import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { MlQuestionView, MlQuestionsSyncResult } from '@base-template/shared';
import { MlConnectionService } from '../mercadolibre/ml-connection.service';
import { ProductoEntity } from '../catalog/entities/producto.entity';
import { MlQuestionEntity } from './entities/ml-question.entity';

/** Forma cruda de una pregunta de Mercado Libre (solo lo que usamos). */
interface RawMlQuestion {
	id?: number | string;
	text?: string;
	status?: string;
	date_created?: string;
	item_id?: string;
	from?: { id?: number | string };
	answer?: { text?: string; status?: string; date_created?: string } | null;
}

/**
 * Preguntas de Mercado Libre respondibles desde la app. Trae las preguntas (por
 * webhook o backfill), las persiste, y publica la respuesta en ML (POST /answers)
 * reflejándola localmente.
 *
 * Reutiliza `MlConnectionService.getValidAccessToken` para el token del rubro.
 */
@Injectable()
export class MlQuestionsService {
	private get apiHost(): string {
		return process.env.ML_API_HOST || 'https://api.mercadolibre.com';
	}

	constructor(
		@InjectRepository(MlQuestionEntity)
		private readonly questions: Repository<MlQuestionEntity>,
		@InjectRepository(ProductoEntity)
		private readonly productos: Repository<ProductoEntity>,
		private readonly connections: MlConnectionService,
	) {}

	// ── Entrada por webhook ──

	/**
	 * Procesa una notificación `questions`: extrae el id del resource
	 * (`/questions/123` → `123`), la trae de ML y la upsertea.
	 */
	async handleQuestionNotification(resource: string, owner: { rubroId: string; espacioId: string }): Promise<void> {
		const mlQuestionId = resource.split('/').filter(Boolean).pop() ?? '';
		if (!mlQuestionId) throw new Error(`Resource de pregunta inválido: ${resource}`);
		const raw = await this.fetchQuestion(owner.rubroId, owner.espacioId, mlQuestionId);
		await this.upsertFromMl(owner.rubroId, owner.espacioId, raw);
	}

	// ── Backfill ──

	/**
	 * Trae las preguntas del vendedor (`/questions/search`) y las upsertea. Sirve
	 * para llenar el panel y reconciliar avisos perdidos. Pagina con un techo.
	 */
	async backfill(rubroId: string, espacioId: string): Promise<MlQuestionsSyncResult> {
		const { accessToken, mlUserId } = await this.connections.getValidAccessToken(rubroId, espacioId);
		if (!mlUserId) throw new BadRequestException('La conexión de Mercado Libre no tiene user_id; reconectá la cuenta');

		const limit = 50;
		const MAX_PAGES = 20;
		let offset = 0;
		let total = 0;
		let imported = 0;

		for (let page = 0; page < MAX_PAGES; page++) {
			const params = new URLSearchParams({
				seller_id: mlUserId,
				sort_fields: 'date_created',
				sort_types: 'DESC',
				limit: String(limit),
				offset: String(offset),
			});
			const res = await fetch(`${this.apiHost}/questions/search?${params.toString()}`, {
				headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' },
			});
			const body = (await res.json().catch(() => ({}))) as {
				questions?: RawMlQuestion[];
				total?: number;
				message?: string;
			};
			if (!res.ok) throw new BadRequestException(`No se pudieron sincronizar las preguntas: ${body.message || res.statusText}`);

			const results = body.questions ?? [];
			total = body.total ?? total;
			for (const raw of results) {
				await this.upsertFromMl(rubroId, espacioId, raw);
				imported++;
			}
			offset += limit;
			if (results.length < limit || offset >= total) break;
		}

		return { imported, total };
	}

	// ── Responder ──

	/**
	 * Publica la respuesta en ML (`POST /answers`) y refleja el cambio local.
	 * `questionId` es el id interno (uuid), scopeado por rubro/espacio.
	 */
	async answer(rubroId: string, espacioId: string, questionId: string, text: string): Promise<MlQuestionView> {
		const clean = text?.trim();
		if (!clean) throw new BadRequestException('La respuesta no puede estar vacía');

		const question = await this.questions.findOne({ where: { id: questionId, rubroId, espacioId } });
		if (!question) throw new NotFoundException('Pregunta no encontrada');
		if (question.status === 'ANSWERED') throw new BadRequestException('Esa pregunta ya fue respondida');

		const { accessToken } = await this.connections.getValidAccessToken(rubroId, espacioId);
		const res = await fetch(`${this.apiHost}/answers`, {
			method: 'POST',
			headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json', accept: 'application/json' },
			body: JSON.stringify({ question_id: question.mlQuestionId, text: clean }),
		});
		const body = (await res.json().catch(() => ({}))) as { message?: string };
		if (!res.ok) throw new BadRequestException(`Mercado Libre no aceptó la respuesta: ${body.message || res.statusText}`);

		question.status = 'ANSWERED';
		question.answerText = clean;
		question.answeredAt = new Date();
		await this.questions.save(question);

		return (await this.list(rubroId, espacioId, { ids: [question.id] }))[0];
	}

	// ── Lectura para el panel ──

	/**
	 * Lista las preguntas del rubro (scopeadas por espacio). Resuelve el nombre del
	 * producto propio por `mlItemId` para mostrarlo en el panel.
	 */
	async list(
		rubroId: string,
		espacioId: string,
		filters: { status?: string; limit?: number; offset?: number; ids?: string[] },
	): Promise<MlQuestionView[]> {
		const where: Record<string, unknown> = { rubroId, espacioId };
		if (filters.status) where.status = filters.status;
		if (filters.ids) where.id = In(filters.ids);

		const rows = await this.questions.find({
			where,
			order: { dateCreated: 'DESC' },
			take: filters.ids ? undefined : (filters.limit ?? 100),
			skip: filters.ids ? undefined : (filters.offset ?? 0),
		});

		const itemIds = [...new Set(rows.map(r => r.mlItemId).filter(Boolean))];
		const prods = itemIds.length ? await this.productos.find({ where: { rubroId, mlItemId: In(itemIds) } }) : [];
		const nameByItem = new Map(prods.map(p => [p.mlItemId as string, p.nombre]));

		return rows.map(r => MlQuestionsService.toView(r, nameByItem.get(r.mlItemId) ?? null));
	}

	// ── Helpers ──

	private async fetchQuestion(rubroId: string, espacioId: string, mlQuestionId: string): Promise<RawMlQuestion> {
		const { accessToken } = await this.connections.getValidAccessToken(rubroId, espacioId);
		const res = await fetch(`${this.apiHost}/questions/${mlQuestionId}`, {
			headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' },
		});
		const body = (await res.json().catch(() => ({}))) as RawMlQuestion & { message?: string };
		if (!res.ok) throw new Error(`No se pudo traer la pregunta ${mlQuestionId}: ${body.message || res.statusText}`);
		return body;
	}

	/** Upsert por `mlQuestionId`. Mapea los campos de ML a la entidad. */
	private async upsertFromMl(rubroId: string, espacioId: string, raw: RawMlQuestion): Promise<MlQuestionEntity> {
		const mlQuestionId = raw.id != null ? String(raw.id) : '';
		if (!mlQuestionId) throw new Error('Pregunta de Mercado Libre sin id');

		let question = await this.questions.findOne({ where: { mlQuestionId } });
		if (!question) question = this.questions.create({ mlQuestionId, rubroId, espacioId });

		question.rubroId = rubroId;
		question.espacioId = espacioId;
		question.mlItemId = raw.item_id ?? question.mlItemId ?? '';
		question.text = raw.text ?? question.text ?? '';
		question.status = raw.status ?? 'UNANSWERED';
		question.fromId = raw.from?.id != null ? String(raw.from.id) : null;
		question.dateCreated = raw.date_created ? new Date(raw.date_created) : null;
		question.answerText = raw.answer?.text ?? null;
		question.answeredAt = raw.answer?.date_created ? new Date(raw.answer.date_created) : null;
		question.raw = raw as unknown as Record<string, unknown>;

		return this.questions.save(question);
	}

	private static toView(q: MlQuestionEntity, itemTitle: string | null): MlQuestionView {
		return {
			id: q.id,
			mlQuestionId: q.mlQuestionId,
			mlItemId: q.mlItemId,
			itemTitle,
			text: q.text,
			status: q.status,
			answerText: q.answerText,
			dateCreated: q.dateCreated ? q.dateCreated.toISOString() : null,
			answeredAt: q.answeredAt ? q.answeredAt.toISOString() : null,
		};
	}
}
