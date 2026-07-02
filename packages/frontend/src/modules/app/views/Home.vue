<template>
	<div class="mx-auto max-w-7xl">
		<!-- Hero -->
		<header class="mb-12 flex flex-col items-center rounded-[2rem] px-6 py-16 text-center md:py-20">
			<h1 class="mb-6 max-w-3xl text-4xl font-extrabold leading-tight text-surface-900 dark:text-surface-0 md:text-5xl">
				{{ $t('public.hero.titlePre') }} <span class="text-primary">{{ $t('public.hero.titleHi') }}</span>
			</h1>
			<p class="mb-10 max-w-2xl text-lg text-surface-600 dark:text-surface-300">
				{{ $t('public.hero.subtitle') }}
			</p>
			<Button
				:label="$t('public.hero.cta')"
				icon="pi pi-arrow-down"
				icon-pos="right"
				rounded
				class="primary-gradient border-0 px-8 py-3 font-semibold text-white"
				@click="scrollToGrid"
			/>
		</header>

		<!-- Bento de rubros -->
		<section ref="grid" class="mb-16 scroll-mt-24">
			<div v-if="loading" class="py-16 text-center text-surface-500">
				<i class="pi pi-spin pi-spinner text-3xl" />
			</div>

			<div v-else-if="!rubros.length" class="glass-card rounded-3xl p-12 text-center text-surface-500">
				{{ $t('public.empty') }}
			</div>

			<div v-else class="bento-grid">
				<router-link
					v-for="(rubro, i) in rubros"
					:key="rubro.id"
					:to="{ name: 'app-rubro-detalle', params: { id: rubro.id } }"
					:class="spanClass(i)"
					class="group relative flex flex-col overflow-hidden rounded-[2rem] transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-primary/10"
				>
					<!-- Imagen o degradé -->
					<div class="relative flex-1 overflow-hidden bg-surface-100 dark:bg-surface-800">
						<img
							v-if="rubro.imageUrl"
							:src="rubro.imageUrl"
							:alt="rubro.nombre"
							class="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
						/>
						<div v-else class="primary-gradient flex h-full w-full items-center justify-center opacity-90">
							<i class="pi pi-tag text-5xl text-white/70" />
						</div>
						<span class="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 backdrop-blur-md dark:bg-surface-900/80">
							<i class="pi pi-tag text-sm text-primary" />
							<span class="text-xs font-bold text-primary">{{ rubro.nombre }}</span>
						</span>
					</div>
					<!-- Pie -->
					<div class="flex items-end justify-between gap-4 bg-white/80 p-6 backdrop-blur-md dark:bg-surface-900/70">
						<div class="min-w-0">
							<h3 class="truncate text-lg font-bold text-surface-900 dark:text-surface-0">{{ rubro.nombre }}</h3>
							<p class="line-clamp-1 text-sm text-surface-500">{{ rubro.descripcion || ' ' }}</p>
						</div>
						<div class="flex-shrink-0 text-right">
							<span class="block text-xl font-extrabold text-primary">{{ rubro.productCount ?? 0 }}</span>
							<span class="text-[10px] uppercase tracking-wider text-surface-400">{{ $t('public.products') }}</span>
						</div>
					</div>
				</router-link>
			</div>
		</section>

		<!-- Stats (ilustrativas) -->
		<section class="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
			<div v-for="stat in stats" :key="stat.label" class="rounded-3xl border border-primary/10 bg-primary/5 p-6 text-center">
				<span class="block text-3xl font-extrabold text-primary">{{ stat.value }}</span>
				<span class="text-xs font-semibold uppercase text-surface-400">{{ $t(stat.label) }}</span>
			</div>
		</section>
	</div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import type { Rubro } from '@base-template/shared';
import { useCatalogStore } from '@/modules/admin/store/catalog';

// Patrón cíclico de anchos (12 columnas) que llena filas: 8+4 / 4+4+4 / 6+6.
// Con grid-auto-flow: dense cualquier cantidad de rubros queda prolija.
const SPAN_CYCLE = [
	'md:col-span-8',
	'md:col-span-4',
	'md:col-span-4',
	'md:col-span-4',
	'md:col-span-4',
	'md:col-span-6',
	'md:col-span-6',
];

export default defineComponent({
	name: 'AppHome',
	data() {
		return {
			catalog: useCatalogStore(),
			loading: false,
			stats: [
				{ value: '98%', label: 'public.stats.conversion' },
				{ value: '15k+', label: 'public.stats.leads' },
				{ value: '24/7', label: 'public.stats.support' },
				{ value: '500+', label: 'public.stats.catalogs' },
			],
		};
	},
	computed: {
		rubros(): Rubro[] {
			return this.catalog.publicRubros;
		},
	},
	async created() {
		this.loading = true;
		try {
			await this.catalog.fetchPublicRubros();
		} finally {
			this.loading = false;
		}
	},
	methods: {
		spanClass(i: number): string {
			return SPAN_CYCLE[i % SPAN_CYCLE.length];
		},
		scrollToGrid() {
			(this.$refs.grid as HTMLElement | undefined)?.scrollIntoView({ behavior: 'smooth' });
		},
	},
});
</script>

<style scoped>
.bento-grid {
	display: grid;
	grid-template-columns: 1fr;
	grid-auto-rows: 300px;
	gap: 1.5rem;
	grid-auto-flow: dense;
}

@media (min-width: 768px) {
	.bento-grid {
		grid-template-columns: repeat(12, minmax(0, 1fr));
	}
}
</style>
