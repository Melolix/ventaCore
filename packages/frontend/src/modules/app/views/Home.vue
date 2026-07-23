<template>
	<div class="mx-auto max-w-7xl">
		<!-- Hero del negocio -->
		<header class="mb-12 flex flex-col items-center gap-5 rounded-[2rem] px-6 py-14 text-center">
			<div v-if="espacio?.logoUrl" class="h-24 w-24 overflow-hidden rounded-3xl shadow-lg">
				<img :src="espacio.logoUrl" class="h-full w-full object-cover" :alt="espacio?.nombre" />
			</div>
			<div v-else class="primary-gradient flex h-24 w-24 items-center justify-center rounded-3xl shadow-lg">
				<i class="pi pi-building text-3xl text-white" />
			</div>
			<h1 class="max-w-3xl text-4xl font-extrabold leading-tight text-surface-900 dark:text-surface-0 md:text-5xl">
				{{ espacio?.nombre }}
			</h1>
			<p v-if="espacio?.descripcion" class="max-w-2xl text-lg text-surface-600 dark:text-surface-300">
				{{ espacio.descripcion }}
			</p>
		</header>

		<!-- Bento de rubros del negocio -->
		<section class="mb-16">
			<div v-if="!rubros.length" class="glass-card rounded-3xl p-12 text-center text-surface-500">
				{{ $t('public.empty') }}
			</div>

			<div v-else class="bento-grid" :class="{ 'bento-grid--apps': isApps }">
				<component
					:is="isApps ? 'div' : 'router-link'"
					v-for="(rubro, i) in rubros"
					:key="rubro.id"
					:to="{ name: 'app-rubro-detalle', params: { id: rubro.id } }"
					:class="[spanClass(i), { 'cursor-pointer': isApps }]"
					class="group relative flex flex-col overflow-hidden rounded-[2rem] transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-primary/10"
					@click="onTileClick(rubro.id)"
				>
					<div class="relative flex-1 overflow-hidden bg-surface-100 dark:bg-surface-800">
						<img
							v-if="rubro.imageUrl"
							:src="rubro.imageUrl"
							:alt="rubro.nombre"
							class="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
						/>
						<div v-else class="primary-gradient flex h-full w-full items-center justify-center opacity-90">
							<i :class="isApps ? 'pi pi-th-large' : 'pi pi-tag'" class="text-5xl text-white/70" />
						</div>
						<span class="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 backdrop-blur-md dark:bg-surface-900/80">
							<i :class="isApps ? 'pi pi-th-large' : 'pi pi-tag'" class="text-sm text-primary" />
							<span class="text-xs font-bold text-primary">{{ rubro.nombre }}</span>
						</span>
					</div>
					<div class="bg-white/80 p-6 backdrop-blur-md dark:bg-surface-900/70">
						<!-- Catálogo comercial: info + conteo de productos -->
						<div v-if="!isApps" class="flex items-end justify-between gap-4">
							<div class="min-w-0">
								<h3 class="truncate text-lg font-bold text-surface-900 dark:text-surface-0">{{ rubro.nombre }}</h3>
								<p class="line-clamp-1 text-sm text-surface-500">{{ rubro.descripcion || ' ' }}</p>
							</div>
							<div class="flex-shrink-0 text-right">
								<span class="block text-xl font-extrabold text-primary">{{ rubro.productCount ?? 0 }}</span>
								<span class="text-[10px] uppercase tracking-wider text-surface-400">{{ $t('public.products') }}</span>
							</div>
						</div>
						<!-- Página de apps: info + links de descarga (Android/iOS) -->
						<template v-else>
							<div class="mb-4 min-w-0">
								<h3 class="truncate text-lg font-bold text-surface-900 dark:text-surface-0">{{ rubro.nombre }}</h3>
								<p class="line-clamp-3 text-sm text-surface-500">{{ rubro.descripcion || ' ' }}</p>
							</div>
							<div class="flex items-center gap-3">
								<!-- Íconos de plataforma (no descargas: eso va en el detalle) -->
								<div class="flex items-center gap-2.5 text-surface-400 dark:text-surface-500">
									<i
										v-for="p in appPlatforms(rubro)"
										:key="p"
										:class="platformIcon(p)"
										class="text-lg"
										:title="$t(`public.platform.${p}`)"
									/>
								</div>
								<span class="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-primary">
									{{ $t('public.viewScreens') }} <i class="pi pi-arrow-right text-xs" />
								</span>
							</div>
						</template>
					</div>
				</component>
			</div>
		</section>
	</div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { AppPlatform, EspacioType, type Espacio, type Rubro } from '@base-template/shared';
import { useCatalogStore } from '@/modules/admin/store/catalog';
import { PLATFORM_ICON, effectivePlatforms } from '@/shared/utils/apps';

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
		};
	},
	computed: {
		espacio(): Espacio | null {
			return this.catalog.currentEspacio;
		},
		rubros(): Rubro[] {
			return this.catalog.publicRubros;
		},
		/** Espacios tipo "apps": cada rubro es una app con links de descarga. */
		isApps(): boolean {
			return this.espacio?.type === EspacioType.APPS;
		},
	},
	methods: {
		spanClass(i: number): string {
			return SPAN_CYCLE[i % SPAN_CYCLE.length];
		},
		appPlatforms(rubro: Rubro): AppPlatform[] {
			return effectivePlatforms(rubro);
		},
		platformIcon(p: AppPlatform): string {
			return PLATFORM_ICON[p];
		},
		/** En apps el tile es un <div> (para poder anidar los links de descarga):
		 *  navegamos al detalle a mano. En catálogo lo maneja el router-link. */
		onTileClick(id: string): void {
			if (this.isApps) this.$router.push({ name: 'app-rubro-detalle', params: { id } });
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

/* Página de apps: tiles más altos para dar aire a la portada y a la descripción. */
.bento-grid--apps {
	grid-auto-rows: 440px;
}

@media (min-width: 768px) {
	.bento-grid {
		grid-template-columns: repeat(12, minmax(0, 1fr));
	}
}
</style>
