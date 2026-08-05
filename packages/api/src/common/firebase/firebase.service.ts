import { randomUUID } from 'node:crypto';
import { Injectable, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';

/**
 * Inicializa Firebase Admin una sola vez y expone helpers de auth y storage.
 * Las credenciales se resuelven desde GOOGLE_APPLICATION_CREDENTIALS
 * (Application Default Credentials).
 */
@Injectable()
export class FirebaseService implements OnModuleInit {
	private app!: admin.app.App;

	onModuleInit() {
		if (!admin.apps.length) {
			// Con el emulador (FIREBASE_AUTH_EMULATOR_HOST) no hacen falta credenciales
			// reales: firebase-admin enruta las operaciones de auth al emulador local.
			const useEmulator = !!process.env.FIREBASE_AUTH_EMULATOR_HOST;
			this.app = admin.initializeApp({
				projectId: process.env.FIREBASE_PROJECT_ID,
				storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
				...(useEmulator ? {} : { credential: admin.credential.applicationDefault() }),
			});
		} else {
			this.app = admin.app();
		}
	}

	get auth(): admin.auth.Auth {
		return this.app.auth();
	}

	/**
	 * Sube una imagen a Storage y devuelve su download URL (mismo formato que
	 * genera el SDK web: `.../o/{path}?alt=media&token=...`), de modo que se puede
	 * guardar/borrar igual que las subidas del cliente. Respeta el emulador de
	 * Storage en dev (FIREBASE_STORAGE_EMULATOR_HOST).
	 */
	async uploadImage(path: string, buffer: Buffer, contentType: string): Promise<string> {
		const bucket = this.app.storage().bucket();
		const downloadToken = randomUUID();
		await bucket.file(path).save(buffer, {
			contentType,
			resumable: false,
			metadata: { metadata: { firebaseStorageDownloadTokens: downloadToken } },
		});

		const emulator = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
		const host = emulator ? `http://${emulator}` : 'https://firebasestorage.googleapis.com';
		return `${host}/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${downloadToken}`;
	}

	/** Verifica un ID token del cliente y devuelve el token decodificado. */
	async verifyIdToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
		return this.auth.verifyIdToken(idToken);
	}

	/** Crea un usuario en Firebase Auth (usado al dar de alta usuarios). */
	async createUser(email: string, password: string, displayName?: string) {
		return this.auth.createUser({ email, password, displayName });
	}

	async deleteUser(uid: string) {
		return this.auth.deleteUser(uid);
	}
}
