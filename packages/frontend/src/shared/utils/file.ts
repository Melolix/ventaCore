import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, storage } from '@/shared/providers/firebase';

/** Content-type de un APK: hace que el navegador lo descargue al abrir la URL. */
export const APK_CONTENT_TYPE = 'application/vnd.android.package-archive';
export const MAX_APK_BYTES = 100 * 1024 * 1024; // 100 MB (coincide con storage.rules)

/** Motivos de rechazo (el componente los mapea a mensajes traducidos). */
export type FileError = 'type' | 'size';

/** Valida que el archivo sea un .apk y no supere el tamaño máximo. */
export function validateApk(file: File): FileError | null {
	const isApk = file.name.toLowerCase().endsWith('.apk') || file.type === APK_CONTENT_TYPE;
	if (!isApk) return 'type';
	if (file.size > MAX_APK_BYTES) return 'size';
	return null;
}

/**
 * Sube un archivo a Firebase Storage bajo uploads/{uid}/{folder}/ y devuelve la
 * URL pública de descarga (la que se guarda en Postgres). Conserva el nombre
 * original (saneado) para que la descarga tenga un nombre reconocible.
 */
export async function uploadFile(file: File, folder: string, contentType?: string): Promise<string> {
	const uid = auth.currentUser?.uid;
	if (!uid) throw new Error('auth');

	// Nombre único: timestamp + sufijo aleatorio + nombre original saneado.
	// Evitamos crypto.randomUUID() (solo existe en contextos seguros/HTTPS).
	const rand = Math.random().toString(36).slice(2, 10);
	const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
	const name = `${Date.now()}-${rand}-${safeName}`;
	const path = `uploads/${uid}/${folder}/${name}`;

	const r = storageRef(storage, path);
	await uploadBytes(r, file, { contentType: contentType || file.type || 'application/octet-stream' });
	return getDownloadURL(r);
}

// El borrado de archivos de Storage se reutiliza de `image.ts` (`deleteImage`),
// que ya funciona con cualquier ruta bajo `uploads/`.
export { deleteImage as deleteFile } from '@/shared/utils/image';
