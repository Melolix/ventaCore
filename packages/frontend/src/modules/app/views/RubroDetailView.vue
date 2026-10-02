<template>
	<div>
		<!-- Hero del rubro (3:1 en desktop → coincide con el recorte de la portada) -->
		<section class="relative mb-10 min-h-[18rem] overflow-hidden rounded-[2rem] md:min-h-0 md:aspect-[3/1]">
			<div
				class="absolute inset-0 bg-cover bg-center"
				:style="rubro?.imageUrl ? { backgroundImage: `url('${rubro.imageUrl}')`, backgroundPosition: rubro.imageFocus || undefined } : {}"
				:class="[{ 'primary-gradient': !rubro?.imageUrl }, isApps && rubro?.imageUrl ? 'scale-110 blur-xl' : '']"
			>
				<!-- En apps el fondo va desenfocado: el título se lee limpio y no compite
				     con el texto de la propia portada/banner. -->
				<div
					class="absolute inset-0"
					:class="isApps ? 'bg-gradient-to-r from-black/80 via-black/60 to-black/40' : 'bg-gradient-to-r from-black/70 to-black/10'"
				/>
			</div>
			<div class="relative flex h-full flex-col justify-center gap-3 p-8 md:p-12">
				<!-- En modo "home" (negocio de un solo rubro) esta vista ES la vitrina:
				     no hay a dónde "volver" ni sentido en la etiqueta de sector. -->
				<Button
					v-if="!isHome"
					:label="$t('public.back')"
					icon="pi pi-arrow-left"
					text
					class="w-fit !text-white"
					@click="goBack"
				/>
				<span v-if="!isHome" class="flex w-fit items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3 py-1 backdrop-blur-md">
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
			<!-- Apps con varias audiencias: pestañas por sección (usuario/entrenador/admin…) -->
			<div v-if="isApps && showTabs" class="mb-6 overflow-x-auto">
				<SelectButton
					v-model="activeSeccion"
					:options="seccionOptions"
					option-label="label"
					option-value="value"
					:allow-empty="false"
					class="w-fit"
				/>
			</div>

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

			<!-- Con categorías: menú a la izquierda (lg+) o tira fija arriba (mobile) y
			     los productos agrupados por categoría. Sin categorías (o en apps): un
			     solo grupo sin título, igual que antes. -->
			<div v-else :class="showCategorias ? 'lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-8' : ''">
				<nav
					v-if="showCategorias"
					ref="catNav"
					class="cat-nav sticky top-16 z-30 -mx-6 mb-5 flex gap-2 overflow-x-auto border-b border-surface-200/70 bg-surface-50/95 px-6 py-2.5 backdrop-blur lg:top-24 lg:mx-0 lg:mb-0 lg:max-h-[calc(100dvh-7.5rem)] lg:flex-col lg:gap-1 lg:self-start lg:overflow-y-auto lg:overflow-x-hidden lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none dark:border-surface-700/70 dark:bg-surface-950/95 lg:dark:bg-transparent"
					:aria-label="$t('public.categories')"
				>
					<p class="mb-1 hidden px-3 text-[11px] font-bold uppercase tracking-widest text-surface-400 lg:block">{{ $t('public.categories') }}</p>
					<button
						v-for="g in groups"
						:key="g.key"
						type="button"
						:data-cat="g.key"
						class="flex shrink-0 items-center justify-between gap-2 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors lg:w-full lg:whitespace-normal lg:rounded-xl lg:border-0 lg:px-3 lg:py-2 lg:text-left"
						:class="activeCat === g.key
							? 'border-primary bg-primary text-primary-contrast lg:bg-primary/10 lg:text-primary'
							: 'border-surface-200 bg-surface-0 text-surface-600 hover:text-primary dark:border-surface-700 dark:bg-surface-900 dark:text-surface-300 lg:bg-transparent lg:hover:bg-surface-100 lg:dark:bg-transparent lg:dark:hover:bg-surface-800'"
						:aria-current="activeCat === g.key ? 'true' : undefined"
						@click="goToCat(g.key)"
					>
						<span class="min-w-0 lg:truncate">{{ g.label }}</span>
						<span class="hidden text-xs font-medium opacity-60 lg:inline">{{ g.items.length }}</span>
					</button>
				</nav>
				<div class="min-w-0 space-y-10">
				<section
					v-for="g in groups"
					:key="g.key"
					:data-cat-section="g.key"
					class="scroll-mt-32 lg:scroll-mt-24"
				>
				<h2 v-if="showCategorias" class="mb-4 flex items-baseline gap-2 text-xl font-extrabold text-surface-900 dark:text-surface-0">
					{{ g.label }}
					<span class="text-sm font-medium text-surface-400">{{ g.items.length }}</span>
				</h2>
				<div class="grid grid-cols-1 gap-8 sm:grid-cols-2 xl:grid-cols-3">
				<div
					v-for="producto in g.items"
					:key="producto.id"
					class="glass-card group flex flex-col overflow-hidden rounded-2xl transition-all hover:scale-[1.02]"
				>
					<div
						class="relative overflow-hidden bg-surface-100 dark:bg-surface-800"
						:class="isApps ? 'h-72' : 'h-56'"
					>
						<template v-if="producto.imageUrl">
							<!-- Apps: la captura se ve ENTERA (contain) sobre un fondo blur de sí
							     misma → sirve igual para capturas de escritorio (apaisadas) y de
							     celular (verticales), sin recortes feos. -->
							<template v-if="isApps">
								<div
									class="absolute inset-0 scale-110 bg-cover bg-center opacity-40 blur-2xl"
									:style="{ backgroundImage: `url('${producto.imageUrl}')` }"
								/>
								<img
									:src="producto.imageUrl"
									:alt="producto.nombre"
									class="relative h-full w-full cursor-zoom-in object-contain transition-transform duration-500 group-hover:scale-105"
									@click="openLightbox(producto)"
								/>
							</template>
							<!-- Catálogo: la foto entra ENTERA (contain) sobre un fondo borroso de
							     sí misma. Las fotos que cargan los clientes vienen con cualquier
							     relación de aspecto (collages, verticales, con carteles): así no se
							     recorta nada y el marco queda uniforme entre todas las cards. -->
							<template v-else>
								<div
									class="absolute inset-0 scale-110 bg-cover bg-center opacity-40 blur-2xl"
									:style="{ backgroundImage: `url('${producto.imageUrl}')` }"
								/>
								<img
									:src="producto.imageUrl"
									:alt="producto.nombre"
									class="relative h-full w-full object-contain transition-transform duration-500 group-hover:scale-105"
								/>
							</template>
						</template>
						<div v-else class="flex h-full w-full items-center justify-center text-surface-400">
							<i :class="isApps ? 'pi pi-image' : 'pi pi-shopping-bag'" class="text-4xl" />
						</div>
						<!-- Precio siempre presente para que todas las cards alineen igual:
						     si el producto no tiene precio, mostramos "Consultar precio". -->
						<span
							v-if="!isApps"
							class="absolute right-4 top-4 rounded-full px-3 py-1 shadow-sm backdrop-blur-sm"
							:class="producto.precio != null
								? 'bg-white/90 font-bold text-primary dark:bg-surface-900/80'
								: 'bg-surface-900/70 text-xs font-semibold text-white/90'"
						>
							{{ producto.precio != null ? formatPrice(producto.precio) : $t('public.consultPrice') }}
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
						<!-- line-clamp-2: los títulos largos (típicos de import de ML) se cortan
						     en 2 líneas con "…" → cards parejas. El texto completo, en el title. -->
						<h3 class="mb-2 line-clamp-2 text-lg font-bold text-surface-900 dark:text-surface-0" :title="producto.nombre">
							{{ producto.nombre }}
						</h3>
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
				</section>
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
/** Un grupo del catálogo: una categoría con sus productos. */
interface CatGroup {
	key: string;
	label: string;
	items: Producto[];
}
/** Clave del grupo de productos sin categoría. */
const OTROS_KEY = '__otros';
interface Download {
	key: string;
	url: string;
	label: string;
	icon: string;
	primary: boolean;
}

export default defineComponent({
	name: 'RubroDetailView',
	props: {
		/** Rubro a mostrar cuando se reusa fuera de la ruta (negocio de un solo rubro).
		 *  Si viene vacío, se toma el `:id` de la URL. */
		forcedRubroId: { type: String, default: '' },
		/** Modo vitrina: esta vista es la home del negocio (oculta "Volver" y la etiqueta). */
		isHome: { type: Boolean, default: false },
	},
	data() {
		return {
			catalog: useCatalogStore(),
			loading: false,
			search: '',
			sort: 'relevance' as SortKey,
			lightboxVisible: false,
			lightboxItem: null as Producto | null,
			activeSeccion: '',
			/** Categoría resaltada en el menú (la que se está viendo al hacer scroll). */
			activeCat: '',
			catObserver: null as IntersectionObserver | null,
		};
	},
	computed: {
		rubroId(): string {
			return this.forcedRubroId || (this.$route.params.id as string);
		},
		/** Secciones/pestañas distintas de las capturas, en orden de aparición. */
		secciones(): string[] {
			const out: string[] = [];
			for (const p of this.catalog.publicProductos) {
				if (p.seccion && !out.includes(p.seccion)) out.push(p.seccion);
			}
			return out;
		},
		seccionOptions(): { label: string; value: string }[] {
			return this.secciones.map(s => ({ label: s.charAt(0).toUpperCase() + s.slice(1), value: s }));
		},
		/** Muestra pestañas solo si la app tiene capturas de 2+ secciones. */
		showTabs(): boolean {
			return this.isApps && this.secciones.length >= 2;
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
		/**
		 * Productos agrupados por categoría, en el orden del menú que armó el
		 * vendedor (`rubro.categorias`). Después van las categorías que usan los
		 * productos pero no están en la lista, y al final "Otros" (sin categoría).
		 * Solo grupos con productos (el buscador los achica). En apps: un grupo.
		 */
		groups(): CatGroup[] {
			if (this.isApps) return [{ key: 'all', label: '', items: this.filtered }];
			const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();
			const order: { key: string; label: string }[] = (this.rubro?.categorias ?? []).map(c => ({ key: norm(c), label: c.trim() }));
			const known = new Set(order.map(o => o.key));
			const buckets = new Map<string, Producto[]>();
			for (const p of this.filtered) {
				const key = norm(p.seccion);
				if (key && !known.has(key)) {
					known.add(key);
					order.push({ key, label: (p.seccion ?? '').trim() });
				}
				const list = buckets.get(key);
				if (list) list.push(p);
				else buckets.set(key, [p]);
			}
			const out: CatGroup[] = [];
			for (const o of order) {
				const items = buckets.get(o.key);
				if (items?.length) out.push({ key: o.key, label: o.label, items });
			}
			const sin = buckets.get('');
			if (sin?.length) out.push({ key: OTROS_KEY, label: this.$t('public.otherCategory'), items: sin });
			return out;
		},
		/** Hay menú de categorías si el catálogo (sin filtrar) usa al menos una. */
		showCategorias(): boolean {
			return !this.isApps && this.catalog.publicProductos.some(p => (p.seccion ?? '').trim());
		},
		filtered(): Producto[] {
			const term = this.search.trim().toLowerCase();
			let list = this.catalog.publicProductos.filter(p => !term || p.nombre.toLowerCase().includes(term));
			// Apps con pestañas: mostrar solo las capturas de la sección activa.
			if (this.showTabs) list = list.filter(p => p.seccion === this.activeSeccion);
			if (this.sort !== 'relevance') {
				const dir = this.sort === 'priceAsc' ? 1 : -1;
				list = [...list].sort((a, b) => ((a.precio ?? 0) - (b.precio ?? 0)) * dir);
			}
			return list;
		},
	},
	watch: {
		// Las secciones cambian con el buscador/orden: re-enganchamos el seguimiento.
		groups() {
			this.$nextTick(() => this.observeSections());
		},
	},
	beforeUnmount() {
		this.catObserver?.disconnect();
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
			// Si hay pestañas, arrancamos en la primera sección.
			if (this.showTabs) this.activeSeccion = this.secciones[0];
		} catch {
			// Rubro inexistente o en borrador → volver a la vitrina del negocio.
			// (En modo home no redirigimos: esta vista ya ES la vitrina.)
			if (!this.isHome) this.goBack();
		} finally {
			this.loading = false;
			// Las secciones recién existen en el DOM cuando termina la carga.
			this.$nextTick(() => this.observeSections());
		}
	},
	methods: {
		/** Baja hasta la sección de esa categoría. */
		goToCat(key: string) {
			this.activeCat = key;
			const el = this.$el.querySelector(`[data-cat-section="${CSS.escape(key)}"]`) as HTMLElement | null;
			el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		},
		/**
		 * Marca en el menú la categoría que se está viendo. En mobile además trae
		 * su chip a la vista dentro de la tira (la tira scrollea sola, la página no).
		 */
		observeSections() {
			this.catObserver?.disconnect();
			if (!this.showCategorias) return;
			const sections = [...this.$el.querySelectorAll('[data-cat-section]')] as HTMLElement[];
			if (!sections.length) return;
			if (!sections.some(s => s.dataset.catSection === this.activeCat)) this.activeCat = sections[0].dataset.catSection ?? '';
			// El observer solo avisa de las secciones que CAMBIAN: llevamos la cuenta de
			// cuáles están en la franja y la activa es la primera de ellas (orden del DOM).
			const visible = new Set<Element>();
			this.catObserver = new IntersectionObserver(
				entries => {
					for (const e of entries) {
						if (e.isIntersecting) visible.add(e.target);
						else visible.delete(e.target);
					}
					const top = sections.find(s => visible.has(s));
					if (!top) return;
					this.activeCat = top.dataset.catSection ?? '';
					const nav = this.$refs.catNav as HTMLElement | undefined;
					const chip = nav?.querySelector(`[data-cat="${CSS.escape(this.activeCat)}"]`) as HTMLElement | null;
					if (nav && chip && nav.scrollWidth > nav.clientWidth) {
						nav.scrollTo({ left: chip.offsetLeft - nav.clientWidth / 2 + chip.clientWidth / 2, behavior: 'smooth' });
					}
				},
				// Franja de "lectura": debajo del header + menú fijos, mitad superior de la pantalla.
				{ rootMargin: '-140px 0px -55% 0px' },
			);
			for (const s of sections) this.catObserver.observe(s);
		},
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

<style scoped>
/* La tira de categorías (mobile) se desliza con el dedo, sin barra a la vista. */
.cat-nav {
	scrollbar-width: none;
}
.cat-nav::-webkit-scrollbar {
	display: none;
}
</style>
