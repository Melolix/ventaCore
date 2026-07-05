<template>
	<div class="mx-auto max-w-5xl">
		<!-- Hero -->
		<header class="relative mb-16 overflow-hidden rounded-[2rem] px-6 py-16 text-center md:py-20">
			<div class="absolute inset-0 -z-10 bg-gradient-to-b from-primary/5 to-transparent" />
			<span class="text-xs font-bold uppercase tracking-widest text-primary">{{ $t('public.about.eyebrow') }}</span>
			<h1 class="mx-auto mt-3 max-w-3xl text-4xl font-extrabold leading-tight text-surface-900 dark:text-surface-0 md:text-5xl">
				{{ espacio?.aboutHeadline || $t('public.about.defaultHeadline', { nombre: espacio?.nombre || '' }) }}
			</h1>
		</header>

		<!-- Historia + imagen -->
		<section class="mb-16 grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
			<div :class="espacio?.aboutImageUrl ? 'order-2 lg:order-1' : 'lg:col-span-2 text-center max-w-2xl mx-auto'">
				<span class="text-xs font-bold uppercase tracking-widest text-primary">{{ $t('public.about.storyEyebrow') }}</span>
				<div
					v-if="aboutHtml"
					class="about-prose mt-4 text-lg leading-relaxed text-surface-600 dark:text-surface-300"
					v-html="aboutHtml"
				/>
				<p v-else class="mt-4 text-lg leading-relaxed text-surface-600 dark:text-surface-300">
					{{ $t('public.about.empty') }}
				</p>

				<a
					v-if="espacio?.instagramUrl"
					:href="espacio.instagramUrl"
					target="_blank"
					rel="noopener"
					class="primary-gradient mt-8 inline-flex items-center gap-2 rounded-full px-6 py-3 font-semibold text-white shadow-lg transition hover:brightness-110"
				>
					<i class="pi pi-instagram" /> {{ $t('public.about.instagram') }}
				</a>
			</div>

			<div v-if="espacio?.aboutImageUrl" class="order-1 lg:order-2">
				<div class="relative">
					<div class="absolute -right-4 -top-4 -z-10 h-full w-full rounded-2xl bg-primary/10" />
					<img
						:src="espacio.aboutImageUrl"
						:alt="espacio?.nombre"
						class="aspect-video w-full rounded-2xl object-cover shadow-xl md:aspect-square"
					/>
				</div>
			</div>
		</section>
	</div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import type { Espacio } from '@base-template/shared';
import { useCatalogStore } from '@/modules/admin/store/catalog';
import { renderRichText } from '@/modules/app/utils/richText';

export default defineComponent({
	name: 'AboutView',
	computed: {
		espacio(): Espacio | null {
			return useCatalogStore().currentEspacio;
		},
		aboutHtml(): string {
			return renderRichText(this.espacio?.aboutText);
		},
	},
});
</script>

<style scoped>
.about-prose :deep(p) {
	margin-bottom: 1rem;
}
.about-prose :deep(p:last-child) {
	margin-bottom: 0;
}
.about-prose :deep(strong),
.about-prose :deep(b) {
	font-weight: 700;
	color: var(--p-surface-900);
}
:global(.dark) .about-prose :deep(strong),
:global(.dark) .about-prose :deep(b) {
	color: var(--p-surface-0);
}
.about-prose :deep(ul),
.about-prose :deep(ol) {
	margin: 0.75rem 0;
	padding-left: 1.5rem;
}
.about-prose :deep(ul) {
	list-style: disc;
}
.about-prose :deep(ol) {
	list-style: decimal;
}
.about-prose :deep(li) {
	margin-bottom: 0.35rem;
}
.about-prose :deep(a) {
	color: var(--p-primary-color);
	text-decoration: underline;
}
</style>
