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
export function subdomainBase(slug?: string): string {
	let host = window.location.hostname;
	// Si el panel se abrió EN el subdominio del propio negocio (ej.
	// melolix.<base>/admin), sacamos ese primer label para no duplicarlo al
	// reconstruir la URL ({slug}.{slug}.<base>).
	if (slug && host.startsWith(`${slug}.`)) host = host.slice(slug.length + 1);
	const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
	return isIp ? `${host}.nip.io` : host;
}

/** Host visible del negocio: su dominio propio o {slug}.<base>. */
export function vitrinaHost(espacio: EspacioLike): string {
	return espacio.domain || `${espacio.slug}.${subdomainBase(espacio.slug)}`;
}

/** URL absoluta para abrir la vitrina pública del negocio. */
export function vitrinaUrl(espacio: EspacioLike): string {
	if (espacio.domain) return `https://${espacio.domain}`;
	const port = window.location.port ? `:${window.location.port}` : '';
	return `${window.location.protocol}//${espacio.slug}.${subdomainBase(espacio.slug)}${port}`;
}

/**
 * Igual que `vitrinaUrl` pero agrega el origen del panel (`?panel=`). La vitrina
 * corre en OTRO origen (subdominio/dominio propio), donde la sesión de Firebase
 * no existe; con este dato el sitio puede ofrecer "Volver al panel", que lleva
 * de vuelta al origen donde la sesión (y la impersonación) siguen vivas.
 */
export function vitrinaUrlWithReturn(espacio: EspacioLike): string {
	const base = vitrinaUrl(espacio);
	const sep = base.includes('?') ? '&' : '?';
	return `${base}${sep}panel=${encodeURIComponent(window.location.origin)}`;
}
