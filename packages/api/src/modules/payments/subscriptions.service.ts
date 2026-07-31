import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { PaymentProvider, RubroStatus, type SubscribableRubroPublic } from '@base-template/shared';
import { EspaciosService } from '../spaces/espacios.service';
import { RubroEntity } from '../catalog/entities/rubro.entity';
import { PaymentConfigService } from './payment-config.service';
import { SubscriptionPlansService } from './subscription-plans.service';
import { SubscriptionPlanEntity } from './entities/subscription-plan.entity';
import { SubscriptionEntity } from './entities/subscription.entity';
import { SubscriptionEventEntity } from './entities/subscription-event.entity';
import { PaymentProviderRegistry } from './providers/payment-provider.registry';
import { NormalizedSubscriptionEvent } from './providers/payment-provider.interface';
import { CreateCheckoutDto } from './dto/create-checkout.dto';

const PG_UNIQUE_VIOLATION = '23505';

@Injectable()
export class SubscriptionsService {
	private readonly logger = new Logger(SubscriptionsService.name);

	constructor(
		@InjectRepository(SubscriptionPlanEntity)
		private readonly plans: Repository<SubscriptionPlanEntity>,
		@InjectRepository(SubscriptionEntity)
		private readonly subs: Repository<SubscriptionEntity>,
		@InjectRepository(SubscriptionEventEntity)
		private readonly events: Repository<SubscriptionEventEntity>,
		@InjectRepository(RubroEntity)
		private readonly rubros: Repository<RubroEntity>,
		private readonly espacios: EspaciosService,
		private readonly config: PaymentConfigService,
		private readonly registry: PaymentProviderRegistry,
	) {}

	// ── Público: listado de rubros suscribibles ──

	/** Rubros activos con suscripción habilitada del negocio del host, con sus planes. */
	async listSubscribableByHost(host: string): Promise<SubscribableRubroPublic[]> {
		const espacio = await this.espacios.resolveByHost(host);
		const rubros = await this.rubros.find({
			where: { espacioId: espacio.id, status: RubroStatus.ACTIVE, subscriptionsEnabled: true },
			order: { createdAt: 'DESC' },
		});

		const out: SubscribableRubroPublic[] = [];
		for (const r of rubros) {
			const plans = await this.plans.find({
				where: { rubroId: r.id, active: true },
				order: { orden: 'ASC', createdAt: 'ASC' },
			});
			if (!plans.length) continue;
			out.push({
				rubro: { id: r.id, nombre: r.nombre, descripcion: r.descripcion, imageUrl: r.imageUrl, logoUrl: r.logoUrl },
				plans: plans.map(SubscriptionPlansService.toPublic),
			});
		}
		return out;
	}

	// ── Público: iniciar checkout ──

	/**
	 * Crea el checkout hosteado del proveedor para un plan. No escribe en la base:
	 * la suscripción se registra cuando llega el webhook (fuente de verdad).
	 * `origin` es el sitio desde el que se pide (para el redirect de vuelta).
	 */
	async createCheckout(dto: CreateCheckoutDto, origin: string | null): Promise<{ checkoutUrl: string }> {
		const plan = await this.plans.findOne({ where: { id: dto.planId, active: true } });
		if (!plan) throw new NotFoundException('Plan no encontrado o inactivo');
		if (!plan.providerVariantId) {
			throw new BadRequestException('El plan todavía no está vinculado a un producto del proveedor');
		}

		const creds = await this.config.getCredentials(plan.espacioId, plan.provider);
		const provider = this.registry.get(plan.provider);

		const out = await provider.createCheckout({
			apiKey: creds.apiKey,
			storeId: creds.storeId,
			variantId: plan.providerVariantId,
			email: dto.email,
			name: dto.name ?? null,
			returnUrl: origin ? `${origin.replace(/\/$/, '')}/suscripciones/gracias` : null,
			custom: { espacio_id: plan.espacioId, rubro_id: plan.rubroId, plan_id: plan.id },
		});

		return { checkoutUrl: out.checkoutUrl };
	}

	// ── Webhook: fuente de verdad del estado ──

	/**
	 * Procesa un webhook del proveedor para un espacio. Verifica la firma con el
	 * secret de ESE espacio, deduplica por evento y hace upsert de la suscripción.
	 */
	async handleWebhook(
		espacioId: string,
		provider: PaymentProvider,
		rawBody: Buffer | undefined,
		headers: Record<string, string | string[] | undefined>,
	): Promise<void> {
		if (!rawBody || !rawBody.length) throw new BadRequestException('Webhook sin cuerpo');

		const creds = await this.config.getCredentials(espacioId, provider);
		if (!creds.webhookSecret) {
			throw new BadRequestException('El negocio no configuró el signing secret del webhook');
		}

		const impl = this.registry.get(provider);
		if (!impl.verifyWebhook(rawBody, headers, creds.webhookSecret)) {
			throw new BadRequestException('Firma de webhook inválida');
		}

		const event = impl.parseWebhookEvent(rawBody);
		if (!event) {
			this.logger.warn(`Webhook de ${provider} ilegible para espacio ${espacioId}`);
			return;
		}

		// Idempotencia: el insert único es el guard. Si ya se procesó, salimos.
		let eventRow: SubscriptionEventEntity;
		try {
			eventRow = await this.events.save(
				this.events.create({
					provider,
					providerEventId: event.providerEventId,
					eventType: event.eventType,
					payload: event.raw,
					subscriptionId: null,
				}),
			);
		} catch (err) {
			if (err instanceof QueryFailedError && (err.driverError as { code?: string })?.code === PG_UNIQUE_VIOLATION) {
				return; // evento repetido
			}
			throw err;
		}

		const subscription = await this.upsertSubscription(espacioId, provider, event);
		if (subscription) {
			eventRow.subscriptionId = subscription.id;
			await this.events.save(eventRow);
		}
	}

	/** Crea o actualiza la suscripción a partir de un evento normalizado. */
	private async upsertSubscription(
		espacioId: string,
		provider: PaymentProvider,
		event: NormalizedSubscriptionEvent,
	): Promise<SubscriptionEntity | null> {
		if (!event.providerSubscriptionId) return null;

		// El espacioId de confianza es el del path (atado al secret verificado).
		const planId = event.custom.planId ?? null;
		const plan = planId ? await this.plans.findOne({ where: { id: planId, espacioId } }) : null;

		let sub = await this.subs.findOne({
			where: { provider, providerSubscriptionId: event.providerSubscriptionId },
		});
		if (!sub) {
			sub = this.subs.create({
				espacioId,
				rubroId: plan?.rubroId ?? event.custom.rubroId ?? '',
				planId,
				provider,
				providerSubscriptionId: event.providerSubscriptionId,
			});
		}

		if (event.providerCustomerId) sub.providerCustomerId = event.providerCustomerId;
		if (event.subscriberEmail) sub.subscriberEmail = event.subscriberEmail;
		if (event.subscriberName) sub.subscriberName = event.subscriberName;
		if (event.status) sub.status = event.status;
		if (event.currentPeriodEnd) sub.currentPeriodEnd = event.currentPeriodEnd;
		sub.cancelledAt = event.cancelledAt;
		if (plan) {
			sub.planId = plan.id;
			sub.rubroId = plan.rubroId;
			sub.precio = plan.precio;
			sub.moneda = plan.moneda;
		}
		sub.metadata = event.raw;

		// Garantiza un email aunque el evento no lo traiga (columna NOT NULL).
		if (!sub.subscriberEmail) sub.subscriberEmail = event.custom.email ?? 'desconocido@sin-email';

		return this.subs.save(sub);
	}
}
