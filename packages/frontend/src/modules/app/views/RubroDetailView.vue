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
					<i :class="isApps ? 'pi pi-th-large' : 'pi pi-tag'" class="text-sm text-white" />
					<span class="text-xs font-bold uppercase tracking-wide text-white">{{ isApps ? $t('public.app') : $t('public.sector') }}</span>
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
				<div v-if="isApps" class="mt-3 flex flex-col gap-3">
					<!-- Plataformas disponibles -->
					<div v-if="appPlatforms.length" class="flex items-center gap-3 text-white/80">
						<i
							v-for="p in appPlatforms"
							:key="p"
							:class="platformIcon(p)"
							class="text-xl"
							:title="$t(`public.platform.${p}`)"
						/>
					</div>
					<!-- Descargas / abrir (con etiquetas claras) -->
					<div v-if="downloads.length" class="flex flex-wrap gap-3">
						<a
							v-for="d in downloads"
							:key="d.key"
							:href="d.url"
							target="_blank"
							rel="noopener"
							class="inline-flex items-center gap-2 rounded-xl px-5 py-3 font-semibold transition-transform hover:scale-[1.03]"
							:class="d.primary
								? 'primary-gradient text-white shadow-lg'
								: 'border border-white/40 bg-white/10 text-white backdrop-blur-md hover:bg-white/20'"
						>
							<i :class="d.icon" /> {{ d.label }}
						</a>
					</div>
				</div>
			</div>
		</section>

		<div class="mx-auto max-w-7xl">
			<!-- Filtros -->
			<div class="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
				<p class="text-surface-600 dark:text-surface-300">
					{{ isApps ? $t('public.showingScreens', { n: filtered.length }) : $t('public.showing', { n: filtered.length }) }}
				</p>
				<div v-if="!isApps" class="flex flex-col gap-3 sm:flex-row">
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
				{{ isApps ? $t('public.noScreens') : $t('public.noProducts') }}
			</div>

			<div v-else class="grid grid-cols-1 gap-8 sm:grid-cols-2 xl:grid-cols-3">
				<div
					v-for="producto in filtered"
					:key="producto.id"
					class="glass-card group flex flex-col overflow-hidden rounded-2xl transition-all hover:scale-[1.02]"
				>
					<div
						class="relative overflow-hidden bg-surface-100 dark:bg-surface-800"
						:class="isApps ? 'h-72' : 'h-56'"
					>
						<img
							v-if="producto.imageUrl"
							:src="producto.imageUrl"
							:alt="producto.nombre"
							class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
							:class="{ 'cursor-zoom-in': isApps }"
							@click="isApps && openLightbox(producto)"
						/>
						<div v-else class="flex h-full w-full items-center justify-center text-surface-400">
							<i :class="isApps ? 'pi pi-image' : 'pi pi-shopping-bag'" class="text-4xl" />
						</div>
						<span
							v-if="!isApps && producto.precio != null"
							class="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1 font-bold text-primary shadow-sm backdrop-blur-sm dark:bg-surface-900/80"
						>
							{{ formatPrice(producto.precio) }}
						</span>
						<!-- Apps: hint de "ampliar" (abre el lightbox) -->
						<button
							v-if="isApps && producto.imageUrl"
							type="button"
							class="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100"
							:aria-label="$t('public.viewFull')"
							@click="openLightbox(producto)"
						>
							<i class="pi pi-search-plus" />
						</button>
					</div>
					<div class="flex flex-1 flex-col p-6">
						<h3 class="mb-2 text-lg font-bold text-surface-900 dark:text-surface-0">{{ producto.nombre }}</h3>
						<p class="flex-1 text-sm text-surface-500" :class="isApps ? 'line-clamp-4' : 'mb-4 line-clamp-2'">
							{{ producto.descripcion || '' }}
						</p>
						<!-- En apps las cards son capturas: sin botones (la descarga va en el hero). -->
						<template v-if="!isApps">
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
						</template>
					</div>
				</div>
			</div>
		</div>

		<!-- Lightbox: captura ampliada al centro (solo apps) -->
		<Dialog
			v-model:visible="lightboxVisible"
			modal
			dismissable-mask
			:show-header="false"
			class="w-full max-w-5xl"
			:pt="{ content: { class: '!p-0 !bg-transparent !overflow-visible' } }"
		>
			<div class="relative">
				<img
					:src="lightboxItem?.imageUrl || ''"
					:alt="lightboxItem?.nombre"
					class="max-h-[82vh] w-full rounded-2xl bg-black object-contain"
				/>
				<button
					type="button"
					class="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/80"
					:aria-label="$t('common.cancel')"
					@click="lightboxVisible = false"
				>
					<i class="pi pi-times" />
				</button>
				<div class="absolute inset-x-0 bottom-0 rounded-b-2xl bg-gradient-to-t from-black/80 to-transparent p-6 text-white">
					<h4 class="text-lg font-bold">{{ lightboxItem?.nombre }}</h4>
					<p v-if="lightboxItem?.descripcion" class="mt-1 text-sm text-white/85">{{ lightboxItem.descripcion }}</p>
				</div>
			</div>
		</Dialog>
	</div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { AppPlatform, EspacioType, Role, type Producto } from '@base-template/shared';
import { useCatalogStore } from '@/modules/admin/store/catalog';
import { useUserStore } from '@/modules/auth/store/user';
import { PLATFORM_ICON, effectivePlatforms } from '@/shared/utils/apps';

type SortKey = 'relevance' | 'priceAsc' | 'priceDesc';
interface Download {
	key: string;
	url: string;
	label: string;
	icon: string;
	primary: boolean;
}

export default defineComponent({
	name: 'RubroDetailView',
	data() {
		return {
			catalog: useCatalogStore(),
			loading: false,
			search: '',
			sort: 'relevance' as SortKey,
			lightboxVisible: false,
			lightboxItem: null as Producto | null,
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
		/** Plataformas de la app (con fallback a los links si el admin no eligió). */
		appPlatforms(): AppPlatform[] {
			return this.rubro ? effectivePlatforms(this.rubro) : [];
		},
		/** Botones de descarga/abrir del hero, con etiquetas claras. */
		downloads(): Download[] {
			const r = this.rubro;
			if (!r) return [];
			const list: Download[] = [];
			if (r.androidUrl) {
				const isStore = /play\.google\.com/i.test(r.androidUrl);
				list.push({
					key: 'android',
					url: r.androidUrl,
					label: this.$t(isStore ? 'public.download.playstore' : 'public.download.apk'),
					icon: 'pi pi-android',
					primary: true,
				});
			}
			if (r.iosUrl) {
				list.push({ key: 'ios', url: r.iosUrl, label: this.$t('public.download.appstore'), icon: 'pi pi-apple', primary: false });
			}
			if (r.webUrl) {
				list.push({ key: 'web', url: r.webUrl, label: this.$t('public.download.openWeb'), icon: 'pi pi-globe', primary: false });
			}
			return list;
		},
		/** Espacios tipo "apps": los "productos" son capturas de la app. */
		isApps(): boolean {
			return this.espacio?.type === EspacioType.APPS;
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
		platformIcon(p: AppPlatform): string {
			return PLATFORM_ICON[p];
		},
		/** Abre una captura ampliada en el lightbox central. */
		openLightbox(producto: Producto) {
			this.lightboxItem = producto;
			this.lightboxVisible = true;
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
