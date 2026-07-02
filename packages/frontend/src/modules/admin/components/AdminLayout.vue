<template>
	<div class="min-h-screen bg-surface-50 dark:bg-surface-950">
		<!-- Topbar -->
		<header
			class="fixed top-0 left-0 z-50 flex h-16 w-full items-center justify-between border-b border-surface-200/60 bg-surface-0/70 px-6 backdrop-blur-xl dark:border-surface-700/60 dark:bg-surface-900/70"
		>
			<span class="text-xl font-extrabold text-primary">{{ $t('app.brand') }}</span>

			<div class="flex items-center gap-3">
				<Button
					:label="$t('admin.viewSite')"
					icon="pi pi-external-link"
					severity="secondary"
					size="small"
					outlined
					@click="$router.push('/app')"
				/>
				<span class="hidden text-sm font-semibold text-surface-700 dark:text-surface-200 sm:inline">
					{{ email }}
				</span>
				<Button
					:label="$t('common.logout')"
					icon="pi pi-sign-out"
					severity="secondary"
					size="small"
					text
					@click="onLogout"
				/>
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

interface NavItem {
	key: string;
	label: string;
	icon: string;
	to: string;
	disabled?: boolean;
}

export default defineComponent({
	name: 'AdminLayout',
	data() {
		return {
			navItems: [
				{ key: 'rubros', label: 'admin.nav.rubros', icon: 'pi pi-tags', to: '/admin' },
				{ key: 'creativos', label: 'admin.nav.creativos', icon: 'pi pi-palette', to: '/admin', disabled: true },
				{ key: 'config', label: 'admin.nav.config', icon: 'pi pi-cog', to: '/admin', disabled: true },
			] as NavItem[],
		};
	},
	computed: {
		email(): string {
			return useUserStore().profile?.email ?? '';
		},
	},
	methods: {
		isActive(item: NavItem): boolean {
			// "Rubros" queda activo tanto en la lista como en la vista de productos.
			return item.key === 'rubros' && this.$route.path.startsWith('/admin');
		},
		async onLogout() {
			await useUserStore().logout();
			// Al cerrar sesión volvemos a la página pública como visitante.
			this.$router.replace('/app');
		},
	},
});
</script>
