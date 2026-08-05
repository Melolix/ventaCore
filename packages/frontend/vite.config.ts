import * as path from 'node:path';
import { readFileSync } from 'node:fs';
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import Components from 'unplugin-vue-components/vite';
import { PrimeVueResolver } from '@primevue/auto-import-resolver';
import { VitePWA } from 'vite-plugin-pwa';
import tailwindcss from '@tailwindcss/vite';

const pkg = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'));

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, path.resolve(__dirname, '../../'), 'VITE_');
	const isProduction = process.env.NODE_ENV === 'production';

	return {
		envDir: path.resolve(__dirname, '../../'),
		base: env.VITE_BASE_PATH || '/',
		// host: true expone el dev server en la LAN (permite subdominios
		// {slug}.localhost y probar el handoff por QR desde el celular).
		// allowedHosts: true acepta cualquier host (incluida tu IP de LAN, que
		// varía por dev/red) — es solo el dev server; en prod sirve Nginx.
		server: {
			host: true,
			allowedHosts: true,
			// Proxy del API: el celular solo llega al 5173 y Vite reenvía /api a la
			// API local. Va de la mano con VITE_API_URL=/api (relativo) en dev.
			proxy: {
				'/api': 'http://localhost:3000',
			},
		},
		build: {
			target: 'esnext',
		},
		...(isProduction && {
			esbuild: {
				drop: ['console', 'debugger'],
			},
		}),
		plugins: [
			vue(),
			tailwindcss(),
			Components({
				resolvers: [PrimeVueResolver()],
				dts: 'components.d.ts',
			}),
			VitePWA({
				registerType: 'autoUpdate',
				injectRegister: 'auto',
				manifest: {
					name: 'Base Template',
					short_name: 'BaseTemplate',
					theme_color: '#6366F1',
					icons: [
						{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
						{ src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
					],
				},
				workbox: {
					globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
					// Los screenshots de las páginas de apps son contenido pesado
					// (>2 MB) y no forman parte del app shell: no se precachean.
					globIgnores: ['**/screenshots/**'],
					cleanupOutdatedCaches: true,
					clientsClaim: true,
					skipWaiting: true,
					navigateFallbackDenylist: [/^\/__\/auth\//],
				},
				devOptions: {
					enabled: false,
				},
			}),
		],
		resolve: {
			alias: {
				'@': path.resolve(__dirname, './src'),
				'@base-template/sdk': path.resolve(__dirname, '../sdk/src/index.ts'),
				'@base-template/shared': path.resolve(__dirname, '../shared/src/index.ts'),
			},
			preserveSymlinks: true,
		},
		define: {
			__APP_VERSION__: JSON.stringify(pkg.version),
		},
	};
});
