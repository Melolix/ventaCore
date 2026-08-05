<template>
	<div class="min-h-screen bg-surface-50 dark:bg-surface-950">
		<!-- Topbar -->
		<header
			class="fixed top-0 left-0 z-50 flex h-16 w-full items-center justify-between border-b border-surface-200/60 bg-surface-0/70 px-6 backdrop-blur-xl dark:border-surface-700/60 dark:bg-surface-900/70"
		>
			<div class="flex items-center gap-3">
				<BrandLogo :size="28" />
				<span class="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
					{{ $t('areas.superadmin') }}
				</span>
			</div>

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
				<h2 class="text-lg font-black text-primary">{{ $t('superadmin.panelTitle') }}</h2>
				<p class="text-xs text-surface-500">{{ $t('superadmin.panelSubtitle') }}</p>
			</div>

			<nav class="flex flex-1 flex-col gap-1">
				<router-link
					v-for="item in navItems"
					:key="item.key"
					:to="item.to"
					class="flex items-center gap-3 rounded-xl bg-primary/10 p-3 text-sm font-semibold text-primary shadow-sm transition-all"
				>
					<i :class="item.icon" />
					<span>{{ $t(item.label) }}</span>
				</router-link>
			</nav>
		</aside>

		<!-- Contenido -->
		<main class="mt-16 ml-64 min-h-[calc(100vh-64px)] p-6">
			<router-view />
		</main>

		<!-- El <Toast /> vive en App.vue (raíz); no repetirlo acá o los toasts salen dobles. -->
		<ConfirmDialog />
	</div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { useUserStore } from '@/modules/auth/store/user';
import { isDark, toggleTheme } from '@/composables/useTheme';
import BrandLogo from '@/shared/components/BrandLogo.vue';

export default defineComponent({
	name: 'SuperadminLayout',
	components: { BrandLogo },
	setup() {
		return { isDark, toggleTheme };
	},
	data() {
		return {
			navItems: [
				{ key: 'espacios', label: 'superadmin.nav.espacios', icon: 'pi pi-building', to: '/superadmin' },
			],
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
	methods: {
		toggleUserMenu(event: Event) {
			(this.$refs.userMenu as { toggle: (e: Event) => void }).toggle(event);
		},
		async onLogout() {
			await useUserStore().logout();
			this.$router.replace('/');
		},
	},
});
</script>
