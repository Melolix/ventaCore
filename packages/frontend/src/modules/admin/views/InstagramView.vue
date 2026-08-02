<template>
	<div class="mx-auto max-w-3xl">
		<!-- Encabezado -->
		<div class="mb-6">
			<p class="text-xs font-semibold uppercase tracking-wide text-pink-500">{{ $t('admin.instagram.eyebrow') }}</p>
			<h1 class="text-2xl font-extrabold text-surface-900 dark:text-surface-0">{{ $t('admin.instagram.title') }}</h1>
			<p class="mt-1 text-sm text-surface-500">{{ $t('admin.instagram.subtitle') }}</p>
		</div>

		<!-- Placeholder: esta pantalla la construye otra persona del equipo. -->
		<div class="glass-card rounded-2xl p-10 text-center">
			<div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-pink-500/10 text-pink-500">
				<i class="pi pi-instagram text-2xl" />
			</div>
			<p class="font-semibold text-surface-800 dark:text-surface-100">{{ $t('admin.instagram.soonTitle') }}</p>
			<p class="mx-auto mt-1 max-w-md text-sm text-surface-500">{{ $t('admin.instagram.soonBody') }}</p>
			<div class="mt-5">
				<Button
					:label="$t('admin.rubros.configure')"
					icon="pi pi-cog"
					outlined
					@click="$router.push({ name: 'admin-configuraciones' })"
				/>
			</div>
		</div>
	</div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
	name: 'InstagramView',
});
</script>
