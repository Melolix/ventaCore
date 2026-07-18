import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * Cifra/descifra secretos (tokens de Meta) para guardarlos en la base.
 *
 * Usa AES-256-GCM: cada valor se cifra con un IV aleatorio y se guarda como
 * `iv:authTag:ciphertext` (los tres en base64). El authTag detecta cualquier
 * manipulación del dato cifrado.
 *
 * La clave sale de `META_TOKEN_ENC_KEY` (32 bytes, en base64 o hex). La
 * validación es diferida: la app puede bootear sin la clave; solo falla si se
 * intenta cifrar/descifrar (es decir, al conectar o publicar en Meta).
 */
@Injectable()
export class TokenCryptoService {
	private cachedKey: Buffer | null = null;

	private get key(): Buffer {
		if (this.cachedKey) return this.cachedKey;

		const raw = process.env.META_TOKEN_ENC_KEY;
		if (!raw) {
			throw new InternalServerErrorException(
				'Falta META_TOKEN_ENC_KEY: la integración con Meta no está configurada en el servidor.',
			);
		}

		// Admite hex (64 chars) o base64; en ambos casos debe dar 32 bytes (AES-256).
		const key = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
		if (key.length !== 32) {
			throw new InternalServerErrorException('META_TOKEN_ENC_KEY debe representar 32 bytes (AES-256).');
		}

		this.cachedKey = key;
		return key;
	}

	/** Cifra un secreto en claro y devuelve el paquete `iv:authTag:ciphertext`. */
	encrypt(plain: string): string {
		const iv = randomBytes(12);
		const cipher = createCipheriv('aes-256-gcm', this.key, iv);
		const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
		const tag = cipher.getAuthTag();
		return [iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join(':');
	}

	/** Descifra un paquete generado por `encrypt`. Lanza si fue manipulado. */
	decrypt(payload: string): string {
		const [ivB64, tagB64, dataB64] = payload.split(':');
		if (!ivB64 || !tagB64 || !dataB64) {
			throw new InternalServerErrorException('Token cifrado con formato inválido.');
		}
		const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(ivB64, 'base64'));
		decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
		return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
	}
}
