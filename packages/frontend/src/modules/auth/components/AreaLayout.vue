<template>
	<div class="min-h-screen bg-surface-50 dark:bg-surface-950">
		<header
			class="flex items-center justify-between border-b border-surface-200 bg-white px-6 py-3 dark:border-surface-700 dark:bg-surface-900"
		>
			<div class="flex items-center gap-2">
				<span class="text-xs font-medium uppercase tracking-wide text-primary">{{ $t(`areas.${area}`) }}</span>
			</div>
			<div class="flex items-center gap-3">
				<Button
					:label="$t('admin.viewSite')"
					icon="pi pi-external-link"
					severity="secondary"
					size="small"
					outlined
					@click="$router.push('/app')"
				/>
				<span class="text-sm text-surface-600 dark:text-surface-300">{{ email }}</span>
				<Button :label="$t('common.logout')" severity="secondary" size="small" text @click="onLogout" />
			</div>
		</header>

		<main class="p-6">
			<router-view />
		</main>
	</div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import { type AreaKey } from '@base-template/shared';
import { useUserStore } from '@/modules/auth/store/user';

export default defineComponent({
	name: 'AreaLayout',
	props: {
		area: {
			type: String as PropType<AreaKey>,
			required: true,
		},
	},
	computed: {
		email(): string {
			return useUserStore().profile?.email ?? '';
		},
	},
	methods: {
		async onLogout() {
			await useUserStore().logout();
			// Al cerrar sesión volvemos a la página pública como visitante.
			this.$router.replace('/app');
		},
	},
});
</script>
