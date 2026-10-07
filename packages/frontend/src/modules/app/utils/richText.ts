import DOMPurify from 'dompurify';

/** Etiquetas y atributos permitidos al renderizar texto enriquecido público. */
const ALLOWED_TAGS = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li', 'a', 'h2', 'h3', 'blockquote', 'span'];
const ALLOWED_ATTR = ['href', 'target', 'rel'];

/**
 * Convierte el `aboutText` guardado en HTML seguro para mostrar con `v-html`.
 *
 * Mantiene compatibilidad con textos viejos guardados como texto plano:
 * si el contenido no parece HTML, convierte los saltos de línea en párrafos.
 */
export function renderRichText(raw: string | null | undefined): string {
	// Los editores contenteditable suelen guardar `&nbsp;` (espacio de NO-quiebre)
	// entre palabras. Eso impide que el texto corte y desborda/rompe el layout de la
	// vitrina. Los normalizamos a espacios comunes (entidad y carácter U+00A0).
	const value = (raw || '')
		.replace(/&nbsp;/gi, ' ')
		.replace(/ /g, ' ')
		.trim();
	if (!value) return '';

	const pareceHtml = /<[a-z][\s\S]*>/i.test(value);
	const html = pareceHtml
		? value
		: `<p>${value
				.replace(/&/g, '&amp;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;')
				.replace(/\n{2,}/g, '</p><p>')
				.replace(/\n/g, '<br>')}</p>`;

	return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR });
}
