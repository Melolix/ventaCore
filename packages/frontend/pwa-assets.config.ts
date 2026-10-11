import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Íconos de la PWA generados en el build a partir del logo (public/favicon.svg).
// El fondo de los íconos "maskable" y de Apple usa el mismo azul oscuro del logo,
// así el recorte (círculo, squircle, etc.) no deja bordes blancos.
const fondo = '#0d1c2d';

export default defineConfig({
	headLinkOptions: { preset: '2023' },
	preset: {
		...minimal2023Preset,
		maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: fondo } },
		apple: { ...minimal2023Preset.apple, resizeOptions: { background: fondo } },
	},
	images: ['public/favicon.svg'],
});
