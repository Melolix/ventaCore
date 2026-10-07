import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { WhatsappRecipientView } from '@base-template/shared';
import { WhatsappRecipientEntity } from './entities/whatsapp-recipient.entity';

/** Datos para crear/actualizar un destinatario. */
export interface UpsertRecipientInput {
	phoneE164: string;
	role?: string | null;
	displayName?: string | null;
	active?: boolean;
}

/**
 * Destinatarios de WhatsApp por rubro (UNO por rubro). El admin define a quién se
 * le avisan las preguntas de ML de ese rubro.
 */
@Injectable()
export class WhatsappRecipientsService {
	constructor(
		@InjectRepository(WhatsappRecipientEntity)
		private readonly recipients: Repository<WhatsappRecipientEntity>,
	) {}

	/**
	 * Deriva el `wa_id` con el que Meta identifica el contacto en los webhooks.
	 * Para Argentina (móviles) el número es `+54 9 ...` pero Meta lo devuelve SIN
	 * el "9" (`549…` → `54…`). Normalizamos así para poder matchear los entrantes.
	 */
	static toWaId(phoneE164: string): string {
		const digits = phoneE164.replace(/\D/g, '');
		// 54 (país) + 9 (móvil AR) + resto → sacar el 9.
		if (digits.startsWith('549')) return '54' + digits.slice(3);
		return digits;
	}

	/** Devuelve el destinatario del rubro, o null si no hay. */
	async get(rubroId: string, espacioId: string): Promise<WhatsappRecipientView | null> {
		const row = await this.recipients.findOne({ where: { rubroId, espacioId } });
		return row ? WhatsappRecipientsService.toView(row) : null;
	}

	/** Devuelve la entidad del rubro (uso interno del envío), o null. */
	async findEntity(rubroId: string, espacioId: string): Promise<WhatsappRecipientEntity | null> {
		return this.recipients.findOne({ where: { rubroId, espacioId } });
	}

	/** Crea o actualiza el destinatario del rubro (uno por rubro). */
	async upsert(rubroId: string, espacioId: string, input: UpsertRecipientInput): Promise<WhatsappRecipientView> {
		let row = await this.recipients.findOne({ where: { rubroId } });
		if (!row) row = this.recipients.create({ rubroId, espacioId });

		row.espacioId = espacioId;
		row.phoneE164 = input.phoneE164;
		row.waId = WhatsappRecipientsService.toWaId(input.phoneE164);
		row.role = input.role ?? row.role ?? null;
		row.displayName = input.displayName ?? row.displayName ?? null;
		if (input.active != null) row.active = input.active;

		return WhatsappRecipientsService.toView(await this.recipients.save(row));
	}

	/** Elimina el destinatario del rubro. */
	async remove(rubroId: string, espacioId: string): Promise<{ ok: true }> {
		const row = await this.recipients.findOne({ where: { rubroId, espacioId } });
		if (!row) throw new NotFoundException('No hay destinatario configurado para este rubro');
		await this.recipients.remove(row);
		return { ok: true };
	}

	private static toView(r: WhatsappRecipientEntity): WhatsappRecipientView {
		return {
			id: r.id,
			rubroId: r.rubroId,
			phoneE164: r.phoneE164,
			role: r.role,
			displayName: r.displayName,
			active: r.active,
			createdAt: r.createdAt.toISOString(),
		};
	}
}
