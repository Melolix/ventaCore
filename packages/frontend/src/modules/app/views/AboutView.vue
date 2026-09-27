<template>
	<div class="mx-auto max-w-5xl">
		<!-- Hero -->
		<header class="relative mb-10 overflow-hidden rounded-[2rem] px-6 py-10 text-center md:py-14">
			<div class="absolute inset-0 -z-10 bg-gradient-to-b from-primary/5 to-transparent" />
			<span class="text-xs font-bold uppercase tracking-widest text-primary">{{ $t('public.about.eyebrow') }}</span>
			<h1 class="mx-auto mt-3 max-w-3xl text-4xl font-extrabold leading-tight text-surface-900 dark:text-surface-0 md:text-5xl">
				{{ espacio?.aboutHeadline || $t('public.about.defaultHeadline', { nombre: espacio?.nombre || '' }) }}
			</h1>
			<!-- CTA principal en el hero: siempre visible en la pantalla inicial
			     (antes estaba al final del scroll). Único lugar para la acción. -->
			<a
				v-if="espacio?.instagramUrl"
				:href="espacio.instagramUrl"
				target="_blank"
				rel="noopener"
				class="primary-gradient mt-6 inline-flex items-center gap-2 rounded-full px-6 py-3 font-semibold text-white shadow-lg transition hover:brightness-110"
			>
				<i class="pi pi-instagram" /> {{ $t('public.about.instagram') }}
			</a>
		</header>

		<!-- Historia + imagen -->
		<section class="mb-12" lang="es">
			<!-- CON imagen: la imagen flota a la derecha (desde sm) y el texto la envuelve,
			     aprovechando todo el ancho con cualquier largo. En móvil va arriba, full width. -->
			<template v-if="espacio?.aboutImageUrl">
				<div class="relative mb-6 w-full sm:float-right sm:mb-3 sm:ml-8 sm:w-[46%] sm:max-w-md">
					<div class="absolute -right-3 -top-3 -z-10 h-full w-full rounded-2xl bg-primary/10" />
					<!-- Mismo aspecto (4:3) y object-cover que el editor → se ve idéntico al panel. -->
					<img
						:src="espacio.aboutImageUrl"
						:alt="espacio?.nombre"
						class="aspect-[4/3] w-full rounded-2xl object-cover shadow-xl"
					/>
				</div>

				<span class="block text-xs font-bold uppercase tracking-widest text-primary">{{ $t('public.about.storyEyebrow') }}</span>
				<div
					v-if="aboutHtml"
					class="about-prose mt-4 text-lg leading-relaxed text-surface-600 dark:text-surface-100"
					v-html="aboutHtml"
				/>
				<p v-else class="mt-4 text-lg leading-relaxed text-surface-600 dark:text-surface-100">
					{{ $t('public.about.empty') }}
				</p>

				<!-- clear-both: cierra el float de la imagen para que la sección
				     envuelva bien su alto. El CTA ahora vive en el hero. -->
				<div class="clear-both" />
			</template>

			<!-- SIN imagen: texto centrado. -->
			<div v-else class="mx-auto max-w-2xl text-center">
				<span class="text-xs font-bold uppercase tracking-widest text-primary">{{ $t('public.about.storyEyebrow') }}</span>
				<div
					v-if="aboutHtml"
					class="about-prose mt-4 text-lg leading-relaxed text-surface-600 dark:text-surface-100"
					v-html="aboutHtml"
				/>
				<p v-else class="mt-4 text-lg leading-relaxed text-surface-600 dark:text-surface-100">
					{{ $t('public.about.empty') }}
				</p>
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
/* Color base del texto enriquecido (los <p>/<li> lo heredan). Se fija acá
   —no solo con clases Tailwind— para ganarle en especificidad al v-html. */
.about-prose {
	color: var(--p-surface-600);
	/* Corta SOLO las palabras demasiado largas (y con guion real, gracias a
	   lang="es"), en vez de partir cualquier palabra a la mitad sin guion. El
	   resto de las palabras envuelven enteras. */
	hyphens: auto;
}
/* Ojo: NO usar `:global(.p-dark) .about-prose` acá. El compilador de estilos
   scoped de Vue descarta esa combinación (el selector nunca llega al CSS) y el
   texto queda con el color base tenue. Escribiéndolo así, Vue le agrega el
   atributo de scope al `.about-prose` → `.p-dark .about-prose[data-v-xxx]`
   (más específico que la regla base) y el color oscuro sí gana. */
.p-dark .about-prose {
	/* surface-100 = color de texto principal del tema oscuro (bien legible;
	   surface-200/300 quedaban casi iguales entre sí y muy tenues). */
	color: var(--p-surface-100);
}
.about-prose :deep(p) {
	margin-bottom: 1rem;
}
.about-prose :deep(p:last-child) {
	margin-bottom: 0;
}
/* El color de la negrita (<strong>/<b>) se define en style.css (global),
   porque necesita alcanzar el contenido v-html y reaccionar a .p-dark. */
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
