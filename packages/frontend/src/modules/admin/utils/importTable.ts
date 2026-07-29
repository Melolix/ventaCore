/**
 * Parseo de tablas para la carga masiva. Soporta:
 *  - CSV nativo (sin dependencias): maneja comillas, saltos de línea dentro de
 *    celdas y autodetecta el separador (coma o punto y coma, típico de Excel LATAM).
 *  - .xlsx: vía `read-excel-file`, importada de forma perezosa (code-split) para
 *    que la librería solo se descargue cuando el usuario sube un Excel.
 */

export interface ParsedTable {
	headers: string[];
	rows: string[][];
}

/** Extensiones aceptadas por el importador (atributo `accept` del input). */
export const ACCEPTED_IMPORT_EXTENSIONS = '.csv,.xlsx,text/csv';

/** Convierte una celda de xlsx (string | number | Date | boolean | null) a texto. */
function cellToString(cell: unknown): string {
	if (cell == null) return '';
	if (cell instanceof Date) return cell.toISOString().slice(0, 10);
	return String(cell).trim();
}

/** Detecta el separador contando coma vs. punto y coma en la primera línea. */
function detectDelimiter(sample: string): ',' | ';' {
	const firstLine = sample.split(/\r?\n/, 1)[0] ?? '';
	const commas = (firstLine.match(/,/g) || []).length;
	const semis = (firstLine.match(/;/g) || []).length;
	return semis > commas ? ';' : ',';
}

/** Parser CSV que respeta comillas dobles y celdas multilínea. */
function parseCsv(text: string, delimiter: ',' | ';'): string[][] {
	const rows: string[][] = [];
	let field = '';
	let row: string[] = [];
	let inQuotes = false;

	for (let i = 0; i < text.length; i++) {
		const char = text[i];

		if (inQuotes) {
			if (char === '"') {
				if (text[i + 1] === '"') {
					field += '"';
					i++; // comilla escapada ("")
				} else {
					inQuotes = false;
				}
			} else {
				field += char;
			}
			continue;
		}

		if (char === '"') {
			inQuotes = true;
		} else if (char === delimiter) {
			row.push(field);
			field = '';
		} else if (char === '\n') {
			row.push(field);
			rows.push(row);
			field = '';
			row = [];
		} else if (char === '\r') {
			// se ignora; el \n siguiente cierra la fila
		} else {
			field += char;
		}
	}
	// última celda/fila si el archivo no termina en salto de línea
	if (field.length > 0 || row.length > 0) {
		row.push(field);
		rows.push(row);
	}
	return rows;
}

/**
 * Lee un archivo .xlsx con `read-excel-file` (carga perezosa). Devuelve todas
 * las celdas como texto para un mapeo uniforme.
 */
async function readXlsx(file: File): Promise<string[][]> {
	const { default: readXlsxFile } = await import('read-excel-file/browser');
	const result: unknown = await readXlsxFile(file);
	// Según el build/versión, devuelve las filas directas (browser) o
	// `[{ sheet, data }]` (algunos builds). Contemplamos ambas formas.
	const first = Array.isArray(result) ? (result[0] as { data?: unknown } | undefined) : undefined;
	const matrix = (first && Array.isArray(first.data) ? first.data : result) as unknown[][];
	return matrix.map(row => row.map(cellToString));
}

/**
 * Lee un archivo CSV o .xlsx y devuelve encabezados + filas (todo como texto).
 * Descarta filas totalmente vacías. Lanza `noRows` si no hay filas de datos.
 */
export async function parseTableFile(file: File): Promise<ParsedTable> {
	const isXlsx = /\.xlsx$/i.test(file.name) || file.type.includes('spreadsheetml');

	let matrix: string[][];
	if (isXlsx) {
		matrix = await readXlsx(file);
	} else {
		const text = await file.text();
		matrix = parseCsv(text, detectDelimiter(text));
	}

	const all = matrix.map(r => r.map(c => c.trim())).filter(r => r.some(c => c !== ''));
	if (all.length < 2) throw new Error('noRows');

	const [headers, ...rows] = all;
	return { headers, rows };
}

/**
 * Convierte un texto de precio/stock a número. Tolera símbolos de moneda,
 * espacios y separadores es-AR ("1.800,50" → 1800.5).
 */
export function parseNumber(raw: string): number | null {
	if (!raw) return null;
	let s = raw.replace(/[^\d.,-]/g, '').trim();
	if (!s) return null;
	const hasComma = s.includes(',');
	const hasDot = s.includes('.');
	if (hasComma && hasDot) {
		// Formato es-AR: el punto es miles y la coma decimal.
		s = s.replace(/\./g, '').replace(',', '.');
	} else if (hasComma) {
		s = s.replace(',', '.');
	}
	const n = Number(s);
	return Number.isFinite(n) ? n : null;
}
