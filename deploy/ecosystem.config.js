// PM2 Ecosystem File — VentaCore
// Gestiona el proceso de la API NestJS en producción.
const fs = require('node:fs');
const path = require('node:path');

const ROOT = '/home/ubuntu/ventacore';
const ENV_FILE = path.join(ROOT, '.env.production');

// PM2 evalúa este archivo con Node, así que parseamos el .env nosotros y lo
// inyectamos en `env`. La opción `env_file` de PM2 no cargó las variables acá
// (el proceso arrancaba solo con NODE_ENV y la API caía a los defaults de
// Postgres), y depender de un `source` previo en el shell se rompe en cuanto
// alguien levanta PM2 a mano o el server reinicia.
function parseEnvFile(file) {
	if (!fs.existsSync(file)) {
		throw new Error(`No existe ${file} — copiá .env.production.template y completalo.`);
	}
	const env = {};
	for (const raw of fs.readFileSync(file, 'utf-8').split('\n')) {
		const line = raw.trim();
		if (!line || line.startsWith('#')) continue;
		const eq = line.indexOf('=');
		if (eq === -1) continue;
		const key = line.slice(0, eq).trim();
		// Quita comillas envolventes y el \r de finales de línea Windows.
		const value = line
			.slice(eq + 1)
			.trim()
			.replace(/\r$/, '')
			.replace(/^(['"])(.*)\1$/, '$2');
		if (key) env[key] = value;
	}
	return env;
}

module.exports = {
	apps: [
		{
			name: 'ventacore-api',
			cwd: path.join(ROOT, 'packages/api'),
			script: 'lib/api/src/main.js',
			node_args: '--require reflect-metadata',
			instances: 1,
			exec_mode: 'fork',
			env: {
				...parseEnvFile(ENV_FILE),
				NODE_ENV: 'production',
			},
			// Reinicio automático
			autorestart: true,
			max_restarts: 10,
			restart_delay: 5000,
			// Logs
			log_date_format: 'YYYY-MM-DD HH:mm:ss',
			error_file: '/home/ubuntu/logs/ventacore-error.log',
			out_file: '/home/ubuntu/logs/ventacore-out.log',
			merge_logs: true,
			// Monitoreo
			max_memory_restart: '300M',
		},
	],
};
