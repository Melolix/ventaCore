/**
 * Datos del titular de la plataforma que aparecen en las páginas legales
 * (privacidad, términos, eliminación de datos). Meta los revisa contra la
 * verificación del negocio: tienen que coincidir con la constancia de ARCA.
 */
export const TITULAR = {
	marca: 'Melolix',
	producto: 'VentaCore',
	nombreLegal: 'Florencia Cerquette',
	cuit: '23-35642353-4',
	domicilio: 'Moreno 2788 (CP 2170), Casilda, Santa Fe, Argentina',
	telefono: '+54 3464 447597',
	email: 'contacto@melolix.ar',
	sitio: 'https://melolix.ar',
	/** Fecha de la última actualización de los textos legales. */
	actualizado: '23 de septiembre de 2026',
} as const;
