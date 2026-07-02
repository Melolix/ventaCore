import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, connectAuthEmulator, type User } from 'firebase/auth';

const firebaseConfig = {
	apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
	authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
	projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
	storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
	messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
	appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);

// En desarrollo, apuntar el SDK al emulador de Auth si está configurado.
const emulatorHost = import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_HOST;
if (emulatorHost) {
	connectAuthEmulator(auth, `http://${emulatorHost}`, { disableWarnings: true });
}

/**
 * Promesa que resuelve cuando Firebase terminó de restaurar la sesión.
 * Los guards la esperan antes de decidir si el usuario está logueado.
 */
export const authReady: Promise<User | null> = new Promise(resolve => {
	const unsub = onAuthStateChanged(auth, user => {
		unsub();
		resolve(user);
	});
});
