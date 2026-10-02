import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { DespachoConfig, Direccion, EnvioOpcion, Paquete } from '@base-template/shared';
import { RubroEntity } from './entities/rubro.entity';

/** Transportistas nacionales que se cotizan si no se pudo leer la lista de la cuenta. */
const CARRIERS_FALLBACK = ['andreani', 'correoArgentino', 'oca', 'urbano'];
/** Cuánto esperamos a cada transportista antes de seguir sin él. */
const RATE_TIMEOUT_MS = 12_000;
const CARRIERS_TTL_MS = 6 * 60 * 60 * 1000;

interface EnviaRate {
	carrier?: string;
	service?: string;
	serviceDescription?: string;
	totalPrice?: number | string;
	deliveryEstimate?: string;
}

function baseUrl(host: string | undefined, fallback: string): string {
	const h = (host ?? '').trim() || fallback;
	return (/^https?:\/\//.test(h) ? h : `https://${h}`).replace(/\/$/, '');
}

/**
 * Cliente de envia.com (cotización de envíos). Usa la cuenta de la plataforma
 * (`ENVIA_TOKEN`) salvo que el rubro haya conectado la suya.
 */
@Injectable()
export class EnviaService {
	private readonly logger = new Logger(EnviaService.name);
	private carriersCache: { at: number; list: string[] } | null = null;

	constructor(
		@InjectRepository(RubroEntity)
		private readonly rubros: Repository<RubroEntity>,
	) {}

	/**
	 * Entorno de PRUEBAS de envia (`ENVIA_SANDBOX=true`, lo normal en desarrollo):
	 * otros hosts y otro token. Ahí se cotiza y se generan etiquetas sin gastar
	 * saldo. Los tokens no se cruzan: el de pruebas no sirve en producción ni al revés.
	 */
	get sandbox(): boolean {
		return process.env.ENVIA_SANDBOX === 'true';
	}
	private get apiHost(): string {
		if (this.sandbox) return 'https://api-test.envia.com';
		return baseUrl(process.env.ENVIA_API_HOST, 'https://api.envia.com');
	}
	private get queriesHost(): string {
		if (this.sandbox) return 'https://queries-test.envia.com';
		return baseUrl(process.env.ENVIA_QUERIES_HOST, 'https://queries.envia.com');
	}
	private get platformToken(): string | null {
		if (this.sandbox) return (process.env.ENVIA_TOKEN_PRUEBA ?? process.env.envia_token_prueba)?.trim() || null;
		return process.env.ENVIA_TOKEN?.trim() || null;
	}

	/** ¿Hay cuenta de la plataforma configurada? */
	get platformReady(): boolean {
		return !!this.platformToken;
	}

	/** Token con el que opera el rubro: el propio si lo conectó; si no, el de la plataforma. */
	private async tokenFor(rubro: RubroEntity): Promise<string | null> {
		if (rubro.enviaPropia) {
			const row = await this.rubros
				.createQueryBuilder('r')
				.addSelect('r.enviaToken')
				.where('r.id = :id', { id: rubro.id })
				.getOne();
			if (row?.enviaToken) return row.enviaToken;
		}
		return this.platformToken;
	}

	/** ¿El rubro puede cotizar? Necesita dirección de despacho y alguna cuenta. */
	activo(rubro: RubroEntity): boolean {
		return !!rubro.despacho?.cp && (rubro.enviaPropia || this.platformReady);
	}

	/** Transportistas disponibles en Argentina (cacheado; con respaldo si falla). */
	private async carriers(token: string): Promise<string[]> {
		if (this.carriersCache && Date.now() - this.carriersCache.at < CARRIERS_TTL_MS) return this.carriersCache.list;
		try {
			const res = await fetch(`${this.queriesHost}/carrier?country_code=AR`, {
				headers: { Authorization: `Bearer ${token}` },
				signal: AbortSignal.timeout(8000),
			});
			const json = (await res.json()) as { data?: { name?: string }[] };
			const list = (json.data ?? []).map(c => c.name).filter((n): n is string => !!n);
			if (list.length) {
				this.carriersCache = { at: Date.now(), list };
				return list;
			}
		} catch (e: unknown) {
			this.logger.warn(`No se pudo leer la lista de transportistas: ${e instanceof Error ? e.message : e}`);
		}
		return CARRIERS_FALLBACK;
	}

	/** Cotiza con UN transportista. Devuelve [] si no cubre el trayecto o falla. */
	private async rate(
		token: string,
		carrier: string,
		origen: DespachoConfig,
		destino: Direccion,
		paquete: Paquete,
		valorDeclarado: number,
	): Promise<EnvioOpcion[]> {
		const address = (name: string, phone: string, d: Direccion) => ({
			name,
			company: '',
			email: '',
			phone,
			street: d.calle,
			number: d.numero,
			district: '',
			city: d.ciudad,
			state: d.provincia,
			country: 'AR',
			postalCode: d.cp,
			reference: d.referencia ?? '',
		});
		const body = {
			origin: address(origen.nombre, origen.telefono, origen),
			// Al cotizar todavía no hay datos del cliente; algunos transportistas (DHL)
			// exigen un teléfono en el destino, así que va el del despacho de relleno.
			destination: address('Cliente', origen.telefono, destino),
			packages: [
				{
					content: 'Productos',
					amount: 1,
					type: 'box',
					dimensions: { length: paquete.largo, width: paquete.ancho, height: paquete.alto },
					weight: Math.max(0.1, Math.round(paquete.peso / 100) / 10), // g → kg (1 decimal)
					insurance: 0,
					declaredValue: Math.round(valorDeclarado),
					weightUnit: 'KG',
					lengthUnit: 'CM',
				},
			],
			shipment: { carrier, type: 1 },
			settings: { currency: 'ARS' },
		};
		try {
			const res = await fetch(`${this.apiHost}/ship/rate/`, {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
				signal: AbortSignal.timeout(RATE_TIMEOUT_MS),
			});
			const json = (await res.json()) as { data?: EnviaRate[] };
			if (!Array.isArray(json.data)) return []; // sin cobertura / error del transportista
			return json.data
				.filter(r => r.service && Number(r.totalPrice) > 0)
				.map(r => ({
					id: `${carrier}:${r.service}`,
					carrier,
					service: String(r.service),
					nombre: r.serviceDescription?.trim() || `${carrier} ${r.service}`,
					precio: Math.round(Number(r.totalPrice)),
					plazo: r.deliveryEstimate?.trim() || null,
				}));
		} catch (e: unknown) {
			this.logger.warn(`Cotización con ${carrier} falló: ${e instanceof Error ? e.message : e}`);
			return [];
		}
	}

	/** Todas las opciones de envío para ese destino y paquete, de la más barata a la más cara. */
	async cotizar(rubro: RubroEntity, destino: Direccion, paquete: Paquete, valorDeclarado: number): Promise<EnvioOpcion[]> {
		const token = await this.tokenFor(rubro);
		if (!token || !rubro.despacho) return [];
		const carriers = await this.carriers(token);
		const origen = rubro.despacho;
		const results = await Promise.all(carriers.map(c => this.rate(token, c, origen, destino, paquete, valorDeclarado)));
		return results.flat().sort((a, b) => a.precio - b.precio);
	}

	/** Re-cotiza UNA opción (al crear el pedido: el precio lo fija el servidor, no el cliente). */
	async cotizarOpcion(
		rubro: RubroEntity,
		destino: Direccion,
		paquete: Paquete,
		valorDeclarado: number,
		opcionId: string,
	): Promise<EnvioOpcion | null> {
		const token = await this.tokenFor(rubro);
		if (!token || !rubro.despacho) return null;
		const [carrier] = opcionId.split(':');
		const opciones = await this.rate(token, carrier, rubro.despacho, destino, paquete, valorDeclarado);
		return opciones.find(o => o.id === opcionId) ?? null;
	}
}
