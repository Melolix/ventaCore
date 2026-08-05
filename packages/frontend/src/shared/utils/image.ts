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

/** Formato de salida al comprimir. WebP es más liviano; JPEG lo exige Instagram. */
export type ImageFormat = 'webp' | 'jpeg';

/**
 * Redimensiona un canvas (ya recortado al aspecto deseado) a un ancho máximo y
 * lo exporta comprimido.
 *
 * `format` por defecto WebP (más liviano, con transparencia). Para las fotos que
 * se publican en Instagram usamos JPEG, que es el único formato que IG acepta.
 * JPEG no tiene canal alfa: rellenamos el fondo de blanco para que las zonas
 * transparentes no queden negras.
 */
export function canvasToBlob(
	source: HTMLCanvasElement,
	maxWidth: number,
	opts: { format?: ImageFormat; quality?: number } = {},
): Promise<Blob> {
	const { format = 'webp', quality = 0.85 } = opts;
	const scale = Math.min(1, maxWidth / source.width);
	const w = Math.round(source.width * scale);
	const h = Math.round(source.height * scale);

	const out = document.createElement('canvas');
	out.width = w;
	out.height = h;
	const ctx = out.getContext('2d');
	if (!ctx) throw new Error('canvas');
	ctx.imageSmoothingQuality = 'high';
	if (format === 'jpeg') {
		ctx.fillStyle = '#ffffff';
		ctx.fillRect(0, 0, w, h);
	}
	ctx.drawImage(source, 0, 0, w, h);

	const mime = format === 'jpeg' ? 'image/jpeg' : 'image/webp';
	return new Promise((resolve, reject) => {
		out.toBlob(
			blob => {
				if (blob) resolve(blob);
				// Fallback a JPEG si el formato pedido no está disponible.
				else out.toBlob(b => (b ? resolve(b) : reject(new Error('encode'))), 'image/jpeg', quality);
			},
			mime,
			quality,
		);
	});
}

/**
 * Quita el fondo de una imagen 100% en el navegador (@imgly/background-removal,
 * modelo ISNet vía WASM/ONNX). Devuelve un canvas con el objeto recortado sobre
 * fondo TRANSPARENTE; al exportarlo con `canvasToBlob({ format: 'jpeg' })` las
 * zonas transparentes quedan en blanco (ver relleno en esta misma función).
 *
 * La primera vez descarga el modelo (~40 MB) y lo cachea; usá `onProgress` para
 * mostrarle el avance al usuario. El import es dinámico para no cargar la
 * librería (pesada) hasta que alguien realmente use la feature.
 */
export async function removeBackground(
	source: Blob,
	onProgress?: (ratio: number) => void,
): Promise<HTMLCanvasElement> {
	const { removeBackground: imglyRemove } = await import('@imgly/background-removal');
	const cutout = await imglyRemove(source, {
		// fp16: mejor balance calidad/peso de borde para fotos de producto.
		model: 'isnet_fp16',
		output: { format: 'image/png' }, // PNG conserva el canal alfa (transparencia)
		progress: (_key, current, total) => {
			if (onProgress && total > 0) onProgress(current / total);
		},
	});

	const bitmap = await createImageBitmap(cutout);
	const canvas = document.createElement('canvas');
	canvas.width = bitmap.width;
	canvas.height = bitmap.height;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('canvas');
	ctx.drawImage(bitmap, 0, 0);
	bitmap.close();
	return canvas;
}

/**
 * Pipeline completo de "quitar fondo" reutilizable en cualquier lugar donde
 * haya una foto de producto: toma la fuente (un Blob que ya tengamos, o la URL
 * de una imagen ya subida), le quita el fondo, la exporta con fondo blanco y la
 * sube a Storage. Devuelve la URL nueva y el Blob (útil para cachearlo y evitar
 * re-descargas).
 *
 * Nota CORS: si la fuente es una URL de Storage, el `fetch` requiere que el
 * bucket tenga CORS habilitado. Cuando reusamos un Blob en memoria (subida de
 * la misma sesión) no hay problema.
 */
export async function stripBackgroundToUpload(
	source: Blob | string,
	opts: { folder: string; format?: ImageFormat; maxWidth?: number; onProgress?: (ratio: number) => void },
): Promise<{ url: string; blob: Blob }> {
	const input = typeof source === 'string' ? await (await fetch(source)).blob() : source;
	const canvas = await removeBackground(input, opts.onProgress);
	const blob = await canvasToBlob(canvas, opts.maxWidth ?? 1600, { format: opts.format ?? 'jpeg' });
	const url = await uploadImage(blob, opts.folder);
	return { url, blob };
}

/**
 * Sube un blob a Firebase Storage bajo uploads/{uid}/{folder}/ y devuelve la
 * URL pública de descarga (la que se guarda en Postgres).
 */
export async function uploadImage(blob: Blob, folder: string): Promise<string> {
	const uid = auth.currentUser?.uid;
	if (!uid) throw new Error('auth');

	const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
	// Nombre único: timestamp + sufijo aleatorio. Evitamos crypto.randomUUID(),
	// que solo existe en contextos seguros (HTTPS); sobre HTTP plano no está
	// definida y rompía la subida.
	const rand = Math.random().toString(36).slice(2, 10);
	const name = `${Date.now()}-${rand}.${ext}`;
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
