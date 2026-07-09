<template>
	<div>
		<!-- Hero del rubro (3:1 en desktop → coincide con el recorte de la portada) -->
		<section class="relative mb-10 min-h-[18rem] overflow-hidden rounded-[2rem] md:min-h-0 md:aspect-[3/1]">
			<div
				class="absolute inset-0 bg-cover bg-center"
				:style="rubro?.imageUrl ? { backgroundImage: `url('${rubro.imageUrl}')` } : {}"
				:class="{ 'primary-gradient': !rubro?.imageUrl }"
			>
				<div class="absolute inset-0 bg-gradient-to-r from-black/70 to-black/10" />
			</div>
			<div class="relative flex h-full flex-col justify-center gap-3 p-8 md:p-12">
				<Button
					:label="$t('public.back')"
					icon="pi pi-arrow-left"
					text
					class="w-fit !text-white"
					@click="goBack"
				/>
				<span class="flex w-fit items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3 py-1 backdrop-blur-md">
					<i class="pi pi-tag text-sm text-white" />
					<span class="text-xs font-bold uppercase tracking-wide text-white">{{ $t('public.sector') }}</span>
				</span>
				<div class="flex items-center gap-4">
					<div
						v-if="rubro?.logoUrl"
						class="h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-white/20 shadow-lg md:h-16 md:w-16"
					>
						<img :src="rubro.logoUrl" :alt="rubro?.nombre" class="h-full w-full object-cover" />
					</div>
					<h1 class="max-w-2xl text-3xl font-extrabold leading-tight text-white md:text-4xl">
						{{ rubro?.nombre || $t('public.detailTitle') }}
					</h1>
				</div>
				<p v-if="rubro?.descripcion" class="max-w-xl text-white/85">{{ rubro.descripcion }}</p>
			</div>
		</section>

		<div class="mx-auto max-w-7xl">
			<!-- Filtros -->
			<div class="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
				<p class="text-surface-600 dark:text-surface-300">
					{{ $t('public.showing', { n: filtered.length }) }}
				</p>
				<div class="flex flex-col gap-3 sm:flex-row">
					<IconField>
						<InputIcon class="pi pi-search" />
						<InputText v-model="search" :placeholder="$t('public.searchPlaceholder')" class="w-full sm:w-64" />
					</IconField>
					<Select v-model="sort" :options="sortOptions" option-label="label" option-value="value" class="w-full sm:w-56" />
				</div>
			</div>

			<!-- Grid de productos -->
			<div v-if="loading" class="py-16 text-center text-surface-500">
				<i class="pi pi-spin pi-spinner text-3xl" />
			</div>

			<div v-else-if="!filtered.length" class="glass-card rounded-3xl p-12 text-center text-surface-500">
				{{ $t('public.noProducts') }}
			</div>

			<div v-else class="grid grid-cols-1 gap-8 sm:grid-cols-2 xl:grid-cols-3">
				<div
					v-for="producto in filtered"
					:key="producto.id"
					class="glass-card group flex flex-col overflow-hidden rounded-2xl transition-all hover:scale-[1.02]"
				>
					<div class="relative h-56 overflow-hidden bg-surface-100 dark:bg-surface-800">
						<img
							v-if="producto.imageUrl"
							:src="producto.imageUrl"
							:alt="producto.nombre"
							class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
						/>
						<div v-else class="flex h-full w-full items-center justify-center text-surface-400">
							<i class="pi pi-shopping-bag text-4xl" />
						</div>
						<span
							v-if="producto.precio != null"
							class="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1 font-bold text-primary shadow-sm backdrop-blur-sm dark:bg-surface-900/80"
						>
							{{ formatPrice(producto.precio) }}
						</span>
					</div>
					<div class="flex flex-1 flex-col p-6">
						<h3 class="mb-2 text-lg font-bold text-surface-900 dark:text-surface-0">{{ producto.nombre }}</h3>
						<p class="mb-4 line-clamp-2 flex-1 text-sm text-surface-500">{{ producto.descripcion || '' }}</p>
						<!-- Admin logueado: publicar (por ahora abre el Instagram del rubro) -->
						<Button
							v-if="isAdmin"
							:label="$t('public.generateAd')"
							icon="pi pi-instagram"
							:disabled="!rubro?.instagramUrl"
							:title="rubro?.instagramUrl ? '' : $t('public.noInstagram')"
							class="primary-gradient mt-auto w-full border-0 py-2.5 font-semibold text-white"
							@click="publicar"
						/>
						<!-- Cliente/visitante: consultar al vendedor por WhatsApp -->
						<Button
							v-else-if="espacio?.whatsapp"
							:label="$t('public.consultWhatsapp')"
							icon="pi pi-whatsapp"
							class="primary-gradient mt-auto w-full border-0 py-2.5 font-semibold text-white"
							@click="consultarWhatsapp(producto)"
						/>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { Role, type Producto } from '@base-template/shared';
import { useCatalogStore } from '@/modules/admin/store/catalog';
import { useUserStore } from '@/modules/auth/store/user';

type SortKey = 'relevance' | 'priceAsc' | 'priceDesc';

export default defineComponent({
	name: 'RubroDetailView',
	data() {
		return {
			catalog: useCatalogStore(),
			loading: false,
			search: '',
			sort: 'relevance' as SortKey,
		};
	},
	computed: {
		rubroId(): string {
			return this.$route.params.id as string;
		},
		rubro() {
			return this.catalog.currentRubro;
		},
		espacio() {
			return this.catalog.currentEspacio;
		},
		isAdmin(): boolean {
			return useUserStore().role === Role.ADMIN;
		},
		sortOptions(): { label: string; value: SortKey }[] {
			return [
				{ label: this.$t('public.sort.relevance'), value: 'relevance' },
				{ label: this.$t('public.sort.priceAsc'), value: 'priceAsc' },
				{ label: this.$t('public.sort.priceDesc'), value: 'priceDesc' },
			];
		},
		filtered(): Producto[] {
			const term = this.search.trim().toLowerCase();
			let list = this.catalog.publicProductos.filter(p => !term || p.nombre.toLowerCase().includes(term));
			if (this.sort !== 'relevance') {
				const dir = this.sort === 'priceAsc' ? 1 : -1;
				list = [...list].sort((a, b) => ((a.precio ?? 0) - (b.precio ?? 0)) * dir);
			}
			return list;
		},
	},
	async created() {
		this.loading = true;
		try {
			// Sesión no bloqueante (para saber si mostrar acciones de admin).
			void useUserStore().currentUser();
			await Promise.all([
				this.catalog.fetchPublicRubro(this.rubroId),
				this.catalog.fetchPublicProductos(this.rubroId),
			]);
		} catch {
			// Rubro inexistente o en borrador → volver a la vitrina del negocio.
			this.goBack();
		} finally {
			this.loading = false;
		}
	},
	methods: {
		goBack() {
			this.$router.push('/');
		},
		formatPrice(value: number): string {
			return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
		},
		/** Admin: por ahora abre el Instagram del rubro para armar la publicación. */
		publicar() {
			const url = this.rubro?.instagramUrl;
			if (url) window.open(url, '_blank', 'noopener');
		},
		/** Cliente: abre WhatsApp con una consulta sobre el producto. */
		consultarWhatsapp(producto: Producto) {
			const num = (this.espacio?.whatsapp || '').replace(/\D/g, '');
			if (!num) return;
			const msg = this.$t('public.whatsappMsg', { producto: producto.nombre });
			window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
		},
	},
});
</script>
