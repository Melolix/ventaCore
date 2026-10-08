/** Precio en pesos para la tienda. Sin ",00": los centavos solo se muestran si el precio los tiene. */
export function formatPrice(value: number): string {
	return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(value);
}
