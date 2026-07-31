import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentProvider, type PaymentProviderConfigPublic } from '@base-template/shared';
import { TokenCryptoService } from '../../common/crypto/token-crypto.service';
import { PaymentProviderConfigEntity } from './entities/payment-provider-config.entity';
import { SavePaymentConfigDto } from './dto/save-payment-config.dto';

/** Credenciales descifradas del proveedor (uso interno del backend). */
export interface PaymentCredentials {
	apiKey: string;
	storeId: string | null;
	webhookSecret: string | null;
}

/** Segmento de URL del webhook de cada proveedor. */
const WEBHOOK_PATH: Record<PaymentProvider, string> = {
	[PaymentProvider.LEMON_SQUEEZY]: 'lemon-squeezy',
	[PaymentProvider.MERCADO_PAGO]: 'mercado-pago',
};

@Injectable()
export class PaymentConfigService {
	constructor(
		@InjectRepository(PaymentProviderConfigEntity)
		private readonly configs: Repository<PaymentProviderConfigEntity>,
		private readonly crypto: TokenCryptoService,
	) {}

	/** Config (vista pública, sin secretos) de un espacio para un proveedor. */
	async getPublic(espacioId: string, provider: PaymentProvider): Promise<PaymentProviderConfigPublic | null> {
		const config = await this.configs.findOne({ where: { espacioId, provider } });
		return config ? this.toPublic(config) : this.emptyPublic(espacioId, provider);
	}

	/** Guarda (upsert) las credenciales. Conserva los secretos previos si no vienen. */
	async save(espacioId: string, dto: SavePaymentConfigDto): Promise<PaymentProviderConfigPublic> {
		let config = await this.configs.findOne({ where: { espacioId, provider: dto.provider } });
		if (!config) {
			config = this.configs.create({ espacioId, provider: dto.provider });
		}

		if (dto.apiKey !== undefined) {
			config.apiKey = dto.apiKey.trim() ? this.crypto.encrypt(dto.apiKey.trim()) : null;
		}
		if (dto.webhookSecret !== undefined) {
			config.webhookSecret = dto.webhookSecret.trim() ? this.crypto.encrypt(dto.webhookSecret.trim()) : null;
		}
		if (dto.storeId !== undefined) config.storeId = dto.storeId.trim() || null;
		if (dto.active !== undefined) config.active = dto.active;

		config = await this.configs.save(config);
		return this.toPublic(config);
	}

	/** Credenciales descifradas para operar contra el proveedor. Lanza si no están completas. */
	async getCredentials(espacioId: string, provider: PaymentProvider): Promise<PaymentCredentials> {
		const config = await this.configs.findOne({ where: { espacioId, provider } });
		if (!config || !config.apiKey) {
			throw new BadRequestException('El negocio todavía no configuró sus credenciales de cobro');
		}
		return {
			apiKey: this.crypto.decrypt(config.apiKey),
			storeId: config.storeId,
			webhookSecret: config.webhookSecret ? this.crypto.decrypt(config.webhookSecret) : null,
		};
	}

	// ── Helpers ──

	/** URL que el negocio pega en el dashboard del proveedor (incluye el prefijo global de la API). */
	private webhookUrl(espacioId: string, provider: PaymentProvider): string {
		const base = (process.env.PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');
		const prefix = process.env.API_PREFIX || 'api';
		return `${base}/${prefix}/webhooks/${WEBHOOK_PATH[provider]}/${espacioId}`;
	}

	private toPublic(config: PaymentProviderConfigEntity): PaymentProviderConfigPublic {
		return {
			id: config.id,
			espacioId: config.espacioId,
			provider: config.provider,
			storeId: config.storeId,
			hasApiKey: !!config.apiKey,
			hasWebhookSecret: !!config.webhookSecret,
			webhookUrl: this.webhookUrl(config.espacioId, config.provider),
			active: config.active,
			createdAt: config.createdAt.toISOString(),
			updatedAt: config.updatedAt.toISOString(),
		};
	}

	/** Vista "vacía" cuando el negocio todavía no cargó nada (para que el panel muestre la URL). */
	private emptyPublic(espacioId: string, provider: PaymentProvider): PaymentProviderConfigPublic {
		const now = new Date().toISOString();
		return {
			id: '',
			espacioId,
			provider,
			storeId: null,
			hasApiKey: false,
			hasWebhookSecret: false,
			webhookUrl: this.webhookUrl(espacioId, provider),
			active: false,
			createdAt: now,
			updatedAt: now,
		};
	}
}
