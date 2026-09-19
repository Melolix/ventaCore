<template>
	<div class="mx-auto max-w-6xl">
		<!-- Encabezado -->
		<div class="mb-6 flex flex-wrap items-end justify-between gap-3">
			<div>
				<p class="ig-eyebrow text-xs font-extrabold uppercase tracking-widest">{{ $t('admin.estudio.eyebrow') }}</p>
				<h1 class="text-2xl font-extrabold text-surface-900 dark:text-surface-0">{{ $t('admin.estudio.title') }}</h1>
				<p class="mt-1 text-sm text-surface-500">{{ $t('admin.estudio.subtitle') }}</p>
			</div>
			<div v-if="igUsername" class="flex items-center gap-2 rounded-full border border-surface-200 px-3 py-1.5 text-xs font-semibold dark:border-surface-700">
				<span class="ig-badge" /> {{ '@' + igUsername }} · {{ $t('admin.estudio.connected') }}
			</div>
		</div>

		<!-- Sin negocio -->
		<div v-if="!rubroId" class="glass-card rounded-2xl p-10 text-center text-surface-500">{{ $t('admin.businessNone') }}</div>

		<!-- No conectado -->
		<div
			v-else-if="!metaReady"
			class="flex flex-col items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 sm:flex-row sm:items-center sm:justify-between"
		>
			<p class="text-sm text-amber-700 dark:text-amber-300">{{ $t('admin.publish.notReady') }}</p>
			<Button :label="$t('admin.rubros.configure')" icon="pi pi-cog" size="small" outlined @click="$router.push({ name: 'admin-configuraciones' })" />
		</div>

		<template v-else>
			<div v-if="loading" class="py-16 text-center text-surface-500"><i class="pi pi-spin pi-spinner text-2xl" /></div>

			<div v-else-if="!catalog.productos.length" class="glass-card rounded-2xl p-10 text-center text-surface-500">
				{{ $t('admin.productos.empty') }}
			</div>

			<!-- Estudio -->
			<div v-else class="grid grid-cols-1 gap-4 lg:grid-cols-[244px_minmax(0,1fr)_320px]">
				<!-- A: producto -->
				<div class="glass-card rounded-2xl">
					<p class="px-4 pt-3 text-xs font-bold uppercase tracking-wide text-surface-400">{{ $t('admin.estudio.product') }}</p>
					<div class="relative m-3">
						<i class="pi pi-search pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-surface-400" />
						<InputText v-model="search" :placeholder="$t('admin.estudio.searchProduct')" class="w-full !py-1.5 !pl-8 text-sm" />
					</div>
					<div class="max-h-[460px] space-y-0.5 overflow-auto px-2 pb-3">
						<button
							v-for="p in filteredProducts"
							:key="p.id"
							type="button"
							class="flex w-full items-center gap-2.5 rounded-xl border border-transparent p-2 text-left transition-colors"
							:class="selectedId === p.id ? 'border-pink-500/30 bg-pink-500/10' : 'hover:bg-surface-100 dark:hover:bg-surface-800'"
							@click="selectProduct(p)"
						>
							<div class="h-9 w-9 flex-none overflow-hidden rounded-lg bg-surface-100 dark:bg-surface-800">
								<img v-if="p.imageUrl" :src="p.imageUrl" class="h-full w-full object-cover" alt="" />
								<div v-else class="flex h-full w-full items-center justify-center text-surface-400"><i class="pi pi-image text-xs" /></div>
							</div>
							<div class="min-w-0">
								<p class="truncate text-[13px] font-semibold text-surface-800 dark:text-surface-100">{{ p.nombre }}</p>
								<p class="text-xs" :class="selectedId === p.id ? 'font-semibold text-pink-500' : 'text-surface-400'">
									{{ p.precio != null ? money(p.precio) : $t('admin.estudio.noPrice') }}
								</p>
							</div>
						</button>
					</div>
				</div>

				<!-- B: vista previa -->
				<div class="glass-card flex flex-col gap-3 rounded-2xl p-4">
					<div class="flex gap-1.5">
						<button
							v-for="f in formats"
							:key="f.key"
							type="button"
							class="flex-1 rounded-lg border px-2 py-2 text-[13px] font-bold transition-colors"
							:class="format === f.key
								? 'border-transparent text-white ig-fill'
								: 'border-surface-200 bg-surface-50 text-surface-600 dark:border-surface-700 dark:bg-surface-800 dark:text-surface-300'"
							@click="format = f.key"
						>
							{{ f.label }}
						</button>
					</div>
					<div class="flex flex-1 items-center justify-center py-2">
						<div class="relative">
							<canvas
								ref="preview"
								class="max-h-[44vh] w-auto rounded-2xl shadow-xl"
								:style="{ maxWidth: '100%', aspectRatio: aspect }"
							/>
							<div v-if="imgLoading" class="absolute inset-0 flex items-center justify-center rounded-2xl bg-surface-900/30">
								<i class="pi pi-spin pi-spinner text-2xl text-white" />
							</div>
						</div>
					</div>

					<!-- Imágenes del producto: elegí cuál queda mejor en la plantilla. -->
					<div v-if="productImages.length > 1" class="flex flex-wrap justify-center gap-2">
						<button
							v-for="(img, i) in productImages"
							:key="i"
							type="button"
							class="h-11 w-11 overflow-hidden rounded-lg border-2 transition-all"
							:class="img === selectedImageUrl ? 'border-pink-500' : 'border-transparent opacity-60 hover:opacity-100'"
							@click="selectImage(img)"
						>
							<img :src="img" class="h-full w-full object-cover" alt="" />
						</button>
					</div>
				</div>

				<!-- C: diseño + publicar -->
				<div class="flex flex-col gap-4">
					<div class="glass-card rounded-2xl">
						<p class="px-4 pt-3 text-xs font-bold uppercase tracking-wide text-surface-400">{{ $t('admin.estudio.template') }}</p>
						<div class="grid grid-cols-3 gap-2 p-3">
							<button
								v-for="t in templates"
								:key="t.id"
								type="button"
								class="overflow-hidden rounded-xl border transition-all"
								:class="templateId === t.id ? 'border-pink-500 ring-2 ring-pink-500/40' : 'border-surface-200 dark:border-surface-700'"
								@click="templateId = t.id"
							>
								<canvas :ref="'thumb_' + t.id" class="block w-full" style="aspect-ratio:1/1" />
								<span class="block border-t border-surface-100 py-1 text-center text-[10px] font-bold text-surface-500 dark:border-surface-800">
									{{ $t('admin.estudio.tpl.' + t.id_label) }}
								</span>
							</button>
						</div>
						<div class="px-4 pb-4">
							<div class="mb-1.5 mt-1 flex items-center justify-between">
								<label class="text-xs font-bold uppercase tracking-wide text-surface-400">{{ $t('admin.estudio.caption') }}</label>
								<span class="text-[10px] tabular-nums" :class="caption.length > 2200 ? 'font-semibold text-red-500' : 'text-surface-400'">{{ caption.length }}/2200</span>
							</div>
							<Textarea v-model="caption" class="w-full !max-h-36 overflow-y-auto" rows="4" />
							<div class="mt-2.5 flex items-center gap-2 rounded-lg border border-dashed border-surface-300 px-3 py-2 text-xs text-surface-400 dark:border-surface-600">
								<i class="pi pi-video" /> {{ $t('admin.estudio.videoSoon') }}
								<span class="ml-auto rounded-full bg-surface-100 px-2 py-0.5 text-[10px] font-bold uppercase text-surface-400 dark:bg-surface-800">{{ $t('admin.estudio.optional') }}</span>
							</div>
						</div>
					</div>

					<div class="glass-card flex flex-col gap-2 rounded-2xl p-4">
						<Button
							:label="$t('admin.estudio.publishNow')"
							icon="pi pi-send"
							class="ig-fill w-full border-0 font-bold text-white"
							:loading="publishing"
							:disabled="!selectedId || imgLoading"
							@click="publish"
						/>
						<div class="grid grid-cols-2 gap-2">
							<Button :label="$t('admin.estudio.schedule')" icon="pi pi-clock" size="small" outlined disabled :title="$t('admin.estudio.soon')" />
							<Button :label="$t('admin.estudio.download')" icon="pi pi-download" size="small" outlined :disabled="!selectedId || imgLoading" @click="download" />
						</div>
						<Button :label="$t('admin.estudio.campaign')" icon="pi pi-megaphone" size="small" outlined disabled class="justify-start">
							<template #default>
								<span class="flex w-full items-center gap-2">
									<i class="pi pi-megaphone" /> {{ $t('admin.estudio.campaign') }}
									<span class="ml-auto rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">{{ $t('admin.estudio.soon') }}</span>
								</span>
							</template>
						</Button>
					</div>
				</div>
			</div>

			<!-- Publicaciones recientes: tira horizontal compacta (entra sin scroll de página). -->
			<div v-if="posts.length" class="mt-3">
				<h3 class="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-surface-400">{{ $t('admin.estudio.recent') }}</h3>
				<div class="flex gap-3 overflow-x-auto pb-1">
					<a
						v-for="p in posts"
						:key="p.id"
						:href="p.permalink || undefined"
						:target="p.permalink ? '_blank' : undefined"
						rel="noopener"
						class="glass-card w-24 flex-none overflow-hidden rounded-xl transition-opacity"
						:class="p.permalink ? 'cursor-pointer hover:opacity-90' : 'cursor-default'"
					>
						<div class="aspect-square bg-surface-100 dark:bg-surface-800">
							<img :src="p.imageUrl" class="h-full w-full object-cover" alt="" />
						</div>
						<div class="px-1.5 py-1">
							<p class="truncate text-[10px] font-medium text-surface-700 dark:text-surface-200" :title="p.productoNombre || ''">{{ p.productoNombre || '—' }}</p>
							<span class="mt-0.5 inline-block rounded-full bg-emerald-500/15 px-1.5 py-px text-[8px] font-bold uppercase text-emerald-600 dark:text-emerald-400">{{ $t('admin.estudio.statusPublished') }}</span>
						</div>
					</a>
				</div>
			</div>
		</template>
	</div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import type { MetaPost, MetaRubroState, Producto, Rubro } from '@base-template/shared';
import { useCatalogStore } from '@/modules/admin/store/catalog';
import { useAdminContext } from '@/modules/admin/store/context';
import { apiErrorMessage } from '@/shared/utils/apiError';
import { uploadImage } from '@/shared/utils/image';
import { TEMPLATES, FORMATS, formatPrice, type PostFormat } from '@/modules/admin/instagram/templates';
import { loadProductImage, renderTemplate, exportJpeg, type ProductBitmap, type PostContent } from '@/modules/admin/instagram/compose';

/**
 * Estudio de Instagram: convierte productos en posts con plantillas y los
 * publica en Instagram. La foto del producto se compone dentro de la plantilla
 * elegida en un canvas; al publicar, se exporta a JPEG, se sube a Storage y se
 * usa esa URL pública para publicar (reutiliza el publish de Meta ya existente).
 */
export default defineComponent({
	name: 'InstagramView',
	setup() {
		return { ctx: useAdminContext() };
	},
	data() {
		return {
			catalog: useCatalogStore(),
			loading: false,
			search: '',
			selectedId: '',
			templateId: TEMPLATES[0].id,
			format: 'square' as PostFormat,
			caption: '',
			bmp: null as ProductBitmap | null,
			logoBmp: null as ProductBitmap | null,
			selectedImageUrl: '',
			metaState: null as MetaRubroState | null,
			posts: [] as MetaPost[],
			imgLoading: false,
			publishing: false,
			templates: TEMPLATES,
			formats: [
				{ key: 'square' as PostFormat, label: 'Post 1:1' },
				{ key: 'portrait' as PostFormat, label: 'Retrato 4:5' },
				{ key: 'story' as PostFormat, label: 'Historia 9:16' },
			],
		};
	},
	computed: {
		rubroId(): string {
			return this.ctx.currentRubroId;
		},
		rubro(): Rubro | undefined {
			return this.catalog.rubroById(this.rubroId);
		},
		metaReady(): boolean {
			return !!this.rubro?.metaTargetId;
		},
		igUsername(): string | null {
			const target = this.metaState?.connection?.targets.find(t => t.id === this.rubro?.metaTargetId);
			return target?.igUsername ?? null;
		},
		selectedProduct(): Producto | undefined {
			return this.catalog.productos.find(p => p.id === this.selectedId);
		},
		/** Imágenes del producto elegido (para elegir cuál componer en la plantilla). */
		productImages(): string[] {
			const p = this.selectedProduct;
			if (!p) return [];
			const imgs = (p.imagenes ?? []).filter(Boolean);
			return imgs.length ? imgs : p.imageUrl ? [p.imageUrl] : [];
		},
		filteredProducts(): Producto[] {
			const q = this.search.trim().toLowerCase();
			return q ? this.catalog.productos.filter(p => p.nombre.toLowerCase().includes(q)) : this.catalog.productos;
		},
		/** Nombre del negocio que va como marca en la plantilla. */
		brand(): string {
			return this.rubro?.nombre ?? '';
		},
		content(): PostContent {
			return {
				nombre: this.selectedProduct?.nombre ?? '',
				precio: this.selectedProduct?.precio ?? null,
				brand: this.brand,
			};
		},
		aspect(): string {
			const f = FORMATS[this.format];
			return `${f.w} / ${f.h}`;
		},
	},
	watch: {
		rubroId() {
			void this.reload();
		},
		selectedId() {
			// Al cambiar de producto, arrancamos con su imagen de portada.
			this.selectedImageUrl = this.productImages[0] ?? '';
			void this.loadAndRender();
		},
		format() {
			this.render();
		},
		templateId() {
			this.render();
		},
	},
	async created() {
		if (!this.catalog.rubros.length) await this.catalog.fetchRubros().catch(() => undefined);
		await this.reload();
	},
	methods: {
		async reload() {
			if (!this.rubroId) return;
			this.loading = true;
			try {
				await this.catalog.fetchProductos(this.rubroId);
				this.metaState = await this.catalog.fetchMetaState(this.rubroId).catch(() => null);
				// Historial real de publicaciones (en simulación arranca vacío y se llena al publicar).
				this.posts = await this.catalog.fetchMetaPosts(this.rubroId).catch(() => []);
				// Logo del negocio para componerlo en las plantillas (si tiene; si no, va el nombre).
				this.logoBmp = await loadProductImage(this.rubro?.logoUrl);
				// Elegimos el primer producto con imagen (o el primero).
				const first = this.catalog.productos.find(p => p.imageUrl) ?? this.catalog.productos[0];
				this.selectedId = first?.id ?? '';
				this.selectedImageUrl = this.productImages[0] ?? '';
				this.caption = this.buildCaption();
				await this.loadAndRender();
			} catch {
				this.$toast.add({ severity: 'error', summary: this.$t('admin.errors.load'), life: 4000 });
			} finally {
				this.loading = false;
			}
		},
		selectProduct(p: Producto) {
			this.selectedId = p.id;
			this.caption = this.buildCaption(p);
		},
		buildCaption(p?: Producto): string {
			const prod = p ?? this.selectedProduct;
			if (!prod) return '';
			const parts = [prod.nombre];
			if (prod.descripcion) parts.push(prod.descripcion);
			if (prod.precio != null) parts.push(formatPrice(prod.precio));
			return parts.join('\n\n');
		},
		money(n: number): string {
			return formatPrice(n);
		},
		/** Elige otra imagen del producto para componer. */
		selectImage(url: string) {
			if (url === this.selectedImageUrl) return;
			this.selectedImageUrl = url;
			void this.loadAndRender();
		},
		/** Carga la foto elegida del producto (por proxy) y re-renderiza todo. */
		async loadAndRender() {
			const url = this.selectedImageUrl || this.selectedProduct?.imageUrl;
			this.imgLoading = true;
			try {
				this.bmp = await loadProductImage(url);
			} finally {
				this.imgLoading = false;
			}
			this.render();
		},
		/** Renderiza la vista previa grande + las miniaturas de plantillas. */
		render() {
			this.$nextTick(() => {
				const tpl = this.templates.find(t => t.id === this.templateId) ?? this.templates[0];
				const canvas = this.$refs.preview as HTMLCanvasElement | undefined;
				if (canvas) renderTemplate(canvas, tpl, this.format, this.content, this.bmp, this.logoBmp);
				// Miniaturas (siempre en cuadrado, para comparar diseños).
				for (const t of this.templates) {
					const ref = (this.$refs['thumb_' + t.id] as HTMLCanvasElement[] | HTMLCanvasElement | undefined);
					const c = Array.isArray(ref) ? ref[0] : ref;
					if (c) renderTemplate(c, t, 'square', this.content, this.bmp, this.logoBmp);
				}
			});
		},
		/** Exporta el post compuesto a un Blob JPEG. */
		async exportBlob(): Promise<Blob> {
			const tpl = this.templates.find(t => t.id === this.templateId) ?? this.templates[0];
			// Renderizamos en un canvas offscreen a resolución completa del formato.
			const canvas = document.createElement('canvas');
			renderTemplate(canvas, tpl, this.format, this.content, this.bmp, this.logoBmp);
			return exportJpeg(canvas);
		},
		async publish() {
			const prod = this.selectedProduct;
			if (!prod) return;
			this.publishing = true;
			try {
				const blob = await this.exportBlob();
				const imageUrl = await uploadImage(blob, 'instagram');
				const results = await this.catalog.publishProducto(this.rubroId, prod.id, {
					networks: ['instagram'],
					caption: this.caption.trim() || undefined,
					imageUrl,
					story: this.format === 'story',
				});
				const ok = results.some(r => r.network === 'instagram' && r.ok);
				if (ok) {
					this.addLocalPost(imageUrl);
					this.$toast.add({ severity: 'success', summary: this.$t('admin.estudio.published'), life: 4000 });
				} else {
					const err = results.find(r => r.network === 'instagram')?.error || '';
					this.$toast.add({ severity: 'error', summary: this.$t('admin.publish.failed'), detail: err, life: 7000 });
				}
			} catch (e: unknown) {
				this.$toast.add({ severity: 'error', summary: apiErrorMessage(e, this.$t('admin.publish.failed')), life: 6000 });
			} finally {
				this.publishing = false;
			}
		},
		/** Prepend optimista al historial local (feedback inmediato tras publicar). */
		addLocalPost(imageUrl: string) {
			const prod = this.selectedProduct;
			this.posts.unshift({
				id: 'local-' + Date.now(),
				network: 'instagram',
				productoId: prod?.id ?? null,
				productoNombre: prod?.nombre ?? null,
				imageUrl,
				caption: this.caption.trim() || null,
				mediaId: null,
				permalink: null,
				status: 'published',
				createdAt: new Date().toISOString(),
			});
			if (this.posts.length > 30) this.posts.length = 30;
		},
		async download() {
			const prod = this.selectedProduct;
			if (!prod) return;
			try {
				const blob = await this.exportBlob();
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = `${prod.nombre.replace(/[^\w\-]+/g, '_').slice(0, 40)}-${this.format}.jpg`;
				document.body.appendChild(a);
				a.click();
				a.remove();
				URL.revokeObjectURL(url);
			} catch (e: unknown) {
				this.$toast.add({ severity: 'error', summary: apiErrorMessage(e, this.$t('admin.publish.failed')), life: 5000 });
			}
		},
	},
});
</script>

<style scoped>
.ig-badge {
	width: 18px;
	height: 18px;
	border-radius: 5px;
	display: inline-block;
	background: linear-gradient(135deg, #feda75, #fa7e1e 26%, #d62976 55%, #962fbf 78%, #4f5bd5);
}
.ig-eyebrow {
	background: linear-gradient(135deg, #feda75, #fa7e1e 26%, #d62976 55%, #962fbf 78%, #4f5bd5);
	-webkit-background-clip: text;
	background-clip: text;
	color: transparent;
}
.ig-fill {
	background: linear-gradient(135deg, #feda75, #fa7e1e 26%, #d62976 55%, #962fbf 78%, #4f5bd5);
}
</style>
