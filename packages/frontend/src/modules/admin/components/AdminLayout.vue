<template>
	<div class="min-h-screen bg-surface-50 dark:bg-surface-950">
		<!-- Topbar -->
		<header
			class="fixed top-0 left-0 z-50 flex h-16 w-full items-center justify-between border-b border-surface-200/60 bg-surface-0/70 px-6 backdrop-blur-xl dark:border-surface-700/60 dark:bg-surface-900/70"
		>
			<BrandLogo :size="30" />

			<div class="flex items-center gap-3">
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
					<span class="hidden max-w-[10rem] truncate text-sm font-semibold text-surface-700 dark:text-surface-200 sm:inline">
						{{ nombre }}
					</span>
					<i class="pi pi-chevron-down text-xs text-surface-400" />
				</button>
				<Menu ref="userMenu" :model="userMenuItems" popup>
					<template #start>
						<div class="border-b border-surface-200 px-3 py-2 dark:border-surface-700">
							<p class="text-xs text-surface-400">{{ $t('common.signedInAs') }}</p>
							<p class="max-w-[14rem] truncate text-sm font-medium text-surface-700 dark:text-surface-200">{{ email }}</p>
						</div>
					</template>
				</Menu>
			</div>
		</header>

		<!-- Sidebar -->
		<aside
			class="fixed top-16 left-0 z-40 flex h-[calc(100vh-64px)] w-64 flex-col border-r border-surface-200/60 bg-surface-0/60 p-4 backdrop-blur-2xl dark:border-surface-700/60 dark:bg-surface-900/60"
		>
			<div class="mb-8 px-3">
				<h2 class="text-lg font-black text-primary">{{ $t('admin.panelTitle') }}</h2>
				<p class="text-xs text-surface-500">{{ $t('admin.panelSubtitle') }}</p>
			</div>

			<nav class="flex flex-1 flex-col gap-1">
				<router-link
					v-for="item in navItems"
					:key="item.key"
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
			</nav>

			<!-- Acción al pie: ver la vitrina pública -->
			<div class="mt-2 border-t border-surface-200/60 pt-3 dark:border-surface-700/60">
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
import { isDark, toggleTheme } from '@/composables/useTheme';
import { vitrinaUrl } from '@/shared/utils/site';
import BrandLogo from '@/shared/components/BrandLogo.vue';

interface NavItem {
	key: string;
	label: string;
	icon: string;
	to: string;
	disabled?: boolean;
}

export default defineComponent({
	name: 'AdminLayout',
	components: { BrandLogo },
	setup() {
		return { isDark, toggleTheme, catalog: useCatalogStore() };
	},
	data() {
		return {
			navItems: [
				{ key: 'rubros', label: 'admin.nav.rubros', icon: 'pi pi-tags', to: '/admin' },
				{ key: 'nosotros', label: 'admin.nav.nosotros', icon: 'pi pi-id-card', to: '/admin/nosotros' },
			] as NavItem[],
		};
	},
	computed: {
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
	},
	methods: {
		/** Abre la vitrina pública en su host propio (no un push interno: la vitrina
		 *  se resuelve por hostname, así que hay que cambiar de host, no solo de path). */
		openSite() {
			if (!this.catalog.miEspacio) return;
			window.open(vitrinaUrl(this.catalog.miEspacio), '_blank', 'noopener');
		},
		toggleUserMenu(event: Event) {
			(this.$refs.userMenu as { toggle: (e: Event) => void }).toggle(event);
		},
		isActive(item: NavItem): boolean {
			const path = this.$route.path;
			if (item.key === 'nosotros') return path.startsWith('/admin/nosotros');
			// "Rubros" queda activo en la lista y en la vista de productos.
			if (item.key === 'rubros') return path === '/admin' || path.startsWith('/admin/rubros');
			return false;
		},
		async onLogout() {
			await useUserStore().logout();
			// Al cerrar sesión volvemos a la página pública como visitante.
			this.$router.replace('/');
		},
	},
});
</script>
