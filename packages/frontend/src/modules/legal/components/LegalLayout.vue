<template>
	<div class="min-h-screen bg-surface-50 px-4 py-10 dark:bg-surface-950 md:py-16">
		<article class="glass-card mx-auto max-w-3xl rounded-2xl p-6 md:p-10">
			<header class="mb-8 border-b border-surface-200 pb-6 dark:border-surface-700">
				<span class="text-xs font-bold uppercase tracking-widest text-primary">{{ TITULAR.marca }} · {{ TITULAR.producto }}</span>
				<h1 class="mt-2 text-3xl font-extrabold text-surface-900 dark:text-surface-0">{{ title }}</h1>
				<p class="mt-2 text-sm text-surface-500">Última actualización: {{ TITULAR.actualizado }}</p>
			</header>

			<div class="legal-prose text-surface-700 dark:text-surface-200">
				<slot />
			</div>

			<footer class="mt-10 border-t border-surface-200 pt-6 text-sm text-surface-500 dark:border-surface-700">
				<p>
					{{ TITULAR.nombreLegal }} (CUIT {{ TITULAR.cuit }}) · {{ TITULAR.domicilio }} ·
					<a :href="`mailto:${TITULAR.email}`" class="text-primary">{{ TITULAR.email }}</a>
				</p>
				<nav class="mt-3 flex flex-wrap gap-4">
					<router-link to="/privacidad" class="text-primary">Política de privacidad</router-link>
					<router-link to="/terminos" class="text-primary">Términos y condiciones</router-link>
					<router-link to="/eliminar-datos" class="text-primary">Eliminación de datos</router-link>
				</nav>
			</footer>
		</article>
	</div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { TITULAR } from '../titular';

/** Marco común de las páginas legales: globales, no dependen del negocio del dominio. */
export default defineComponent({
	name: 'LegalLayout',
	props: {
		title: { type: String, required: true },
	},
	data() {
		return { TITULAR };
	},
});
</script>

<style scoped>
.legal-prose :deep(h2) {
	margin-top: 2rem;
	margin-bottom: 0.75rem;
	font-size: 1.25rem;
	font-weight: 700;
}
.legal-prose :deep(p),
.legal-prose :deep(ul) {
	margin-bottom: 1rem;
	line-height: 1.7;
}
.legal-prose :deep(ul) {
	list-style: disc;
	padding-left: 1.5rem;
}
.legal-prose :deep(li) {
	margin-bottom: 0.35rem;
}
.legal-prose :deep(a) {
	color: var(--p-primary-color);
}
</style>
