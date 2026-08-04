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
			<div class="mx-auto grid h-16 max-w-7xl grid-cols-2 items-center px-6 md:grid-cols-3">
				<!-- Marca -->
				<router-link to="/" class="flex items-center gap-2.5 justify-self-start">
					<div v-if="espacio?.logoUrl" class="h-9 w-9 overflow-hidden rounded-lg">
						<img :src="espacio.logoUrl" class="h-full w-full object-cover" :alt="espacio.nombre" />
					</div>
					<span class="text-lg font-extrabold tracking-tight text-primary">
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
				<div class="flex items-center gap-3 justify-self-end">
					<Button
						:icon="isDark ? 'pi pi-sun' : 'pi pi-moon'"
						severity="secondary"
						size="small"
						text
						rounded
						aria-label="Cambiar tema"
						@click="toggleTheme"
					/>
					<!-- Volver al panel: si llegamos desde el panel (incluye "actuar como"),
					     ocupa el lugar del login y reemplaza a los botones de sesión.
					     La sesión vive en ese origen, así que volvemos allá. -->
					<Button
						v-if="panelReturn"
						:label="$t('nav.backToPanel')"
						icon="pi pi-arrow-left"
						rounded
						size="small"
						class="border-0 bg-amber-500 px-4 font-semibold text-white shadow-md hover:bg-amber-600"
						@click="backToPanel"
					/>
					<template v-else-if="isAuthenticated">
						<Button
							:label="$t('nav.goToPanel')"
							rounded
							size="small"
							class="primary-gradient border-0 px-5 font-semibold text-white shadow-md"
							@click="onGoToPanel"
						/>
						<Button :label="$t('common.logout')" severity="secondary" size="small" text @click="onLogout" />
					</template>
					<Button
						v-else
						:label="$t('common.login')"
						rounded
						size="small"
						class="primary-gradient border-0 px-6 font-semibold text-white shadow-md"
						@click="onSignIn"
					/>
				</div>
			</div>
		</header>

		<main class="mx-auto max-w-7xl p-6">
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
			/** Origen del panel del que venimos (para "Volver al panel"). '' = no aplica. */
			panelReturn: '',
		};
	},
	computed: {
		isAuthenticated(): boolean {
			return useUserStore().isAuthenticated;
		},
		espacio(): Espacio | null {
			return this.catalog.currentEspacio;
		},
		/** El tab de suscripciones aparece solo si algún rubro las tiene habilitadas. */
		hasSubscriptions(): boolean {
			return this.catalog.publicRubros.some(r => r.subscriptionsEnabled);
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
