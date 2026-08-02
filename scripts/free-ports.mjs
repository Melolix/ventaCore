/**
 * Libera los puertos del entorno de desarrollo antes de arrancar `npm run dev`.
 *
 * En Windows (y a veces en otros SO) los procesos de node en modo watch quedan
 * "zombies" cuando se corta el árbol de golpe: el nieto que tiene el puerto no
 * recibe la señal y sigue vivo, ocupando el 3000/5173. Eso hace que la API o el
 * front nuevos no puedan tomar el puerto y sirvan código viejo (o fallen).
 *
 * Este script corre como `predev` (npm lo ejecuta solo antes de `dev`) y mata
 * cualquier proceso que esté escuchando en esos puertos. Solo toca puertos de
 * desarrollo; no afecta producción.
 */
import { execSync } from 'node:child_process';

// API · Vite · emulador de Firebase (auth, storage, UI, hub).
const PORTS = [3000, 5173, 9099, 9199, 4000, 4400];
const isWin = process.platform === 'win32';

/** PIDs que están ESCUCHANDO en un puerto. */
function pidsOnPort(port) {
	try {
		if (isWin) {
			const out = execSync('netstat -ano -p tcp', { encoding: 'utf8' });
			const pids = new Set();
			for (const line of out.split(/\r?\n/)) {
				const parts = line.trim().split(/\s+/);
				// TCP  <local>  <foreign>  LISTENING  <pid>
				if (parts.length >= 5 && parts[3] === 'LISTENING' && parts[1].endsWith(`:${port}`)) {
					pids.add(parts[4]);
				}
			}
			return [...pids];
		}
		// Unix (CI / otros devs): lsof lista los PIDs en LISTEN.
		const out = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, { encoding: 'utf8' });
		return out.split(/\s+/).filter(Boolean);
	} catch {
		// netstat/lsof sin resultados o no disponible: nada que liberar.
		return [];
	}
}

let freed = 0;
for (const port of PORTS) {
	for (const pid of pidsOnPort(port)) {
		if (!pid || pid === '0' || pid === String(process.pid)) continue;
		try {
			execSync(isWin ? `taskkill /F /PID ${pid}` : `kill -9 ${pid}`, { stdio: 'ignore' });
			console.log(`  ✔ puerto ${port} liberado (PID ${pid})`);
			freed++;
		} catch {
			/* ya murió o sin permisos: seguimos */
		}
	}
}
if (freed === 0) console.log('  ✔ puertos de desarrollo ya estaban libres');
