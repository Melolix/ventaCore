/**
 * Pipeline de composición del Estudio de Instagram: carga la foto del producto,
 * la dibuja dentro de una plantilla en un `<canvas>` y exporta el JPEG final
 * listo para subir y publicar.
 *
 * La foto se baja por el proxy del backend (`/media/proxy`): así el blob es del
 * mismo origen y el canvas NO queda "tainted" (si no, `toBlob` falla por CORS).
 */
import { api } from '@/shared/services/api';
import { FORMATS, type PostFormat, type StudioTemplate, type ComposeData } from './templates';

export interface ProductBitmap {
	img: ImageBitmap;
	w: number;
	h: number;
}

/** Datos de contenido (sin la imagen, que se pasa aparte ya decodificada). */
export type PostContent = Omit<ComposeData, 'img' | 'imgW' | 'imgH'>;

/** Baja la foto por el proxy del backend y la decodifica a un ImageBitmap. */
export async function loadProductImage(url: string | null | undefined): Promise<ProductBitmap | null> {
	if (!url) return null;
	try {
		const { data } = await api.get('/media/proxy', { params: { url }, responseType: 'blob' });
		const bmp = await createImageBitmap(data as Blob);
		return { img: bmp, w: bmp.width, h: bmp.height };
	} catch {
		return null;
	}
}

/** Renderiza una plantilla+formato+datos en el canvas dado (lo dimensiona al formato). */
export function renderTemplate(
	canvas: HTMLCanvasElement,
	tpl: StudioTemplate,
	format: PostFormat,
	content: PostContent,
	bmp: ProductBitmap | null,
): void {
	const { w, h } = FORMATS[format];
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext('2d');
	if (!ctx) return;
	ctx.clearRect(0, 0, w, h);
	tpl.render(ctx, w, h, {
		...content,
		img: bmp?.img ?? null,
		imgW: bmp?.w ?? 0,
		imgH: bmp?.h ?? 0,
	});
}

/** Exporta el canvas a un Blob JPEG (para subir a Storage y publicar). */
export function exportJpeg(canvas: HTMLCanvasElement, quality = 0.92): Promise<Blob> {
	return new Promise((resolve, reject) => {
		canvas.toBlob(
			blob => (blob ? resolve(blob) : reject(new Error('No se pudo exportar la imagen'))),
			'image/jpeg',
			quality,
		);
	});
}
