import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { auth, storage } from '@/shared/providers/firebase';

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 MB

export interface ImageValidation {
	/** Ancho/alto mínimos aceptados (evita fotos que quedarían borrosas). */
	minWidth?: number;
	minHeight?: number;
}

/** Motivos de rechazo (el componente los mapea a mensajes traducidos). */
export type ImageError = 'type' | 'size' | 'dimensions' | 'decode';

/** Valida tipo y peso del archivo antes de siquiera decodificarlo. */
export function validateFile(file: File): ImageError | null {
	if (!ACCEPTED_TYPES.includes(file.type)) return 'type';
	if (file.size > MAX_FILE_BYTES) return 'size';
	return null;
}

/** Carga un archivo a un HTMLImageElement (para leer dimensiones y recortar). */
export function loadImage(file: File): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(file);
		const img = new Image();
		img.onload = () => {
			resolve(img);
			// El objectURL se libera cuando el consumidor termina; lo revoca abajo.
		};
		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error('decode'));
		};
		img.src = url;
	});
}

/** Verifica dimensiones mínimas de una imagen ya cargada. */
export function checkDimensions(img: HTMLImageElement, v: ImageValidation): ImageError | null {
	if (v.minWidth && img.naturalWidth < v.minWidth) return 'dimensions';
	if (v.minHeight && img.naturalHeight < v.minHeight) return 'dimensions';
	return null;
}

/**
 * Redimensiona un canvas (ya recortado al aspecto deseado) a un ancho máximo y
 * lo exporta comprimido. Prefiere WebP; si el navegador no lo soporta, JPEG.
 */
export function canvasToBlob(source: HTMLCanvasElement, maxWidth: number, quality = 0.85): Promise<Blob> {
	const scale = Math.min(1, maxWidth / source.width);
	const w = Math.round(source.width * scale);
	const h = Math.round(source.height * scale);

	const out = document.createElement('canvas');
	out.width = w;
	out.height = h;
	const ctx = out.getContext('2d');
	if (!ctx) throw new Error('canvas');
	ctx.imageSmoothingQuality = 'high';
	ctx.drawImage(source, 0, 0, w, h);

	return new Promise((resolve, reject) => {
		out.toBlob(
			blob => {
				if (blob) resolve(blob);
				// Fallback a JPEG si WebP no está disponible.
				else out.toBlob(b => (b ? resolve(b) : reject(new Error('encode'))), 'image/jpeg', quality);
			},
			'image/webp',
			quality,
		);
	});
}

/**
 * Sube un blob a Firebase Storage bajo uploads/{uid}/{folder}/ y devuelve la
 * URL pública de descarga (la que se guarda en Postgres).
 */
export async function uploadImage(blob: Blob, folder: string): Promise<string> {
	const uid = auth.currentUser?.uid;
	if (!uid) throw new Error('auth');

	const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
	// Nombre único sin depender de Date.now(): timestamp + aleatorio del navegador.
	const name = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
	const path = `uploads/${uid}/${folder}/${name}`;

	const r = storageRef(storage, path);
	await uploadBytes(r, blob, { contentType: blob.type });
	return getDownloadURL(r);
}

/**
 * Borra un archivo de NUESTRO Storage a partir de su URL de descarga.
 * Best-effort: ignora URLs externas (ej. las del seed) y errores (archivo
 * inexistente, etc.). Extrae el path de `.../o/{path}?...` para funcionar tanto
 * en el emulador como en producción.
 */
export async function deleteImage(url: string | null | undefined): Promise<void> {
	if (!url) return;
	const m = url.match(/\/o\/(uploads(?:%2F|\/)[^?]+)/);
	if (!m) return; // no es un archivo nuestro
	try {
		await deleteObject(storageRef(storage, decodeURIComponent(m[1])));
	} catch {
		/* best-effort: puede no existir o fallar; no es crítico */
	}
}
