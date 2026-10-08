<template>
	<!-- Negocio suspendido: pantalla neutra "no disponible" (sin login ni error técnico). -->
	<div
		v-if="unavailable"
		class="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface-50 px-6 text-center dark:bg-surface-950"
	>
		<div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-100 text-surface-400 dark:bg-surface-800">
			<i class="pi pi-clock text-3xl" />
		</div>
		<h1 class="text-2xl font-extrabold text-surface-900 dark:text-surface-0">{{ $t('public.unavailable.title') }}</h1>
		<p class="max-w-md text-surface-500">{{ $t('public.unavailable.subtitle') }}</p>
	</div>

	<div v-else class="min-h-screen bg-surface-50 dark:bg-surface-950">
		<header
			class="sticky top-0 z-50 border-b border-surface-200/70 bg-surface-0/80 shadow-sm backdrop-blur-xl dark:border-surface-700/70 dark:bg-surface-900/80"
		>
			<!-- Mobile: marca a la izquierda y hamburguesa al extremo derecho (tema y
			     sesión van dentro del menú). Desde md: marca · nav centrada · acciones. -->
			<div class="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 md:grid md:grid-cols-3 md:px-6">
				<!-- Marca -->
				<router-link to="/" class="flex min-w-0 flex-1 items-center gap-2.5 justify-self-start md:flex-none">
					<div v-if="espacio?.logoUrl" class="h-9 w-9 shrink-0 overflow-hidden rounded-lg">
						<img :src="espacio.logoUrl" class="h-full w-full object-cover" :alt="espacio.nombre" />
					</div>
					<span class="truncate text-lg font-extrabold tracking-tight text-primary">
						{{ espacio?.nombre || $t('app.brand') }}
					</span>
				</router-link>

				<!-- Navegación centrada -->
				<nav class="hidden items-center justify-center gap-8 md:flex">
					<router-link
						to="/"
						class="border-b-2 border-transparent pb-1 text-sm font-medium text-surface-600 transition-colors hover:text-primary dark:text-surface-300"
						exact-active-class="!border-primary !text-primary"
					>{{ $t('public.nav.home') }}</router-link>
					<router-link
						v-if="hasSubscriptions"
						to="/suscripciones"
						class="border-b-2 border-transparent pb-1 text-sm font-medium text-surface-600 transition-colors hover:text-primary dark:text-surface-300"
						active-class="!border-primary !text-primary"
					>{{ $t('public.nav.subscriptions') }}</router-link>
					<router-link
						to="/nosotros"
						class="border-b-2 border-transparent pb-1 text-sm font-medium text-surface-600 transition-colors hover:text-primary dark:text-surface-300"
						active-class="!border-primary !text-primary"
					>{{ $t('public.about.nav') }}</router-link>
				</nav>

				<!-- Acciones -->
				<div class="flex shrink-0 items-center gap-2 justify-self-end sm:gap-3">
					<Button
						:icon="isDark ? 'pi pi-sun' : 'pi pi-moon'"
						severity="secondary"
						size="small"
						text
						rounded
						aria-label="Cambiar tema"
						class="!hidden md:!inline-flex"
						@click="toggleTheme"
					/>
					<!-- Volver al panel: si llegamos desde el panel (incluye "actuar como"),
					     ocupa el lugar del login y reemplaza a los botones de sesión.
					     La sesión vive en ese origen, así que volvemos allá. En mobile queda
					     visible pero corto ("Panel"), así la vuelta sigue a un toque. -->
					<Button
						v-if="panelReturn"
						:label="$t('nav.backToPanel')"
						icon="pi pi-arrow-left"
						rounded
						size="small"
						class="!hidden !border-0 !bg-amber-500 px-4 font-semibold !text-white shadow-md hover:!bg-amber-600 md:!inline-flex"
						@click="backToPanel"
					/>
					<Button
						v-if="panelReturn"
						:label="$t('nav.panelShort')"
						icon="pi pi-arrow-left"
						rounded
						size="small"
						class="whitespace-nowrap !border-0 !bg-amber-500 px-3 font-semibold !text-white shadow-md hover:!bg-amber-600 md:!hidden"
						@click="backToPanel"
					/>
					<template v-else-if="isAuthenticated">
						<Button
							:label="$t('nav.goToPanel')"
							rounded
							size="small"
							class="primary-gradient !hidden border-0 px-5 font-semibold text-white shadow-md md:!inline-flex"
							@click="onGoToPanel"
						/>
						<Button :label="$t('common.logout')" severity="secondary" size="small" text class="!hidden md:!inline-flex" @click="onLogout" />
					</template>
					<Button
						v-else
						:label="$t('common.login')"
						rounded
						size="small"
						class="primary-gradient !hidden border-0 px-6 font-semibold text-white shadow-md md:!inline-flex"
						@click="onSignIn"
					/>
					<!-- Mis pedidos: visible en todas las páginas, solo si este dispositivo
					     tiene alguno. El número cuenta los que el cliente guardó. -->
					<router-link
						v-if="pedidosCount"
						:to="{ name: 'app-mis-pedidos' }"
						class="relative flex h-9 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-surface-600 transition-colors hover:bg-surface-100 hover:text-primary dark:text-surface-300 dark:hover:bg-surface-800"
						:aria-label="$t('public.misPedidos.title')"
						active-class="!text-primary"
					>
						<i class="pi pi-receipt text-lg" />
						<span class="hidden lg:inline">{{ $t('public.misPedidos.title') }}</span>
						<span class="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-contrast">{{ pedidosCount }}</span>
					</router-link>
					<!-- Hamburguesa (mobile): al extremo derecho; despliega nav, tema y sesión. -->
					<button
						type="button"
						class="flex h-9 w-9 items-center justify-center rounded-lg text-surface-600 transition-colors hover:bg-surface-100 md:hidden dark:text-surface-300 dark:hover:bg-surface-800"
						:aria-label="$t('public.nav.menu')"
						@click="mobileNavOpen = !mobileNavOpen"
					>
						<i :class="mobileNavOpen ? 'pi pi-times' : 'pi pi-bars'" class="text-lg" />
					</button>
				</div>
			</div>

			<!-- Nav mobile: se despliega bajo la barra al tocar la hamburguesa. -->
			<nav
				v-if="mobileNavOpen"
				class="mx-auto flex max-w-7xl flex-col gap-1 border-t border-surface-200/70 px-4 py-2 md:hidden dark:border-surface-700/70"
			>
				<router-link
					to="/"
					class="rounded-lg px-3 py-2.5 text-sm font-medium text-surface-700 hover:bg-surface-100 dark:text-surface-200 dark:hover:bg-surface-800"
					exact-active-class="!text-primary"
					@click="mobileNavOpen = false"
				>{{ $t('public.nav.home') }}</router-link>
				<router-link
					v-if="hasSubscriptions"
					to="/suscripciones"
					class="rounded-lg px-3 py-2.5 text-sm font-medium text-surface-700 hover:bg-surface-100 dark:text-surface-200 dark:hover:bg-surface-800"
					active-class="!text-primary"
					@click="mobileNavOpen = false"
				>{{ $t('public.nav.subscriptions') }}</router-link>
				<router-link
					to="/nosotros"
					class="rounded-lg px-3 py-2.5 text-sm font-medium text-surface-700 hover:bg-surface-100 dark:text-surface-200 dark:hover:bg-surface-800"
					active-class="!text-primary"
					@click="mobileNavOpen = false"
				>{{ $t('public.about.nav') }}</router-link>

				<!-- Tema + sesión (en mobile no entran en la barra). -->
				<div class="mt-1 border-t border-surface-200/70 pt-2 dark:border-surface-700/70">
					<button
						type="button"
						class="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-surface-700 hover:bg-surface-100 dark:text-surface-200 dark:hover:bg-surface-800"
						@click="toggleTheme"
					>
						<i :class="isDark ? 'pi pi-sun' : 'pi pi-moon'" class="text-sm" />
						{{ $t(isDark ? 'common.lightMode' : 'common.darkMode') }}
					</button>
					<template v-if="!panelReturn">
						<template v-if="isAuthenticated">
							<button
								type="button"
								class="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-primary hover:bg-surface-100 dark:hover:bg-surface-800"
								@click="onGoToPanel"
							>
								<i class="pi pi-th-large text-sm" /> {{ $t('nav.goToPanel') }}
							</button>
							<button
								type="button"
								class="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-surface-700 hover:bg-surface-100 dark:text-surface-200 dark:hover:bg-surface-800"
								@click="onLogout"
							>
								<i class="pi pi-sign-out text-sm" /> {{ $t('common.logout') }}
							</button>
						</template>
						<button
							v-else
							type="button"
							class="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-primary hover:bg-surface-100 dark:hover:bg-surface-800"
							@click="onSignIn"
						>
							<i class="pi pi-sign-in text-sm" /> {{ $t('common.login') }}
						</button>
					</template>
				</div>
			</nav>
		</header>

		<main class="mx-auto max-w-7xl p-4 sm:p-6">
			<router-view v-if="ready" />
			<div v-else class="py-24 text-center text-surface-400">
				<i class="pi pi-spin pi-spinner text-3xl" />
			</div>
		</main>
	</div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { areaForRole, type Espacio } from '@base-template/shared';
import { useUserStore } from '@/modules/auth/store/user';
import { useCatalogStore } from '@/modules/admin/store/catalog';
import { useCartStore } from '@/modules/app/store/cart';
import { isDark, toggleTheme } from '@/composables/useTheme';

export default defineComponent({
	name: 'PublicLayout',
	setup() {
		return { isDark, toggleTheme };
	},
	data() {
		return {
			catalog: useCatalogStore(),
			ready: false,
			unavailable: false,
			// Menú de nav desplegable en mobile (en md+ la nav va inline).
			mobileNavOpen: false,
			/** Origen del panel del que venimos (para "Volver al panel"). '' = no aplica. */
			panelReturn: '',
		};
	},
	computed: {
		isAuthenticated(): boolean {
			return useUserStore().isAuthenticated;
		},
		/** Pedidos que este cliente hizo desde este dispositivo (para el acceso del header). */
		pedidosCount(): number {
			return useCartStore().pedidos.length;
		},
		espacio(): Espacio | null {
			return this.catalog.currentEspacio;
		},
		/** El tab de suscripciones aparece solo si algún rubro las tiene habilitadas. */
		hasSubscriptions(): boolean {
			return this.catalog.publicRubros.some(r => r.subscriptionsEnabled);
		},
	},
	watch: {
		// Cerrar el menú mobile al navegar.
		$route() {
			this.mobileNavOpen = false;
		},
	},
	async created() {
		// Si venimos del panel (?panel=<origen>), habilitamos "Volver al panel".
		this.readPanelReturn();
		// Sesión no bloqueante (para decidir "Iniciar sesión" vs "Ir al panel").
		void useUserStore().currentUser();
		// Resuelve el negocio por el dominio.
		const result = await this.catalog.resolveSite();
		if (result === 'suspended') {
			// El negocio existe pero está suspendido: mostramos "no disponible".
			this.unavailable = true;
			return;
		}
		if (result === 'notfound') {
			// No hay negocio en este dominio: es la raíz de la plataforma → login.
			this.$router.replace('/login');
			return;
		}
		this.ready = true;
	},
	methods: {
		/**
		 * Habilita "Volver al panel" si llegamos con `?panel=<origen>`. Guarda el
		 * origen en sessionStorage para que sobreviva a la navegación dentro del
		 * sitio, y limpia el query de la URL. Solo acepta el dato si el referrer
		 * coincide con ese origen (evita links armados con un panel falso).
		 */
		readPanelReturn() {
			const KEY = 'vc_panel_return';
			const q = this.$route.query.panel;
			if (typeof q === 'string' && q) {
				try {
					const origin = new URL(q).origin;
					const refOk = !document.referrer || new URL(document.referrer).origin === origin;
					if (refOk) {
						this.panelReturn = origin;
						sessionStorage.setItem(KEY, origin);
					}
				} catch {
					/* query inválido: lo ignoramos */
				}
				// Sacamos el ?panel de la URL para que quede limpia.
				const query = { ...this.$route.query };
				delete query.panel;
				void this.$router.replace({ query });
			} else {
				this.panelReturn = sessionStorage.getItem(KEY) ?? '';
			}
		},
		/** Vuelve al panel (su origen), donde la sesión y la impersonación siguen vivas. */
		backToPanel() {
			if (this.panelReturn) window.location.href = `${this.panelReturn}/admin`;
		},
		onSignIn() {
			this.$router.push('/login');
		},
		onGoToPanel() {
			const role = useUserStore().role;
			if (role) this.$router.push(areaForRole(role).homePath);
		},
		async onLogout() {
			await useUserStore().logout();
		},
	},
});
</script>
