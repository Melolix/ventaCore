<template>
	<div class="mx-auto flex max-w-lg flex-col items-center gap-6 py-20 text-center">
		<div class="flex h-20 w-20 items-center justify-center rounded-3xl bg-green-100 text-green-600 dark:bg-green-950/40 dark:text-green-400">
			<i class="pi pi-check-circle text-4xl" />
		</div>
		<h1 class="text-3xl font-extrabold text-surface-900 dark:text-surface-0">
			{{ $t('public.subscriptions.gracias.title') }}
		</h1>
		<p class="max-w-md text-surface-600 dark:text-surface-300">
			{{ $t('public.subscriptions.gracias.subtitle') }}
		</p>
		<Button
			:label="$t('public.subscriptions.gracias.back')"
			icon="pi pi-home"
			class="primary-gradient border-0 px-6 font-semibold text-white"
			@click="$router.push('/')"
		/>
	</div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
	name: 'SuscripcionesGraciasView',
});
</script>
