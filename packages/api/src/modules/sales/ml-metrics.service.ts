import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { MlMetrics } from '@base-template/shared';
import { MlConnectionService } from '../mercadolibre/ml-connection.service';
import { MlOrderEntity } from './entities/ml-order.entity';
import { MlQuestionEntity } from './entities/ml-question.entity';

/** Ítems de una orden, tal como los guardamos en `raw` (para sumar comisión). */
interface RawOrderItems {
	order_items?: Array<{ quantity?: number; unit_price?: number; sale_fee?: number }>;
}

/**
 * Métricas de la cuenta de Mercado Libre para el dashboard. Junta lo que da la
 * API de ML (publicaciones por estado, visitas de 30 días, reputación) con lo
 * nuestro (ventas y preguntas ya guardadas). Cada llamada externa es tolerante a
 * fallos: si una parte no responde, esa sección va en cero y el resto igual sale.
 */
@Injectable()
export class MlMetricsService {
	private get apiHost(): string {
		return process.env.ML_API_HOST || 'https://api.mercadolibre.com';
	}

	constructor(
		@InjectRepository(MlOrderEntity)
		private readonly orders: Repository<MlOrderEntity>,
		@InjectRepository(MlQuestionEntity)
		private readonly questions: Repository<MlQuestionEntity>,
		private readonly connections: MlConnectionService,
	) {}

	async getMetrics(rubroId: string, espacioId: string): Promise<MlMetrics> {
		const { accessToken, mlUserId } = await this.connections.getValidAccessToken(rubroId, espacioId);

		const [publicaciones, visitas, reputacion, ventas, preguntas] = await Promise.all([
			this.fetchPublicaciones(mlUserId, accessToken),
			this.fetchVisitas(mlUserId, accessToken),
			this.fetchReputacion(mlUserId, accessToken),
			this.computeVentas(rubroId, espacioId),
			this.computePreguntas(rubroId, espacioId),
		]);

		return { publicaciones, ventas, preguntas, visitas, reputacion };
	}

	// ── Desde la API de ML ──

	/** Cantidad de publicaciones por estado (una llamada liviana por estado, limit=1). */
	private async fetchPublicaciones(mlUserId: string, token: string): Promise<MlMetrics['publicaciones']> {
		const count = async (status: string): Promise<number> => {
			const body = await this.mlGet<{ paging?: { total?: number } }>(
				`/users/${mlUserId}/items/search?status=${status}&limit=1`,
				token,
			);
			return body?.paging?.total ?? 0;
		};
		const [active, paused, closed] = await Promise.all([count('active'), count('paused'), count('closed')]);
		return { active, paused, closed, total: active + paused + closed };
	}

	/** Visitas de los últimos 30 días (total + serie diaria) del vendedor. */
	private async fetchVisitas(mlUserId: string, token: string): Promise<MlMetrics['visitas']> {
		const body = await this.mlGet<{ total_visits?: number; results?: Array<{ date?: string; total?: number }> }>(
			`/users/${mlUserId}/items_visits/time_window?last=30&unit=day`,
			token,
		);
		const days = (body?.results ?? []).map(d => ({ date: d.date ?? '', total: d.total ?? 0 }));
		return { total: body?.total_visits ?? 0, days };
	}

	/** Reputación del vendedor. null si ML no la trae. */
	private async fetchReputacion(mlUserId: string, token: string): Promise<MlMetrics['reputacion']> {
		const body = await this.mlGet<{ seller_reputation?: RawReputation }>(`/users/${mlUserId}`, token);
		const s = body?.seller_reputation;
		if (!s) return null;
		const t = s.transactions ?? {};
		const r = t.ratings ?? {};
		const m = s.metrics ?? {};
		return {
			levelId: s.level_id ?? null,
			powerSellerStatus: s.power_seller_status ?? null,
			transactionsTotal: t.total ?? 0,
			transactionsCompleted: t.completed ?? 0,
			transactionsCanceled: t.canceled ?? 0,
			ratingsPositive: r.positive ?? 0,
			ratingsNeutral: r.neutral ?? 0,
			ratingsNegative: r.negative ?? 0,
			claimsRate: m.claims?.rate ?? 0,
			cancellationsRate: m.cancellations?.rate ?? 0,
			delayedHandlingRate: m.delayed_handling_time?.rate ?? 0,
		};
	}

	// ── Desde nuestras tablas ──

	/** Ventas concretadas (status `paid`): cantidad, facturación bruta, comisión y neto. */
	private async computeVentas(rubroId: string, espacioId: string): Promise<MlMetrics['ventas']> {
		const rows = await this.orders.find({ where: { rubroId, espacioId, status: 'paid' } });
		let facturacion = 0;
		let comision = 0;
		let currencyId = 'ARS';
		for (const o of rows) {
			facturacion += o.totalAmount ?? 0;
			if (o.currencyId) currencyId = o.currencyId;
			const items = (o.raw as RawOrderItems | null)?.order_items ?? [];
			for (const it of items) comision += it.sale_fee ?? 0;
		}
		return {
			count: rows.length,
			facturacion: Math.round(facturacion),
			comision: Math.round(comision),
			neto: Math.round(facturacion - comision),
			currencyId,
		};
	}

	/** Preguntas: sin responder / respondidas / tasa de respuesta. */
	private async computePreguntas(rubroId: string, espacioId: string): Promise<MlMetrics['preguntas']> {
		const [unanswered, answered, total] = await Promise.all([
			this.questions.count({ where: { rubroId, espacioId, status: 'UNANSWERED' } }),
			this.questions.count({ where: { rubroId, espacioId, status: 'ANSWERED' } }),
			this.questions.count({ where: { rubroId, espacioId } }),
		]);
		const base = answered + unanswered;
		return { unanswered, answered, total, responseRate: base > 0 ? answered / base : null };
	}

	// ── HTTP ──

	/** GET a ML tolerante a fallos: si no responde OK, devuelve null (la sección va en cero). */
	private async mlGet<T>(path: string, token: string): Promise<T | null> {
		try {
			const res = await fetch(`${this.apiHost}${path}`, {
				headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
			});
			if (!res.ok) return null;
			return (await res.json()) as T;
		} catch {
			return null;
		}
	}
}

/** Forma cruda de `seller_reputation` de ML (solo lo que usamos). */
interface RawReputation {
	level_id?: string | null;
	power_seller_status?: string | null;
	transactions?: {
		total?: number;
		completed?: number;
		canceled?: number;
		ratings?: { positive?: number; neutral?: number; negative?: number };
	};
	metrics?: {
		claims?: { rate?: number };
		cancellations?: { rate?: number };
		delayed_handling_time?: { rate?: number };
	};
}
