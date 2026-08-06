import { randomBytes, randomUUID } from 'node:crypto';
import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	NotFoundException,
	OnModuleDestroy,
	PayloadTooLargeException,
} from '@nestjs/common';
import { FirebaseService } from '../../common/firebase/firebase.service';

/** Ventana de vida de una sesión de subida por QR. */
const TTL_MS = 10 * 60 * 1000; // 10 minutos
/** Tope de fotos por sesión (acota abuso del endpoint público). */
const MAX_IMAGES = 12;
/** Peso máximo por foto (alineado con el límite del frontend). */
const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Archivo recibido por multer (subconjunto que usamos, evita depender de @types/multer). */
export interface UploadedImage {
	buffer: Buffer;
	mimetype: string;
	size: number;
}

interface HandoffSession {
	id: string;
	/** Dueño (uid del admin que abrió la sesión desde la compu). */
	uid: string;
	/** Token de la sesión: el celular lo presenta para poder subir. */
	token: string;
	/** URLs de las fotos subidas desde el celular, en orden. */
	images: string[];
	expiresAt: number;
}

/**
 * Handoff compu → celular: la compu (logueada) abre una sesión efímera y muestra
 * un QR; el celular (sin login) sube fotos validando el token de la sesión; la
 * compu consulta por polling las fotos que van llegando.
 *
 * Estado EN MEMORIA (v1): las sesiones son efímeras (10 min) y no vale la pena
 * persistirlas. Si se escala a varias instancias del API habría que moverlo a un
 * store compartido (Redis/DB).
 */
@Injectable()
export class HandoffService implements OnModuleDestroy {
	private readonly sessions = new Map<string, HandoffSession>();
	private readonly sweeper: NodeJS.Timeout;

	constructor(private readonly firebase: FirebaseService) {
		// Limpieza periódica de sesiones vencidas (además del chequeo perezoso).
		this.sweeper = setInterval(() => this.sweep(), 60_000);
		this.sweeper.unref?.();
	}

	onModuleDestroy(): void {
		clearInterval(this.sweeper);
	}

	private sweep(): void {
		const now = Date.now();
		for (const [id, s] of this.sessions) {
			if (s.expiresAt <= now) this.sessions.delete(id);
		}
	}

	private getActive(id: string): HandoffSession {
		const s = this.sessions.get(id);
		if (!s || s.expiresAt <= Date.now()) {
			throw new NotFoundException('La sesión de subida no existe o expiró');
		}
		return s;
	}

	/** La compu abre una sesión. Devuelve id + token (para armar el link del QR). */
	create(uid: string): { id: string; token: string; expiresAt: number } {
		const id = randomUUID();
		const token = randomBytes(24).toString('base64url');
		const session: HandoffSession = { id, uid, token, images: [], expiresAt: Date.now() + TTL_MS };
		this.sessions.set(id, session);
		return { id, token, expiresAt: session.expiresAt };
	}

	/** El celular sube una foto (valida token, tipo y peso) y la guarda en Storage. */
	async addPhoto(id: string, token: string, file: UploadedImage | undefined): Promise<{ url: string }> {
		const session = this.getActive(id);
		if (!token || token !== session.token) throw new ForbiddenException('Token de subida inválido');
		if (session.images.length >= MAX_IMAGES) throw new ForbiddenException('Se alcanzó el máximo de fotos');
		if (!file?.buffer?.length) throw new BadRequestException('No se recibió ninguna imagen');
		if (!ACCEPTED_TYPES.includes(file.mimetype)) throw new BadRequestException('Formato no permitido (usá JPG, PNG o WebP)');
		if (file.size > MAX_BYTES) throw new PayloadTooLargeException('La imagen supera el tamaño máximo (8 MB)');

		const ext = file.mimetype === 'image/png' ? 'png' : file.mimetype === 'image/webp' ? 'webp' : 'jpg';
		const name = `${Date.now()}-${randomBytes(6).toString('hex')}.${ext}`;
		const path = `uploads/handoff/${id}/${name}`;
		const url = await this.firebase.uploadImage(path, file.buffer, file.mimetype);
		session.images.push(url);
		return { url };
	}

	/** La compu consulta el estado de la sesión (fotos llegadas). Solo el dueño. */
	poll(id: string, uid: string): { images: string[]; expiresAt: number } {
		const session = this.getActive(id);
		if (session.uid !== uid) throw new ForbiddenException('La sesión no te pertenece');
		return { images: session.images, expiresAt: session.expiresAt };
	}
}
