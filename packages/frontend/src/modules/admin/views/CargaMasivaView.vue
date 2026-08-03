<template>
	<div class="mx-auto max-w-7xl">
		<!-- Encabezado -->
		<div class="mb-6">
			<p class="text-xs font-semibold uppercase tracking-wide text-primary">{{ $t('admin.carga.eyebrow') }}</p>
			<h1 class="text-2xl font-extrabold text-surface-900 dark:text-surface-0">{{ $t('admin.carga.title') }}</h1>
			<p class="mt-1 text-sm text-surface-500">{{ $t('admin.carga.subtitle') }}</p>
		</div>

		<!-- Cargando -->
		<div v-if="loading" class="py-16 text-center text-surface-500">
			<i class="pi pi-spin pi-spinner text-2xl" />
		</div>

		<!-- Sin rubros: no se puede cargar -->
		<div v-else-if="!catalog.rubros.length" class="glass-card rounded-2xl p-8 text-center text-surface-500">
			<i class="pi pi-tags mb-3 block text-3xl text-surface-400" />
			{{ $t('admin.carga.noRubros') }}
			<div class="mt-4">
				<Button :label="$t('admin.nav.rubros')" icon="pi pi-arrow-right" outlined @click="$router.push('/admin')" />
			</div>
		</div>

		<!-- Sin negocio elegido: se elige arriba, en el selector del panel -->
		<div v-else-if="!selectedRubroId" class="glass-card rounded-2xl p-8 text-center text-surface-500">
			<i class="pi pi-arrow-up mb-3 block text-3xl text-surface-400" />
			{{ $t('admin.carga.pickAbove') }}
		</div>

		<!-- Grilla del negocio activo -->
		<template v-else>
			<!-- Contexto: rubro + estado de ML -->
			<div class="mb-4 flex flex-wrap items-center justify-between gap-3">
				<div class="flex items-center gap-2 text-sm">
					<span class="text-surface-400">{{ $t('admin.carga.loadingIn') }}</span>
					<span class="inline-flex items-center gap-1.5 font-semibold text-surface-800 dark:text-surface-100">
						<i class="pi pi-box text-surface-500" /> {{ selectedRubro?.nombre }}
					</span>
				</div>
				<div class="flex items-center gap-3">
					<template v-if="mlStateByRubro[selectedRubroId]">
						<span class="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
							<i class="pi pi-check-circle" /> {{ $t('admin.carga.mlConnected') }}
						</span>
						<Button
							:label="$t('admin.carga.importMl.button')"
							icon="pi pi-cloud-download"
							size="small"
							outlined
							:loading="importingMl"
							@click="importMl"
						/>
					</template>
					<button
						v-else
						type="button"
						class="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 hover:underline dark:text-amber-400"
						@click="$router.push('/admin')"
					>
						<i class="pi pi-exclamation-triangle" /> {{ $t('admin.carga.mlConnectHint') }}
					</button>
				</div>
			</div>

			<!-- Fuentes de entrada -->
			<div class="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
				<button
					v-for="src in sources"
					:key="src.key"
					type="button"
					:disabled="src.disabled"
					:class="[
						'group relative flex flex-col gap-2 rounded-2xl border p-4 text-left transition-all',
						src.highlight
							? 'border-primary/40 bg-primary/5 hover:border-primary'
							: 'border-surface-200/60 bg-surface-0/40 hover:border-surface-300 dark:border-surface-700/60 dark:bg-surface-900/40',
						src.disabled ? 'cursor-not-allowed opacity-60' : 'hover:-translate-y-0.5',
					]"
					@click="src.action && src.action()"
				>
					<i :class="[src.icon, src.highlight ? 'text-primary' : 'text-surface-500', 'text-xl']" />
					<div>
						<p class="text-sm font-semibold text-surface-900 dark:text-surface-0">{{ $t(src.title) }}</p>
						<p class="text-xs text-surface-500">{{ $t(src.desc) }}</p>
					</div>
					<span
						v-if="src.disabled"
						class="absolute right-3 top-3 rounded-full bg-surface-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-surface-500 dark:bg-surface-700"
					>
						{{ $t('admin.carga.sources.soon') }}
					</span>
				</button>
			</div>

			<!-- Barra de acciones: sticky para que "Agregar" y "Guardar" viajen con el scroll -->
			<div
				class="glass-card sticky top-20 z-20 mb-3 flex flex-wrap items-center gap-3 rounded-2xl p-3 shadow-sm"
			>
				<Button :label="$t('admin.carga.addRow')" icon="pi pi-plus" size="small" @click="addRow()" />
				<span class="hidden h-6 w-px bg-surface-200 dark:bg-surface-700 sm:block" />
				<Checkbox :model-value="allSelected" binary @update:model-value="toggleAll" />
				<span class="text-sm font-semibold text-surface-700 dark:text-surface-200">
					{{ $t('admin.carga.selectedOf', { sel: selectedCount, total: visibleRows.length }) }}
				</span>
				<Button
					:label="$t('admin.carga.bulk.margen')"
					icon="pi pi-percentage"
					size="small"
					outlined
					:disabled="!selectedCount"
					@click="bulkMargenVisible = true"
				/>
				<Button
					:label="$t('admin.carga.bulk.precioEnLote')"
					icon="pi pi-dollar"
					size="small"
					outlined
					:disabled="!selectedCount"
					@click="bulkPrecioVisible = true"
				/>
				<div class="ml-auto flex items-center gap-2">
					<span
						v-if="dirtyCount"
						class="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400"
					>
						<i class="pi pi-circle-fill text-[7px]" /> {{ $t('admin.carga.unsavedN', { n: dirtyCount }) }}
					</span>
					<Button
						:label="selectedCount ? $t('admin.carga.saveSelected', { n: selectedCount }) : $t('admin.carga.saveAll')"
						icon="pi pi-save"
						size="small"
						:loading="saving"
						:disabled="!visibleRows.length"
						class="primary-gradient border-0 font-semibold text-white"
						@click="saveSelected"
					/>
				</div>
			</div>

			<!-- Grilla vacía -->
			<div v-if="!visibleRows.length" class="glass-card rounded-2xl p-10 text-center text-surface-500">
				{{ $t('admin.carga.empty') }}
			</div>

			<!-- Grilla -->
			<div v-else class="glass-card quiet overflow-x-auto rounded-2xl">
				<table class="w-full min-w-[680px] table-fixed text-sm">
					<thead>
						<tr
							class="border-b border-surface-200/60 text-left text-[11px] uppercase tracking-wide text-surface-400 dark:border-surface-700/60"
						>
							<th class="w-9 px-2 py-2.5"></th>
							<th class="px-2 py-2.5">{{ $t('admin.carga.cols.producto') }}</th>
							<th v-if="mlConnected" class="w-28 px-2 py-2.5">{{ $t('admin.carga.cols.categoriaMl') }}</th>
							<th class="w-28 px-2 py-2.5 text-right">{{ $t('admin.carga.cols.costo') }}</th>
							<th class="w-28 px-2 py-2.5 text-right">{{ $t('admin.carga.cols.precio') }}</th>
							<th class="w-20 px-2 py-2.5 text-center">{{ $t('admin.carga.cols.stock') }}</th>
							<th class="w-28 px-2 py-2.5">{{ $t('admin.carga.cols.estado') }}</th>
							<th class="w-14 px-2 py-2.5"></th>
						</tr>
					</thead>
					<tbody>
						<tr
							v-for="row in visibleRows"
							:key="row.key"
							class="border-b border-surface-100 transition-colors last:border-0 hover:bg-surface-50/60 dark:border-surface-800/60 dark:hover:bg-surface-800/30"
							:class="row.dirty ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''"
						>
							<td class="px-2 py-2 align-middle">
								<Checkbox v-model="row.selected" binary />
							</td>
							<td class="px-2 py-2 align-middle">
								<div class="flex min-w-0 items-center gap-3">
									<button
										type="button"
										class="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-100 text-surface-400 transition-colors hover:text-primary dark:bg-surface-800"
										:title="$t('admin.carga.images.title')"
										@click="openImages(row)"
									>
										<img v-if="row.imageUrl" :src="row.imageUrl" class="h-full w-full object-cover" alt="" />
										<i v-else class="pi pi-camera text-sm" />
										<span
											v-if="row.imagenes.length > 1"
											class="absolute bottom-0 right-0 rounded-tl bg-surface-900/80 px-1 text-[9px] font-semibold text-white"
											>{{ row.imagenes.length }}</span
										>
									</button>
									<div class="min-w-0 flex-1">
										<InputText
											v-model="row.nombre"
											class="w-full !min-w-0 font-medium"
											:class="quietCls"
											:placeholder="$t('admin.carga.placeholders.nombre')"
											@update:model-value="markDirty(row)"
										/>
										<div class="mt-0.5 flex min-w-0 items-center gap-1.5 pl-2 text-[11px] text-surface-400">
											<i :class="sourceMeta(row.source).icon" class="shrink-0" />
											<span class="truncate">{{ $t('admin.carga.source.' + row.source) }}</span>
											<span class="shrink-0">·</span>
											<InputText
												v-model="row.gtin"
												:class="quietCls"
												class="!h-5 !min-w-0 max-w-[130px] flex-1 !py-0 !text-[11px]"
												:placeholder="$t('admin.carga.placeholders.ean')"
												@update:model-value="markDirty(row)"
											/>
										</div>
									</div>
								</div>
							</td>
							<td v-if="mlConnected" class="px-2 py-2 align-middle">
								<button
									v-if="row.mlCategoryName"
									type="button"
									class="inline-flex max-w-full items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
									@click="openMl(row)"
								>
									<i class="pi pi-tag shrink-0" />
									<span class="truncate">{{ row.mlCategoryName }}</span>
								</button>
								<button
									v-else
									type="button"
									class="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs font-medium text-amber-600 transition-colors hover:bg-amber-500/10 dark:text-amber-400"
									@click="openMl(row)"
								>
									<i class="pi pi-sparkles" /> {{ $t('admin.carga.ml.assignInline') }}
								</button>
							</td>
							<td class="px-2 py-2 align-middle">
								<InputNumber
									v-model="row.precioCosto"
									fluid
									mode="currency"
									currency="ARS"
									locale="es-AR"
									:min="0"
									:max-fraction-digits="0"
									:input-class="quietCls + ' text-right'"
									:placeholder="'—'"
									@update:model-value="markDirty(row)"
								/>
							</td>
							<td class="px-2 py-2 align-middle">
								<InputNumber
									v-model="row.precio"
									fluid
									mode="currency"
									currency="ARS"
									locale="es-AR"
									:min="0"
									:max-fraction-digits="0"
									:input-class="quietCls + ' text-right font-medium'"
									@update:model-value="markDirty(row)"
								/>
							</td>
							<td class="px-2 py-2 align-middle">
								<InputNumber
									v-model="row.stock"
									fluid
									:min="0"
									:input-class="quietCls + ' text-center'"
									:placeholder="'—'"
									@update:model-value="markDirty(row)"
								/>
							</td>
							<td class="px-2 py-2 align-middle">
								<Tag :value="estadoLabel(row)" :severity="estadoSeverity(row)" />
								<p v-if="faltantesDe(row).length" class="mt-1 text-[11px] text-surface-400">
									{{ faltantesDe(row).join(' · ') }}
								</p>
							</td>
							<td class="px-2 py-2 align-middle">
								<div class="flex items-center gap-1">
									<!-- Guardar esta fila: aparece solo si tiene cambios sin guardar. -->
									<Button
										v-if="row.dirty"
										icon="pi pi-save"
										text
										rounded
										severity="warn"
										size="small"
										:loading="savingKey === row.key"
										:title="$t('admin.carga.saveRow')"
										@click="saveRow(row)"
									/>
									<template v-if="mlConnected">
										<a
											v-if="row.mlPermalink"
											:href="row.mlPermalink"
											target="_blank"
											rel="noopener"
											class="inline-flex h-8 w-8 items-center justify-center rounded-full text-emerald-500 hover:bg-emerald-500/10"
											:title="$t('admin.carga.pub.view')"
											><i class="pi pi-check-circle"
										/></a>
										<Button
											v-else
											icon="pi pi-megaphone"
											text
											rounded
											severity="success"
											size="small"
											:loading="publishingKey === row.key"
											:disabled="!row.id"
											:title="$t('admin.carga.pub.button')"
											@click="publishRow(row)"
										/>
									</template>
									<Button
										icon="pi pi-trash"
										text
										rounded
										severity="secondary"
										size="small"
										@click="removeRow(row)"
									/>
								</div>
							</td>
						</tr>
					</tbody>
				</table>
			</div>

			<!-- Pie: leyenda de estados -->
			<div class="mt-4 flex flex-wrap items-center gap-4 text-xs">
				<span class="flex items-center gap-1.5"
					><span class="h-2 w-2 rounded-full bg-emerald-500" />
					{{ $t('admin.carga.legend.ready', tally.ready) }}</span
				>
				<span class="flex items-center gap-1.5"
					><span class="h-2 w-2 rounded-full bg-amber-500" />
					{{ $t('admin.carga.legend.review', { n: tally.review }) }}</span
				>
				<span class="flex items-center gap-1.5"
					><span class="h-2 w-2 rounded-full bg-red-500" />
					{{ $t('admin.carga.legend.missing', { n: tally.missing }) }}</span
				>
			</div>

			<p class="mt-4 flex items-start gap-2 text-xs text-surface-400">
				<i class="pi pi-info-circle mt-0.5" /> {{ $t('admin.carga.footnote') }}
			</p>
		</template>

		<!-- Dialog: precio en lote -->
		<Dialog
			v-model:visible="bulkPrecioVisible"
			modal
			:header="$t('admin.carga.bulk.precioEnLote')"
			class="w-full max-w-sm"
		>
			<InputNumber v-model="bulkPrecio" class="w-full" mode="currency" currency="ARS" locale="es-AR" :min="0" />
			<template #footer>
				<Button :label="$t('common.cancel')" text @click="bulkPrecioVisible = false" />
				<Button :label="$t('common.apply')" :disabled="bulkPrecio == null" @click="applyBulkPrecio" />
			</template>
		</Dialog>

		<!-- Dialog: margen en lote ("quiero ganar X%") -->
		<Dialog v-model:visible="bulkMargenVisible" modal :header="$t('admin.carga.bulk.margen')" class="w-full max-w-sm">
			<div class="space-y-4 pt-1">
				<p class="text-sm text-surface-500">{{ $t('admin.carga.bulk.margenHint') }}</p>
				<div class="flex items-center gap-3">
					<Slider
					:model-value="bulkMargen ?? 0"
					class="flex-1"
					:min="0"
					:max="300"
					@update:model-value="v => (bulkMargen = Array.isArray(v) ? v[0] : v)"
				/>
					<InputNumber v-model="bulkMargen" fluid suffix=" %" :min="0" :max="900" class="w-24 shrink-0" />
				</div>
				<p class="text-xs text-surface-400">{{ $t('admin.carga.bulk.margenApplies', { n: selectedCount }) }}</p>
			</div>
			<template #footer>
				<Button :label="$t('common.cancel')" text @click="bulkMargenVisible = false" />
				<Button :label="$t('common.apply')" :disabled="bulkMargen == null" @click="applyBulkMargen" />
			</template>
		</Dialog>

		<!-- Dialog: importar Excel/CSV -->
		<Dialog v-model:visible="importVisible" modal :header="$t('admin.carga.import.title')" class="w-full max-w-2xl">
			<!-- Paso 1: subir -->
			<div v-if="!parsed">
				<label
					class="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-surface-300 p-10 text-center text-surface-500 transition-colors hover:border-primary hover:text-primary dark:border-surface-600"
				>
					<i class="pi pi-cloud-upload text-3xl" />
					<span class="text-sm">{{ $t('admin.carga.import.dropHint') }}</span>
					<input type="file" :accept="acceptExtensions" class="hidden" @change="onFile" />
				</label>
			</div>

			<!-- Paso 2: mapeo de columnas -->
			<div v-else class="space-y-3">
				<p class="text-sm font-semibold text-surface-700 dark:text-surface-200">
					{{ $t('admin.carga.import.preview', { n: parsed.rows.length }) }}
				</p>
				<div class="max-h-72 space-y-2 overflow-y-auto pr-1">
					<div
						v-for="(header, i) in parsed.headers"
						:key="i"
						class="flex items-center gap-3 rounded-xl bg-surface-50 p-2.5 dark:bg-surface-800/50"
					>
						<div class="flex-1 truncate">
							<p class="truncate text-sm font-medium text-surface-700 dark:text-surface-200">
								{{ header || '—' }}
							</p>
							<p class="truncate text-[11px] text-surface-400">{{ sampleValue(i) }}</p>
						</div>
						<i class="pi pi-arrow-right text-xs text-surface-400" />
						<Select
							v-model="mapping[i]"
							:options="fieldOptions"
							option-label="label"
							option-value="value"
							class="w-44"
						/>
					</div>
				</div>
			</div>
			<template #footer>
				<Button :label="$t('common.cancel')" text @click="closeImport" />
				<Button
					v-if="parsed"
					:label="$t('admin.carga.import.confirm', { n: parsed.rows.length })"
					icon="pi pi-check"
					@click="confirmImport"
				/>
			</template>
		</Dialog>

		<!-- Modal: categoría ML + atributos obligatorios -->
		<Dialog v-model:visible="mlVisible" modal :header="$t('admin.carga.ml.title')" class="w-full max-w-lg">
			<div v-if="mlRow" class="flex flex-col gap-5 pt-2">
				<p class="text-sm font-semibold text-surface-800 dark:text-surface-100">
					{{ mlRow.nombre || $t('admin.carga.placeholders.nombre') }}
				</p>
				<!-- Buscar en el catálogo de ML (autocompleta) -->
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
					<label class="text-xs font-semibold uppercase tracking-wide text-surface-600 dark:text-surface-300">{{
						$t('admin.carga.ml.categoryTitle')
					}}</label>
					<div class="flex items-center gap-2">
						<span
							class="flex-1 text-sm"
							:class="mlPendingCategoryName ? 'text-surface-800 dark:text-surface-100' : 'text-surface-400'"
							>{{ mlPendingCategoryName || $t('admin.carga.ml.noCategory') }}</span
						>
						<Button
							:label="$t('admin.carga.ml.suggest')"
							icon="pi pi-sparkles"
							size="small"
							outlined
							:loading="mlPredicting"
							@click="suggestCategories"
						/>
					</div>
					<div v-if="mlPredictions.length" class="space-y-1">
						<button
							v-for="p in mlPredictions"
							:key="p.categoryId"
							type="button"
							class="flex w-full items-center justify-between rounded-lg border p-2 text-left text-sm transition-colors"
							:class="
								p.categoryId === mlPendingCategoryId
									? 'border-primary bg-primary/5'
									: 'border-surface-200 hover:bg-surface-50 dark:border-surface-700 dark:hover:bg-surface-800'
							"
							@click="pickCategory(p)"
						>
							<span>{{ p.categoryName }}</span>
							<i v-if="p.categoryId === mlPendingCategoryId" class="pi pi-check text-primary" />
						</button>
					</div>
				</div>
				<!-- Atributos obligatorios -->
				<div v-if="mlPendingCategoryId" class="space-y-3 border-t border-surface-200 pt-4 dark:border-surface-700">
					<label class="text-xs font-semibold uppercase tracking-wide text-surface-600 dark:text-surface-300">{{
						$t('admin.carga.ml.attrsTitle')
					}}</label>
					<div v-if="mlLoadingAttrs" class="py-4 text-center text-surface-500"><i class="pi pi-spin pi-spinner" /></div>
					<p v-else-if="!mlAttrs.length" class="text-xs text-surface-400">{{ $t('admin.carga.ml.noAttrs') }}</p>
					<div v-else class="space-y-3">
						<div v-for="attr in mlAttrs" :key="attr.id" class="space-y-1">
							<label class="flex items-center gap-1.5 text-sm font-medium"
								><i
									class="pi text-xs"
									:class="attrFilled(attr) ? 'pi-check-circle text-green-500' : 'pi-exclamation-circle text-amber-500'"
								/>
								{{ attr.name }}</label
							>
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
							<InputText
								v-else
								v-model="mlAttrValues[attr.id]"
								class="w-full"
								:placeholder="$t('admin.carga.ml.attrValue')"
							/>
						</div>
					</div>
				</div>
			</div>
			<template #footer>
				<Button :label="$t('common.cancel')" text @click="mlVisible = false" />
				<Button :label="$t('common.apply')" icon="pi pi-check" @click="saveMl" />
			</template>
		</Dialog>

		<!-- Dialog: gestor de imágenes por fila -->
		<Dialog v-model:visible="imgVisible" modal :header="$t('admin.carga.images.title')" class="w-full max-w-lg">
			<div v-if="imgRow" class="pt-2">
				<div class="grid grid-cols-3 gap-3 sm:grid-cols-4">
					<div v-for="(img, i) in imgRow.imagenes" :key="img" class="group relative aspect-square overflow-hidden rounded-xl border border-surface-200 dark:border-surface-700">
						<img :src="img" class="h-full w-full object-cover" alt="" />
						<span v-if="i === 0" class="absolute left-1 top-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-white">{{ $t('admin.carga.images.cover') }}</span>
						<div class="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
							<Button v-if="i !== 0" icon="pi pi-star" rounded size="small" :title="$t('admin.carga.images.makeCover')" @click="makeCover(i)" />
							<Button icon="pi pi-trash" rounded severity="danger" size="small" :title="$t('common.delete')" @click="removeImg(i)" />
						</div>
					</div>
					<ImageUpload :model-value="''" folder="productos" :aspect-ratio="1" :min-width="500" format="jpeg" @update:model-value="onAddImage" />
				</div>
				<p class="mt-3 text-xs text-surface-400">{{ $t('admin.carga.images.hint') }}</p>
			</div>
			<template #footer>
				<Button :label="$t('admin.carga.images.done')" @click="imgVisible = false" />
			</template>
		</Dialog>
	</div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import {
	ProductoSource,
	ProductoEstado,
	evaluarProducto,
	type Producto,
	type ProductoLike,
	type BatchProductoItem,
	type MlCategoryPrediction,
	type MlAttribute,
	type MlRequiredAttribute,
	type MlCatalogSearchResult,
} from '@base-template/shared';
import { useCatalogStore } from '@/modules/admin/store/catalog';
import { useAdminContext } from '@/modules/admin/store/context';
import { apiErrorMessage } from '@/shared/utils/apiError';
import {
	parseTableFile,
	parseNumber,
	ACCEPTED_IMPORT_EXTENSIONS,
	type ParsedTable,
} from '@/modules/admin/utils/importTable';
import ImageUpload from '@/shared/components/ImageUpload.vue';

/** Fila editable de la grilla (aún sin persistir o ya existente). */
interface Row {
	key: string;
	id?: string;
	rubroId: string;
	nombre: string;
	descripcion: string;
	precio: number | null;
	precioCosto: number | null;
	stock: number | null;
	gtin: string;
	sku: string;
	imageUrl: string;
	imagenes: string[];
	mlCategoryId: string;
	mlCategoryName: string;
	atributos: Record<string, string>;
	mlItemId: string;
	mlPermalink: string;
	mlCatalogProductId: string;
	source: ProductoSource;
	isDraft: boolean;
	selected: boolean;
	/** La fila tiene cambios sin guardar (muestra el ✔ de guardar en la fila). */
	dirty?: boolean;
}

/** Campos de producto a los que puede mapear una columna del archivo. */
const IMPORT_FIELDS = ['nombre', 'descripcion', 'precioCosto', 'precio', 'stock', 'gtin', 'sku', 'imageUrl'] as const;
type ImportField = (typeof IMPORT_FIELDS)[number] | 'ignore';

export default defineComponent({
	name: 'CargaMasivaView',
	components: { ImageUpload },
	data() {
		return {
			catalog: useCatalogStore(),
			ctx: useAdminContext(),
			loading: false,
			saving: false,
			rows: [] as Row[],
			seq: 0,
			// ¿Cada rubro tiene ML conectado? (para el contexto)
			mlStateByRubro: {} as Record<string, boolean>,
			// Precio en lote
			bulkPrecioVisible: false,
			bulkPrecio: null as number | null,
			// Margen en lote ("quiero ganar X%")
			bulkMargenVisible: false,
			bulkMargen: 40 as number | null,
			// Importar
			importVisible: false,
			parsed: null as ParsedTable | null,
			mapping: [] as ImportField[],
			acceptExtensions: ACCEPTED_IMPORT_EXTENSIONS,
			// Inputs "silenciosos" en la grilla: look de texto, borde solo en hover/foco.
			quietCls:
				'!border-transparent !bg-transparent !shadow-none hover:!border-surface-300 focus:!border-primary dark:hover:!border-surface-600',
			// Mercado Libre: categoría + atributos por fila
			mlVisible: false,
			mlRow: null as Row | null,
			mlPredicting: false,
			mlPredictions: [] as MlCategoryPrediction[],
			mlPendingCategoryId: '',
			mlPendingCategoryName: '',
			mlLoadingAttrs: false,
			mlAttrs: [] as MlAttribute[],
			mlAttrValues: {} as Record<string, string>,
			// Cache de atributos obligatorios por categoría (para el "Faltan N").
			attrsByCategory: {} as Record<string, MlAttribute[]>,
			publishingKey: null as string | null,
			savingKey: null as string | null,
			importingMl: false,
			// Gestor de imágenes por fila
			imgVisible: false,
			imgRow: null as Row | null,
			// ¿Hay cambios en la grilla sin guardar?
			dirty: false,
			// Buscador de catálogo ML (dentro del modal)
			mlCatalogQuery: '',
			mlCatalogSearching: false,
			mlCatalogResults: [] as MlCatalogSearchResult[],
			mlFillingCatalog: false,
			mlPendingImageUrl: '',
			mlPendingDescription: '',
			mlPendingCatalogId: '',
		};
	},
	computed: {
		sources() {
			return [
				{
					key: 'scan',
					title: 'admin.carga.sources.scan.title',
					desc: 'admin.carga.sources.scan.desc',
					icon: 'pi pi-qrcode',
					highlight: true,
					disabled: false,
					action: () => this.addRow(ProductoSource.SCAN),
				},
				{
					key: 'excel',
					title: 'admin.carga.sources.excel.title',
					desc: 'admin.carga.sources.excel.desc',
					icon: 'pi pi-file-import',
					highlight: false,
					disabled: false,
					action: () => this.openImport(),
				},
				{
					key: 'erp',
					title: 'admin.carga.sources.erp.title',
					desc: 'admin.carga.sources.erp.desc',
					icon: 'pi pi-database',
					highlight: false,
					disabled: true,
				},
				{
					key: 'ia',
					title: 'admin.carga.sources.ia.title',
					desc: 'admin.carga.sources.ia.desc',
					icon: 'pi pi-sparkles',
					highlight: false,
					disabled: true,
				},
			];
		},
		/** Negocio activo, tomado del contexto persistido (selector del panel). */
		selectedRubroId(): string {
			return this.ctx.currentRubroId;
		},
		/** ¿El negocio activo tiene Mercado Libre conectado? Gatea los campos de ML. */
		mlConnected(): boolean {
			return !!this.mlStateByRubro[this.selectedRubroId];
		},
		/** Rubro actualmente elegido. */
		selectedRubro(): { id: string; nombre: string } | undefined {
			return this.catalog.rubros.find(r => r.id === this.selectedRubroId);
		},
		/** Filas del rubro elegido (lo que muestra la grilla). */
		visibleRows(): Row[] {
			return this.rows.filter(r => r.rubroId === this.selectedRubroId);
		},
		fieldOptions(): { label: string; value: ImportField }[] {
			const opts: { label: string; value: ImportField }[] = IMPORT_FIELDS.map(f => ({
				label: this.fieldLabel(f),
				value: f,
			}));
			opts.push({ label: this.$t('admin.carga.import.ignore'), value: 'ignore' });
			return opts;
		},
		selectedCount(): number {
			return this.visibleRows.filter(r => r.selected).length;
		},
		/** Filas del negocio activo con cambios sin guardar. */
		dirtyCount(): number {
			return this.visibleRows.filter(r => r.dirty).length;
		},
		allSelected(): boolean {
			return this.visibleRows.length > 0 && this.visibleRows.every(r => r.selected);
		},
		tally(): { ready: number; review: number; missing: number } {
			const t = { ready: 0, review: 0, missing: 0 };
			for (const row of this.visibleRows) {
				const e = evaluarProducto(this.toLike(row), this.requiredAttrsFor(row)).estado;
				if (e === ProductoEstado.READY) t.ready++;
				else if (e === ProductoEstado.REVIEW) t.review++;
				else if (e === ProductoEstado.MISSING) t.missing++;
			}
			return t;
		},
	},
	async created() {
		this.loading = true;
		try {
			if (!this.catalog.miEspacio) await this.catalog.fetchMiEspacio().catch(() => undefined);
			if (!this.catalog.rubros.length) await this.catalog.fetchRubros();
			await this.catalog.fetchAllProductos();
			this.rows = this.catalog.allProductos.map(p => this.fromProducto(p));
		} catch {
			this.$toast.add({ severity: 'error', summary: this.$t('admin.carga.saveError'), life: 4000 });
		} finally {
			this.loading = false;
		}
		void this.loadMlStates();
	},
	mounted() {
		window.addEventListener('beforeunload', this.onBeforeUnload);
	},
	beforeUnmount() {
		window.removeEventListener('beforeunload', this.onBeforeUnload);
	},
	beforeRouteLeave(_to: unknown, _from: unknown, next: (ok?: boolean) => void) {
		if (this.dirty && !window.confirm(this.$t('admin.carga.unsavedLeave'))) next(false);
		else next();
	},
	methods: {
		/** Trae el estado de ML de cada rubro (sin bloquear la grilla). */
		async loadMlStates() {
			await Promise.all(
				this.catalog.rubros.map(async r => {
					try {
						const state = await this.catalog.fetchMlState(r.id);
						this.mlStateByRubro[r.id] = !!state.connection;
					} catch {
						this.mlStateByRubro[r.id] = false;
					}
				}),
			);
		},
		nextKey(): string {
			this.seq += 1;
			return `row-${this.seq}`;
		},
		markDirty(row?: Row) {
			if (row) row.dirty = true;
			this.dirty = true;
		},
		onBeforeUnload(e: BeforeUnloadEvent) {
			if (this.dirty) {
				e.preventDefault();
				e.returnValue = '';
			}
		},
		fromProducto(p: Producto): Row {
			return {
				key: this.nextKey(),
				id: p.id,
				rubroId: p.rubroId,
				nombre: p.nombre,
				descripcion: p.descripcion ?? '',
				precio: p.precio,
				precioCosto: p.precioCosto,
				stock: p.stock,
				gtin: p.gtin ?? '',
				sku: p.sku ?? '',
				imageUrl: p.imageUrl ?? '',
				imagenes: p.imagenes?.length ? [...p.imagenes] : p.imageUrl ? [p.imageUrl] : [],
				mlCategoryId: p.mlCategoryId ?? '',
				mlCategoryName: p.mlCategoryName ?? '',
				atributos: { ...(p.atributos ?? {}) },
				mlItemId: p.mlItemId ?? '',
				mlPermalink: p.mlPermalink ?? '',
				mlCatalogProductId: p.mlCatalogProductId ?? '',
				source: p.source ?? ProductoSource.MANUAL,
				isDraft: p.isDraft ?? false,
				selected: false,
			};
		},
		emptyRow(source: ProductoSource): Row {
			return {
				key: this.nextKey(),
				rubroId: this.selectedRubroId,
				nombre: '',
				descripcion: '',
				precio: null,
				precioCosto: null,
				stock: null,
				gtin: '',
				sku: '',
				imageUrl: '',
				imagenes: [],
				mlCategoryId: '',
				mlCategoryName: '',
				atributos: {},
				mlItemId: '',
				mlPermalink: '',
				mlCatalogProductId: '',
				source,
				isDraft: false,
				selected: true,
			};
		},
		addRow(source: ProductoSource = ProductoSource.MANUAL) {
			this.rows.unshift(this.emptyRow(source));
			this.dirty = true;
		},
		removeRow(row: Row) {
			this.rows = this.rows.filter(r => r.key !== row.key);
		},
		toggleAll(value: boolean) {
			for (const row of this.visibleRows) row.selected = value;
		},
		toLike(row: Row): ProductoLike {
			return {
				nombre: row.nombre,
				precio: row.precio,
				stock: row.stock,
				imageUrl: row.imageUrl || null,
				descripcion: row.descripcion || null,
				mlCategoryId: row.mlCategoryId || null,
				atributos: row.atributos,
				isDraft: row.isDraft,
			};
		},
		requiredAttrsFor(row: Row): MlRequiredAttribute[] {
			const attrs = row.mlCategoryId ? this.attrsByCategory[row.mlCategoryId] : undefined;
			return (attrs ?? []).map(a => ({ id: a.id, name: a.name }));
		},
		faltantesDe(row: Row): string[] {
			return evaluarProducto(this.toLike(row), this.requiredAttrsFor(row)).faltantes;
		},
		estadoLabel(row: Row): string {
			const { estado, faltantes } = evaluarProducto(this.toLike(row), this.requiredAttrsFor(row));
			if (estado === ProductoEstado.MISSING) return this.$t('admin.carga.estado.missing', { n: faltantes.length });
			return this.$t('admin.carga.estado.' + estado);
		},
		estadoSeverity(row: Row): string {
			const estado = evaluarProducto(this.toLike(row), this.requiredAttrsFor(row)).estado;
			return (
				{
					[ProductoEstado.READY]: 'success',
					[ProductoEstado.REVIEW]: 'warn',
					[ProductoEstado.MISSING]: 'danger',
					[ProductoEstado.DRAFT]: 'secondary',
				}[estado] ?? 'secondary'
			);
		},
		sourceMeta(source: ProductoSource): { icon: string } {
			const icons: Record<ProductoSource, string> = {
				[ProductoSource.MANUAL]: 'pi pi-pencil',
				[ProductoSource.EXCEL]: 'pi pi-file-import',
				[ProductoSource.SCAN]: 'pi pi-qrcode',
				[ProductoSource.IA]: 'pi pi-sparkles',
				[ProductoSource.ML]: 'pi pi-shopping-cart',
			};
			return { icon: icons[source] ?? 'pi pi-pencil' };
		},

		// ── Precio en lote ──
		applyBulkPrecio() {
			for (const row of this.visibleRows)
				if (row.selected) {
					row.precio = this.bulkPrecio;
					row.dirty = true;
				}
			this.dirty = true;
			this.bulkPrecioVisible = false;
			this.bulkPrecio = null;
		},

		// ── Margen en lote: precio = costo * (1 + margen%) sobre las seleccionadas ──
		applyBulkMargen() {
			if (this.bulkMargen == null) return;
			const factor = 1 + this.bulkMargen / 100;
			let sinCosto = 0;
			for (const row of this.visibleRows) {
				if (!row.selected) continue;
				if (row.precioCosto == null) {
					sinCosto++;
					continue;
				}
				row.precio = Math.round(row.precioCosto * factor);
				row.dirty = true;
			}
			this.dirty = true;
			this.bulkMargenVisible = false;
			if (sinCosto) {
				this.$toast.add({ severity: 'info', summary: this.$t('admin.carga.bulk.margenNoCost', { n: sinCosto }), life: 4000 });
			}
		},

		// ── Guardar ──
		/** Arma el payload de guardado de una fila. */
		rowToBatchItem(r: Row): BatchProductoItem {
			return {
				...(r.id ? { id: r.id } : {}),
				rubroId: r.rubroId,
				nombre: r.nombre.trim(),
				descripcion: r.descripcion.trim() || undefined,
				precio: r.precio ?? undefined,
				precioCosto: r.precioCosto ?? undefined,
				stock: r.stock ?? undefined,
				gtin: r.gtin.trim() || undefined,
				sku: r.sku.trim() || undefined,
				imageUrl: r.imageUrl.trim() || undefined,
				imagenes: r.imagenes.length ? r.imagenes : undefined,
				mlCategoryId: r.mlCategoryId || undefined,
				mlCategoryName: r.mlCategoryName || undefined,
				mlCatalogProductId: r.mlCatalogProductId || undefined,
				atributos: Object.keys(r.atributos).length ? r.atributos : undefined,
				source: r.source,
			};
		},
		/** Guarda una sola fila (el ✔ de la fila). */
		async saveRow(row: Row) {
			if (!row.nombre.trim()) {
				this.$toast.add({ severity: 'warn', summary: this.$t('admin.carga.needName'), life: 4000 });
				return;
			}
			this.savingKey = row.key;
			try {
				const [res] = await this.catalog.batchUpsert([this.rowToBatchItem(row)]);
				if (!res?.ok || !res.id) throw new Error(res?.error || this.$t('admin.carga.saveError'));
				row.id = res.id;
				row.dirty = false;
				this.dirty = this.rows.some(r => r.dirty);
				// Si ya está publicado en ML, empujamos el cambio (precio/stock/descripción)
				// a la publicación: así editar acá se refleja en Mercado Libre.
				let synced = false;
				if (this.mlConnected && row.mlItemId && row.id) {
					synced = await this.catalog
						.updateMlListing(this.selectedRubroId, row.id)
						.then(() => true)
						.catch(() => false);
				}
				this.$toast.add({
					severity: 'success',
					summary: synced ? this.$t('admin.carga.savedSynced') : this.$t('admin.carga.saved', { n: 1 }),
					life: 3000,
				});
			} catch (e: unknown) {
				this.$toast.add({ severity: 'error', summary: apiErrorMessage(e, this.$t('admin.carga.saveError')), life: 5000 });
			} finally {
				this.savingKey = null;
			}
		},
		async saveSelected() {
			// Sin selección: guardamos TODAS las filas del rubro (editar + guardar directo).
			const marcadas = this.visibleRows.filter(r => r.selected);
			const seleccionadas = marcadas.length ? marcadas : this.visibleRows;
			if (!seleccionadas.length) {
				this.$toast.add({ severity: 'warn', summary: this.$t('admin.carga.empty'), life: 3000 });
				return;
			}
			if (seleccionadas.some(r => !r.nombre.trim())) {
				this.$toast.add({ severity: 'warn', summary: this.$t('admin.carga.needName'), life: 4000 });
				return;
			}

			this.saving = true;
			try {
				const items: BatchProductoItem[] = seleccionadas.map(r => this.rowToBatchItem(r));

				const results = await this.catalog.batchUpsert(items);
				const ok = results.filter(r => r.ok);
				const fail = results.filter(r => !r.ok);

				results.forEach((res, i) => {
					if (res.ok && res.id) {
						const row = seleccionadas[i];
						row.id = res.id;
						row.selected = false;
						row.dirty = false;
					}
				});
				// El indicador global refleja si quedó alguna fila sin guardar.
				this.dirty = this.rows.some(r => r.dirty);

				// Los que ya están publicados: empujamos el cambio a Mercado Libre.
				let synced = 0;
				if (this.mlConnected) {
					const publicadas = seleccionadas.filter(r => r.mlItemId && r.id);
					const res = await Promise.all(
						publicadas.map(r => this.catalog.updateMlListing(this.selectedRubroId, r.id as string).then(() => true).catch(() => false)),
					);
					synced = res.filter(Boolean).length;
				}

				if (!fail.length) {
					this.$toast.add({
						severity: 'success',
						summary: synced
							? this.$t('admin.carga.savedSyncedN', { n: ok.length, synced })
							: this.$t('admin.carga.saved', { n: ok.length }),
						life: 4000,
					});
				} else {
					this.$toast.add({
						severity: 'warn',
						summary: this.$t('admin.carga.savedPartial', { ok: ok.length, fail: fail.length }),
						detail: fail
							.map(f => f.error)
							.filter(Boolean)
							.join(' · '),
						life: 7000,
					});
				}
			} catch (e: unknown) {
				this.$toast.add({
					severity: 'error',
					summary: apiErrorMessage(e, this.$t('admin.carga.saveError')),
					life: 5000,
				});
			} finally {
				this.saving = false;
			}
		},

		// ── Importar Excel/CSV ──
		fieldLabel(field: ImportField): string {
			const map: Record<string, string> = {
				nombre: this.$t('admin.carga.placeholders.nombre'),
				descripcion: this.$t('admin.productos.fields.description'),
				precioCosto: this.$t('admin.carga.cols.costo'),
				precio: this.$t('admin.carga.cols.precio'),
				stock: this.$t('admin.carga.cols.stock'),
				gtin: this.$t('admin.carga.placeholders.ean'),
				sku: 'SKU',
				imageUrl: this.$t('admin.productos.fields.imageUrl'),
			};
			return map[field] ?? field;
		},
		openImport() {
			this.parsed = null;
			this.mapping = [];
			this.importVisible = true;
		},
		closeImport() {
			this.importVisible = false;
			this.parsed = null;
			this.mapping = [];
		},
		async onFile(event: Event) {
			const input = event.target as HTMLInputElement;
			const file = input.files?.[0];
			if (!file) return;
			try {
				const parsed = await parseTableFile(file);
				this.parsed = parsed;
				this.mapping = parsed.headers.map(h => this.guessField(h));
			} catch (e: unknown) {
				const key =
					e instanceof Error && e.message === 'noRows'
						? 'admin.carga.import.noRows'
						: 'admin.carga.import.parseError';
				this.$toast.add({ severity: 'error', summary: this.$t(key), life: 4000 });
			} finally {
				input.value = '';
			}
		},
		/** Adivina el campo destino por el nombre del encabezado. */
		guessField(header: string): ImportField {
			const h = header.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
			if (/(nombre|titulo|producto|name|title)/.test(h)) return 'nombre';
			if (/(descrip|detalle|description)/.test(h)) return 'descripcion';
			if (/(costo|compra|proveedor|cost)/.test(h)) return 'precioCosto';
			if (/(precio|price|importe|venta)/.test(h)) return 'precio';
			if (/(stock|cantidad|qty|existencia)/.test(h)) return 'stock';
			if (/(ean|gtin|codigo de barra|barcode)/.test(h)) return 'gtin';
			if (/(sku|codigo|cod\.?|code)/.test(h)) return 'sku';
			if (/(imagen|image|foto|url)/.test(h)) return 'imageUrl';
			return 'ignore';
		},
		sampleValue(colIndex: number): string {
			const first = this.parsed?.rows.find(r => (r[colIndex] ?? '').trim() !== '');
			return first?.[colIndex] ?? '';
		},
		confirmImport() {
			if (!this.parsed) return;
			const nombreCol = this.mapping.indexOf('nombre');
			const nuevas: Row[] = [];
			for (const cells of this.parsed.rows) {
				const row = this.emptyRow(ProductoSource.EXCEL);
				this.mapping.forEach((field, i) => {
					const value = (cells[i] ?? '').trim();
					if (!value || field === 'ignore') return;
					if (field === 'precio') row.precio = parseNumber(value);
					else if (field === 'precioCosto') row.precioCosto = parseNumber(value);
					else if (field === 'stock') row.stock = parseNumber(value);
					else if (field === 'nombre') row.nombre = value;
					else if (field === 'descripcion') row.descripcion = value;
					else if (field === 'gtin') row.gtin = value;
					else if (field === 'sku') row.sku = value;
					else if (field === 'imageUrl') row.imageUrl = value;
				});
				row.dirty = true;
				if (nombreCol === -1 || row.nombre) nuevas.push(row);
			}
			this.rows = [...nuevas, ...this.rows];
			this.dirty = true;
			this.closeImport();
		},

		// ── Mercado Libre: categoría + atributos ──
		openMl(row: Row) {
			this.mlRow = row;
			this.mlPredictions = [];
			this.mlPendingCategoryId = row.mlCategoryId;
			this.mlPendingCategoryName = row.mlCategoryName;
			this.mlAttrValues = { ...row.atributos };
			this.mlAttrs = row.mlCategoryId ? (this.attrsByCategory[row.mlCategoryId] ?? []) : [];
			this.mlCatalogQuery = '';
			this.mlCatalogResults = [];
			this.mlPendingImageUrl = row.imageUrl;
			this.mlPendingDescription = row.descripcion;
			this.mlPendingCatalogId = row.mlCatalogProductId;
			this.mlVisible = true;
			if (row.mlCategoryId && !this.attrsByCategory[row.mlCategoryId]) {
				void this.loadAttrs(row.rubroId, row.mlCategoryId);
			}
		},
		async suggestCategories() {
			const row = this.mlRow;
			if (!row) return;
			if (!row.nombre.trim()) {
				this.$toast.add({ severity: 'warn', summary: this.$t('admin.carga.ml.needName'), life: 4000 });
				return;
			}
			this.mlPredicting = true;
			try {
				this.mlPredictions = await this.catalog.predictMlCategory(row.rubroId, row.nombre.trim());
				if (!this.mlPredictions.length)
					this.$toast.add({ severity: 'info', summary: this.$t('admin.carga.ml.noSuggestions'), life: 4000 });
			} catch (e) {
				this.$toast.add({
					severity: 'error',
					summary: apiErrorMessage(e, this.$t('admin.carga.ml.predictError')),
					life: 5000,
				});
			} finally {
				this.mlPredicting = false;
			}
		},
		async pickCategory(pred: MlCategoryPrediction) {
			this.mlPendingCategoryId = pred.categoryId;
			this.mlPendingCategoryName = pred.categoryName;
			this.mlAttrValues = {};
			if (this.mlRow) await this.loadAttrs(this.mlRow.rubroId, pred.categoryId);
		},
		async loadAttrs(rubroId: string, categoryId: string) {
			this.mlLoadingAttrs = true;
			try {
				const attrs = await this.catalog.fetchMlAttributes(rubroId, categoryId);
				this.attrsByCategory[categoryId] = attrs;
				this.mlAttrs = attrs;
			} catch (e) {
				this.$toast.add({
					severity: 'error',
					summary: apiErrorMessage(e, this.$t('admin.carga.ml.attrsError')),
					life: 5000,
				});
			} finally {
				this.mlLoadingAttrs = false;
			}
		},
		saveMl() {
			const row = this.mlRow;
			if (!row) return;
			row.mlCategoryId = this.mlPendingCategoryId;
			row.mlCategoryName = this.mlPendingCategoryName;
			const clean: Record<string, string> = {};
			for (const [k, v] of Object.entries(this.mlAttrValues)) if (v && v.trim()) clean[k] = v.trim();
			row.atributos = clean;
			row.mlCatalogProductId = this.mlPendingCatalogId;
			if (this.mlPendingImageUrl) {
				row.imageUrl = this.mlPendingImageUrl;
				if (!row.imagenes.length) row.imagenes = [this.mlPendingImageUrl];
			}
			if (this.mlPendingDescription) row.descripcion = this.mlPendingDescription;
			row.dirty = true;
			this.dirty = true;
			this.mlVisible = false;
		},
		async publishRow(row: Row) {
			if (!row.nombre.trim()) {
				this.$toast.add({ severity: 'warn', summary: this.$t('admin.carga.needName'), life: 4000 });
				return;
			}
			this.publishingKey = row.key;
			try {
				// Guardamos la fila con sus datos actuales antes de publicar:
				// lo que ves en la grilla es lo que se publica.
				const [saved] = await this.catalog.batchUpsert([this.rowToBatchItem(row)]);
				if (!saved?.ok || !saved.id) throw new Error(saved?.error || this.$t('admin.carga.saveError'));
				row.id = saved.id;
				row.dirty = false;
				this.dirty = this.rows.some(r => r.dirty);
				const res = await this.catalog.publishToMl(row.rubroId, row.id);
				row.mlItemId = res.itemId ?? '';
				row.mlPermalink = res.permalink ?? '';
				// Puente multicanal: si el rubro tiene Meta listo, compartir también en IG/FB.
				const rubro = this.catalog.rubroById(row.rubroId);
				let metaMsg = '';
				if (rubro?.metaTargetId) {
					try {
						const results = await this.catalog.publishProducto(row.rubroId, row.id, {});
						const ok = results.filter(r => r.ok).length;
						if (ok) metaMsg = this.$t('admin.carga.pub.alsoShared', { n: ok });
					} catch {
						/* el aviso de ML ya salió; no fallamos por las redes */
					}
				}
				this.$toast.add({
					severity: 'success',
					summary: this.$t('admin.carga.pub.done'),
					detail: (res.permalink || '') + (metaMsg ? ' · ' + metaMsg : ''),
					life: 8000,
				});
			} catch (e: unknown) {
				this.$toast.add({
					severity: 'error',
					summary: apiErrorMessage(e, this.$t('admin.carga.pub.error')),
					life: 8000,
				});
			} finally {
				this.publishingKey = null;
			}
		},
		async searchCatalog() {
			const row = this.mlRow;
			const q = this.mlCatalogQuery.trim();
			if (!row || !q) return;
			this.mlCatalogSearching = true;
			try {
				this.mlCatalogResults = await this.catalog.searchMlCatalog(row.rubroId, q);
				if (!this.mlCatalogResults.length)
					this.$toast.add({ severity: 'info', summary: this.$t('admin.carga.ml.catalogNone'), life: 4000 });
			} catch (e) {
				this.$toast.add({ severity: 'error', summary: apiErrorMessage(e, this.$t('admin.carga.ml.catalogError')), life: 5000 });
			} finally {
				this.mlCatalogSearching = false;
			}
		},
		async pickCatalogProduct(result: MlCatalogSearchResult) {
			const row = this.mlRow;
			if (!row) return;
			this.mlFillingCatalog = true;
			try {
				const p = await this.catalog.fetchMlCatalogProduct(row.rubroId, result.id);
				this.mlPendingCatalogId = p.catalogProductId;
				if (p.imageUrl) this.mlPendingImageUrl = p.imageUrl;
				if (p.description) this.mlPendingDescription = p.description;
				if (!row.nombre.trim()) row.nombre = p.name;
				this.mlAttrValues = { ...p.atributos };
				this.mlCatalogResults = [];
				if (p.categoryId) {
					this.mlPendingCategoryId = p.categoryId;
					this.mlPendingCategoryName = p.categoryName;
					await this.loadAttrs(row.rubroId, p.categoryId);
				}
				this.$toast.add({ severity: 'success', summary: this.$t('admin.carga.ml.catalogFilled'), life: 4000 });
			} catch (e) {
				this.$toast.add({ severity: 'error', summary: apiErrorMessage(e, this.$t('admin.carga.ml.catalogError')), life: 5000 });
			} finally {
				this.mlFillingCatalog = false;
			}
		},
		openImages(row: Row) {
			if (!row.imagenes.length && row.imageUrl) row.imagenes = [row.imageUrl];
			this.imgRow = row;
			this.imgVisible = true;
		},
		syncCover() {
			if (this.imgRow) {
				this.imgRow.imageUrl = this.imgRow.imagenes[0] ?? '';
				this.imgRow.dirty = true;
			}
			this.dirty = true;
		},
		onAddImage(url: string) {
			if (url && this.imgRow) {
				this.imgRow.imagenes.push(url);
				this.syncCover();
			}
		},
		removeImg(i: number) {
			this.imgRow?.imagenes.splice(i, 1);
			this.syncCover();
		},
		makeCover(i: number) {
			if (!this.imgRow) return;
			const [img] = this.imgRow.imagenes.splice(i, 1);
			this.imgRow.imagenes.unshift(img);
			this.syncCover();
		},
		async importMl() {
			if (!this.selectedRubroId) return;
			this.importingMl = true;
			try {
				const res = await this.catalog.importMlListings(this.selectedRubroId);
				await this.catalog.fetchAllProductos();
				this.rows = this.catalog.allProductos.map(p => this.fromProducto(p));
				this.dirty = false;
				if (!res.total) {
					this.$toast.add({ severity: 'info', summary: this.$t('admin.carga.importMl.none'), life: 4000 });
				} else {
					this.$toast.add({ severity: 'success', summary: this.$t('admin.carga.importMl.done', { imported: res.imported, updated: res.updated }), life: 5000 });
				}
			} catch (e: unknown) {
				this.$toast.add({ severity: 'error', summary: apiErrorMessage(e, this.$t('admin.carga.importMl.error')), life: 6000 });
			} finally {
				this.importingMl = false;
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
	},
});
</script>
