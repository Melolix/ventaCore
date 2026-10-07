import { createI18n } from 'vue-i18n';
import es from './locales/es.json';
import en from './locales/en.json';

type Locale = 'es' | 'en';
const isLocale = (v: unknown): v is Locale => v === 'es' || v === 'en';

/**
 * Idioma inicial: `?lang=en|es` en la URL (se recuerda en localStorage), si no el
 * guardado, si no español. Sirve para mostrar la app en inglés (p. ej. App Review de Meta).
 */
function initialLocale(): Locale {
	if (typeof window === 'undefined') return 'es';
	try {
		const q = new URLSearchParams(window.location.search).get('lang');
		if (isLocale(q)) {
			localStorage.setItem('lang', q);
			return q;
		}
		const saved = localStorage.getItem('lang');
		if (isLocale(saved)) return saved;
	} catch {
		// localStorage bloqueado: seguimos con el default
	}
	return 'es';
}

const locale = initialLocale();
if (typeof document !== 'undefined') document.documentElement.lang = locale;

export const i18n = createI18n({
	legacy: false,
	globalInjection: true,
	locale,
	fallbackLocale: 'en',
	messages: { es, en },
});
