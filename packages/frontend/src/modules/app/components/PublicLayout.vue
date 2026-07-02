<template>
	<div class="min-h-screen bg-surface-50 dark:bg-surface-950">
		<header
			class="flex items-center justify-between border-b border-surface-200 bg-white px-6 py-3 dark:border-surface-700 dark:bg-surface-900"
		>
			<div class="flex items-center gap-2">
				<span class="text-base font-semibold text-surface-900 dark:text-surface-0">{{ $t('app.brand') }}</span>
			</div>
			<div class="flex items-center gap-3">
				<template v-if="isAuthenticated">
					<Button :label="$t('nav.goToPanel')" size="small" @click="onGoToPanel" />
					<Button :label="$t('common.logout')" severity="secondary" size="small" text @click="onLogout" />
				</template>
				<Button v-else :label="$t('common.login')" size="small" @click="onSignIn" />
			</div>
		</header>

		<main class="p-6">
			<router-view />
		</main>
	</div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { areaForRole } from '@base-template/shared';
import { useUserStore } from '@/modules/auth/store/user';

export default defineComponent({
	name: 'PublicLayout',
	computed: {
		isAuthenticated(): boolean {
			return useUserStore().isAuthenticated;
		},
	},
	created() {
		// Resuelve la sesión de forma no bloqueante para decidir qué botón mostrar.
		// El público anónimo no espera a Firebase: por defecto se ve "Iniciar sesión".
		void useUserStore().currentUser();
	},
	methods: {
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
