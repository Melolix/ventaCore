<template>
	<div class="mx-auto max-w-6xl">
		<!-- Encabezado -->
		<div class="mb-6">
			<p class="text-xs font-semibold uppercase tracking-wide text-amber-500">{{ $t('admin.ml.eyebrow') }}</p>
			<h1 class="text-2xl font-extrabold text-surface-900 dark:text-surface-0">{{ $t('admin.ml.pageTitle') }}</h1>
			<p class="mt-1 text-sm text-surface-500">{{ $t('admin.ml.pageSubtitle') }}</p>
		</div>

		<!-- Sin negocio -->
		<div v-if="!rubro" class="glass-card rounded-2xl p-8 text-center text-surface-500">
			<i class="pi pi-arrow-up mb-3 block text-3xl text-surface-400" />
			{{ $t('admin.ml.pickAbove') }}
		</div>

		<!-- Cargando -->
		<div v-else-if="loading" class="py-16 text-center text-surface-500"><i class="pi pi-spin pi-spinner text-2xl" /></div>

		<!-- Negocio sin ML conectado -->
		<div v-else-if="!mlConnected" class="glass-card rounded-2xl p-8 text-center text-surface-500">
			<i class="pi pi-plug mb-3 block text-3xl text-amber-400" />
			<p class="mb-4">{{ $t('admin.ml.notConnectedHere', { nombre: rubro.nombre }) }}</p>
			<Button :label="$t('admin.rubros.configure')" icon="pi pi-cog" outlined @click="$router.push({ name: 'admin-configuraciones' })" />
		</div>

		<template v-else>
			<!-- Barra: filtros + buscador + importar -->
			<div class="mb-4 flex flex-wrap items-center gap-3">
				<div class="flex flex-wrap gap-1.5">
					<button
						v-for="f in filters"
						:key="f.key"
						type="button"
						class="rounded-full px-3 py-1.5 text-sm font-medium transition-colors"
						:class="activeFilter === f.key
							? 'bg-amber-500 text-white'
							: 'bg-surface-100 text-surface-600 hover:bg-surface-200 dark:bg-surface-800 dark:text-surface-300'"
						@click="activeFilter = f.key"
					>
						{{ $t(f.label) }} <span class="opacity-70">{{ counts[f.key] }}</span>
					</button>
				</div>
				<IconField class="ml-auto w-full sm:w-64">
					<InputIcon class="pi pi-search" />
					<InputText v-model="search" :placeholder="$t('admin.ml.searchPlaceholder')" class="w-full" />
				</IconField>
				<Button
					:label="$t('admin.carga.importMl.button')"
					icon="pi pi-cloud-download"
					size="small"
					outlined
					:loading="importing"
					@click="importListings"
				/>
			</div>

			<!-- Lista vacía -->
			<div v-if="!filtered.length" class="glass-card rounded-2xl p-10 text-center text-surface-500">
				{{ $t('admin.ml.emptyList') }}
			</div>

			<!-- Lista de productos -->
			<div v-else class="space-y-2">
				<div
					v-for="p in filtered"
					:key="p.id"
					class="glass-card flex flex-wrap items-center gap-4 rounded-2xl p-3.5"
				>
					<div class="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-surface-100 dark:bg-surface-800">
						<img v-if="p.imageUrl" :src="p.imageUrl" class="h-full w-full object-cover" alt="" />
						<div v-else class="flex h-full w-full items-center justify-center text-surface-400"><i class="pi pi-image" /></div>
					</div>
					<div class="min-w-0 flex-1">
						<p class="truncate font-semibold text-surface-900 dark:text-surface-0">{{ p.nombre }}</p>
						<div class="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-surface-500">
							<span v-if="p.mlCategoryName" class="inline-flex items-center gap-1"><i class="pi pi-tag" /> {{ p.mlCategoryName }}</span>
							<span v-else class="text-amber-600 dark:text-amber-400">{{ $t('admin.ml.noCategoryShort') }}</span>
							<span>·</span>
							<span>{{ $t('admin.ml.listingType.' + (p.mlListingType || 'gold_special')) }}</span>
							<span>·</span>
							<span :class="p.stock === 0 ? 'font-semibold text-red-500' : ''">{{ $t('admin.ml.stockN', { n: p.stock ?? '—' }) }}</span>
						</div>
					</div>
					<div class="text-right">
						<p class="text-[11px] uppercase tracking-wide text-surface-400">{{ $t('admin.ml.colMl') }}</p>
						<p class="font-semibold text-surface-800 dark:text-surface-100">{{ mlPriceLabel(p) }}</p>
						<!-- Beneficio real (tras comisión) sobre el costo. Deja ver de un vistazo si el precio está mal. -->
						<p v-if="benefit[p.id]" class="text-[11px] font-semibold" :class="benefitClass(benefit[p.id])">
							{{ benefitLabel(benefit[p.id]) }}
						</p>
						<p v-else-if="p.precioCosto == null" class="text-[11px] text-surface-300 dark:text-surface-600">{{ $t('admin.ml.noCostHint') }}</p>
					</div>
					<!-- Estado real en ML si está publicada; si no, el estado de la app. -->
					<Tag
						v-if="p.mlItemId && p.mlStatus"
						:value="$t('admin.ml.mlState.' + p.mlStatus)"
						:severity="statusSeverity(p.mlStatus)"
					/>
					<Tag v-else :value="$t('admin.ml.state.' + stateOf(p))" :severity="stateSeverity(stateOf(p))" />
					<div class="flex items-center gap-1">
						<a
							v-if="p.mlPermalink"
							:href="p.mlPermalink"
							target="_blank"
							rel="noopener"
							class="inline-flex h-9 w-9 items-center justify-center rounded-full text-emerald-500 hover:bg-emerald-500/10"
							:title="$t('admin.carga.pub.view')"
						><i class="pi pi-external-link" /></a>
						<Button :label="$t('admin.ml.editBtn')" icon="pi pi-sliders-h" size="small" text @click="openEditor(p)" />
					</div>
				</div>
			</div>
		</template>

		<!-- Editor + calculadora -->
		<Drawer v-model:visible="editorVisible" position="right" :style="{ width: 'min(44rem, 100vw)' }" :header="$t('admin.ml.editorTitle')">
			<div v-if="edit" class="flex flex-col gap-6">
				<!-- Cabecera: nombre + estado real en ML -->
				<div class="flex flex-wrap items-center gap-2">
					<p class="min-w-0 flex-1 truncate text-base font-semibold text-surface-900 dark:text-surface-0">{{ edit.nombre }}</p>
					<Tag v-if="edit.mlStatus" :value="$t('admin.ml.mlState.' + edit.mlStatus)" :severity="statusSeverity(edit.mlStatus)" />
				</div>

				<!-- Acciones sobre la publicación (solo si ya está publicada) -->
				<div v-if="edit.mlItemId" class="flex flex-wrap items-center gap-2">
					<a
						v-if="edit.mlPermalink"
						:href="edit.mlPermalink"
						target="_blank"
						rel="noopener"
						class="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-1.5 text-xs font-medium text-surface-600 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-300 dark:hover:bg-surface-800"
					>
						<i class="pi pi-external-link" /> {{ $t('admin.carga.pub.view') }}
					</a>
					<Button
						v-if="edit.mlStatus === 'active'"
						:label="$t('admin.ml.pause')"
						icon="pi pi-pause"
						size="small"
						severity="warn"
						outlined
						:loading="statusChanging"
						@click="toggleStatus('paused')"
					/>
					<Button
						v-else-if="edit.mlStatus === 'paused'"
						:label="$t('admin.ml.activate')"
						icon="pi pi-play"
						size="small"
						severity="success"
						outlined
						:loading="statusChanging"
						@click="toggleStatus('active')"
					/>
				</div>

				<!-- ── Precio y rentabilidad ── -->
				<section class="space-y-4">
					<h4 class="text-xs font-semibold uppercase tracking-wide text-surface-400">{{ $t('admin.ml.secPricing') }}</h4>

					<!-- Tipo de publicación -->
					<div class="space-y-1.5">
						<label class="text-xs font-semibold uppercase tracking-wide text-surface-500">{{ $t('admin.ml.listingTypeLabel') }}</label>
						<SelectButton
							v-model="edit.mlListingType"
							:options="listingTypeOptions"
							option-label="label"
							option-value="value"
							:allow-empty="false"
							@update:model-value="refreshFee"
						/>
					</div>

					<!-- Costo + margen -->
					<div class="grid grid-cols-2 gap-3">
						<div class="space-y-1.5">
							<label class="text-xs font-semibold uppercase tracking-wide text-surface-500">{{ $t('admin.ml.cost') }}</label>
							<InputNumber v-model="edit.precioCosto" fluid mode="currency" currency="ARS" locale="es-AR" :min="0" :max-fraction-digits="0" @update:model-value="onCostChange" />
						</div>
						<div class="space-y-1.5">
							<label class="text-xs font-semibold uppercase tracking-wide text-surface-500">{{ $t('admin.ml.margin') }}</label>
							<InputNumber v-model="margenPct" fluid suffix=" %" :min="0" :max="900" @update:model-value="applyMargin" />
						</div>
					</div>

					<!-- Precio tienda (neto objetivo) -->
					<div class="space-y-1.5">
						<label class="text-xs font-semibold uppercase tracking-wide text-surface-500">{{ $t('admin.ml.storePrice') }}</label>
						<InputNumber v-model="edit.precio" fluid mode="currency" currency="ARS" locale="es-AR" :min="0" :max-fraction-digits="0" @update:model-value="syncMargin" />
						<p class="text-[11px] text-surface-400">{{ $t('admin.ml.storePriceHint') }}</p>
					</div>

					<!-- Precio ML + calcular -->
					<div class="space-y-1.5">
						<label class="text-xs font-semibold uppercase tracking-wide text-surface-500">{{ $t('admin.ml.mlPrice') }}</label>
						<div class="flex gap-2">
							<InputNumber v-model="edit.precioMl" class="flex-1" fluid mode="currency" currency="ARS" locale="es-AR" :min="0" :max-fraction-digits="0" @update:model-value="onMlPriceChange" />
							<Button :label="$t('admin.ml.calcBtn')" icon="pi pi-calculator" :loading="calculating" :disabled="!canCalc" @click="calcMlPrice" />
						</div>
					</div>

					<!-- Desglose en vivo -->
					<div class="rounded-xl border border-surface-200 p-4 dark:border-surface-700">
						<div v-if="feeLoading" class="py-2 text-center text-surface-500"><i class="pi pi-spin pi-spinner" /></div>
						<div v-else-if="!edit.mlCategoryId" class="text-center text-xs text-surface-400">{{ $t('admin.ml.needCategory') }}</div>
						<div v-else-if="!edit.precioMl" class="text-center text-xs text-surface-400">{{ $t('admin.ml.needMlPrice') }}</div>
						<div v-else-if="fee" class="space-y-3">
							<div class="flex h-3 overflow-hidden rounded-full">
								<div class="bg-surface-400" :style="{ width: pct(costPart) + '%' }" :title="$t('admin.ml.cost')" />
								<div class="bg-emerald-500" :style="{ width: pct(gainPart) + '%' }" :title="$t('admin.ml.gain')" />
								<div class="bg-amber-500" :style="{ width: pct(fee.saleFeeAmount) + '%' }" :title="$t('admin.ml.commission')" />
							</div>
							<div class="grid grid-cols-3 gap-2 text-center text-xs">
								<div>
									<p class="text-surface-400">{{ $t('admin.ml.cost') }}</p>
									<p class="font-semibold text-surface-600 dark:text-surface-300">{{ costPart != null ? money(costPart) : '—' }}</p>
								</div>
								<div>
									<p class="text-surface-400">{{ $t('admin.ml.gain') }}</p>
									<p class="font-semibold" :class="loss ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'">
										{{ gainPart != null ? money(gainPart) : '—' }}
										<span v-if="gainPct != null" class="text-[11px]">({{ gainPct >= 0 ? '+' : '' }}{{ gainPct }}%)</span>
									</p>
								</div>
								<div>
									<p class="text-surface-400">{{ $t('admin.ml.commission') }} ({{ fee.percentageFee }}%)</p>
									<p class="font-semibold text-amber-600 dark:text-amber-400">{{ money(fee.saleFeeAmount) }}</p>
								</div>
							</div>
							<p v-if="loss" class="flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400">
								<i class="pi pi-exclamation-triangle" /> {{ $t('admin.ml.lossWarn') }}
							</p>
						</div>
					</div>
				</section>

				<!-- ── Datos ── -->
				<section class="space-y-4 border-t border-surface-200 pt-5 dark:border-surface-700">
					<h4 class="text-xs font-semibold uppercase tracking-wide text-surface-400">{{ $t('admin.ml.secData') }}</h4>

					<!-- Título -->
					<div class="space-y-1.5">
						<label class="text-xs font-semibold uppercase tracking-wide text-surface-500">{{ $t('admin.ml.fieldTitle') }}</label>
						<InputText v-model="edit.nombre" class="w-full" />
					</div>

					<!-- Descripción -->
					<div class="space-y-1.5">
						<label class="text-xs font-semibold uppercase tracking-wide text-surface-500">{{ $t('admin.ml.fieldDescription') }}</label>
						<Textarea v-model="edit.descripcion" class="w-full" rows="4" auto-resize />
						<p class="text-[11px] text-surface-400">{{ $t('admin.ml.descSyncHint') }}</p>
					</div>

					<!-- Stock + EAN -->
					<div class="grid grid-cols-2 gap-3">
						<div class="space-y-1.5">
							<label class="text-xs font-semibold uppercase tracking-wide text-surface-500">{{ $t('admin.carga.cols.stock') }}</label>
							<InputNumber v-model="edit.stock" fluid :min="0" :placeholder="'—'" />
							<p class="text-[11px] text-surface-400">{{ $t('admin.ml.stockHint') }}</p>
						</div>
						<div class="space-y-1.5">
							<label class="text-xs font-semibold uppercase tracking-wide text-surface-500">{{ $t('admin.carga.placeholders.ean') }}</label>
							<InputText v-model="edit.gtin" class="w-full" />
						</div>
					</div>

					<!-- SKU -->
					<div class="max-w-[14rem] space-y-1.5">
						<label class="text-xs font-semibold uppercase tracking-wide text-surface-500">SKU</label>
						<InputText v-model="edit.sku" class="w-full" />
					</div>
				</section>

				<!-- ── Ficha de Mercado Libre (categoría + atributos) ── -->
				<section class="space-y-4 border-t border-surface-200 pt-5 dark:border-surface-700">
					<h4 class="text-xs font-semibold uppercase tracking-wide text-surface-400">{{ $t('admin.ml.secFicha') }}</h4>

					<!-- Buscar en el catálogo de ML (autocompleta categoría + atributos) -->
				<div class="space-y-2 rounded-xl bg-primary/5 p-3">
					<label class="text-xs font-semibold uppercase tracking-wide text-surface-600 dark:text-surface-300">{{ $t('admin.carga.ml.catalogTitle') }}</label>
					<div class="flex gap-2">
						<InputText v-model="mlCatalogQuery" class="w-full" :placeholder="$t('admin.carga.ml.catalogPlaceholder')" @keyup.enter="searchCatalog" />
						<Button icon="pi pi-search" :loading="mlCatalogSearching" size="small" @click="searchCatalog" />
					</div>
					<div v-if="mlFillingCatalog" class="py-2 text-center text-xs text-surface-500"><i class="pi pi-spin pi-spinner" /> {{ $t('admin.carga.ml.catalogFilling') }}</div>
					<div v-else-if="mlCatalogResults.length" class="max-h-56 space-y-1 overflow-y-auto">
						<button v-for="r in mlCatalogResults" :key="r.id" type="button" class="flex w-full items-center gap-3 rounded-lg border border-surface-200 p-2 text-left transition-colors hover:bg-surface-50 dark:border-surface-700 dark:hover:bg-surface-800" @click="pickCatalogProduct(r)">
							<img v-if="r.thumbnail" :src="r.thumbnail" class="h-10 w-10 shrink-0 rounded object-contain" :alt="r.name" />
							<div v-else class="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-surface-100 text-surface-400 dark:bg-surface-800"><i class="pi pi-image" /></div>
							<span class="line-clamp-2 text-sm">{{ r.name }}</span>
						</button>
					</div>
					<p class="text-[11px] text-surface-400">{{ $t('admin.carga.ml.catalogHint') }}</p>
				</div>

				<!-- Categoría -->
				<div class="space-y-2">
					<label class="text-xs font-semibold uppercase tracking-wide text-surface-600 dark:text-surface-300">{{ $t('admin.carga.ml.categoryTitle') }}</label>
					<div class="flex items-center gap-2">
						<span class="flex-1 text-sm" :class="edit.mlCategoryName ? 'text-surface-800 dark:text-surface-100' : 'text-surface-400'">{{ edit.mlCategoryName || $t('admin.carga.ml.noCategory') }}</span>
						<Button :label="$t('admin.carga.ml.suggest')" icon="pi pi-sparkles" size="small" outlined :loading="mlPredicting" @click="suggestCategories" />
					</div>
					<div v-if="mlPredictions.length" class="space-y-1">
						<button
							v-for="p in mlPredictions"
							:key="p.categoryId"
							type="button"
							class="flex w-full items-center justify-between rounded-lg border p-2 text-left text-sm transition-colors"
							:class="p.categoryId === edit.mlCategoryId ? 'border-primary bg-primary/5' : 'border-surface-200 hover:bg-surface-50 dark:border-surface-700 dark:hover:bg-surface-800'"
							@click="pickCategory(p)"
						>
							<span>{{ p.categoryName }}</span>
							<i v-if="p.categoryId === edit.mlCategoryId" class="pi pi-check text-primary" />
						</button>
					</div>
				</div>

				<!-- Atributos obligatorios -->
				<div v-if="edit.mlCategoryId" class="space-y-3 border-t border-surface-200 pt-4 dark:border-surface-700">
					<label class="text-xs font-semibold uppercase tracking-wide text-surface-600 dark:text-surface-300">{{ $t('admin.carga.ml.attrsTitle') }}</label>
					<div v-if="mlLoadingAttrs" class="py-4 text-center text-surface-500"><i class="pi pi-spin pi-spinner" /></div>
					<p v-else-if="!mlAttrs.length" class="text-xs text-surface-400">{{ $t('admin.carga.ml.noAttrs') }}</p>
					<div v-else class="space-y-3">
						<div v-for="attr in mlAttrs" :key="attr.id" class="space-y-1">
							<label class="flex items-center gap-1.5 text-sm font-medium">
								<i class="pi text-xs" :class="attrFilled(attr) ? 'pi-check-circle text-green-500' : 'pi-exclamation-circle text-amber-500'" />
								{{ attr.name }}
							</label>
							<Select
								v-if="attrHasOptions(attr)"
								v-model="mlAttrValues[attr.id]"
								:options="attrValueOptions(attr)"
								option-label="label"
								option-value="value"
								filter
								:placeholder="$t('admin.carga.ml.attrPick')"
								class="w-full"
							/>
							<InputText v-else v-model="mlAttrValues[attr.id]" class="w-full" :placeholder="$t('admin.carga.ml.attrValue')" />
						</div>
					</div>
				</div>

				</section>

				<!-- ── Imágenes ── -->
				<section class="space-y-3 border-t border-surface-200 pt-5 dark:border-surface-700">
					<h4 class="text-xs font-semibold uppercase tracking-wide text-surface-400">{{ $t('admin.ml.secImages') }}</h4>
					<div class="grid grid-cols-3 gap-3 sm:grid-cols-4">
						<div
							v-for="(img, i) in edit.imagenes"
							:key="img"
							class="group relative aspect-square overflow-hidden rounded-xl border border-surface-200 dark:border-surface-700"
						>
							<img :src="img" class="h-full w-full object-cover" alt="" />
							<span v-if="i === 0" class="absolute left-1 top-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-white">{{ $t('admin.carga.images.cover') }}</span>
							<div class="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
								<Button v-if="i !== 0" icon="pi pi-star" rounded size="small" :title="$t('admin.carga.images.makeCover')" @click="makeCover(i)" />
								<Button icon="pi pi-trash" rounded severity="danger" size="small" :title="$t('common.delete')" @click="removeImg(i)" />
							</div>
						</div>
						<ImageUpload :model-value="''" folder="productos" :aspect-ratio="1" :min-width="500" format="jpeg" @update:model-value="onAddImage" />
					</div>
					<p class="text-[11px] text-surface-400">{{ $t('admin.ml.imagesHint') }}</p>
				</section>
			</div>

			<!-- Footer fijo del drawer -->
			<div v-if="edit" class="sticky bottom-0 z-10 flex items-center justify-end gap-2 border-t border-surface-200 bg-surface-0/95 py-3 backdrop-blur dark:border-surface-700 dark:bg-surface-900/95">
				<Button :label="$t('common.cancel')" text @click="editorVisible = false" />
				<Button
					:label="edit.mlItemId ? $t('admin.ml.saveBtn') : $t('admin.ml.savePublishBtn')"
					icon="pi pi-check"
					:loading="saving"
					:disabled="loss"
					@click="saveEditor"
				/>
			</div>
		</Drawer>
	</div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import type {
	Producto,
	Rubro,
	MlFeeBreakdown,
	MlListingType,
	BatchProductoItem,
	MlCategoryPrediction,
	MlAttribute,
	MlCatalogSearchResult,
} from '@base-template/shared';
import { useCatalogStore } from '@/modules/admin/store/catalog';
import { useAdminContext } from '@/modules/admin/store/context';
import { apiErrorMessage } from '@/shared/utils/apiError';
import ImageUpload from '@/shared/components/ImageUpload.vue';

type FilterKey = 'all' | 'published' | 'ready' | 'missing';
type ProductState = 'published' | 'ready' | 'missing';

/** Copia editable de un producto dentro del editor de ML. */
interface EditState {
	id: string;
	nombre: string;
	precio: number | null;
	precioCosto: number | null;
	precioMl: number | null;
	mlListingType: MlListingType;
	mlCategoryId: string;
	mlCategoryName: string;
	atributos: Record<string, string>;
	mlCatalogProductId: string;
	mlItemId: string;
	stock: number | null;
	descripcion: string;
	gtin: string;
	sku: string;
	imageUrl: string;
	imagenes: string[];
	mlStatus: string | null;
	mlPermalink: string | null;
}

export default defineComponent({
	name: 'MercadoLibreView',
	components: { ImageUpload },
	data() {
		return {
			catalog: useCatalogStore(),
			ctx: useAdminContext(),
			loading: false,
			mlConnected: false,
			importing: false,
			activeFilter: 'all' as FilterKey,
			search: '',
			filters: [
				{ key: 'all', label: 'admin.ml.filter.all' },
				{ key: 'published', label: 'admin.ml.filter.published' },
				{ key: 'ready', label: 'admin.ml.filter.ready' },
				{ key: 'missing', label: 'admin.ml.filter.missing' },
			] as { key: FilterKey; label: string }[],
			// Editor
			editorVisible: false,
			edit: null as EditState | null,
			margenPct: null as number | null,
			saving: false,
			statusChanging: false,
			// Calculadora
			fee: null as MlFeeBreakdown | null,
			feeLoading: false,
			calculating: false,
			feeTimer: null as ReturnType<typeof setTimeout> | null,
			// Beneficio real por producto (para la lista): { pct, loss }
			benefit: {} as Record<string, { pct: number; loss: boolean }>,
			// Categoría + atributos de ML (misma función que en Cargar productos)
			mlPredicting: false,
			mlPredictions: [] as MlCategoryPrediction[],
			mlLoadingAttrs: false,
			mlAttrs: [] as MlAttribute[],
			mlAttrValues: {} as Record<string, string>,
			attrsByCategory: {} as Record<string, MlAttribute[]>,
			mlCatalogQuery: '',
			mlCatalogSearching: false,
			mlCatalogResults: [] as MlCatalogSearchResult[],
			mlFillingCatalog: false,
		};
	},
	computed: {
		rubro(): Rubro | undefined {
			return this.catalog.rubros.find(r => r.id === this.ctx.currentRubroId);
		},
		/** Productos del negocio activo. */
		productos(): Producto[] {
			return this.catalog.allProductos.filter(p => p.rubroId === this.ctx.currentRubroId);
		},
		counts(): Record<FilterKey, number> {
			const c: Record<FilterKey, number> = { all: this.productos.length, published: 0, ready: 0, missing: 0 };
			for (const p of this.productos) c[this.stateOf(p)]++;
			return c;
		},
		filtered(): Producto[] {
			const q = this.search.trim().toLowerCase();
			return this.productos.filter(p => {
				if (this.activeFilter !== 'all' && this.stateOf(p) !== this.activeFilter) return false;
				if (q && !p.nombre.toLowerCase().includes(q)) return false;
				return true;
			});
		},
		listingTypeOptions(): { label: string; value: MlListingType }[] {
			return [
				{ label: this.$t('admin.ml.listingType.gold_special'), value: 'gold_special' },
				{ label: this.$t('admin.ml.listingType.gold_pro'), value: 'gold_pro' },
			];
		},
		/** ¿Se puede calcular/consultar comisión? (categoría + conexión). */
		canCalc(): boolean {
			return !!this.edit?.mlCategoryId && !!this.edit?.precio;
		},
		/** Neto que recibe el vendedor con el precio ML actual. */
		neto(): number | null {
			if (!this.edit?.precioMl || !this.fee) return null;
			return this.edit.precioMl - this.fee.saleFeeAmount;
		},
		/** Parte de costo (para la barrita). */
		costPart(): number | null {
			return this.edit?.precioCosto ?? null;
		},
		/** Ganancia real: neto − costo. */
		gainPart(): number | null {
			if (this.neto == null) return null;
			return this.neto - (this.edit?.precioCosto ?? 0);
		},
		/** ¿Se vendería a pérdida? (neto < costo). */
		loss(): boolean {
			if (this.neto == null || this.edit?.precioCosto == null) return false;
			return this.neto < this.edit.precioCosto;
		},
		/** % de beneficio real (ganancia sobre el costo) al precio de ML actual. */
		gainPct(): number | null {
			if (this.gainPart == null || !this.edit?.precioCosto) return null;
			return Math.round((this.gainPart / this.edit.precioCosto) * 100);
		},
	},
	async created() {
		await this.reload();
	},
	watch: {
		'ctx.currentRubroId'() {
			void this.reload();
		},
	},
	methods: {
		money(n: number): string {
			return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
		},
		pct(part: number | null): number {
			const total = this.edit?.precioMl || 0;
			if (!total || part == null || part <= 0) return 0;
			return Math.min(100, (part / total) * 100);
		},
		stateOf(p: Producto): ProductState {
			if (p.mlItemId) return 'published';
			const hasPrice = p.precioMl != null || p.precio != null;
			if (p.nombre?.trim() && hasPrice && p.stock != null && p.mlCategoryId) return 'ready';
			return 'missing';
		},
		stateSeverity(s: ProductState): string {
			return { published: 'success', ready: 'info', missing: 'warn' }[s] ?? 'secondary';
		},
		/** Precio de ML del producto: el calculado, o el publicado (importado en `precio`). */
		mlPrice(p: Producto): number | null {
			return p.precioMl ?? p.precio;
		},
		mlPriceLabel(p: Producto): string {
			const v = this.mlPrice(p);
			return v != null ? this.money(v) : '—';
		},
		benefitClass(b: { pct: number; loss: boolean }): string {
			if (b.loss) return 'text-red-500';
			if (b.pct < 15) return 'text-amber-600 dark:text-amber-400';
			return 'text-emerald-600 dark:text-emerald-400';
		},
		benefitLabel(b: { pct: number; loss: boolean }): string {
			return `${b.pct >= 0 ? '+' : ''}${b.pct}%`;
		},
		/**
		 * Calcula, en segundo plano, el beneficio real (tras comisión) de cada
		 * producto que tenga costo + categoría + precio. Consulta la comisión a ML
		 * con concurrencia limitada. Los que no tienen costo quedan sin dato.
		 */
		async computeBenefits() {
			if (!this.rubro) return;
			const queue = this.productos.filter(p => p.precioCosto != null && this.mlPrice(p) != null && p.mlCategoryId);
			const rubroId = this.rubro.id;
			const worker = async () => {
				for (;;) {
					const p = queue.shift();
					if (!p) return;
					try {
						const price = this.mlPrice(p) as number;
						const fee = await this.catalog.fetchMlFee(rubroId, price, p.mlCategoryId as string, p.mlListingType || 'gold_special');
						const ganancia = price - fee.saleFeeAmount - (p.precioCosto as number);
						this.benefit[p.id] = { pct: Math.round((ganancia / (p.precioCosto as number)) * 100), loss: ganancia < 0 };
					} catch {
						/* si falla la comisión de uno, seguimos con el resto */
					}
				}
			};
			await Promise.all([worker(), worker(), worker()]);
		},
		async reload() {
			if (!this.rubro) return;
			this.loading = true;
			try {
				if (!this.catalog.rubros.length) await this.catalog.fetchRubros().catch(() => undefined);
				const state = await this.catalog.fetchMlState(this.rubro.id);
				this.mlConnected = !!state.connection;
				if (this.mlConnected) await this.catalog.fetchAllProductos();
			} catch {
				this.$toast.add({ severity: 'error', summary: this.$t('admin.errors.load'), life: 4000 });
			} finally {
				this.loading = false;
			}
			// Beneficio real por producto (en segundo plano, no bloquea la lista).
			if (this.mlConnected) void this.computeBenefits();
		},
		async importListings() {
			if (!this.rubro) return;
			this.importing = true;
			try {
				const res = await this.catalog.importMlListings(this.rubro.id);
				await this.catalog.fetchAllProductos();
				if (!res.total) this.$toast.add({ severity: 'info', summary: this.$t('admin.carga.importMl.none'), life: 4000 });
				else this.$toast.add({ severity: 'success', summary: this.$t('admin.carga.importMl.done', { imported: res.imported, updated: res.updated }), life: 5000 });
			} catch (e: unknown) {
				this.$toast.add({ severity: 'error', summary: apiErrorMessage(e, this.$t('admin.carga.importMl.error')), life: 6000 });
			} finally {
				this.importing = false;
			}
		},

		// ── Editor + calculadora ──
		openEditor(p: Producto) {
			this.edit = {
				id: p.id,
				nombre: p.nombre,
				precio: p.precio,
				precioCosto: p.precioCosto,
				// Las importadas guardan el precio publicado en `precio`; lo usamos como precio de ML.
				precioMl: p.precioMl ?? p.precio,
				mlListingType: p.mlListingType || 'gold_special',
				mlCategoryId: p.mlCategoryId ?? '',
				mlCategoryName: p.mlCategoryName ?? '',
				atributos: { ...(p.atributos ?? {}) },
				mlCatalogProductId: p.mlCatalogProductId ?? '',
				mlItemId: p.mlItemId ?? '',
				stock: p.stock,
				descripcion: p.descripcion ?? '',
				gtin: p.gtin ?? '',
				sku: p.sku ?? '',
				imageUrl: p.imageUrl ?? '',
				imagenes: p.imagenes?.length ? [...p.imagenes] : p.imageUrl ? [p.imageUrl] : [],
				mlStatus: p.mlStatus,
				mlPermalink: p.mlPermalink,
			};
			// Categoría + atributos.
			this.mlPredictions = [];
			this.mlAttrValues = { ...(p.atributos ?? {}) };
			this.mlAttrs = p.mlCategoryId ? (this.attrsByCategory[p.mlCategoryId] ?? []) : [];
			this.mlCatalogQuery = '';
			this.mlCatalogResults = [];
			// Margen implícito a partir de costo + precio de tienda.
			this.margenPct = this.deriveMargin();
			this.fee = null;
			this.editorVisible = true;
			if (this.edit.precioMl) this.refreshFee();
			if (p.mlCategoryId && !this.attrsByCategory[p.mlCategoryId]) void this.loadAttrs(p.mlCategoryId);
		},
		/** Color del tag de estado real en ML. */
		statusSeverity(status: string): string {
			return { active: 'success', paused: 'warn', closed: 'secondary', under_review: 'info', inactive: 'secondary' }[status] ?? 'secondary';
		},
		/** Pausa o reactiva la publicación en ML. */
		async toggleStatus(status: 'active' | 'paused') {
			const e = this.edit;
			if (!e || !e.mlItemId || !this.rubro) return;
			this.statusChanging = true;
			try {
				await this.catalog.setMlStatus(this.rubro.id, e.id, status);
				e.mlStatus = status;
				await this.catalog.fetchAllProductos();
				this.$toast.add({ severity: 'success', summary: this.$t(status === 'paused' ? 'admin.ml.pausedToast' : 'admin.ml.activatedToast'), life: 4000 });
			} catch (err: unknown) {
				this.$toast.add({ severity: 'error', summary: apiErrorMessage(err, this.$t('admin.ml.statusError')), life: 5000 });
			} finally {
				this.statusChanging = false;
			}
		},
		// ── Imágenes (portada + galería) ──
		onAddImage(url: string) {
			if (url && this.edit) {
				this.edit.imagenes.push(url);
				this.edit.imageUrl = this.edit.imagenes[0] ?? '';
			}
		},
		makeCover(i: number) {
			if (!this.edit) return;
			const [img] = this.edit.imagenes.splice(i, 1);
			this.edit.imagenes.unshift(img);
			this.edit.imageUrl = this.edit.imagenes[0] ?? '';
		},
		removeImg(i: number) {
			if (!this.edit) return;
			this.edit.imagenes.splice(i, 1);
			this.edit.imageUrl = this.edit.imagenes[0] ?? '';
		},
		// ── Categoría + atributos de ML ──
		async suggestCategories() {
			const e = this.edit;
			if (!e || !this.rubro) return;
			if (!e.nombre.trim()) {
				this.$toast.add({ severity: 'warn', summary: this.$t('admin.carga.ml.needName'), life: 4000 });
				return;
			}
			this.mlPredicting = true;
			try {
				this.mlPredictions = await this.catalog.predictMlCategory(this.rubro.id, e.nombre.trim());
				if (!this.mlPredictions.length)
					this.$toast.add({ severity: 'info', summary: this.$t('admin.carga.ml.noSuggestions'), life: 4000 });
			} catch (err) {
				this.$toast.add({ severity: 'error', summary: apiErrorMessage(err, this.$t('admin.carga.ml.predictError')), life: 5000 });
			} finally {
				this.mlPredicting = false;
			}
		},
		async pickCategory(pred: MlCategoryPrediction) {
			if (!this.edit) return;
			this.edit.mlCategoryId = pred.categoryId;
			this.edit.mlCategoryName = pred.categoryName;
			this.mlAttrValues = {};
			await this.loadAttrs(pred.categoryId);
			// La comisión depende de la categoría: recalculamos el desglose.
			this.refreshFee();
		},
		async loadAttrs(categoryId: string) {
			if (!this.rubro) return;
			this.mlLoadingAttrs = true;
			try {
				const attrs = await this.catalog.fetchMlAttributes(this.rubro.id, categoryId);
				this.attrsByCategory[categoryId] = attrs;
				this.mlAttrs = attrs;
			} catch (err) {
				this.$toast.add({ severity: 'error', summary: apiErrorMessage(err, this.$t('admin.carga.ml.attrsError')), life: 5000 });
			} finally {
				this.mlLoadingAttrs = false;
			}
		},
		async searchCatalog() {
			const q = this.mlCatalogQuery.trim();
			if (!q || !this.rubro) return;
			this.mlCatalogSearching = true;
			try {
				this.mlCatalogResults = await this.catalog.searchMlCatalog(this.rubro.id, q);
				if (!this.mlCatalogResults.length)
					this.$toast.add({ severity: 'info', summary: this.$t('admin.carga.ml.catalogNone'), life: 4000 });
			} catch (err) {
				this.$toast.add({ severity: 'error', summary: apiErrorMessage(err, this.$t('admin.carga.ml.catalogError')), life: 5000 });
			} finally {
				this.mlCatalogSearching = false;
			}
		},
		async pickCatalogProduct(result: MlCatalogSearchResult) {
			const e = this.edit;
			if (!e || !this.rubro) return;
			this.mlFillingCatalog = true;
			try {
				const p = await this.catalog.fetchMlCatalogProduct(this.rubro.id, result.id);
				e.mlCatalogProductId = p.catalogProductId;
				this.mlAttrValues = { ...p.atributos };
				this.mlCatalogResults = [];
				if (p.categoryId) {
					e.mlCategoryId = p.categoryId;
					e.mlCategoryName = p.categoryName;
					await this.loadAttrs(p.categoryId);
					this.refreshFee();
				}
				this.$toast.add({ severity: 'success', summary: this.$t('admin.carga.ml.catalogFilled'), life: 4000 });
			} catch (err) {
				this.$toast.add({ severity: 'error', summary: apiErrorMessage(err, this.$t('admin.carga.ml.catalogError')), life: 5000 });
			} finally {
				this.mlFillingCatalog = false;
			}
		},
		attrHasOptions(attr: MlAttribute): boolean {
			return attr.values.length > 0;
		},
		attrValueOptions(attr: MlAttribute): { label: string; value: string }[] {
			const opts = attr.values.map(v => ({ label: v.name, value: v.name }));
			// Si el valor ya guardado no está entre las opciones (ej. una marca que ML
			// no lista), lo agregamos para que el Select pueda mostrarlo.
			const current = this.mlAttrValues[attr.id];
			if (current && !opts.some(o => o.value === current)) opts.unshift({ label: current, value: current });
			return opts;
		},
		attrFilled(attr: MlAttribute): boolean {
			const v = this.mlAttrValues[attr.id];
			return !!v && v.trim().length > 0;
		},
		deriveMargin(): number | null {
			const c = this.edit?.precioCosto;
			const v = this.edit?.precio;
			if (!c || v == null) return null;
			return Math.round(((v - c) / c) * 100);
		},
		/** Recalcula el precio de tienda cuando cambia el costo, manteniendo el margen. */
		onCostChange() {
			this.applyMargin();
		},
		/** Aplica margen% sobre el costo → precio de tienda. */
		applyMargin() {
			if (this.edit?.precioCosto != null && this.margenPct != null) {
				this.edit.precio = Math.round(this.edit.precioCosto * (1 + this.margenPct / 100));
			}
		},
		/** Al editar el precio de tienda a mano, recalcula el margen mostrado. */
		syncMargin() {
			this.margenPct = this.deriveMargin();
		},
		onMlPriceChange() {
			this.scheduleFee();
		},
		/** Debounce del desglose en vivo al tipear el precio de ML. */
		scheduleFee() {
			if (this.feeTimer) clearTimeout(this.feeTimer);
			this.feeTimer = setTimeout(() => this.refreshFee(), 500);
		},
		async refreshFee() {
			const e = this.edit;
			if (!e || !e.mlCategoryId || !e.precioMl || !this.rubro) {
				this.fee = null;
				return;
			}
			this.feeLoading = true;
			try {
				this.fee = await this.catalog.fetchMlFee(this.rubro.id, e.precioMl, e.mlCategoryId, e.mlListingType);
			} catch (err: unknown) {
				this.fee = null;
				this.$toast.add({ severity: 'error', summary: apiErrorMessage(err, this.$t('admin.ml.feeError')), life: 5000 });
			} finally {
				this.feeLoading = false;
			}
		},
		/** Calcula el precio de ML para dejar el precio de tienda como neto. */
		async calcMlPrice() {
			const e = this.edit;
			if (!e || !e.mlCategoryId || !e.precio || !this.rubro) return;
			this.calculating = true;
			try {
				const suggested = await this.catalog.suggestMlPrice(this.rubro.id, e.precio, e.mlCategoryId, e.mlListingType);
				e.precioMl = suggested.price;
				this.fee = suggested;
			} catch (err: unknown) {
				this.$toast.add({ severity: 'error', summary: apiErrorMessage(err, this.$t('admin.ml.feeError')), life: 5000 });
			} finally {
				this.calculating = false;
			}
		},
		async saveEditor() {
			const e = this.edit;
			if (!e || this.loss || !this.rubro) return;
			this.saving = true;
			try {
				// Atributos: descartamos los vacíos.
				const atributos: Record<string, string> = {};
				for (const [k, v] of Object.entries(this.mlAttrValues)) if (v && v.trim()) atributos[k] = v.trim();
				const item: BatchProductoItem = {
					id: e.id,
					rubroId: this.rubro.id,
					nombre: e.nombre,
					precio: e.precio ?? undefined,
					precioCosto: e.precioCosto ?? undefined,
					precioMl: e.precioMl ?? undefined,
					stock: e.stock ?? undefined,
					descripcion: e.descripcion.trim() || undefined,
					gtin: e.gtin.trim() || undefined,
					sku: e.sku.trim() || undefined,
					imageUrl: e.imageUrl || undefined,
					imagenes: e.imagenes.length ? e.imagenes : undefined,
					mlListingType: e.mlListingType,
					mlCategoryId: e.mlCategoryId || undefined,
					mlCategoryName: e.mlCategoryName || undefined,
					mlCatalogProductId: e.mlCatalogProductId || undefined,
					atributos: Object.keys(atributos).length ? atributos : undefined,
				};
				const [saved] = await this.catalog.batchUpsert([item]);
				if (!saved?.ok || !saved.id) throw new Error(saved?.error || this.$t('admin.carga.saveError'));

				if (!e.mlItemId) {
					// Todavía no publicado: lo publicamos ahora.
					const res = await this.catalog.publishToMl(this.rubro.id, saved.id);
					// Puente multicanal: si el rubro tiene Meta, compartir en IG/FB.
					if (this.rubro.metaTargetId) {
						await this.catalog.publishProducto(this.rubro.id, saved.id, {}).catch(() => undefined);
					}
					this.$toast.add({ severity: 'success', summary: this.$t('admin.carga.pub.done'), detail: res.permalink || '', life: 7000 });
				} else {
					// Ya publicado: empujamos el nuevo precio/stock a la publicación de ML.
					await this.catalog.updateMlListing(this.rubro.id, saved.id);
					this.$toast.add({ severity: 'success', summary: this.$t('admin.ml.savedSynced'), life: 4000 });
				}
				await this.catalog.fetchAllProductos();
				this.editorVisible = false;
			} catch (err: unknown) {
				this.$toast.add({ severity: 'error', summary: apiErrorMessage(err, this.$t('admin.carga.pub.error')), life: 7000 });
			} finally {
				this.saving = false;
			}
		},
	},
});
</script>
