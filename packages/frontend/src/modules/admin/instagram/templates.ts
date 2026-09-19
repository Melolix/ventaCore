/**
 * Motor de plantillas para el Estudio de Instagram. Cada plantilla es una
 * función que dibuja, sobre un `<canvas>` de W×H, la foto del producto + los
 * gráficos del diseño (marca, precio, cintas, etc.). Se usa igual para la vista
 * previa (canvas chico) que para exportar (1080px) — solo cambia el tamaño.
 *
 * Sin dependencias: Canvas 2D nativo. Los colores/medidas van en proporción a
 * W/H, así la misma plantilla se adapta a los tres formatos (1:1, 4:5, 9:16).
 */

/** Formato de publicación (relación de aspecto) y sus dimensiones de exportación. */
export type PostFormat = 'square' | 'portrait' | 'story';

export const FORMATS: Record<PostFormat, { w: number; h: number }> = {
	square: { w: 1080, h: 1080 },
	portrait: { w: 1080, h: 1350 },
	story: { w: 1080, h: 1920 },
};

/** Datos que se componen sobre la plantilla. */
export interface ComposeData {
	img: CanvasImageSource | null;
	imgW: number;
	imgH: number;
	nombre: string;
	precio: number | null;
	brand: string;
	/** Logo del negocio (si tiene). Si está, se dibuja en vez del nombre en texto. */
	logo?: CanvasImageSource | null;
	logoW?: number;
	logoH?: number;
}

export interface StudioTemplate {
	id: string;
	/** Etiqueta corta (clave i18n `admin.estudio.tpl.<id>`). */
	id_label: string;
	render(ctx: CanvasRenderingContext2D, W: number, H: number, d: ComposeData): void;
}

// ── Helpers ──

const FONT = "700 1px 'Segoe UI', system-ui, sans-serif";
const IG_STOPS: [number, string][] = [
	[0, '#feda75'],
	[0.26, '#fa7e1e'],
	[0.55, '#d62976'],
	[0.78, '#962fbf'],
	[1, '#4f5bd5'],
];

export function formatPrice(n: number | null): string {
	if (n == null) return '';
	return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
}

function igGradient(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): CanvasGradient {
	const g = ctx.createLinearGradient(x0, y0, x1, y1);
	for (const [stop, color] of IG_STOPS) g.addColorStop(stop, color);
	return g;
}

/** Dibuja la imagen tapando (cover) el rect (recorta lo que sobra, centrado). */
function drawCover(ctx: CanvasRenderingContext2D, d: ComposeData, x: number, y: number, w: number, h: number): void {
	if (!d.img || !d.imgW || !d.imgH) {
		ctx.fillStyle = '#2a2d36';
		ctx.fillRect(x, y, w, h);
		return;
	}
	const scale = Math.max(w / d.imgW, h / d.imgH);
	const dw = d.imgW * scale;
	const dh = d.imgH * scale;
	ctx.save();
	ctx.beginPath();
	ctx.rect(x, y, w, h);
	ctx.clip();
	ctx.drawImage(d.img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
	ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
	const rr = Math.min(r, w / 2, h / 2);
	ctx.beginPath();
	ctx.moveTo(x + rr, y);
	ctx.arcTo(x + w, y, x + w, y + h, rr);
	ctx.arcTo(x + w, y + h, x, y + h, rr);
	ctx.arcTo(x, y + h, x, y, rr);
	ctx.arcTo(x, y, x + w, y, rr);
	ctx.closePath();
}

/** Escribe texto reduciendo el tamaño hasta que entre en `maxW`. Devuelve el px usado. */
function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number, px: number, weight = 700): number {
	let size = px;
	do {
		ctx.font = `${weight} ${size}px 'Segoe UI', system-ui, sans-serif`;
		if (ctx.measureText(text).width <= maxW || size <= px * 0.5) break;
		size -= px * 0.04;
	} while (size > 8);
	return size;
}

/** Gradiente de oscurecimiento inferior (para que el texto blanco se lea sobre la foto). */
function scrim(ctx: CanvasRenderingContext2D, W: number, H: number, fromY: number): void {
	const g = ctx.createLinearGradient(0, fromY, 0, H);
	g.addColorStop(0, 'rgba(8,6,12,0)');
	g.addColorStop(1, 'rgba(8,6,12,0.92)');
	ctx.fillStyle = g;
	ctx.fillRect(0, fromY, W, H - fromY);
}

function priceChip(ctx: CanvasRenderingContext2D, x: number, y: number, precio: number | null, unit: number): void {
	if (precio == null) return;
	const text = formatPrice(precio);
	const px = unit * 0.062;
	ctx.font = `900 ${px}px 'Segoe UI', system-ui, sans-serif`;
	const padX = unit * 0.026;
	const padY = unit * 0.016;
	const tw = ctx.measureText(text).width;
	const w = tw + padX * 2;
	const h = px + padY * 2;
	ctx.fillStyle = '#ffffff';
	roundRect(ctx, x, y, w, h, unit * 0.02);
	ctx.fill();
	ctx.fillStyle = '#111111';
	ctx.textBaseline = 'middle';
	ctx.fillText(text, x + padX, y + h / 2 + px * 0.04);
	ctx.textBaseline = 'alphabetic';
}

function brandMark(ctx: CanvasRenderingContext2D, x: number, y: number, d: ComposeData, unit: number, onLight = false): void {
	// Si el negocio tiene logo, lo dibujamos (alineado a la izquierda) en vez del nombre.
	if (d.logo && d.logoW && d.logoH) {
		const h = unit * 0.09;
		const w = (d.logoW / d.logoH) * h;
		ctx.save();
		if (!onLight) {
			ctx.shadowColor = 'rgba(0,0,0,0.5)';
			ctx.shadowBlur = unit * 0.01;
		}
		ctx.drawImage(d.logo, x, y, w, h);
		ctx.restore();
		return;
	}
	const brand = d.brand;
	if (!brand) return;
	const px = unit * 0.032;
	ctx.font = `800 ${px}px 'Segoe UI', system-ui, sans-serif`;
	const dot = px * 0.9;
	ctx.fillStyle = onLight ? '#111111' : '#ffffff';
	roundRect(ctx, x, y, dot, dot, dot * 0.28);
	ctx.fill();
	if (!onLight) {
		ctx.shadowColor = 'rgba(0,0,0,0.5)';
		ctx.shadowBlur = unit * 0.01;
	}
	ctx.fillStyle = onLight ? '#111111' : '#ffffff';
	ctx.textBaseline = 'middle';
	ctx.fillText(brand, x + dot + px * 0.4, y + dot / 2 + px * 0.05);
	ctx.textBaseline = 'alphabetic';
	ctx.shadowBlur = 0;
}

// ── Plantillas ──

/** OFERTA: foto a sangre + cinta diagonal con gradiente IG + precio grande abajo. */
const oferta: StudioTemplate = {
	id: 'oferta',
	id_label: 'oferta',
	render(ctx, W, H, d) {
		const u = Math.min(W, H);
		drawCover(ctx, d, 0, 0, W, H);
		scrim(ctx, W, H, H * 0.5);
		// Cinta diagonal en la esquina superior izquierda (banda centrada en la
		// diagonal de la esquina, con el texto corriendo a lo largo).
		ctx.save();
		const cxy = u * 0.12; // centro de la cinta, a esta distancia de la esquina
		ctx.translate(cxy, cxy);
		ctx.rotate(-Math.PI / 4);
		const bandW = u * 0.52; // más larga: las puntas se van fuera del cuadro y no se ve el corte
		const bandH = u * 0.06;
		ctx.fillStyle = igGradient(ctx, -bandW / 2, 0, bandW / 2, 0);
		ctx.fillRect(-bandW / 2, -bandH / 2, bandW, bandH);
		ctx.fillStyle = '#ffffff';
		ctx.font = `800 ${u * 0.028}px 'Segoe UI', system-ui, sans-serif`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText('OFERTA', 0, 0);
		ctx.restore();
		ctx.textAlign = 'left';
		ctx.textBaseline = 'alphabetic';
		// Marca arriba a la derecha
		ctx.textAlign = 'right';
		brandMarkRight(ctx, W - u * 0.05, u * 0.05, d, u);
		ctx.textAlign = 'left';
		// Nombre + precio abajo
		const pad = u * 0.06;
		const namePx = fitText(ctx, d.nombre, W - pad * 2, u * 0.05, 700);
		ctx.fillStyle = '#ffffff';
		ctx.font = `700 ${namePx}px 'Segoe UI', system-ui, sans-serif`;
		ctx.fillText(clip(ctx, d.nombre, W - pad * 2), pad, H - pad - u * 0.11);
		priceChip(ctx, pad, H - pad - u * 0.085, d.precio, u);
	},
};

/** MINIMAL: fondo claro, foto en recuadro con margen, nombre + precio abajo. */
const minimal: StudioTemplate = {
	id: 'minimal',
	id_label: 'minimal',
	render(ctx, W, H, d) {
		const u = Math.min(W, H);
		ctx.fillStyle = '#f4f2f6';
		ctx.fillRect(0, 0, W, H);
		const m = u * 0.06;
		const photoH = H - m * 2 - u * 0.16;
		ctx.save();
		roundRect(ctx, m, m, W - m * 2, photoH, u * 0.03);
		ctx.clip();
		drawCover(ctx, d, m, m, W - m * 2, photoH);
		ctx.restore();
		// Marca arriba
		brandMark(ctx, m, m + photoH + u * 0.03, d, u, true);
		// Nombre
		ctx.fillStyle = '#151318';
		const namePx = fitText(ctx, d.nombre, W - m * 2 - u * 0.28, u * 0.048, 700);
		ctx.font = `700 ${namePx}px 'Segoe UI', system-ui, sans-serif`;
		ctx.fillText(clip(ctx, d.nombre, W - m * 2 - u * 0.3), m, H - m - u * 0.02);
		// Precio a la derecha, acento
		if (d.precio != null) {
			ctx.fillStyle = '#d62976';
			ctx.font = `900 ${u * 0.06}px 'Segoe UI', system-ui, sans-serif`;
			ctx.textAlign = 'right';
			ctx.fillText(formatPrice(d.precio), W - m, H - m - u * 0.02);
			ctx.textAlign = 'left';
		}
	},
};

/** PRECIO GRANDE: foto arriba, banda oscura abajo con precio enorme. */
const precioGrande: StudioTemplate = {
	id: 'precioGrande',
	id_label: 'precioGrande',
	render(ctx, W, H, d) {
		const u = Math.min(W, H);
		const bandH = H * 0.34;
		drawCover(ctx, d, 0, 0, W, H - bandH);
		ctx.fillStyle = '#141118';
		ctx.fillRect(0, H - bandH, W, bandH);
		const pad = u * 0.06;
		brandMark(ctx, pad, H - bandH + pad, d, u);
		ctx.fillStyle = '#b9b3c4';
		const namePx = fitText(ctx, d.nombre, W - pad * 2, u * 0.04, 600);
		ctx.font = `600 ${namePx}px 'Segoe UI', system-ui, sans-serif`;
		ctx.fillText(clip(ctx, d.nombre, W - pad * 2), pad, H - bandH + pad + u * 0.09);
		if (d.precio != null) {
			ctx.fillStyle = '#ffffff';
			const pPx = fitText(ctx, formatPrice(d.precio), W - pad * 2, u * 0.13, 900);
			ctx.font = `900 ${pPx}px 'Segoe UI', system-ui, sans-serif`;
			ctx.fillText(formatPrice(d.precio), pad, H - pad - u * 0.01);
		}
	},
};

/** NUEVO: foto a sangre, pastilla verde "NUEVO" arriba, nombre + precio abajo. */
const nuevo: StudioTemplate = {
	id: 'nuevo',
	id_label: 'nuevo',
	render(ctx, W, H, d) {
		const u = Math.min(W, H);
		drawCover(ctx, d, 0, 0, W, H);
		scrim(ctx, W, H, H * 0.55);
		const pad = u * 0.06;
		// Pastilla NUEVO
		ctx.font = `800 ${u * 0.032}px 'Segoe UI', system-ui, sans-serif`;
		const label = 'NUEVO INGRESO';
		const tw = ctx.measureText(label).width;
		ctx.fillStyle = '#10b981';
		roundRect(ctx, pad, pad, tw + u * 0.05, u * 0.06, u * 0.03);
		ctx.fill();
		ctx.fillStyle = '#ffffff';
		ctx.textBaseline = 'middle';
		ctx.fillText(label, pad + u * 0.025, pad + u * 0.03);
		ctx.textBaseline = 'alphabetic';
		brandMarkRight(ctx, W - pad, pad + u * 0.01, d, u);
		// Nombre + precio
		const namePx = fitText(ctx, d.nombre, W - pad * 2, u * 0.05, 700);
		ctx.fillStyle = '#ffffff';
		ctx.font = `700 ${namePx}px 'Segoe UI', system-ui, sans-serif`;
		ctx.fillText(clip(ctx, d.nombre, W - pad * 2), pad, H - pad - u * 0.11);
		priceChip(ctx, pad, H - pad - u * 0.085, d.precio, u);
	},
};

// Marca alineada a la derecha (variante usada en plantillas con foto a sangre).
function brandMarkRight(ctx: CanvasRenderingContext2D, xRight: number, y: number, d: ComposeData, unit: number): void {
	// Logo del negocio (alineado a la derecha) si tiene; si no, el nombre en texto.
	if (d.logo && d.logoW && d.logoH) {
		const h = unit * 0.1;
		const w = (d.logoW / d.logoH) * h;
		ctx.save();
		ctx.shadowColor = 'rgba(0,0,0,0.5)';
		ctx.shadowBlur = unit * 0.012;
		ctx.drawImage(d.logo, xRight - w, y, w, h);
		ctx.restore();
		return;
	}
	const brand = d.brand;
	if (!brand) return;
	const px = unit * 0.032;
	ctx.font = `800 ${px}px 'Segoe UI', system-ui, sans-serif`;
	ctx.save();
	ctx.shadowColor = 'rgba(0,0,0,0.5)';
	ctx.shadowBlur = unit * 0.012;
	ctx.fillStyle = '#ffffff';
	ctx.textAlign = 'right';
	ctx.textBaseline = 'top';
	ctx.fillText(brand, xRight, y);
	ctx.restore();
	ctx.textAlign = 'left';
	ctx.textBaseline = 'alphabetic';
}

/** Recorta con "…" si el texto no entra en maxW con la fuente actual. */
function clip(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
	if (ctx.measureText(text).width <= maxW) return text;
	let t = text;
	while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
	return t + '…';
}

export const TEMPLATES: StudioTemplate[] = [oferta, minimal, precioGrande, nuevo];
void FONT; // referencia reservada para futuras plantillas
