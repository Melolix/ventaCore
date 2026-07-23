/**
 * Helpers para construir la URL pública de la vitrina de un negocio.
 *
 * La vitrina se resuelve por HOSTNAME (dominio propio o subdominio = slug), así
 * que para abrirla hay que cambiar el host, no solo el path: un `router.push('/')`
 * no alcanza si el usuario está parado en otro host (ej. el panel en la IP pelada).
 */

type EspacioLike = { slug: string; domain: string | null };

/**
 * Base para el subdominio de la vitrina, derivada del host donde corre la app:
 *  - dev → 'localhost' (queda {slug}.localhost)
 *  - prod por IP pelada → la envolvemos con nip.io, porque una IP no tiene
 *    subdominios ({slug}.54.94.232.142.nip.io resuelve a la IP)
 *  - prod con dominio propio → ese dominio ({slug}.midominio.com)
 */
export function subdomainBase(): string {
	const host = window.location.hostname;
	const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
	return isIp ? `${host}.nip.io` : host;
}

/** Host visible del negocio: su dominio propio o {slug}.<base>. */
export function vitrinaHost(espacio: EspacioLike): string {
	return espacio.domain || `${espacio.slug}.${subdomainBase()}`;
}

/** URL absoluta para abrir la vitrina pública del negocio. */
export function vitrinaUrl(espacio: EspacioLike): string {
	if (espacio.domain) return `https://${espacio.domain}`;
	const port = window.location.port ? `:${window.location.port}` : '';
	return `${window.location.protocol}//${espacio.slug}.${subdomainBase()}${port}`;
}
