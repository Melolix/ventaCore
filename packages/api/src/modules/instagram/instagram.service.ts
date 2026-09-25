import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MetaConnectionService } from '../social/meta-connection.service';
import { InstagramMessageEntity } from './entities/instagram-message.entity';

/**
 * Envío SALIENTE a Instagram: responde un DM. Lo llama el entrante de WhatsApp
 * cuando el CM responde citando un aviso con `kind='ig_dm'`.
 *
 * Usa la Messenger Platform (IG vinculado a una Página): `POST /{page-id}/messages`
 * con el destinatario = IGSID del cliente y el Page token del rubro. Funciona dentro
 * de la ventana de 24hs desde el último mensaje del cliente (que es justo el caso).
 */
@Injectable()
export class InstagramService {
	private readonly logger = new Logger(InstagramService.name);

	constructor(
		@InjectRepository(InstagramMessageEntity)
		private readonly messages: Repository<InstagramMessageEntity>,
		private readonly meta: MetaConnectionService,
	) {}

	/** Envía `text` como respuesta al DM `dmId` (por su IGSID). Marca el DM respondido. */
	async sendReply(dmId: string, text: string): Promise<void> {
		const dm = await this.messages.findOne({ where: { id: dmId } });
		if (!dm) throw new NotFoundException('DM de Instagram no encontrado');

		const target = await this.meta.resolveTargetForRubro(dm.rubroId, dm.espacioId);
		const version = process.env.META_GRAPH_VERSION?.trim() || 'v21.0';
		const url = `https://graph.facebook.com/${version}/${target.pageId}/messages?access_token=${encodeURIComponent(target.pageAccessToken)}`;
		const res = await fetch(url, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				recipient: { id: dm.senderId },
				message: { text },
				messaging_type: 'RESPONSE',
			}),
		});
		const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
		if (!res.ok) throw new Error(body.error?.message || `HTTP ${res.status}`);

		dm.status = 'answered';
		await this.messages.save(dm);
	}
}
