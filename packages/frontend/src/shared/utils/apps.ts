import { AppPlatform, type Rubro } from '@base-template/shared';

/** Ícono (PrimeIcons) de cada plataforma de una app. */
export const PLATFORM_ICON: Record<AppPlatform, string> = {
	[AppPlatform.ANDROID]: 'pi pi-android',
	[AppPlatform.IOS]: 'pi pi-apple',
	[AppPlatform.WEB]: 'pi pi-globe',
	[AppPlatform.DESKTOP]: 'pi pi-desktop',
};

type AppLinks = Pick<Rubro, 'platforms' | 'androidUrl' | 'iosUrl' | 'webUrl'>;

/**
 * Plataformas a mostrar en la vitrina: las que el admin eligió explícitamente,
 * o —si no eligió ninguna— las inferidas de los links cargados (retrocompatible
 * con apps creadas antes de este campo).
 */
export function effectivePlatforms(rubro: AppLinks): AppPlatform[] {
	if (rubro.platforms?.length) return rubro.platforms;
	const inferred: AppPlatform[] = [];
	if (rubro.androidUrl) inferred.push(AppPlatform.ANDROID);
	if (rubro.iosUrl) inferred.push(AppPlatform.IOS);
	if (rubro.webUrl) inferred.push(AppPlatform.WEB);
	return inferred;
}
