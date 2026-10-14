/** Precio en pesos para la tienda. Sin ",00": los centavos solo se muestran si el precio los tiene (y entonces los dos: ",50"). */
export function formatPrice(value: number): string {
	const digits = Number.isInteger(Math.round(value * 100) / 100) ? 0 : 2;
	return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: digits, maximumFractionDigits: 2 }).format(value);
}
