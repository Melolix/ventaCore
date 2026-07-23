import type { AxiosError } from 'axios';

/**
 * Extrae un mensaje legible del error de una request para mostrarle al usuario
 * qué salió mal. Prioriza el `message` del backend (NestJS), que puede ser un
 * string o un array (errores de validación). Si no hay respuesta del servidor
 * (ej. red caída), cae al `fallback` provisto.
 */
export function apiErrorMessage(e: unknown, fallback: string): string {
	const msg = (e as AxiosError<{ message?: string | string[] }>)?.response?.data?.message;
	if (Array.isArray(msg)) {
		const joined = msg.filter(Boolean).join('. ');
		if (joined) return joined;
	} else if (typeof msg === 'string' && msg.trim()) {
		return msg;
	}
	return fallback;
}
