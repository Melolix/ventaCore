<template>
	<div class="min-h-screen bg-surface-50 dark:bg-surface-950">
		<!-- Topbar -->
		<header
			class="fixed top-0 left-0 z-50 flex h-16 w-full items-center justify-between border-b border-surface-200/60 bg-surface-0/70 px-6 backdrop-blur-xl dark:border-surface-700/60 dark:bg-surface-900/70"
		>
			<BrandLogo :size="30" />

			<!-- "Viendo como": un superadmin está impersonando a un cliente. -->
			<div
				v-if="imp.active"
				class="mx-3 flex min-w-0 items-center gap-2 rounded-full bg-amber-500/15 px-3 py-1 text-sm text-amber-700 dark:text-amber-300"
			>
				<i class="pi pi-eye shrink-0" />
				<span class="truncate">{{ $t('admin.impersonating', { nombre: imp.espacioNombre }) }}</span>
				<button
					type="button"
					class="shrink-0 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold hover:bg-amber-500/30"
					@click="exitImpersonation"
				>
					{{ $t('admin.impersonatingExit') }}
				</button>
			</div>

			<div class="ml-auto flex items-center gap-3">
				<Button
					:icon="isDark ? 'pi pi-sun' : 'pi pi-moon'"
					severity="secondary"
					size="small"
					text
					rounded
					aria-label="Cambiar tema"
					@click="toggleTheme"
				/>
				<button
					type="button"
					class="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-surface-100 dark:hover:bg-surface-800"
					aria-haspopup="true"
					@click="toggleUserMenu"
				>
					<Avatar :label="inicial" shape="circle" class="!bg-primary !text-white" />
					<span
						class="hidden max-w-[10rem] truncate text-sm font-semibold text-surface-700 dark:text-surface-200 sm:inline"
					>
						{{ nombre }}
					</span>
					<i class="pi pi-chevron-down text-xs text-surface-400" />
				</button>
				<Menu ref="userMenu" :model="userMenuItems" popup>
					<template #start>
						<div class="border-b border-surface-200 px-3 py-2 dark:border-surface-700">
							<p class="text-xs text-surface-400">{{ $t('common.signedInAs') }}</p>
							<p
								class="max-w-[14rem] truncate text-sm font-medium text-surface-700 dark:text-surface-200"
							>
								{{ email }}
							</p>
						</div>
					</template>
				</Menu>
			</div>
		</header>

		<!-- Sidebar -->
		<aside
			class="fixed top-16 left-0 z-40 flex h-[calc(100vh-64px)] w-64 flex-col border-r border-surface-200/60 bg-surface-0/60 p-4 backdrop-blur-2xl dark:border-surface-700/60 dark:bg-surface-900/60"
		>
			<div class="mb-6 px-1">
				<label class="mb-1.5 block px-2 text-[11px] font-semibold uppercase tracking-wide text-surface-400">
					{{ $t('admin.business') }}
				</label>
				<Select
					v-if="catalog.rubros.length"
					v-model="currentRubroId"
					:options="rubroOptions"
					option-label="label"
					option-value="value"
					:placeholder="$t('admin.businessPlaceholder')"
					class="w-full"
				/>
				<p v-else class="px-2 text-xs text-surface-400">{{ $t('admin.businessNone') }}</p>
			</div>

			<nav class="flex flex-1 flex-col gap-1">
				<template v-for="item in navItems" :key="item.key">
					<router-link
						:to="item.to"
						:class="[
							'flex items-center gap-3 rounded-xl p-3 text-sm font-semibold transition-all',
							item.disabled
								? 'cursor-not-allowed text-surface-400'
								: isActive(item)
									? 'bg-primary/10 text-primary shadow-sm'
									: 'text-surface-600 hover:translate-x-1 hover:bg-surface-100 dark:text-surface-300 dark:hover:bg-surface-800',
						]"
						@click="item.disabled && $event.preventDefault()"
					>
						<i :class="item.icon" />
						<span>{{ $t(item.label) }}</span>
						<span v-if="item.disabled" class="ml-auto text-[10px] uppercase text-surface-400">
							{{ $t('admin.soon') }}
						</span>
					</router-link>
					<!-- Divisor: separa la gestión de negocios de las tareas del negocio activo. -->
					<div
						v-if="item.groupBreakAfter"
						class="my-2 border-t border-surface-200/60 dark:border-surface-700/60"
					/>
				</template>
			</nav>

			<!-- Acciones al pie: setup de una-vez y ver la vitrina pública. -->
			<div class="mt-2 flex flex-col gap-1 border-t border-surface-200/60 pt-3 dark:border-surface-700/60">
				<router-link
					to="/admin/configuraciones"
					:class="[
						'flex items-center gap-3 rounded-xl p-3 text-sm font-semibold transition-all',
						$route.path.startsWith('/admin/configuraciones')
							? 'bg-primary/10 text-primary shadow-sm'
							: 'text-surface-600 hover:translate-x-1 hover:bg-surface-100 dark:text-surface-300 dark:hover:bg-surface-800',
					]"
				>
					<i class="pi pi-cog" />
					<span>{{ $t('admin.nav.config') }}</span>
				</router-link>
				<button
					type="button"
					class="flex w-full items-center gap-3 rounded-xl p-3 text-sm font-semibold text-surface-600 transition-all hover:translate-x-1 hover:bg-surface-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-surface-300 dark:hover:bg-surface-800"
					:disabled="!catalog.miEspacio"
					@click="openSite"
				>
					<i class="pi pi-external-link" />
					<span>{{ $t('admin.viewSite') }}</span>
				</button>
			</div>
		</aside>

		<!-- Contenido -->
		<main class="mt-16 ml-64 min-h-[calc(100vh-64px)] p-6">
			<router-view />
		</main>

		<Toast />
		<ConfirmDialog />
	</div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { useUserStore } from '@/modules/auth/store/user';
import { useCatalogStore } from '@/modules/admin/store/catalog';
import { useAdminContext } from '@/modules/admin/store/context';
import { useImpersonation } from '@/modules/superadmin/store/impersonation';
import { isDark, toggleTheme } from '@/composables/useTheme';
import { vitrinaUrlWithReturn } from '@/shared/utils/site';
import BrandLogo from '@/shared/components/BrandLogo.vue';

interface NavItem {
	key: string;
	label: string;
	icon: string;
	to: string;
	disabled?: boolean;
	/** Dibuja un divisor debajo (separa "gestión de negocios" del negocio activo). */
	groupBreakAfter?: boolean;
}

export default defineComponent({
	name: 'AdminLayout',
	components: { BrandLogo },
	setup() {
		return { isDark, toggleTheme, catalog: useCatalogStore(), ctx: useAdminContext(), imp: useImpersonation() };
	},
	data() {
		return {
			navItems: [
				// "Rubros" gestiona TODOS los negocios (CRUD); va primero y separado.
				{ key: 'rubros', label: 'admin.nav.rubros', icon: 'pi pi-tags', to: '/admin', groupBreakAfter: true },
				// Canales y tareas del negocio ACTIVO.
				{ key: 'ml', label: 'admin.nav.ml', icon: 'pi pi-shopping-cart', to: '/admin/mercado-libre' },
				{ key: 'instagram', label: 'admin.nav.instagram', icon: 'pi pi-instagram', to: '/admin/instagram' },
				{ key: 'carga', label: 'admin.nav.carga', icon: 'pi pi-upload', to: '/admin/cargar-productos' },
				{ key: 'cobros', label: 'admin.nav.cobros', icon: 'pi pi-credit-card', to: '/admin/cobros' },
				{ key: 'nosotros', label: 'admin.nav.nosotros', icon: 'pi pi-id-card', to: '/admin/nosotros' },
			] as NavItem[],
		};
	},
	computed: {
		/** Opciones del selector de negocio. */
		rubroOptions(): { label: string; value: string }[] {
			return this.catalog.rubros.map(r => ({ label: r.nombre, value: r.id }));
		},
		/** Negocio (rubro) activo, enganchado al contexto persistido. */
		currentRubroId: {
			get(): string {
				return this.ctx.currentRubroId;
			},
			set(id: string) {
				this.ctx.setRubro(id);
			},
		},
		email(): string {
			return useUserStore().profile?.email ?? '';
		},
		nombre(): string {
			const p = useUserStore().profile;
			return p?.displayName || p?.email || '';
		},
		inicial(): string {
			return (this.nombre.trim()[0] || '?').toUpperCase();
		},
		userMenuItems() {
			return [{ label: this.$t('common.logout'), icon: 'pi pi-sign-out', command: () => this.onLogout() }];
		},
	},
	async created() {
		// Necesitamos el slug del negocio para armar el link "Ver el sitio".
		if (!this.catalog.miEspacio) {
			await this.catalog.fetchMiEspacio().catch(() => undefined);
		}
		// Cargamos los negocios (rubros) para el selector y fijamos uno por defecto.
		if (!this.catalog.rubros.length) {
			await this.catalog.fetchRubros().catch(() => undefined);
		}
		const ids = this.catalog.rubros.map(r => r.id);
		if (!this.ctx.currentRubroId || !ids.includes(this.ctx.currentRubroId)) {
			this.ctx.setRubro(this.catalog.rubros[0]?.id ?? '');
		}
	},
	methods: {
		/** Va a la vitrina pública en la MISMA pestaña, en su host propio (no un push
		 *  interno: la vitrina se resuelve por hostname, así que hay que cambiar de
		 *  host, no solo de path). */
		openSite() {
			if (!this.catalog.miEspacio) return;
			// Vamos a la vitrina (otro origen) llevando el origen del panel, para poder
			// volver: la sesión sigue viva acá, no en el host de la vitrina.
			window.location.href = vitrinaUrlWithReturn(this.catalog.miEspacio);
		},
		toggleUserMenu(event: Event) {
			(this.$refs.userMenu as { toggle: (e: Event) => void }).toggle(event);
		},
		isActive(item: NavItem): boolean {
			const path = this.$route.path;
			if (item.key === 'nosotros') return path.startsWith('/admin/nosotros');
			if (item.key === 'carga') return path.startsWith('/admin/cargar-productos');
			if (item.key === 'ml') return path.startsWith('/admin/mercado-libre');
			if (item.key === 'instagram') return path.startsWith('/admin/instagram');
			if (item.key === 'cobros') return path.startsWith('/admin/cobros');
			// "Rubros" queda activo en la lista, productos y planes de suscripción.
			if (item.key === 'rubros') return path === '/admin' || path.startsWith('/admin/rubros');
			return false;
		},
		/** Sale del modo "ver como" y vuelve al panel de superadmin. */
		exitImpersonation() {
			this.imp.exit();
			this.catalog.$reset();
			this.ctx.$reset();
			this.$router.push('/superadmin');
		},
		async onLogout() {
			// Si estaba "viendo como" un cliente, cortamos la impersonación.
			this.imp.exit();
			await useUserStore().logout();
			// Al cerrar sesión volvemos a la página pública como visitante.
			this.$router.replace('/');
		},
	},
});
</script>
