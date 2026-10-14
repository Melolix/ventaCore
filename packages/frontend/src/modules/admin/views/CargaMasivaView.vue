<template>
	<div class="mx-auto max-w-7xl">
		<!-- Encabezado -->
		<!-- En mobile el encabezado va compacto (sin subtítulo): la pantalla es para
		     trabajar con la lista, no para leer. -->
		<div class="mb-3 md:mb-6">
			<p class="text-xs font-semibold uppercase tracking-wide text-primary">{{ $t('admin.carga.eyebrow') }}</p>
			<h1 class="text-2xl font-extrabold text-surface-900 dark:text-surface-0">{{ $t('admin.carga.title') }}</h1>
			<p class="mt-1 hidden text-sm text-surface-500 md:block">{{ $t('admin.carga.subtitle') }}</p>
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
			<div class="mb-3 flex flex-wrap items-center justify-between gap-3 md:mb-4">
				<div class="flex items-center gap-2 text-sm">
					<span class="hidden text-surface-400 md:inline">{{ $t('admin.carga.loadingIn') }}</span>
					<span class="inline-flex items-center gap-1.5 font-semibold text-surface-800 dark:text-surface-100">
						<i class="pi pi-box text-surface-500" /> {{ selectedRubro?.nombre }}
					</span>
				</div>
				<div v-if="mlEnabled" class="flex items-center gap-3">
					<template v-if="mlStateByRubro[selectedRubroId]">
						<span class="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
							<i class="pi pi-check-circle" /> {{ $t('admin.carga.mlConnected') }}
						</span>
						<!-- En mobile "Bajar de ML" está dentro del menú "Agregar". -->
						<Button
							:label="$t('admin.carga.importMl.button')"
							icon="pi pi-cloud-download"
							size="small"
							outlined
							:loading="importingMl"
							class="!hidden md:!inline-flex"
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

			<!-- Fuentes de entrada (desde md; en mobile van en el menú "Agregar").
			     Las "Próximamente" (disabled) se ocultan hasta lg. -->
			<div class="mb-4 hidden grid-cols-2 gap-3 md:grid lg:grid-cols-4">
				<button
					v-for="src in sources"
					:key="src.key"
					type="button"
					:disabled="src.disabled"
					:class="[
						'group relative flex-col gap-2 rounded-2xl border p-4 text-left transition-all',
						src.highlight
							? 'border-primary/40 bg-primary/5 hover:border-primary'
							: 'border-surface-200/60 bg-surface-0/40 hover:border-surface-300 dark:border-surface-700/60 dark:bg-surface-900/40',
						src.disabled ? 'hidden cursor-not-allowed opacity-60 lg:flex' : 'flex hover:-translate-y-0.5',
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
				class="glass-card sticky top-20 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-2xl p-3 shadow-sm md:gap-3"
			>
				<!-- Mobile: 2 filas FIJAS (no flex-wrap, que armaba 3 filas desparejas según
				     el ancho): ① Agregar + buscador, ② selección + Guardar. Desde md las dos
				     filas son `contents` y todo vuelve a ser una sola barra. -->
				<div class="flex w-full min-w-0 items-center gap-2 md:contents">
				<Button :label="$t('admin.carga.addRow')" icon="pi pi-plus" size="small" class="!hidden md:!inline-flex" @click="onAddRow" />
				<!-- Mobile: un solo "Agregar" que reúne todas las formas de cargar (a mano,
				     escanear, Excel/CSV y bajar de ML), en vez de 4 bloques apilados. -->
				<Button
					:label="$t('admin.carga.addMenu.button')"
					icon="pi pi-plus"
					size="small"
					class="shrink-0 md:!hidden"
					aria-haspopup="true"
					@click="toggleAddMenu"
				/>
				<Menu ref="addMenu" :model="addMenuItems" popup />
				<!-- Buscador: filtra por nombre, marca, EAN/SKU… y acota las acciones en lote.
				     En mobile ocupa el ancho libre de la 1ª fila. -->
				<div class="relative min-w-0 flex-1 sm:flex-none">
					<i class="pi pi-search pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-surface-400" />
					<InputText
						v-model="search"
						:placeholder="$t('admin.carga.searchPlaceholder')"
						:title="$t('admin.carga.searchHint')"
						class="w-full !py-1.5 !pl-8 !pr-7 text-sm sm:w-56"
					/>
					<button
						v-if="search"
						type="button"
						class="absolute right-2 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
						:title="$t('common.cancel')"
						@click="search = ''"
					>
						<i class="pi pi-times text-xs" />
					</button>
				</div>
				</div>
				<div class="flex w-full min-w-0 items-center gap-2 md:contents">
				<span class="hidden h-6 w-px bg-surface-200 dark:bg-surface-700 md:block" />
				<Checkbox :model-value="allSelected" binary @update:model-value="toggleAll" />
				<span class="whitespace-nowrap text-sm font-semibold text-surface-700 dark:text-surface-200">
					<span class="md:hidden">{{ $t('admin.carga.selectedOfShort', { sel: selectedShown, total: displayRows.length }) }}</span>
					<span class="hidden md:inline">{{ $t('admin.carga.selectedOf', { sel: selectedShown, total: displayRows.length }) }}</span>
				</span>

				<!-- Acciones en lote: aparecen SOLO al seleccionar, agrupadas y resaltadas
				     (leen como "esto aplica a lo seleccionado"). Los 3 ajustes de precio
				     van en un menú para no saturar la barra. -->
				<!-- Mobile: las acciones del lote en un solo "⋯" (con los 3 botones no entraba
				     "Guardar" en la fila). -->
				<Button
					v-if="selectedCount"
					icon="pi pi-ellipsis-h"
					size="small"
					text
					rounded
					class="shrink-0 !bg-primary/10 md:!hidden"
					:title="$t('admin.carga.bulk.adjustPrices')"
					aria-haspopup="true"
					@click="toggleBulkMenu"
				/>
				<Menu ref="bulkMenu" :model="bulkMenuItems" popup />
				<div
					v-if="selectedCount"
					class="hidden shrink-0 items-center gap-1 rounded-xl bg-primary/5 p-1 md:flex dark:bg-primary/10"
				>
					<Button
						:label="$t('admin.carga.bulk.adjustPrices')"
						icon="pi pi-sliders-h"
						size="small"
						text
						@click="togglePriceMenu"
					/>
					<Menu ref="priceMenu" :model="priceMenuItems" popup />
					<Button
						:label="$t('admin.carga.bulk.asignarRubro')"
						icon="pi pi-th-large"
						size="small"
						text
						@click="openBulkCategoria"
					/>
					<Button
						:label="$t('admin.carga.bulk.delete')"
						icon="pi pi-trash"
						size="small"
						text
						severity="danger"
						@click="bulkDeleteVisible = true"
					/>
					<button
						type="button"
						class="ml-0.5 flex h-6 w-6 items-center justify-center rounded-full text-surface-400 transition-colors hover:bg-surface-200 hover:text-surface-600 dark:hover:bg-surface-700"
						:title="$t('admin.carga.bulk.clearSelection')"
						@click="clearSelection"
					>
						<i class="pi pi-times text-xs" />
					</button>
				</div>

				<div class="ml-auto flex items-center gap-2">
					<!-- En mobile no entra; las filas con cambios ya se ven resaltadas. -->
					<span
						v-if="dirtyCount"
						class="hidden items-center gap-1.5 text-xs font-medium text-amber-600 md:flex dark:text-amber-400"
					>
						<i class="pi pi-circle-fill text-[7px]" /> {{ $t('admin.carga.unsavedN', { n: dirtyCount }) }}
					</span>
					<!-- Cuenta lo que VA a guardar (cambios/nuevos, o los seleccionados con
					     cambios). Sin nada pendiente queda deshabilitado. -->
					<Button
						:label="saveTargets.length ? $t('admin.carga.saveSelected', { n: saveTargets.length }) : $t('admin.carga.sheet.save')"
						icon="pi pi-save"
						size="small"
						:loading="saving"
						:disabled="!saveTargets.length"
						class="primary-gradient shrink-0 whitespace-nowrap border-0 font-semibold text-white"
						@click="saveSelected"
					/>
				</div>
				</div>
			</div>

			<!-- Grilla vacía (o sin resultados del buscador) -->
			<div v-if="!gridRows.length" class="glass-card rounded-2xl p-10 text-center text-surface-500">
				<template v-if="search">
					<i class="pi pi-search-minus mb-2 block text-2xl text-surface-400" />
					{{ $t('admin.carga.searchNoResults', { q: search }) }}
				</template>
				<template v-else>{{ $t('admin.carga.empty') }}</template>
			</div>

			<template v-else>
			<!-- Mobile: lista compacta. Cada producto en una línea (costo, margen, precio
			     y estado); al tocarlo se abre la hoja de edición con todos los campos. -->
			<div class="glass-card overflow-hidden rounded-2xl md:hidden">
				<div
					v-for="row in displayRows"
					:key="row.key"
					class="flex cursor-pointer items-center gap-3 border-b border-surface-100 px-3 py-2.5 last:border-0 dark:border-surface-800/60"
					:class="[row.dirty ? 'bg-amber-50/50 dark:bg-amber-950/20' : '', row.selected ? 'bg-primary/5 dark:bg-primary/10' : '']"
					@click="groupSize(row) > 1 ? openVariantes(row) : openSheet(row)"
				>
					<span class="shrink-0" @click.stop><Checkbox v-model="row.selected" binary /></span>
					<div class="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-100 text-surface-400 dark:bg-surface-800">
						<img v-if="row.imageUrl" :src="row.imageUrl" class="h-full w-full object-cover" alt="" />
						<i v-else class="pi pi-camera text-sm" />
					</div>
					<div class="min-w-0 flex-1">
						<!-- 2 líneas: en 1 sola los nombres se cortaban a las 8 letras -->
						<p class="line-clamp-2 break-words text-sm font-semibold leading-tight text-surface-900 dark:text-surface-0">{{ row.nombre || $t('admin.carga.sheet.untitled') }}</p>
						<!-- Producto con opciones: en vez de costo/margen, cuántas y cuáles son. -->
						<p class="truncate text-xs" :class="groupSize(row) > 1 ? 'font-medium text-primary' : 'text-surface-500'">{{ groupSize(row) > 1 ? groupLabel(row) : rowMeta(row) }}</p>
					</div>
					<div class="shrink-0 text-right">
						<p v-if="groupSize(row) > 1 && groupFrom(row)" class="text-[10px] leading-none text-surface-400">{{ $t('admin.carga.variantes.fromLabel') }}</p>
						<p class="text-sm font-semibold tabular-nums text-surface-800 dark:text-surface-100">{{ groupSize(row) > 1 ? groupMin(row) : row.precio != null ? money(row.precio) : '—' }}</p>
						<p class="text-[11px] font-semibold" :class="estadoTextCls(row)">{{ estadoLabel(row) }}</p>
					</div>
				</div>
			</div>

			<!-- Grilla editable (desde md) -->
			<div class="glass-card quiet hidden overflow-x-auto rounded-2xl md:block">
				<table class="w-full min-w-[1040px] table-fixed text-sm">
					<thead>
						<tr
							class="border-b border-surface-200/60 text-left text-[11px] uppercase tracking-wide text-surface-400 dark:border-surface-700/60"
						>
							<th class="w-9 px-2 py-2.5"></th>
							<!-- Reparto del ancho. REGLA: los números no se cortan — costo y precio
							     muestran "$ 10.000.000" completo a la vez (w-36) y stock "1.250".
							     Ese ancho sale de unir las dos categorías (vitrina arriba, ML abajo)
							     en una columna; el resto libre es del nombre del producto. -->
							<th class="px-2 py-2.5">{{ $t('admin.carga.cols.producto') }}</th>
							<th class="w-44 px-2 py-2.5" :title="$t('admin.carga.categoria.hint')">
								{{ $t('admin.carga.cols.categoriaShort') }}
								<span class="block text-[10px] font-normal normal-case tracking-normal text-surface-400">
									{{ $t(mlConnected ? 'admin.carga.cols.categoriaSubMl' : 'admin.carga.cols.categoriaSub') }}
								</span>
							</th>
							<th class="w-36 px-2 py-2.5 text-right">{{ $t('admin.carga.cols.costo') }}</th>
							<th class="w-[4.5rem] px-2 py-2.5 text-right">{{ $t('admin.carga.cols.margen') }}</th>
							<th class="w-36 px-2 py-2.5 text-right">{{ $t('admin.carga.cols.precio') }}</th>
							<th class="w-[4.5rem] px-2 py-2.5 text-center">{{ $t('admin.carga.cols.stock') }}</th>
							<th class="w-[6.5rem] px-2 py-2.5">{{ $t('admin.carga.cols.estado') }}</th>
							<th class="w-24 px-2 py-2.5"></th>
						</tr>
					</thead>
					<tbody>
						<tr
							v-for="row in displayRows"
							:key="row.key"
							class="cursor-pointer border-b border-surface-100 transition-colors last:border-0 hover:bg-surface-50/60 dark:border-surface-800/60 dark:hover:bg-surface-800/30"
							:class="[row.dirty ? 'bg-amber-50/50 dark:bg-amber-950/20' : '', row.selected ? 'bg-primary/5 dark:bg-primary/10' : '']"
							@click="onRowClick(row, $event)"
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
											:title="row.nombre"
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
							<!-- Categoría del catálogo (menú de la tienda): se elige de la lista o se
							     escribe una nueva. Si no tiene y el producto trae categoría de ML, la
							     sugerimos a un toque. -->
							<td class="px-2 py-2 align-middle">
								<Select
									v-model="row.seccion"
									:options="categoriaOptions"
									editable
									show-clear
									size="small"
									fluid
									:placeholder="$t('admin.carga.categoria.none')"
									@update:model-value="markDirty(row)"
								/>
								<!-- Segundo renglón: la categoría de Mercado Libre (con su etiqueta
								     "ML" para no confundirla con la de arriba). Tocarla abre el
								     diálogo de ML; la flecha la copia a la vitrina si está vacía. -->
								<div v-if="mlConnected" class="mt-1 flex min-w-0 items-center gap-1">
									<span class="shrink-0 rounded bg-surface-200 px-1 text-[9px] font-bold uppercase leading-4 text-surface-500 dark:bg-surface-700 dark:text-surface-300">ML</span>
									<button
										v-if="row.mlCategoryName"
										type="button"
										class="min-w-0 truncate text-left text-[11px] font-medium text-primary hover:underline"
										:title="row.mlCategoryName"
										@click="openMl(row)"
									>
										{{ row.mlCategoryName }}
									</button>
									<button
										v-else
										type="button"
										class="min-w-0 truncate text-left text-[11px] font-medium text-amber-600 hover:underline dark:text-amber-400"
										@click="openMl(row)"
									>
										<i class="pi pi-sparkles text-[10px]" /> {{ $t('admin.carga.ml.assignInline') }}
									</button>
									<button
										v-if="!row.seccion && row.mlCategoryName"
										type="button"
										class="ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-primary hover:bg-primary/10"
										:title="$t('admin.carga.categoria.useMl', { name: row.mlCategoryName })"
										:aria-label="$t('admin.carga.categoria.useMl', { name: row.mlCategoryName })"
										@click="useMlCategoria(row)"
									>
										<i class="pi pi-arrow-up text-[10px]" />
									</button>
								</div>
							</td>
							<!-- Producto con opciones (talles, colores…): una sola fila; el precio
							     y el stock de cada opción se cargan en el diálogo. -->
							<td v-if="groupSize(row) > 1" colspan="4" class="px-2 py-2 align-middle">
								<button
									type="button"
									class="flex w-full min-w-0 items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-left text-xs transition-colors hover:bg-primary/10"
									@click="openVariantes(row)"
								>
									<i class="pi pi-sitemap shrink-0 text-primary" />
									<span class="min-w-0 flex-1 truncate font-medium text-primary">{{ groupLabel(row) }}</span>
									<span class="shrink-0 font-semibold tabular-nums text-surface-800 dark:text-surface-100">{{ groupPrice(row) }}</span>
									<span class="shrink-0 tabular-nums text-surface-500">{{ $t('admin.carga.variantes.stock', { n: groupStock(row) }) }}</span>
								</button>
							</td>
							<template v-else>
							<td class="px-2 py-2 align-middle">
								<InputNumber
									v-model="row.precioCosto"
									fluid
									mode="currency"
									currency="ARS"
									locale="es-AR"
									:min="0"
									:max-fraction-digits="0"
									:input-class="quietCls + ' !px-1 text-right tabular-nums'"
									:placeholder="'—'"
									@update:model-value="onRowCosto(row)"
								/>
							</td>
							<td class="px-2 py-2 align-middle">
								<InputNumber
									v-model="row.margen"
									fluid
									suffix=" %"
									:min="0"
									:max="900"
									:max-fraction-digits="0"
									:input-class="quietCls + ' !px-1 text-right tabular-nums'"
									:placeholder="'—'"
									@update:model-value="onRowMargen(row)"
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
									:input-class="quietCls + ' !px-1 text-right font-medium tabular-nums'"
									@update:model-value="onRowPrecio(row)"
								/>
								<!-- Por unidad o por kilo (verdulería): con kilo el precio es el del kilo. -->
								<Select
									:model-value="ventaDe(row)"
									:options="ventaOptions"
									option-label="label"
									option-value="value"
									size="small"
									fluid
									class="mt-0.5"
									:class="quietCls"
									label-class="!px-1 !text-[11px] text-right text-surface-500"
									:pt="{ dropdown: { class: '!w-5' } }"
									:aria-label="$t('admin.carga.venta.label')"
									@update:model-value="setVenta(row, $event)"
								>
									<!-- En la celda entra poco: "kg · de a 250 g"; la lista muestra el texto entero. -->
									<template #value="{ value }">{{ ventaOptions.find(o => o.value === value)?.short }}</template>
								</Select>
							</td>
							<td class="px-2 py-2 align-middle">
								<span
									v-if="row.unidadVenta === 'kg'"
									class="block text-center text-xs text-surface-400"
									:title="$t('admin.carga.venta.sinStock')"
								>—</span>
								<InputNumber
									v-else
									v-model="row.stock"
									fluid
									:min="0"
									:input-class="quietCls + ' !px-1 text-center tabular-nums'"
									:placeholder="'—'"
									@update:model-value="markDirty(row)"
								/>
							</td>
							</template>
							<td class="px-2 py-2 align-middle">
								<Tag :value="estadoLabel(row)" :severity="estadoSeverity(row)" />
								<p v-if="faltantesDe(row).length" class="mt-1 text-[11px] text-surface-400">
									{{ faltantesDe(row).join(' · ') }}
								</p>
							</td>
							<td class="px-2 py-2 align-middle">
								<div class="flex items-center gap-1">
									<!-- Siempre 3 lugares como máximo (la columna mide 96px): con cambios sin
									     guardar, "Guardar" ocupa el lugar de publicar/ver en ML — con un 4º
									     ícono la tabla desbordaba. Publicar vuelve a aparecer al guardar. -->
									<!-- Un producto con opciones es UNA fila aunque por detrás sean varias
									     publicaciones: guardar y publicar actúan sobre todas sus opciones. -->
									<Button
										v-if="rowPending(row)"
										icon="pi pi-save"
										text
										rounded
										severity="warn"
										size="small"
										:loading="savingKey === row.key"
										:title="$t('admin.carga.saveRow')"
										@click="groupSize(row) > 1 ? saveGroup(row) : saveRow(row)"
									/>
									<template v-if="mlConnected && !rowPending(row)">
										<a
											v-if="rowPermalink(row)"
											:href="rowPermalink(row)"
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
											@click="groupSize(row) > 1 ? publishGroup(row) : publishRow(row)"
										/>
									</template>
									<!-- Única entrada a las variantes (un producto se carga normal y, si
									     hace falta, se le agregan acá). En color para que se encuentre. -->
									<Button
										icon="pi pi-sitemap"
										text
										rounded
										size="small"
										:title="$t(groupSize(row) > 1 ? 'admin.carga.variantes.button' : 'admin.carga.variantes.buttonHint')"
										:aria-label="$t(groupSize(row) > 1 ? 'admin.carga.variantes.button' : 'admin.carga.variantes.buttonHint')"
										@click="openVariantes(row)"
									/>
									<Button
										icon="pi pi-trash"
										text
										rounded
										severity="secondary"
										size="small"
										@click="removeGroup(row)"
									/>
								</div>
							</td>
						</tr>
					</tbody>
				</table>
			</div>
			</template>

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

		<!-- Dialog: costo en lote (valor fijo de costo para las seleccionadas) -->
		<Dialog v-model:visible="bulkCostoVisible" modal :header="$t('admin.carga.bulk.costoEnLote')" class="w-full max-w-sm">
			<div class="space-y-3 pt-1">
				<p class="text-sm text-surface-500">{{ $t('admin.carga.bulk.costoEnLoteHint') }}</p>
				<InputNumber v-model="bulkCosto" class="w-full" mode="currency" currency="ARS" locale="es-AR" :min="0" :max-fraction-digits="0" />
				<p class="text-xs text-surface-400">{{ $t('admin.carga.bulk.costoUpApplies', { n: selectedCount }) }}</p>
			</div>
			<template #footer>
				<Button :label="$t('common.cancel')" text @click="bulkCostoVisible = false" />
				<Button :label="$t('common.apply')" :disabled="bulkCosto == null" @click="applyBulkCosto" />
			</template>
		</Dialog>

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
		<Dialog v-model:visible="bulkCategoriaVisible" modal :header="$t('admin.carga.bulk.asignarRubro')" class="w-full max-w-sm">
			<div class="space-y-3 pt-1">
				<p class="text-sm text-surface-500">{{ $t('admin.carga.categoria.bulkHint', { n: selectedCount }) }}</p>
				<Select
					v-model="bulkCategoria"
					:options="categoriaOptions"
					editable
					show-clear
					fluid
					:placeholder="$t('admin.carga.categoria.none')"
				/>
			</div>
			<template #footer>
				<Button :label="$t('common.cancel')" text @click="bulkCategoriaVisible = false" />
				<Button :label="$t('common.apply')" @click="applyBulkCategoria" />
			</template>
		</Dialog>

		<Dialog v-model:visible="bulkMargenVisible" modal :header="$t('admin.carga.bulk.margen')" class="w-full max-w-sm">
			<div class="space-y-4 pt-1">
				<p class="text-sm text-surface-500">{{ $t('admin.carga.bulk.margenHint') }}</p>
				<InputNumber v-model="bulkMargen" fluid suffix=" %" :min="0" :max="900" class="w-full" />
				<!-- La barra en su propia línea a lo ancho: dentro del flex, junto al input
				     fluid, quedaba con ancho 0 y solo se veía la manija. -->
				<Slider
					:model-value="bulkMargen ?? 0"
					:min="0"
					:max="300"
					@update:model-value="v => (bulkMargen = Array.isArray(v) ? v[0] : v)"
				/>
				<p class="text-xs text-surface-400">{{ $t('admin.carga.bulk.margenApplies', { n: selectedCount }) }}</p>
			</div>
			<template #footer>
				<Button :label="$t('common.cancel')" text @click="bulkMargenVisible = false" />
				<Button :label="$t('common.apply')" :disabled="bulkMargen == null" @click="applyBulkMargen" />
			</template>
		</Dialog>

		<!-- Dialog: aumento % del costo (inflación) -->
		<Dialog v-model:visible="bulkCostoUpVisible" modal :header="$t('admin.carga.bulk.costoUp')" class="w-full max-w-sm">
			<div class="space-y-4 pt-1">
				<p class="text-sm text-surface-500">{{ $t('admin.carga.bulk.costoUpHint') }}</p>
				<InputNumber v-model="bulkCostoUp" fluid suffix=" %" :min="0" :max="900" class="w-full" />
				<Slider
					:model-value="bulkCostoUp ?? 0"
					:min="0"
					:max="200"
					@update:model-value="v => (bulkCostoUp = Array.isArray(v) ? v[0] : v)"
				/>
				<p class="text-xs text-surface-400">{{ $t('admin.carga.bulk.costoUpApplies', { n: selectedCount }) }}</p>
			</div>
			<template #footer>
				<Button :label="$t('common.cancel')" text @click="bulkCostoUpVisible = false" />
				<Button :label="$t('common.apply')" :disabled="!bulkCostoUp" @click="applyBulkCostoUp" />
			</template>
		</Dialog>

		<!-- Dialog: borrar seleccionados (confirmación) -->
		<Dialog v-model:visible="bulkDeleteVisible" modal :header="$t('admin.carga.bulk.deleteTitle')" class="w-full max-w-sm">
			<div class="space-y-3 pt-1">
				<p class="text-sm text-surface-600 dark:text-surface-300">{{ $t('admin.carga.bulk.deleteBody', { n: selectedCount }) }}</p>
				<p v-if="selectedPublished" class="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
					<i class="pi pi-exclamation-triangle mt-0.5" /> {{ $t('admin.carga.bulk.deletePublished', { n: selectedPublished }) }}
				</p>
			</div>
			<template #footer>
				<Button :label="$t('common.cancel')" text :disabled="deleting" @click="bulkDeleteVisible = false" />
				<Button :label="$t('admin.carga.bulk.deleteConfirm', { n: selectedCount })" severity="danger" icon="pi pi-trash" :loading="deleting" @click="bulkDelete" />
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
				<!-- Bonificación de la lista: el precio del Excel se toma como COSTO menos esta boni%. -->
				<div class="flex items-center justify-between gap-3 rounded-xl border border-surface-200 p-3 dark:border-surface-700">
					<div class="min-w-0 flex-1">
						<p class="text-sm font-medium text-surface-700 dark:text-surface-200">{{ $t('admin.carga.import.bonifLabel') }}</p>
						<p class="text-[11px] text-surface-400">{{ $t('admin.carga.import.bonifHint') }}</p>
					</div>
					<div class="w-24 shrink-0">
						<InputNumber v-model="importBonif" fluid suffix=" %" :min="0" :max="100" />
					</div>
				</div>
				<!-- Reimportar para actualizar el costo de productos existentes (match por EAN/SKU). -->
				<div class="flex items-center justify-between gap-3 rounded-xl border border-surface-200 p-3 dark:border-surface-700">
					<div class="min-w-0 flex-1">
						<p class="text-sm font-medium text-surface-700 dark:text-surface-200">{{ $t('admin.carga.import.updateLabel') }}</p>
						<p class="text-[11px] text-surface-400">{{ $t('admin.carga.import.updateHint') }}</p>
					</div>
					<ToggleSwitch v-model="importUpdateExisting" class="shrink-0" />
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
				<!-- El nombre se edita acá mismo: las sugerencias de categoría salen de él, y
				     antes había que cerrar el diálogo para cambiarlo y volver a entrar. -->
				<div class="space-y-1">
					<label class="block text-[11px] font-semibold uppercase tracking-wide text-surface-500">{{ $t('admin.carga.cols.producto') }}</label>
					<div class="flex gap-2">
						<InputText
							v-model="mlRow.nombre"
							class="w-full min-w-0 font-semibold"
							:placeholder="$t('admin.carga.placeholders.nombre')"
							@update:model-value="markDirty(mlRow)"
							@keyup.enter="resuggest"
						/>
						<Button
							v-if="mlMode === 'categoria'"
							:label="$t('admin.carga.ml.suggest')"
							icon="pi pi-sparkles"
							size="small"
							outlined
							class="shrink-0"
							:loading="mlPredicting"
							@click="resuggest"
						/>
					</div>
					<p v-if="mlMode === 'categoria'" class="text-[11px] text-surface-400">{{ $t('admin.carga.ml.nameHint') }}</p>
				</div>
				<!-- Dos caminos SEPARADOS (antes estaban mezclados y el catálogo pisaba
				     lo cargado sin avisar):
				     · categoría → solo asigna categoría + sus datos; no toca lo cargado.
				     · catálogo  → el producto ya existe en ML: trae todos sus datos. -->
				<div class="grid grid-cols-2 gap-2">
					<button
						v-for="m in mlModes"
						:key="m.key"
						type="button"
						class="rounded-xl border p-3 text-left transition-colors"
						:class="
							mlMode === m.key
								? 'border-primary bg-primary/5'
								: 'border-surface-200 hover:bg-surface-50 dark:border-surface-700 dark:hover:bg-surface-800'
						"
						@click="setMlMode(m.key)"
					>
						<span class="flex items-center gap-2 text-sm font-semibold text-surface-800 dark:text-surface-100">
							<i :class="[m.icon, mlMode === m.key ? 'text-primary' : 'text-surface-400']" /> {{ $t(m.title) }}
						</span>
						<span class="mt-1 block text-xs leading-snug text-surface-500">{{ $t(m.desc) }}</span>
					</button>
				</div>

				<!-- Camino "ya está en Mercado Libre": buscar en el catálogo y traer todo -->
				<div v-if="mlMode === 'catalogo'" class="space-y-2 rounded-xl bg-primary/5 p-3">
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
					<p v-if="mlCatalogPicked" class="flex items-start gap-1.5 text-xs font-medium text-green-600 dark:text-green-400">
						<i class="pi pi-check-circle mt-px" /> {{ $t('admin.carga.ml.catalogPicked', { name: mlCatalogPicked }) }}
					</p>
					<p class="flex items-start gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
						<i class="pi pi-info-circle mt-px" /> {{ $t('admin.carga.ml.catalogHint') }}
					</p>
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
							>{{ mlPendingCategoryName || $t(mlMode === 'catalogo' ? 'admin.carga.ml.catalogPickFirst' : 'admin.carga.ml.noCategory') }}</span
						>
					</div>
					<p v-if="mlMode === 'categoria'" class="text-[11px] text-surface-400">{{ $t('admin.carga.ml.categoryHint') }}</p>
					<div v-if="mlMode === 'categoria' && mlPredictions.length" class="space-y-1">
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
							<span class="min-w-0">
								<span class="block font-medium">{{ p.categoryName }}</span>
								<!-- La ruta: hay varias "Remeras" (ropa, pesca, golf) y sin esto parecen la misma. -->
								<span v-if="p.categoryPath" class="block text-[11px] leading-snug text-surface-500">{{ p.categoryPath }}</span>
							</span>
							<i v-if="p.categoryId === mlPendingCategoryId" class="pi pi-check ml-2 shrink-0 text-primary" />
						</button>
					</div>
				</div>
				<!-- Atributos obligatorios -->
				<div v-if="mlPendingCategoryId" class="space-y-3 border-t border-surface-200 pt-4 dark:border-surface-700">
					<label class="text-xs font-semibold uppercase tracking-wide text-surface-600 dark:text-surface-300">{{
						$t('admin.carga.ml.attrsTitle')
					}}</label>
					<div v-if="mlLoadingAttrs" class="py-4 text-center text-surface-500"><i class="pi pi-spin pi-spinner" /></div>
					<p v-else-if="!mlAttrsShown.length" class="text-xs text-surface-400">{{ $t('admin.carga.ml.noAttrs') }}</p>
					<div v-else class="space-y-3">
						<div v-for="attr in mlAttrsShown" :key="attr.id" class="space-y-1">
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
				<!-- Guía de talles: ML la exige para publicar ropa (remeras, camisas,
				     pantalones…). Se elige una del vendedor; al publicar, cada talle se
				     engancha solo a su fila de la guía. -->
				<div v-if="mlCharts && mlCharts.required" class="space-y-2 border-t border-surface-200 pt-4 dark:border-surface-700">
					<div class="flex items-center justify-between gap-2">
						<label class="text-xs font-semibold uppercase tracking-wide text-surface-600 dark:text-surface-300">{{ $t('admin.carga.ml.chart.title') }}</label>
						<Button :label="$t('admin.carga.ml.chart.search')" icon="pi pi-refresh" size="small" text :loading="mlChartsLoading" @click="loadSizeCharts" />
					</div>
					<p class="text-[11px] text-surface-400">{{ $t('admin.carga.ml.chart.hint') }}</p>
					<!-- Guías encontradas (o cargadas por código): se elige una. -->
					<template v-if="mlCharts.charts.length">
						<Select
							v-model="mlAttrValues.SIZE_GRID_ID"
							:options="mlChartOptions"
							option-label="label"
							option-value="value"
							show-clear
							:placeholder="$t('admin.carga.ml.chart.pick')"
							class="w-full"
						/>
						<!-- Calzado: si ML tiene una guía estándar, conviene usarla antes que crear una. -->
						<button
							v-if="mlChartStandard && !mlAttrValues.SIZE_GRID_ID"
							type="button"
							class="flex w-full items-start gap-1.5 rounded-lg bg-emerald-500/10 p-2 text-left text-xs text-emerald-700 dark:text-emerald-300"
							@click="mlAttrValues.SIZE_GRID_ID = mlChartStandard.id"
						>
							<i class="pi pi-star mt-px" />
							<span>{{ $t('admin.carga.ml.chart.recommendedStandard', { name: mlChartStandard.name }) }}</span>
						</button>
						<p v-if="mlChartMissing.length" class="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
							<i class="pi pi-exclamation-triangle mt-px" /> {{ $t('admin.carga.ml.chart.missing', { sizes: mlChartMissing.join(', ') }) }}
						</p>
						<!-- Ninguna le sirve (le faltan talles, es de otra prenda…): crear una nueva acá. -->
						<Button :label="$t('admin.carga.ml.chart.create.button')" icon="pi pi-plus" size="small" text @click="mlChartCreateVisible = true" />
						<p v-if="mlChartSelected && mlChartSelected.sameDomain === false" class="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
							<i class="pi pi-exclamation-triangle mt-px" /> {{ $t('admin.carga.ml.chart.otherDomain', { category: mlPendingCategoryName }) }}
						</p>
						<p
							v-if="mlChartSelected && mlChartSelected.gender && mlAttrValues.GENDER && mlChartSelected.gender !== mlAttrValues.GENDER"
							class="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400"
						>
							<i class="pi pi-exclamation-triangle mt-px" />
							<span>
								{{ $t('admin.carga.ml.chart.otherGenderPicked', { chart: mlChartSelected.gender, product: mlAttrValues.GENDER }) }}
								<!-- Arreglo a un toque: el género del producto pasa a ser el de la guía. -->
								<button type="button" class="font-semibold underline underline-offset-2" @click="mlAttrValues.GENDER = mlChartSelected.gender">
									{{ $t('admin.carga.ml.chart.useChartGender', { gender: mlChartSelected.gender }) }}
								</button>
							</span>
						</p>
					</template>
					<p v-else-if="mlCharts.incomplete" class="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
						<i class="pi pi-info-circle mt-px" /> {{ $t('admin.carga.ml.chart.needFilters') }}
					</p>
					<div v-else class="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
						<p class="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300">
							<i class="pi pi-exclamation-triangle mt-px" />
							{{ $t('admin.carga.ml.chart.none', { category: mlPendingCategoryName, gender: mlAttrValues.GENDER, brand: mlAttrValues.BRAND }) }}
						</p>
						<!-- Tiene guías para esta prenda, pero de otro género: por eso no aparecen. -->
						<div v-if="mlCharts.otherGenders && mlCharts.otherGenders.length" class="space-y-0.5 text-xs text-amber-700 dark:text-amber-300">
							<p class="font-semibold">{{ $t('admin.carga.ml.chart.otherGender') }}</p>
							<p v-for="o in mlCharts.otherGenders" :key="o.chart.id">
								· {{ o.chart.name }} ({{ o.gender }}) — {{ o.chart.rows.map(r => r.size).join(', ') }}
							</p>
						</div>
						<!-- Crear la guía acá mismo, con los talles del producto ya cargados. -->
						<p class="text-xs text-amber-700 dark:text-amber-300">{{ $t('admin.carga.ml.chart.orCreate') }}</p>
						<Button :label="$t('admin.carga.ml.chart.create.button')" icon="pi pi-plus" size="small" @click="mlChartCreateVisible = true" />
						<!-- Alternativa: crearla en la pantalla de guías de talles de Mercado Libre. -->
						<a
							:href="ML_SIZE_CHARTS_URL"
							target="_blank"
							rel="noopener"
							class="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 px-3 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-500/10 dark:text-amber-300"
						>
							<i class="pi pi-external-link" /> {{ $t('admin.carga.ml.chart.goToMl') }}
						</a>
						<p class="text-[11px] text-surface-500">{{ $t('admin.carga.ml.chart.howTo') }}</p>
					</div>
					<!-- Camino directo: el código que ML muestra al crear la guía. No depende
					     de que coincidan los filtros del buscador (prenda, género y marca). -->
					<div class="space-y-1 pt-1">
						<label class="block text-[11px] font-semibold uppercase tracking-wide text-surface-500">{{ $t('admin.carga.ml.chart.codeLabel') }}</label>
						<div class="flex gap-2">
							<InputText
								v-model="mlChartCode"
								class="w-full min-w-0"
								inputmode="numeric"
								:placeholder="$t('admin.carga.ml.chart.codePlaceholder')"
								@keyup.enter="useChartCode"
							/>
							<Button :label="$t('admin.carga.ml.chart.codeUse')" size="small" outlined class="shrink-0" :loading="mlChartCodeLoading" @click="useChartCode" />
						</div>
						<p class="text-[11px] text-surface-400">{{ $t('admin.carga.ml.chart.codeHint') }}</p>
					</div>
				</div>
			</div>
			<template #footer>
				<Button :label="$t('common.cancel')" text @click="mlVisible = false" />
				<Button :label="$t('common.apply')" icon="pi pi-check" @click="saveMl" />
			</template>
		</Dialog>

		<!-- Dialog: crear guía de talles en ML sin salir de VentaCore -->
		<MlSizeChartCreateDialog
			v-if="mlRow && mlPendingCategoryId"
			v-model:visible="mlChartCreateVisible"
			:rubro-id="mlRow.rubroId"
			:category-id="mlPendingCategoryId"
			:category-name="mlPendingCategoryName"
			:gender="mlAttrValues.GENDER ?? ''"
			:brand="mlAttrValues.BRAND ?? ''"
			:sizes="mlProductSizes"
			@created="onChartCreated"
		/>

		<!-- Dialog: gestor de imágenes por fila -->
		<Dialog v-model:visible="imgVisible" modal :header="$t('admin.carga.images.title')" class="w-full max-w-lg">
			<div v-if="imgRow" class="pt-2">
				<div class="grid grid-cols-3 gap-3 sm:grid-cols-4">
					<div v-for="(img, i) in imgRow.imagenes" :key="img" class="group relative aspect-square overflow-hidden rounded-xl border border-surface-200 dark:border-surface-700">
						<img :src="img" class="h-full w-full object-cover" alt="" />
						<span v-if="i === 0" class="absolute left-1 top-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-white">{{ $t('admin.carga.images.cover') }}</span>
						<div class="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
							<Button v-if="i !== 0" icon="pi pi-star" rounded size="small" :title="$t('admin.carga.images.makeCover')" @click="makeCover(i)" />
							<Button icon="pi pi-eraser" rounded size="small" severity="secondary" :title="$t('image.removeBg')" :disabled="strippingIdx !== null" @click="stripImg(i)" />
							<Button icon="pi pi-trash" rounded severity="danger" size="small" :title="$t('common.delete')" @click="removeImg(i)" />
						</div>
						<div v-if="strippingIdx === i" class="absolute inset-0 flex items-center justify-center bg-surface-0/70 dark:bg-surface-900/70">
							<i class="pi pi-spin pi-spinner text-xl text-primary" />
						</div>
					</div>
					<ImageUpload :model-value="''" folder="productos" :aspect-ratio="1" :min-width="500" format="jpeg" @update:model-value="onAddImage" />
				</div>
				<div class="mt-3"><HandoffButton @photos="onHandoffPhotos" /></div>
				<p class="mt-3 text-xs text-surface-400">{{ $t('admin.carga.images.hint') }}</p>
			</div>
			<template #footer>
				<Button :label="$t('admin.carga.images.done')" @click="imgVisible = false" />
			</template>
		</Dialog>

		<!-- Producto con opciones (talles, colores…): datos una vez + un renglón por opción. -->
		<VariantesDialog
			v-model:visible="varVisible"
			:shared="varShared"
			:initial-items="varItems"
			:image-url="varHead ? varHead.imageUrl : ''"
			:image-count="varHead ? varHead.imagenes.length : 0"
			:categoria-options="categoriaOptions"
			:name-suggestions="varNameSuggestions"
			:suggest-categoria="suggestCategoriaVitrina"
			:color-thumb="colorThumb"
			@images="varHead && openImages(varHead)"
			@color-images="openColorImages"
			@apply="applyVariantes"
		/>

		<!-- Hoja de edición (mobile): se abre al tocar un producto de la lista. Edita la
		     MISMA fila que la tabla de desktop (mismos v-model y handlers), así no hay
		     dos lógicas. Fotos y categoría abren los mismos diálogos de siempre. -->
		<Drawer
			v-model:visible="sheetVisible"
			position="bottom"
			block-scroll
			:header="$t('admin.carga.sheet.title')"
			:style="{ height: 'auto', maxHeight: '92vh' }"
			class="rounded-t-2xl"
		>
			<div v-if="sheetRow" class="space-y-4">
				<!-- Foto + nombre -->
				<div class="flex items-end gap-3">
					<button
						type="button"
						class="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-100 text-surface-400 dark:bg-surface-800"
						:title="$t('admin.carga.images.title')"
						@click="openImages(sheetRow)"
					>
						<img v-if="sheetRow.imageUrl" :src="sheetRow.imageUrl" class="h-full w-full object-cover" alt="" />
						<i v-else class="pi pi-camera" />
						<span
							v-if="sheetRow.imagenes.length > 1"
							class="absolute bottom-0 right-0 rounded-tl bg-surface-900/80 px-1 text-[9px] font-semibold text-white"
						>{{ sheetRow.imagenes.length }}</span>
					</button>
					<div class="min-w-0 flex-1 space-y-1">
						<label class="block text-[11px] font-semibold uppercase tracking-wide text-surface-500">{{ $t('admin.carga.cols.producto') }}</label>
						<InputText
							v-model="sheetRow.nombre"
							class="w-full"
							:placeholder="$t('admin.carga.placeholders.nombre')"
							@update:model-value="markDirty(sheetRow)"
						/>
					</div>
				</div>

				<!-- Precio: costo → margen → precio (se recalculan entre sí, igual que en la tabla).
				     Costo ancho + margen angosto (un "900 %" entra en 6rem; mitad y mitad
				     cortaba los costos de 7 cifras) y el precio (el resultado) a todo el ancho. -->
				<div class="grid grid-cols-[minmax(0,1fr)_6rem] gap-2">
					<div class="min-w-0 space-y-1">
						<label class="block text-[11px] font-semibold uppercase tracking-wide text-surface-500">{{ $t('admin.carga.cols.costo') }}</label>
						<InputNumber
							v-model="sheetRow.precioCosto"
							fluid
							mode="currency"
							currency="ARS"
							locale="es-AR"
							:min="0"
							:max-fraction-digits="0"
							:placeholder="'—'"
							@update:model-value="onRowCosto(sheetRow)"
						/>
					</div>
					<div class="min-w-0 space-y-1">
						<label class="block text-[11px] font-semibold uppercase tracking-wide text-surface-500">{{ $t('admin.carga.cols.margen') }}</label>
						<InputNumber
							v-model="sheetRow.margen"
							fluid
							suffix=" %"
							:min="0"
							:max="900"
							:max-fraction-digits="0"
							:placeholder="'—'"
							@update:model-value="onRowMargen(sheetRow)"
						/>
					</div>
					<div class="col-span-2 min-w-0 space-y-1">
						<label class="block text-[11px] font-semibold uppercase tracking-wide text-surface-500">
							{{ $t(sheetRow.unidadVenta === 'kg' ? 'admin.carga.venta.precioKg' : 'admin.carga.cols.precio') }}
						</label>
						<InputNumber
							v-model="sheetRow.precio"
							fluid
							mode="currency"
							currency="ARS"
							locale="es-AR"
							:min="0"
							:max-fraction-digits="0"
							input-class="text-lg font-semibold"
							@update:model-value="onRowPrecio(sheetRow)"
						/>
					</div>
				</div>

				<!-- Por unidad o por kilo -->
				<div class="space-y-1">
					<label class="block text-[11px] font-semibold uppercase tracking-wide text-surface-500">{{ $t('admin.carga.venta.label') }}</label>
					<Select
						:model-value="ventaDe(sheetRow)"
						:options="ventaOptions"
						option-label="label"
						option-value="value"
						fluid
						@update:model-value="setVenta(sheetRow, $event)"
					/>
				</div>

				<!-- Stock + EAN -->
				<div class="grid grid-cols-2 gap-2">
					<div class="min-w-0 space-y-1">
						<label class="block text-[11px] font-semibold uppercase tracking-wide text-surface-500">{{ $t('admin.carga.cols.stock') }}</label>
						<InputText v-if="sheetRow.unidadVenta === 'kg'" :model-value="$t('admin.carga.venta.sinStock')" class="w-full" disabled />
						<InputNumber v-else v-model="sheetRow.stock" fluid :min="0" :placeholder="'—'" @update:model-value="markDirty(sheetRow)" />
					</div>
					<div class="min-w-0 space-y-1">
						<label class="block text-[11px] font-semibold uppercase tracking-wide text-surface-500">{{ $t('admin.carga.placeholders.ean') }}</label>
						<InputText v-model="sheetRow.gtin" class="w-full" @update:model-value="markDirty(sheetRow)" />
					</div>
				</div>

				<!-- Categoría del catálogo (menú de la tienda) -->
				<div class="space-y-1">
					<label class="block text-[11px] font-semibold uppercase tracking-wide text-surface-500">{{ $t('admin.carga.cols.categoria') }}</label>
					<Select
						v-model="sheetRow.seccion"
						:options="categoriaOptions"
						editable
						show-clear
						fluid
						:placeholder="$t('admin.carga.categoria.none')"
						@update:model-value="markDirty(sheetRow)"
					/>
					<button
						v-if="!sheetRow.seccion && sheetRow.mlCategoryName"
						type="button"
						class="block max-w-full truncate text-left text-xs font-semibold text-primary"
						@click="useMlCategoria(sheetRow)"
					>
						{{ $t('admin.carga.categoria.useMl', { name: sheetRow.mlCategoryName }) }}
					</button>
					<p class="text-[11px] text-surface-400">{{ $t('admin.carga.categoria.hint') }}</p>
				</div>

				<!-- Categoría de ML -->
				<div
					v-if="mlConnected"
					class="flex items-center justify-between gap-2 rounded-xl border border-surface-200 px-3 py-2 dark:border-surface-700"
				>
					<div class="min-w-0">
						<p class="text-[11px] font-semibold uppercase tracking-wide text-surface-500">{{ $t('admin.carga.cols.categoriaMl') }}</p>
						<p class="truncate text-sm" :class="sheetRow.mlCategoryName ? 'text-surface-800 dark:text-surface-100' : 'text-amber-600 dark:text-amber-400'">
							{{ sheetRow.mlCategoryName || $t('admin.carga.ml.noCategory') }}
						</p>
					</div>
					<Button
						:label="sheetRow.mlCategoryName ? $t('common.edit') : $t('admin.carga.ml.assignInline')"
						size="small"
						outlined
						class="shrink-0"
						@click="openMl(sheetRow)"
					/>
				</div>

				<!-- Talles, colores, medidas: pasa a ser un producto con opciones. -->
				<Button :label="$t('admin.carga.variantes.button')" icon="pi pi-sitemap" size="small" outlined class="w-full" @click="sheetToVariantes" />

				<!-- Estado + lo que falta -->
				<div class="flex flex-wrap items-center gap-2">
					<Tag :value="estadoLabel(sheetRow)" :severity="estadoSeverity(sheetRow)" />
					<span v-if="faltantesDe(sheetRow).length" class="text-xs text-surface-500">{{ faltantesDe(sheetRow).join(' · ') }}</span>
				</div>

				<!-- Acciones: fijas al pie de la hoja. Eliminar y ML como íconos (con su
				     texto en el tooltip) y Guardar, la acción principal, ocupa el resto:
				     con etiquetas largas se partían en 2 líneas y empujaban Guardar afuera. -->
				<div class="sticky bottom-0 -mx-1 flex items-center gap-2 border-t border-surface-200 bg-surface-0 px-1 pb-1 pt-3 dark:border-surface-700 dark:bg-surface-900">
					<Button icon="pi pi-trash" severity="secondary" outlined :aria-label="$t('common.delete')" :title="$t('common.delete')" class="shrink-0" @click="removeSheetRow" />
					<template v-if="mlConnected">
						<a
							v-if="sheetRow.mlPermalink"
							:href="sheetRow.mlPermalink"
							target="_blank"
							rel="noopener"
							class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
							:aria-label="$t('admin.carga.pub.view')"
							:title="$t('admin.carga.pub.view')"
						><i class="pi pi-external-link" /></a>
						<Button
							v-else
							icon="pi pi-megaphone"
							severity="success"
							outlined
							:aria-label="$t('admin.carga.sheet.publish')"
							:title="$t('admin.carga.sheet.publish')"
							:loading="publishingKey === sheetRow.key"
							:disabled="!sheetRow.id"
							class="shrink-0"
							@click="publishRow(sheetRow)"
						/>
					</template>
					<Button
						:label="$t('admin.carga.sheet.save')"
						icon="pi pi-save"
						class="min-w-0 flex-1 whitespace-nowrap"
						:loading="savingKey === sheetRow.key"
						:disabled="!sheetRow.dirty"
						@click="saveSheetRow"
					/>
				</div>
			</div>
		</Drawer>
	</div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import type { MenuItem } from 'primevue/menuitem';
import {
	ProductoSource,
	ProductoEstado,
	INCREMENTOS_KG,
	evaluarProducto,
	formatCantidad,
	pasoVenta,
	type UnidadVenta,
	channelEnabled,
	sameSize,
	type Producto,
	type ProductoLike,
	type BatchProductoItem,
	type BatchProductoResult,
	type MlCategoryPrediction,
	type MlAttribute,
	type MlSizeChart,
	type MlSizeChartsResult,
	type MlVariationAttr,
	type ProductoOpcion,
	matchOpcionAttr,
	type MlListingType,
	type MlRequiredAttribute,
	type MlCatalogSearchResult,
} from '@base-template/shared';
import { useCatalogStore } from '@/modules/admin/store/catalog';
import { useAdminContext } from '@/modules/admin/store/context';
import { apiErrorMessage } from '@/shared/utils/apiError';
import { stripBackgroundToUpload, deleteImage } from '@/shared/utils/image';
import {
	parseTableFile,
	parseNumber,
	ACCEPTED_IMPORT_EXTENSIONS,
	type ParsedTable,
} from '@/modules/admin/utils/importTable';
import ImageUpload from '@/shared/components/ImageUpload.vue';
import HandoffButton from '@/shared/components/HandoffButton.vue';
import MlSizeChartCreateDialog from '@/modules/admin/components/MlSizeChartCreateDialog.vue';
import { compareVariantes } from '@/modules/app/utils/variantes';
import VariantesDialog, {
	type ColorRef,
	type VarianteItem,
	type VariantesResult,
	type VariantesShared,
} from '@/modules/admin/components/VariantesDialog.vue';

/** Fila editable de la grilla (aún sin persistir o ya existente). */
interface Row {
	key: string;
	id?: string;
	rubroId: string;
	nombre: string;
	descripcion: string;
	/** Categoría del catálogo (menú de la tienda). null/'' = sin categoría. */
	seccion: string | null;
	precio: number | null;
	precioCosto: number | null;
	/** Margen (%) sobre el costo con el que se arma el precio de tienda. */
	margen: number | null;
	/** Precio en Mercado Libre (para propagar en actualizaciones masivas). */
	precioMl: number | null;
	/** Tipo de publicación de ML (para calcular la comisión). */
	mlListingType: MlListingType;
	stock: number | null;
	/** Por unidad o por kilo (con kilo, `precio` es el del kilo y no lleva stock). */
	unidadVenta: UnidadVenta;
	/** Por kilo: de a cuántos kg se pide. */
	incremento: number | null;
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
	/**
	 * Opciones (talles, colores…): las filas con el mismo "grupo" son el mismo
	 * artículo y se muestran en UNA fila; "variante" dice cuál es cada una.
	 */
	grupo: string | null;
	variante: string | null;
	/** Las características de la opción con su nombre ([{ Peso: 1 kg }]); null si no se detallaron. */
	opciones: ProductoOpcion[] | null;
	selected: boolean;
	/** La fila tiene cambios sin guardar (muestra el ✔ de guardar en la fila). */
	dirty?: boolean;
	/** Precio de página y de ML tal como están guardados: para saber si el precio cambió. */
	precioSaved?: number | null;
	precioMlSaved?: number | null;
}

/** Campos de producto a los que puede mapear una columna del archivo. */
/**
 * Pantalla de guías de talles del vendedor en Mercado Libre (ahí se crean). La
 * de "crear" lleva un tramo propio de cada sesión, así que se entra por la
 * lista. (Argentina; las cuentas conectadas hoy son todas MLA.)
 */
const ML_SIZE_CHARTS_URL = 'https://vendedores.mercadolibre.com.ar/moda/talles';

/** Productos por pedido al guardar (el servidor corta los pedidos de más de ~100 KB). */
const SAVE_CHUNK = 25;

const IMPORT_FIELDS = ['nombre', 'descripcion', 'precioCosto', 'precio', 'stock', 'gtin', 'sku', 'imageUrl'] as const;
type ImportField = (typeof IMPORT_FIELDS)[number] | 'ignore';

export default defineComponent({
	name: 'CargaMasivaView',
	components: { ImageUpload, HandoffButton, VariantesDialog, MlSizeChartCreateDialog },
	data() {
		return {
			catalog: useCatalogStore(),
			ctx: useAdminContext(),
			loading: false,
			saving: false,
			rows: [] as Row[],
			seq: 0,
			// Buscador: filtra las filas visibles por nombre, marca, EAN/SKU o atributos.
			// Acota todas las acciones en lote (ej. "yamaha" → seleccionar todo → +10%).
			search: '',
			// ¿Cada rubro tiene ML conectado? (para el contexto)
			mlStateByRubro: {} as Record<string, boolean>,
			// Borrar seleccionados
			bulkDeleteVisible: false,
			deleting: false,
			// Costo en lote (valor fijo de costo para las seleccionadas)
			bulkCostoVisible: false,
			bulkCosto: null as number | null,
			// Precio en lote
			bulkPrecioVisible: false,
			bulkPrecio: null as number | null,
			// Margen en lote ("quiero ganar X%")
			bulkMargenVisible: false,
			bulkCategoriaVisible: false,
			bulkCategoria: null as string | null,
			bulkMargen: 40 as number | null,
			// Aumento % del costo (inflación)
			bulkCostoUpVisible: false,
			bulkCostoUp: 0 as number | null,
			// Importar
			importVisible: false,
			parsed: null as ParsedTable | null,
			mapping: [] as ImportField[],
			acceptExtensions: ACCEPTED_IMPORT_EXTENSIONS,
			// Bonificación % de la lista: el precio del Excel es costo − boni%.
			importBonif: 0 as number,
			// Reimportar para actualizar costos de existentes (match por EAN/SKU).
			importUpdateExisting: false,
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
			/** Atributos con los que cada categoría de ML distingue opciones (por id de categoría). */
			varAttrsByCategory: {} as Record<string, MlVariationAttr[]>,
			/** Guías de talles del vendedor para la categoría elegida (null = sin consultar). */
			ML_SIZE_CHARTS_URL,
			mlCharts: null as MlSizeChartsResult | null,
			mlChartsLoading: false,
			/** Código de guía pegado a mano (el que ML muestra al crearla). */
			mlChartCode: '',
			mlChartCodeLoading: false,
			// Diálogo para crear la guía de talles sin salir de VentaCore.
			mlChartCreateVisible: false,
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
			/** Fotos de imgRow antes del último cambio (para saber a qué opciones copiarlas). */
			imgPrev: '',
			// Hoja de edición en mobile (edita la misma fila que la tabla).
			sheetVisible: false,
			sheetRow: null as Row | null,
			// Producto con opciones: fila "cabeza" del grupo que se está editando.
			varVisible: false,
			varHead: null as Row | null,
			varShared: { nombre: '', descripcion: '', seccion: null } as VariantesShared,
			varItems: [] as VarianteItem[],
			/** Fotos de la cabeza al abrir (para saber si se cambiaron en el diálogo). */
			varImagesSnap: '',
			/**
			 * Fotos por color mientras el diálogo está abierto (clave = id interno del
			 * color). Es una fila existente de ese color o, si el color es nuevo, una
			 * fila "suelta" que solo guarda las fotos hasta aplicar.
			 */
			varHolders: {} as Record<string, Row>,
			// Índice de la imagen a la que se le está quitando el fondo (null = ninguna).
			strippingIdx: null as number | null,
			// ¿Hay cambios en la grilla sin guardar?
			dirty: false,
			// Buscador de catálogo ML (dentro del modal)
			/** Camino elegido en el diálogo de ML: solo categoría, o traer del catálogo. */
			mlMode: 'categoria' as 'categoria' | 'catalogo',
			mlModes: [
				{ key: 'categoria', icon: 'pi pi-tag', title: 'admin.carga.ml.modeCategory', desc: 'admin.carga.ml.modeCategoryDesc' },
				{ key: 'catalogo', icon: 'pi pi-shopping-bag', title: 'admin.carga.ml.modeCatalog', desc: 'admin.carga.ml.modeCatalogDesc' },
			] as { key: 'categoria' | 'catalogo'; icon: string; title: string; desc: string }[],
			/** Nombre del producto del catálogo recién elegido (confirmación visible). */
			mlCatalogPicked: '',
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
		/** "por unidad" o "por kg, de a 250 g": la unidad y el paso en un solo selector. */
		ventaOptions(): { label: string; short: string; value: string }[] {
			const unidad = this.$t('admin.carga.venta.unidad');
			return [
				{ label: unidad, short: unidad, value: 'unidad' },
				...INCREMENTOS_KG.map(paso => {
					const p = { paso: formatCantidad(paso, 'kg') };
					return { label: this.$t('admin.carga.venta.kg', p), short: this.$t('admin.carga.venta.kgShort', p), value: `kg:${paso}` };
				}),
			];
		},
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
		/** ¿El espacio tiene habilitado el canal Mercado Libre? (lo decide el superadmin). */
		mlEnabled(): boolean {
			return channelEnabled(this.catalog.miEspacio, 'mercadolibre');
		},
		/** ¿El negocio activo tiene Mercado Libre conectado? Gatea los campos de ML
		 *  y decide si la categoría/atributos de ML cuentan como "faltan" en el estado
		 *  (sin conexión no hay dónde cargarlos). Sin el canal habilitado, nada de ML. */
		mlConnected(): boolean {
			if (!this.mlEnabled) return false;
			return !!this.mlStateByRubro[this.selectedRubroId];
		},
		/** Rubro actualmente elegido. */
		selectedRubro(): { id: string; nombre: string } | undefined {
			return this.catalog.rubros.find(r => r.id === this.selectedRubroId);
		},
		/** Filas del rubro elegido (todas, sin filtrar por el buscador). */
		visibleRows(): Row[] {
			return this.rows.filter(r => r.rubroId === this.selectedRubroId);
		},
		/**
		 * Filas que muestra la grilla: las del rubro filtradas por el buscador. El
		 * texto matchea nombre, EAN/SKU y cualquier atributo (marca, modelo, etc.), sin
		 * distinguir mayúsculas ni acentos. Es el conjunto sobre el que operan
		 * seleccionar-todo y las acciones en lote.
		 */
		gridRows(): Row[] {
			const q = this.search.trim();
			if (!q) return this.visibleRows;
			// Normaliza: minúsculas y sin acentos (rango de tildes combinantes U+0300–U+036F).
			const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
			const terms = norm(q).split(/\s+/).filter(Boolean);
			return this.visibleRows.filter(r => {
				const haystack = norm([r.nombre, r.gtin, r.sku, ...Object.values(r.atributos || {})].filter(Boolean).join(' '));
				return terms.every(t => haystack.includes(t));
			});
		},
		fieldOptions(): { label: string; value: ImportField }[] {
			const opts: { label: string; value: ImportField }[] = IMPORT_FIELDS.map(f => ({
				label: this.fieldLabel(f),
				value: f,
			}));
			opts.push({ label: this.$t('admin.carga.import.ignore'), value: 'ignore' });
			return opts;
		},
		/**
		 * Nombres sugeridos para las características de un producto con opciones:
		 * primero los que Mercado Libre acepta en la categoría del producto (así el
		 * dato viaja al atributo correcto) y después los generales.
		 */
		varNameSuggestions(): string[] {
			const ml = (this.varHead?.mlCategoryId ? this.varAttrsByCategory[this.varHead.mlCategoryId] : undefined) ?? [];
			const generales = this.$t('admin.carga.variantes.nameList')
				.split(',')
				.map(s => s.trim())
				.filter(Boolean);
			const out: string[] = [];
			for (const n of [...ml.map(a => a.name), ...generales]) if (!out.some(o => o.toLowerCase() === n.toLowerCase())) out.push(n);
			return out;
		},
		/** Guías para el selector: nombre + los talles que trae. */
		mlChartOptions(): { label: string; value: string }[] {
			// Primero las de ML y las de la marca (ya vienen completas); después las propias.
			const order = (type: string) => (type === 'STANDARD' ? 0 : type === 'BRAND' ? 1 : 2);
			return [...(this.mlCharts?.charts ?? [])]
				.sort((a, b) => order(a.type) - order(b.type))
				.map(c => {
					const tag = c.type === 'STANDARD' || c.type === 'BRAND' ? ` · ${this.$t('admin.carga.ml.chart.typeTag.' + c.type)}` : '';
					return { label: `${c.name}${tag} — ${c.rows.map(r => r.size).join(', ')}`, value: c.id };
				});
		},
		/** Guía estándar de ML disponible (calzado): se recomienda antes que crear una propia. */
		mlChartStandard(): MlSizeChart | undefined {
			return this.mlCharts?.charts.find(c => c.type === 'STANDARD');
		},
		/**
		 * Atributos a pedir en la ficha. En un producto con opciones el talle NO se
		 * pide: cada opción ya es su talle (y viaja sola al publicar); pedirlo acá
		 * dejaba un mismo talle cargado para todas.
		 */
		mlAttrsShown(): MlAttribute[] {
			// La guía de talles se elige en su propia sección (más abajo), no como texto.
			const attrs = this.mlAttrs.filter(a => a.id !== 'SIZE_GRID_ID');
			const row = this.mlRow;
			if (!row?.grupo?.startsWith('man:')) return attrs;
			const ocultos = this.optionAttrIds(row, this.mlPendingCategoryId);
			return attrs.filter(a => !ocultos.has(a.id));
		},
		/** La guía elegida, con sus datos. */
		mlChartSelected(): MlSizeChart | undefined {
			return this.mlCharts?.charts.find(c => c.id === this.mlAttrValues.SIZE_GRID_ID);
		},
		/** Talles del producto que NO están en la guía elegida (ML rechazaría esas opciones). */
		/** Talles del producto (de sus opciones, o el de la ficha): arrancan como filas al crear una guía. */
		mlProductSizes(): string[] {
			const row = this.mlRow;
			if (!row) return [];
			if (!row.grupo) return this.mlAttrValues.SIZE?.trim() ? [this.mlAttrValues.SIZE.trim()] : [];
			const sizes = this.groupRows(row).map(r => {
				const talle = (r.opciones ?? []).find(o => /talle|size/i.test(o.nombre ?? ''))?.valor;
				return (talle ?? (r.variante ?? '').split(' / ').pop() ?? '').trim();
			});
			return [...new Set(sizes.filter(Boolean))];
		},
		mlChartMissing(): string[] {
			const chart = this.mlCharts?.charts.find(c => c.id === this.mlAttrValues.SIZE_GRID_ID);
			const row = this.mlRow;
			if (!chart || !row?.grupo) return [];
			// Se compara el TALLE de cada opción (no la etiqueta entera "Negro / 37") y sin
			// la unidad del sistema: la guía dice "37 AR" y la opción "37".
			return this.mlProductSizes.filter(s => !chart.rows.some(r => sameSize(r.size, s)));
		},
		/**
		 * Lo que se DIBUJA: las filas de la grilla, con cada producto con opciones
		 * (mismo "grupo") en una sola fila —la primera del grupo—. Las acciones en
		 * lote y el guardado siguen operando sobre gridRows (todas las opciones).
		 */
		displayRows(): Row[] {
			const seen = new Set<string>();
			return this.gridRows.filter(r => {
				if (!r.grupo) return true;
				if (seen.has(r.grupo)) return false;
				seen.add(r.grupo);
				return true;
			});
		},
		/** Seleccionadas, contando cada producto con opciones como uno. */
		selectedShown(): number {
			return this.displayRows.filter(r => r.selected).length;
		},
		/** Firma de la selección de las cabezas de grupo (ver watch). */
		groupSelSig(): string {
			return this.displayRows
				.filter(r => r.grupo)
				.map(r => r.key + (r.selected ? '1' : '0'))
				.join('|');
		},
		selectedCount(): number {
			return this.gridRows.filter(r => r.selected).length;
		},
		/** De las seleccionadas, cuántas están publicadas en ML (para avisar antes de borrar). */
		selectedPublished(): number {
			return this.gridRows.filter(r => r.selected && r.mlItemId).length;
		},
		/** Ítems del menú "Ajustar precios". "Aumentar costo" primero (flujo más usado). */
		/** Menú "Agregar" (mobile): las mismas formas de cargar que las tarjetas de
		 *  fuentes y "Bajar de ML" de desktop, juntas en un solo botón. */
		addMenuItems(): MenuItem[] {
			const items: MenuItem[] = [
				{ label: this.$t('admin.carga.addMenu.manual'), icon: 'pi pi-pencil', command: () => this.onAddRow() },
				{
					label: this.$t('admin.carga.sources.scan.title'),
					icon: 'pi pi-qrcode',
					command: () => {
						this.addRow(ProductoSource.SCAN);
						if (this.rows[0]) this.openSheet(this.rows[0]);
					},
				},
				{ label: this.$t('admin.carga.sources.excel.title'), icon: 'pi pi-file-import', command: () => this.openImport() },
			];
			if (this.mlConnected) {
				items.push({ label: this.$t('admin.carga.importMl.button'), icon: 'pi pi-cloud-download', command: () => this.importMl() });
			}
			return items;
		},
		priceMenuItems(): MenuItem[] {
			return [
				{ label: this.$t('admin.carga.bulk.costoEnLote'), icon: 'pi pi-tag', command: () => { this.bulkCostoVisible = true; } },
				{ label: this.$t('admin.carga.bulk.costoUp'), icon: 'pi pi-arrow-up', command: () => { this.bulkCostoUpVisible = true; } },
				{ label: this.$t('admin.carga.bulk.margen'), icon: 'pi pi-percentage', command: () => { this.bulkMargenVisible = true; } },
				{ label: this.$t('admin.carga.bulk.precioEnLote'), icon: 'pi pi-dollar', command: () => { this.bulkPrecioVisible = true; } },
			];
		},
		/**
		 * Categorías para elegir: las del rubro (en su orden) + las que ya están
		 * escritas en filas sin guardar. Se puede tipear una nueva.
		 */
		categoriaOptions(): string[] {
			const rubro = this.catalog.rubros.find(r => r.id === this.selectedRubroId);
			const out = [...(rubro?.categorias ?? [])];
			const seen = new Set(out.map(c => c.toLowerCase()));
			for (const row of this.visibleRows) {
				const name = row.seccion?.trim();
				if (name && !seen.has(name.toLowerCase())) {
					seen.add(name.toLowerCase());
					out.push(name);
				}
			}
			return out;
		},
		/** Menú "⋯" del lote en mobile: ajustes de precio + eliminar + deseleccionar. */
		bulkMenuItems(): MenuItem[] {
			return [
				...this.priceMenuItems,
				{ label: this.$t('admin.carga.bulk.asignarRubro'), icon: 'pi pi-th-large', command: () => this.openBulkCategoria() },
				{ separator: true },
				{ label: this.$t('admin.carga.bulk.delete'), icon: 'pi pi-trash', class: 'text-red-500', command: () => { this.bulkDeleteVisible = true; } },
				{ label: this.$t('admin.carga.bulk.clearSelection'), icon: 'pi pi-times', command: () => this.clearSelection() },
			];
		},
		/**
		 * Lo que guarda "Guardar": las filas con cambios o nuevas (sin id). Con
		 * selección, solo las seleccionadas que cumplan eso. Sin selección, las de
		 * todo el negocio (no solo las del buscador), así el filtro no esconde cambios.
		 */
		saveTargets(): Row[] {
			const pending = (r: Row) => r.dirty || !r.id;
			const marcadas = this.gridRows.filter(r => r.selected);
			return (marcadas.length ? marcadas : this.visibleRows).filter(pending);
		},
		/** Filas del negocio activo con cambios sin guardar. */
		dirtyCount(): number {
			return this.visibleRows.filter(r => r.dirty).length;
		},
		allSelected(): boolean {
			return this.gridRows.length > 0 && this.gridRows.every(r => r.selected);
		},
		tally(): { ready: number; review: number; missing: number } {
			const t = { ready: 0, review: 0, missing: 0 };
			for (const row of this.visibleRows) {
				const e = evaluarProducto(this.toLike(row), this.requiredAttrsFor(row), { requireMl: this.mlConnected }).estado;
				if (e === ProductoEstado.READY) t.ready++;
				else if (e === ProductoEstado.REVIEW) t.review++;
				else if (e === ProductoEstado.MISSING) t.missing++;
			}
			return t;
		},
	},
	watch: {
		// Seleccionar la fila de un producto con opciones selecciona TODAS sus
		// opciones (están ocultas, pero las acciones en lote tienen que alcanzarlas).
		groupSelSig() {
			for (const head of this.displayRows) {
				if (!head.grupo) continue;
				for (const r of this.groupRows(head)) if (r.selected !== head.selected) r.selected = head.selected;
			}
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
		/** El valor del selector de venta de la fila ('unidad' | 'kg:<paso>'). */
		ventaDe(row: Row): string {
			return row.unidadVenta === 'kg' ? `kg:${pasoVenta(row)}` : 'unidad';
		},
		setVenta(row: Row, value: string) {
			if (value === 'unidad') {
				row.unidadVenta = 'unidad';
				row.incremento = null;
			} else {
				row.unidadVenta = 'kg';
				row.incremento = Number(value.slice(3));
				// Lo que va por kilo no lleva stock.
				row.stock = null;
			}
			this.markDirty(row);
		},
		markDirty(row?: Row) {
			if (row) {
				row.dirty = true;
				// Con opciones, el nombre y la categoría son del producto entero.
				if (row.grupo) {
					for (const r of this.groupRows(row)) {
						if (r === row || (r.nombre === row.nombre && r.seccion === row.seccion)) continue;
						r.nombre = row.nombre;
						r.seccion = row.seccion;
						r.dirty = true;
					}
				}
			}
			this.dirty = true;
		},
		// ── Costo ↔ margen ↔ precio de tienda (triángulo por fila) ──
		/** El usuario tocó el margen: precio = costo × (1 + margen%). */
		onRowMargen(row: Row) {
			if (row.precioCosto != null && row.margen != null) {
				row.precio = Math.round(row.precioCosto * (1 + row.margen / 100));
			}
			this.markDirty(row);
		},
		/** El usuario tocó el costo: si hay margen, se mantiene y se recalcula el precio. */
		onRowCosto(row: Row) {
			if (row.precioCosto != null && row.margen != null) {
				row.precio = Math.round(row.precioCosto * (1 + row.margen / 100));
			}
			this.markDirty(row);
		},
		/** El usuario tocó el precio a mano: se deriva el margen mostrado desde el costo. */
		onRowPrecio(row: Row) {
			if (row.precioCosto && row.precioCosto > 0 && row.precio != null) {
				row.margen = Math.round((row.precio / row.precioCosto - 1) * 100);
			}
			this.markDirty(row);
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
				seccion: p.seccion ?? null,
				precio: p.precio,
				precioCosto: p.precioCosto,
				margen: p.margen,
				precioMl: p.precioMl,
				precioSaved: p.precio,
				precioMlSaved: p.precioMl,
				mlListingType: p.mlListingType ?? 'gold_special',
				stock: p.stock,
				unidadVenta: p.unidadVenta ?? 'unidad',
				incremento: p.incremento ?? null,
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
				grupo: p.grupo ?? null,
				variante: p.variante ?? null,
				opciones: p.opciones?.length ? p.opciones.map(o => ({ ...o })) : null,
				selected: false,
			};
		},
		emptyRow(source: ProductoSource): Row {
			return {
				key: this.nextKey(),
				rubroId: this.selectedRubroId,
				nombre: '',
				descripcion: '',
				seccion: null,
				precio: null,
				precioCosto: null,
				margen: null,
				precioMl: null,
				mlListingType: 'gold_special',
				stock: null,
				unidadVenta: 'unidad',
				incremento: null,
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
				grupo: null,
				variante: null,
				opciones: null,
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
		/** "Agregar fila": en mobile abre directo la hoja para cargar el producto nuevo. */
		onAddRow() {
			this.addRow();
			if (window.matchMedia('(max-width: 767.98px)').matches && this.rows[0]) this.openSheet(this.rows[0]);
		},
		/** Abre la hoja de edición (mobile) sobre una fila. */
		openSheet(row: Row) {
			this.sheetRow = row;
			this.sheetVisible = true;
		},
		/** Guarda desde la hoja; si quedó guardada, la cierra. */
		async saveSheetRow() {
			if (!this.sheetRow) return;
			await this.saveRow(this.sheetRow);
			if (!this.sheetRow?.dirty) this.sheetVisible = false;
		},
		removeSheetRow() {
			if (!this.sheetRow) return;
			this.removeRow(this.sheetRow);
			this.sheetVisible = false;
			this.sheetRow = null;
		},
		// ── Producto con opciones (talles, colores, medidas…) ──
		/** Todas las filas del mismo producto (ella sola si no tiene opciones). */
		groupRows(row: Row): Row[] {
			// En su orden natural (S, M, L, XL…), no en el de carga.
			return row.grupo ? this.visibleRows.filter(r => r.grupo === row.grupo).sort(compareVariantes) : [row];
		},
		groupSize(row: Row): number {
			return row.grupo ? this.groupRows(row).length : 1;
		},
		/** "4 opciones · S · M · L · XL" */
		groupLabel(row: Row): string {
			const rows = this.groupRows(row);
			const count = this.$t('admin.carga.variantes.count', rows.length);
			// Con colores y talles, listar las 12 combinaciones no se lee: se muestran
			// los colores y los talles por separado ("Negro, Azul · S, M, L").
			// Con características con nombre: "Peso: 500 g, 1 kg · Sabor: Suave, Fuerte".
			const nombres: string[] = [];
			for (const r of rows) for (const o of r.opciones ?? []) if (!nombres.includes(o.nombre)) nombres.push(o.nombre);
			if (nombres.length) {
				const partes = nombres.map(n => {
					const valores = [...new Set(rows.map(r => r.opciones?.find(o => o.nombre === n)?.valor).filter(Boolean))];
					return `${n}: ${valores.join(', ')}`;
				});
				return [count, ...partes].join(' · ');
			}
			if (rows.some(r => (r.variante ?? '').includes(' / '))) {
				const uniq = (list: string[]) => [...new Set(list.filter(Boolean))];
				const colores = uniq(rows.map(r => (r.variante ?? '').split(' / ')[0].trim()));
				const talles = uniq(rows.map(r => (r.variante ?? '').split(' / ').slice(1).join(' / ').trim()));
				return [count, colores.join(', '), talles.join(', ')].filter(Boolean).join(' · ');
			}
			const names = rows
				.map(r => r.variante)
				.filter(Boolean)
				.join(' · ');
			return count + (names ? ' · ' + names : '');
		},
		/** El precio si es el mismo en todas; si no, "desde $X". */
		groupPrice(row: Row): string {
			const precios = this.groupRows(row)
				.map(r => r.precio)
				.filter((v): v is number => v != null);
			if (!precios.length) return '—';
			const min = Math.min(...precios);
			return precios.some(v => v !== min) ? this.$t('admin.carga.variantes.from', { precio: this.money(min) }) : this.money(min);
		},
		/** ¿Las opciones tienen precios distintos? (entonces se muestra "desde"). */
		groupFrom(row: Row): boolean {
			return new Set(this.groupRows(row).map(r => r.precio)).size > 1;
		},
		/** El precio más bajo del producto, ya formateado. */
		groupMin(row: Row): string {
			const precios = this.groupRows(row)
				.map(r => r.precio)
				.filter((v): v is number => v != null);
			return precios.length ? this.money(Math.min(...precios)) : '—';
		},
		groupStock(row: Row): number {
			return this.groupRows(row).reduce((n, r) => n + (r.stock ?? 0), 0);
		},
		/** Abre el diálogo de opciones sobre un producto (con o sin opciones todavía). */
		openVariantes(row: Row) {
			const rows = this.groupRows(row);
			const head = rows[0];
			this.varHead = head;
			this.varShared = { nombre: head.nombre, descripcion: head.descripcion, seccion: head.seccion };
			// Un producto nuevo (sin nombre ni precio) arranca sin renglones; uno ya
			// cargado, con el suyo como primera opción (falta ponerle el nombre).
			const blank = !head.grupo && !head.id && !head.nombre.trim() && head.precio == null;
			this.varItems = blank ? [] : rows.map(r => ({ rowKey: r.key, variante: r.variante ?? '', opciones: r.opciones, precio: r.precio, stock: r.stock }));
			void this.loadVarAttrs(head.rubroId, head.mlCategoryId);
			this.varImagesSnap = JSON.stringify(head.imagenes);
			this.varHolders = {};
			this.varVisible = true;
		},
		/**
		 * Categoría de vitrina sugerida para el diálogo de opciones: la de Mercado
		 * Libre que ya tenga el producto o, con ML conectado, la que ML predice
		 * para ese nombre. Es solo una sugerencia: la categoría de ML no se toca.
		 */
		async suggestCategoriaVitrina(nombre: string): Promise<string | null> {
			if (this.varHead?.mlCategoryName) return this.varHead.mlCategoryName;
			if (!this.mlConnected) return null;
			const preds = await this.catalog.predictMlCategory(this.selectedRubroId, nombre);
			return preds[0]?.categoryName ?? null;
		},
		/**
		 * Atributos de ML que salen de las OPCIONES y no de la ficha común: el talle
		 * siempre y, si las opciones tienen color ("Negro / M"), también el color.
		 * No se piden ni cuentan como faltantes: cada opción manda el suyo al publicar.
		 */
		optionAttrIds(row: Row, categoryId = row.mlCategoryId): Set<string> {
			const rows = this.groupRows(row);
			const nombres = [...new Set(rows.flatMap(r => (r.opciones ?? []).map(o => o.nombre)))];
			if (!nombres.length) {
				// Cargadas antes de que existieran los nombres: talle y, si hay dos partes, color.
				const ids = new Set(['SIZE']);
				if (rows.some(r => (r.variante ?? '').includes(' / '))) ids.add('COLOR');
				return ids;
			}
			// Mismo emparejamiento que usa el servidor al publicar. Si todavía no
			// llegaron los atributos de la categoría, al menos talle y color.
			const attrs = this.varAttrsByCategory[categoryId] ?? [];
			const base: MlVariationAttr[] = attrs.length
				? attrs
				: [
						{ id: 'SIZE', name: 'Talle', values: [], allowVariations: true },
						{ id: 'COLOR', name: 'Color', values: [], allowVariations: true },
					];
			const ids = new Set<string>();
			for (const n of nombres) {
				const attr = matchOpcionAttr(n, base);
				if (attr) ids.add(attr.id);
			}
			return ids;
		},
		/**
		 * El valor que define la foto de una fila ("negro" si cada Color tiene la
		 * suya); '' si la foto es una sola para todas las opciones.
		 */
		colorOf(row: Row): string {
			if (row.opciones?.length) return row.opciones.find(o => o.foto)?.valor.trim().toLowerCase() ?? '';
			// Cargadas antes de que existieran los nombres: "Negro / M" → el primero.
			const v = row.variante ?? '';
			return v.includes(' / ') ? v.split(' / ')[0].trim().toLowerCase() : '';
		},
		/** Trae (una vez) los atributos con los que la categoría de ML distingue opciones. */
		async loadVarAttrs(rubroId: string, categoryId: string) {
			if (!categoryId || !this.mlConnected || this.varAttrsByCategory[categoryId]) return;
			const attrs = await this.catalog.fetchMlVariationAttrs(rubroId, categoryId).catch(() => null);
			if (attrs) this.varAttrsByCategory[categoryId] = attrs;
		},
		/** La fila que guarda las fotos de un color del diálogo (null si todavía no hay). */
		colorHolder(ref: ColorRef): Row | null {
			return this.varHolders[ref.cid] ?? this.rows.find(r => ref.rowKeys.includes(r.key)) ?? null;
		},
		/** Portada y cantidad de fotos de un color (para la miniatura del diálogo). */
		colorThumb(ref: ColorRef): { url: string; count: number } {
			const row = this.colorHolder(ref);
			return { url: row?.imageUrl ?? '', count: row?.imagenes.length ?? 0 };
		},
		/**
		 * Abre las fotos de UN color. Cada color tiene las suyas (en ML el color
		 * define la foto). Si el color es nuevo, las fotos se guardan en una fila
		 * suelta hasta que se aplica el diálogo.
		 */
		openColorImages(ref: ColorRef) {
			const head = this.varHead;
			if (!head) return;
			if (!this.varHolders[ref.cid]) {
				this.varHolders[ref.cid] = this.colorHolder(ref) ?? {
					...head,
					key: this.nextKey(),
					id: undefined,
					grupo: null,
					variante: ref.color + ' / ',
					imagenes: [],
					imageUrl: '',
					atributos: { ...head.atributos },
					mlItemId: '',
					mlPermalink: '',
					selected: false,
				};
			}
			this.openImages(this.varHolders[ref.cid]);
		},
		/** Desde la hoja mobile: pasa a editar el mismo producto como "con opciones". */
		sheetToVariantes() {
			const row = this.sheetRow;
			if (!row) return;
			this.sheetVisible = false;
			this.openVariantes(row);
		},
		/**
		 * Aplica el diálogo a la grilla: cada opción es una fila (producto) del mismo
		 * "grupo". Reusa las filas existentes (conservan id y publicación), crea las
		 * que faltan copiando los datos del producto y borra las que se quitaron.
		 * Queda todo "sin guardar": se confirma con Guardar, como cualquier cambio.
		 */
		async applyVariantes(result: VariantesResult) {
			const head = this.varHead;
			if (!head) return;
			const members = this.groupRows(head);
			const byKey = new Map(members.map(r => [r.key, r]));
			const grupo = head.grupo || 'man:' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
			const imagesChanged = JSON.stringify(head.imagenes) !== this.varImagesSnap;
			const changed = {
				nombre: result.shared.nombre !== this.varShared.nombre,
				descripcion: result.shared.descripcion !== this.varShared.descripcion,
				seccion: result.shared.seccion !== this.varShared.seccion,
			};
			const base: Row = { ...head, imagenes: [...head.imagenes], atributos: { ...head.atributos } };

			// Filas existentes que el diálogo conservó; las libres se reusan para las
			// opciones nuevas antes de crear filas (así no se pierde id ni publicación).
			const used = new Set(result.items.map(it => it.rowKey).filter((k): k is string => !!k && byKey.has(k)));
			const free = members.filter(r => !used.has(r.key));
			const out: Row[] = [];
			for (const it of result.items) {
				let row = it.rowKey ? byKey.get(it.rowKey) : undefined;
				const existing = !!row;
				if (!row) row = free.shift();
				const created = !row;
				if (!row) {
					row = {
						...base,
						key: this.nextKey(),
						id: undefined,
						mlItemId: '',
						mlPermalink: '',
						gtin: '',
						sku: '',
						precioMl: null,
						imagenes: [...base.imagenes],
						atributos: { ...base.atributos },
						selected: false,
					};
				}
				// Para marcar "sin guardar" solo lo que de verdad cambió.
				const sig = (r: Row) => JSON.stringify([r.grupo, r.variante, r.opciones, r.nombre, r.descripcion, r.seccion, r.precio, r.stock, r.imagenes]);
				const antes = created ? '' : sig(row);
				row.grupo = grupo;
				row.variante = it.variante;
				row.opciones = it.opciones?.length ? it.opciones : null;
				// Los datos comunes pisan los de una opción ya existente solo si se
				// tocaron en el diálogo (las importadas de ML pueden traer los suyos).
				if (!existing || changed.nombre) row.nombre = result.shared.nombre;
				if (!existing || changed.descripcion) row.descripcion = result.shared.descripcion;
				if (!existing || changed.seccion) row.seccion = result.shared.seccion;
				if (row !== head && (created || imagesChanged || !row.imagenes.length)) {
					row.imagenes = [...head.imagenes];
					row.imageUrl = head.imageUrl;
				}
				// Fotos: si una característica define la foto (cada color la suya), las
				// que se cargaron para ese valor; si es una sola para todo, la del producto.
				const holder = it.colorKey ? this.varHolders[it.colorKey] : undefined;
				if (holder && holder.imagenes.length && row !== holder) {
					row.imagenes = [...holder.imagenes];
					row.imageUrl = holder.imageUrl;
				} else if (result.sharedPhotos && row !== head && head.imagenes.length) {
					row.imagenes = [...head.imagenes];
					row.imageUrl = head.imageUrl;
				}
				row.precio = it.precio;
				row.stock = it.stock;
				if (row.precioCosto && row.precioCosto > 0 && row.precio != null) row.margen = Math.round((row.precio / row.precioCosto - 1) * 100);
				if (created || !row.id || sig(row) !== antes) row.dirty = true;
				out.push(row);
			}

			// En su orden natural (S, M, L, XL…), igual que el selector de la vitrina.
			out.sort(compareVariantes);
			for (const r of out) r.selected = false;

			// Opciones quitadas: fuera de la grilla, y de la base si estaban guardadas.
			const removed = free;
			const touched = new Set([...out, ...removed].map(r => r.key));
			const anchor = this.rows.findIndex(r => touched.has(r.key));
			const rest = this.rows.filter(r => !touched.has(r.key));
			const at = anchor === -1 ? 0 : this.rows.slice(0, anchor).filter(r => !touched.has(r.key)).length;
			rest.splice(at, 0, ...out);
			this.rows = rest;
			this.dirty = true;
			this.varVisible = false;
			this.varHead = null;

			const guardadas = removed.filter(r => r.id);
			if (guardadas.length) {
				const ok = await Promise.all(
					guardadas.map(r =>
						this.catalog
							.deleteProducto(this.selectedRubroId, r.id as string)
							.then(() => true)
							.catch(() => false),
					),
				);
				const fallidas = ok.filter(v => !v).length;
				this.$toast.add({
					severity: fallidas ? 'warn' : 'info',
					summary: fallidas
						? this.$t('admin.carga.variantes.deletePartial', { n: guardadas.length - fallidas, fail: fallidas })
						: this.$t('admin.carga.variantes.deleted', guardadas.length),
					life: 5000,
				});
			}
			this.$toast.add({ severity: 'success', summary: this.$t('admin.carga.variantes.applied', { n: out.length }), life: 5000 });
		},
		/** ¿La fila (o alguna de sus opciones) tiene algo sin guardar? */
		rowPending(row: Row): boolean {
			return row.grupo ? this.groupRows(row).some(r => r.dirty || !r.id) : !!row.dirty;
		},
		/** Link a la publicación: con opciones, solo si TODAS están publicadas. */
		rowPermalink(row: Row): string {
			if (!row.grupo) return row.mlPermalink;
			const rows = this.groupRows(row);
			return rows.every(r => r.mlItemId) ? (rows.find(r => r.mlPermalink)?.mlPermalink ?? '') : '';
		},
		/** Guarda todas las opciones pendientes del producto (el ✔ de su fila). */
		async saveGroup(row: Row) {
			this.savingKey = row.key;
			try {
				await this.saveRows(this.groupRows(row).filter(r => r.dirty || !r.id));
			} finally {
				this.savingKey = null;
			}
		},
		/**
		 * Publica en Mercado Libre todas las opciones que falten, de a una y en
		 * orden: ML las junta en una sola página porque comparten el nombre y cada
		 * una lleva su talle/color (lo arma el backend). Si alguna falla, las demás
		 * siguen y se informa cuál y por qué.
		 */
		async publishGroup(row: Row) {
			const rows = this.groupRows(row);
			this.publishingKey = row.key;
			try {
				// Lo que ves en la grilla es lo que se publica: primero se guarda.
				await this.saveRows(rows.filter(r => r.dirty || !r.id));
				if (rows.some(r => r.dirty || !r.id)) return;
				let ok = 0;
				const errores: string[] = [];
				for (const r of rows.filter(x => !x.mlItemId)) {
					try {
						const res = await this.catalog.publishToMl(r.rubroId, r.id as string);
						r.mlItemId = res.itemId ?? '';
						r.mlPermalink = res.permalink ?? '';
						ok++;
					} catch (e: unknown) {
						errores.push(`${r.variante ?? ''}: ${apiErrorMessage(e, this.$t('admin.carga.pub.error'))}`);
					}
				}
				if (!errores.length) {
					this.$toast.add({ severity: 'success', summary: this.$t('admin.carga.variantes.published', ok), life: 8000 });
				} else {
					this.$toast.add({
						severity: ok ? 'warn' : 'error',
						summary: this.$t('admin.carga.variantes.publishedPartial', { ok, fail: errores.length }),
						detail: errores.join(' · '),
						life: 15000,
					});
				}
			} finally {
				this.publishingKey = null;
			}
		},
		/** Saca de la grilla el producto entero (todas sus opciones). */
		removeGroup(row: Row) {
			const keys = new Set(this.groupRows(row).map(r => r.key));
			this.rows = this.rows.filter(r => !keys.has(r.key));
		},
		money(v: number): string {
			return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(v);
		},
		/** Línea de detalle de la lista mobile: costo y margen (lo que arma el precio). */
		rowMeta(row: Row): string {
			if (row.precioCosto == null) return this.$t('admin.carga.sheet.noCost');
			const costo = this.money(row.precioCosto);
			return row.margen != null
				? this.$t('admin.carga.sheet.costMargin', { costo, margen: row.margen })
				: this.$t('admin.carga.sheet.cost', { costo });
		},
		/** Color del texto de estado en la lista mobile (mismo criterio que el Tag). */
		estadoTextCls(row: Row): string {
			return (
				{
					success: 'text-emerald-600 dark:text-emerald-400',
					warn: 'text-amber-600 dark:text-amber-400',
					danger: 'text-red-500',
					info: 'text-sky-600 dark:text-sky-400',
				}[this.estadoSeverity(row)] ?? 'text-surface-500'
			);
		},
		toggleAll(value: boolean) {
			for (const row of this.gridRows) row.selected = value;
		},
		/** Deselecciona todo el rubro (limpia el estado de selección, no solo lo filtrado). */
		clearSelection() {
			for (const row of this.visibleRows) row.selected = false;
		},
		/** Abre el menú "Ajustar precios" anclado al botón. */
		togglePriceMenu(e: Event) {
			(this.$refs.priceMenu as { toggle: (e: Event) => void } | undefined)?.toggle(e);
		},
		toggleBulkMenu(e: Event) {
			(this.$refs.bulkMenu as { toggle: (e: Event) => void } | undefined)?.toggle(e);
		},
		toggleAddMenu(e: Event) {
			(this.$refs.addMenu as { toggle: (e: Event) => void } | undefined)?.toggle(e);
		},
		/**
		 * Click en el renglón para seleccionarlo. Ignora clicks en campos editables o
		 * controles (inputs, botones, links, selects) para no romper la edición: solo
		 * selecciona al tocar zonas "muertas" (fondo, imagen, estado, bordes).
		 */
		onRowClick(row: Row, e: MouseEvent) {
			const el = e.target as HTMLElement | null;
			if (el?.closest('input, textarea, button, a, [role="button"], .p-inputnumber, .p-checkbox, .p-select, .p-inputtext')) return;
			row.selected = !row.selected;
		},
		/** Filas visibles seleccionadas (sobre las que actúan las acciones en lote). */
		selectedRows(): Row[] {
			return this.gridRows.filter(r => r.selected);
		},
		/** Borra las filas seleccionadas: de la base las guardadas, y todas de la grilla. */
		async bulkDelete() {
			const sel = this.selectedRows();
			if (!sel.length) return;
			this.deleting = true;
			try {
				const guardadas = sel.filter(r => r.id);
				const results = await Promise.all(
					guardadas.map(r => this.catalog.deleteProducto(this.selectedRubroId, r.id as string).then(() => true).catch(() => false)),
				);
				const fallidas = results.filter(ok => !ok).length;
				const keys = new Set(sel.map(r => r.key));
				this.rows = this.rows.filter(r => !keys.has(r.key));
				this.dirty = this.rows.some(r => r.dirty);
				if (fallidas) {
					this.$toast.add({ severity: 'warn', summary: this.$t('admin.carga.bulk.deletePartial', { n: sel.length - fallidas, fail: fallidas }), life: 5000 });
				} else {
					this.$toast.add({ severity: 'success', summary: this.$t('admin.carga.bulk.deleted', { n: sel.length }), life: 4000 });
				}
			} finally {
				this.deleting = false;
				this.bulkDeleteVisible = false;
			}
		},
		toLike(row: Row): ProductoLike {
			return {
				nombre: row.nombre,
				precio: row.precio,
				stock: row.stock,
				unidadVenta: row.unidadVenta,
				imageUrl: row.imageUrl || null,
				descripcion: row.descripcion || null,
				mlCategoryId: row.mlCategoryId || null,
				atributos: row.atributos,
				isDraft: row.isDraft,
			};
		},
		requiredAttrsFor(row: Row): MlRequiredAttribute[] {
			const attrs = row.mlCategoryId ? this.attrsByCategory[row.mlCategoryId] : undefined;
			// Con opciones el talle lo da cada opción: no cuenta como dato faltante.
			const ocultos = row.grupo?.startsWith('man:') ? this.optionAttrIds(row) : new Set<string>();
			return (attrs ?? []).filter(a => !ocultos.has(a.id)).map(a => ({ id: a.id, name: a.name }));
		},
		faltantesDe(row: Row): string[] {
			return evaluarProducto(this.toLike(row), this.requiredAttrsFor(row), { requireMl: this.mlConnected }).faltantes;
		},
		estadoLabel(row: Row): string {
			const { estado, faltantes } = evaluarProducto(this.toLike(row), this.requiredAttrsFor(row), { requireMl: this.mlConnected });
			if (estado === ProductoEstado.MISSING) return this.$t('admin.carga.estado.missing', { n: faltantes.length });
			return this.$t('admin.carga.estado.' + estado);
		},
		estadoSeverity(row: Row): string {
			const estado = evaluarProducto(this.toLike(row), this.requiredAttrsFor(row), { requireMl: this.mlConnected }).estado;
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
		// ── Costo en lote: fija el mismo costo en las seleccionadas y, si hay margen,
		//    recalcula el precio de tienda (mantiene el margen de cada fila) ──
		applyBulkCosto() {
			if (this.bulkCosto == null) return;
			for (const row of this.gridRows)
				if (row.selected) {
					row.precioCosto = this.bulkCosto;
					if (row.margen != null) row.precio = Math.round(this.bulkCosto * (1 + row.margen / 100));
					row.dirty = true;
				}
			this.dirty = true;
			this.bulkCostoVisible = false;
			this.bulkCosto = null;
		},
		applyBulkPrecio() {
			for (const row of this.gridRows)
				if (row.selected) {
					row.precio = this.bulkPrecio;
					// Precio fijado a mano: derivamos el margen mostrado desde el costo.
					if (row.precioCosto && row.precioCosto > 0 && this.bulkPrecio != null) {
						row.margen = Math.round((this.bulkPrecio / row.precioCosto - 1) * 100);
					}
					row.dirty = true;
				}
			this.dirty = true;
			this.bulkPrecioVisible = false;
			this.bulkPrecio = null;
		},

		// ── Margen en lote: precio = costo * (1 + margen%) sobre las seleccionadas ──
		/** Usa la categoría de Mercado Libre del producto como categoría del catálogo. */
		useMlCategoria(row: Row) {
			if (!row.mlCategoryName) return;
			row.seccion = row.mlCategoryName;
			this.markDirty(row);
		},
		openBulkCategoria() {
			this.bulkCategoria = null;
			this.bulkCategoriaVisible = true;
		},
		/** Asigna (o quita, si queda vacío) la categoría a los seleccionados. */
		applyBulkCategoria() {
			const name = this.bulkCategoria?.trim() || null;
			for (const row of this.gridRows) {
				if (!row.selected) continue;
				row.seccion = name;
				row.dirty = true;
			}
			this.dirty = true;
			this.bulkCategoriaVisible = false;
		},
		applyBulkMargen() {
			if (this.bulkMargen == null) return;
			const factor = 1 + this.bulkMargen / 100;
			let sinCosto = 0;
			for (const row of this.gridRows) {
				if (!row.selected) continue;
				if (row.precioCosto == null) {
					sinCosto++;
					continue;
				}
				row.precio = Math.round(row.precioCosto * factor);
				row.margen = this.bulkMargen;
				row.dirty = true;
			}
			this.dirty = true;
			this.bulkMargenVisible = false;
			if (sinCosto) {
				this.$toast.add({ severity: 'info', summary: this.$t('admin.carga.bulk.margenNoCost', { n: sinCosto }), life: 4000 });
			}
		},

		// ── Aumento % del costo (inflación): sube el costo y propaga a precio de tienda y ML ──
		applyBulkCostoUp() {
			if (!this.bulkCostoUp) return;
			const factor = 1 + this.bulkCostoUp / 100;
			let sinCosto = 0;
			for (const row of this.gridRows) {
				if (!row.selected) continue;
				if (row.precioCosto == null) {
					sinCosto++;
					continue;
				}
				row.precioCosto = Math.round(row.precioCosto * factor);
				// Precio de tienda: mantiene el margen si lo hay.
				if (row.margen != null) row.precio = Math.round(row.precioCosto * (1 + row.margen / 100));
				// Precio de ML: sube proporcional (aprox.; el cálculo exacto de comisión
				// se puede recalcular en la pantalla de ML). Al guardar, se sincroniza a ML.
				if (row.precioMl != null) row.precioMl = Math.round(row.precioMl * factor);
				row.dirty = true;
			}
			this.dirty = true;
			this.bulkCostoUpVisible = false;
			if (sinCosto) {
				this.$toast.add({ severity: 'info', summary: this.$t('admin.carga.bulk.margenNoCost', { n: sinCosto }), life: 4000 });
			}
		},

		// ── Guardar ──
		/**
		 * Recalcula el precio de Mercado Libre a partir del precio de página, para una
		 * fila CON categoría (la comisión depende de ella). Solo cuando el precio de
		 * página CAMBIÓ (o todavía no hay precio de ML): guardar otra cosa —el stock,
		 * la descripción— no tiene que mover el precio publicado.
		 *
		 * El precio de ML es el de página + la comisión + el envío a cargo del
		 * vendedor. Ese envío se saca del precio anterior: lo que el precio de ML
		 * dejaba por encima del de página una vez pagada la comisión. Así una
		 * publicación con envío gratis no pierde el envío al cambiarle el precio.
		 */
		async recomputeMlPrice(row: Row): Promise<void> {
			if (!this.mlConnected || !row.mlCategoryId || row.precio == null) return;
			if (row.precioMl != null && row.precio === row.precioSaved) return;
			try {
				let envio = 0;
				if (row.precioMlSaved != null && row.precioSaved != null && row.precioMlSaved > row.precioSaved) {
					const antes = await this.catalog.fetchMlFee(this.selectedRubroId, row.precioMlSaved, row.mlCategoryId, row.mlListingType);
					envio = Math.max(0, Math.round(row.precioMlSaved - antes.saleFeeAmount - row.precioSaved));
					// Diferencias chicas son redondeo, no envío.
					if (envio < 500) envio = 0;
				}
				const fee = await this.catalog.suggestMlPrice(this.selectedRubroId, row.precio + envio, row.mlCategoryId, row.mlListingType);
				if (fee?.price != null) row.precioMl = fee.price;
			} catch {
				/* si la calculadora falla (categoría rara, sin conexión), dejamos precioMl */
			}
		},
		/** Después de guardar: lo que hay en la fila pasa a ser lo guardado. */
		markSaved(row: Row) {
			row.dirty = false;
			row.precioSaved = row.precio;
			row.precioMlSaved = row.precioMl;
		},
		/** Arma el payload de guardado de una fila. */
		rowToBatchItem(r: Row): BatchProductoItem {
			return {
				...(r.id ? { id: r.id } : {}),
				rubroId: r.rubroId,
				nombre: r.nombre.trim(),
				descripcion: r.descripcion.trim() || undefined,
				// null explícito: permite QUITAR la categoría (undefined no la tocaría).
				seccion: r.seccion?.trim() || null,
				precio: r.precio ?? undefined,
				precioCosto: r.precioCosto ?? undefined,
				margen: r.margen ?? undefined,
				precioMl: r.precioMl ?? undefined,
				stock: r.stock ?? undefined,
				unidadVenta: r.unidadVenta,
				incremento: r.unidadVenta === 'kg' ? r.incremento : null,
				gtin: r.gtin.trim() || undefined,
				sku: r.sku.trim() || undefined,
				imageUrl: r.imageUrl.trim() || undefined,
				imagenes: r.imagenes.length ? r.imagenes : undefined,
				mlCategoryId: r.mlCategoryId || undefined,
				mlCategoryName: r.mlCategoryName || undefined,
				mlCatalogProductId: r.mlCatalogProductId || undefined,
				atributos: Object.keys(r.atributos).length ? r.atributos : undefined,
				source: r.source,
				grupo: r.grupo || null,
				variante: r.grupo ? r.variante || null : null,
				opciones: r.grupo && r.opciones?.length ? r.opciones : null,
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
				// Antes de guardar: si tiene categoría, calculamos el precio de ML (con comisión).
				await this.recomputeMlPrice(row);
				const [res] = await this.catalog.batchUpsert([this.rowToBatchItem(row)]);
				if (!res?.ok || !res.id) throw new Error(res?.error || this.$t('admin.carga.saveError'));
				row.id = res.id;
				this.markSaved(row);
				this.dirty = this.rows.some(r => r.dirty);
				// El servidor suma las categorías nuevas a la lista del rubro: la refrescamos.
				void this.catalog.fetchRubros().catch(() => undefined);
				// Si ya está publicado en ML, empujamos el cambio (precio/stock/descripción)
				// a la publicación: así editar acá se refleja en Mercado Libre.
				let synced = false;
				if (this.mlConnected && row.mlItemId && row.id) {
					synced = await this.catalog
						.updateMlListing(this.selectedRubroId, row.id)
						.then(() => true)
						.catch((e: unknown) => {
							// Guardó acá pero ML no tomó el cambio: se avisa con el motivo.
							this.$toast.add({
								severity: 'warn',
								summary: this.$t('admin.carga.syncFailed', 1),
								detail: apiErrorMessage(e, this.$t('admin.carga.syncError')),
								life: 9000,
							});
							return false;
						});
				}
				this.$toast.add({
					severity: 'success',
					summary: synced ? this.$t('admin.carga.savedSynced') : this.$t('admin.carga.saved', 1),
					life: 3000,
				});
			} catch (e: unknown) {
				this.$toast.add({ severity: 'error', summary: apiErrorMessage(e, this.$t('admin.carga.saveError')), life: 5000 });
			} finally {
				this.savingKey = null;
			}
		},
		async saveSelected() {
			// Solo se guarda lo que CAMBIÓ (o es nuevo): mandar todas las filas pisaba
			// productos sin tocar, los re-empujaba a ML y superaba el límite del pedido.
			await this.saveRows(this.saveTargets);
		},
		/** Guarda un conjunto de filas (en tandas) y sincroniza con ML las ya publicadas. */
		async saveRows(seleccionadas: Row[]) {
			if (!seleccionadas.length) return;
			if (seleccionadas.some(r => !r.nombre.trim())) {
				this.$toast.add({ severity: 'warn', summary: this.$t('admin.carga.needName'), life: 4000 });
				return;
			}

			this.saving = true;
			try {
				// Recalculamos el precio de ML (con comisión) de las que tienen categoría.
				await Promise.all(seleccionadas.map(r => this.recomputeMlPrice(r)));
				const items: BatchProductoItem[] = seleccionadas.map(r => this.rowToBatchItem(r));

				// En tandas: el servidor acepta pedidos de hasta ~100 KB y un producto con
				// descripción y atributos pesa varios KB.
				const results: BatchProductoResult[] = [];
				for (let i = 0; i < items.length; i += SAVE_CHUNK) {
					results.push(...(await this.catalog.batchUpsert(items.slice(i, i + SAVE_CHUNK))));
				}
				const ok = results.filter(r => r.ok);
				const fail = results.filter(r => !r.ok);

				results.forEach((res, i) => {
					if (res.ok && res.id) {
						const row = seleccionadas[i];
						row.id = res.id;
						row.selected = false;
						this.markSaved(row);
					}
				});
				// El indicador global refleja si quedó alguna fila sin guardar.
				this.dirty = this.rows.some(r => r.dirty);
				// El servidor suma las categorías nuevas a la lista del rubro: la refrescamos.
				void this.catalog.fetchRubros().catch(() => undefined);

				// Los que ya están publicados: empujamos el cambio a Mercado Libre.
				let synced = 0;
				if (this.mlConnected) {
					const publicadas = seleccionadas.filter(r => r.mlItemId && r.id);
					const res = await Promise.all(
						publicadas.map(r =>
							this.catalog
								.updateMlListing(this.selectedRubroId, r.id as string)
								.then(() => '')
								.catch((e: unknown) => `${r.variante ? `${r.nombre} (${r.variante})` : r.nombre}: ${apiErrorMessage(e, this.$t('admin.carga.syncError'))}`),
						),
					);
					synced = res.filter(m => !m).length;
					const noSync = res.filter(Boolean);
					// Guardó acá pero Mercado Libre no tomó el cambio: hay que decirlo, si no
					// el precio queda distinto en un lado y en el otro sin que nadie se entere.
					if (noSync.length) {
						this.$toast.add({
							severity: 'warn',
							summary: this.$t('admin.carga.syncFailed', noSync.length),
							detail: noSync.slice(0, 4).join(' · '),
							life: 9000,
						});
					}
				}

				if (!fail.length) {
					this.$toast.add({
						severity: 'success',
						summary: synced
							? this.$t('admin.carga.savedSyncedN', { n: ok.length, synced })
							: this.$t('admin.carga.saved', ok.length),
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
			this.importBonif = 0;
			this.importUpdateExisting = false;
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
			// Una lista importada SIEMPRE es de costo: cualquier columna de precio se
			// mapea por default a Costo; si fuera precio de la app, se cambia a mano.
			if (/(costo|compra|proveedor|cost|precio|price|importe|venta)/.test(h)) return 'precioCosto';
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
			if (this.importUpdateExisting) return this.confirmImportUpdate();
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
				// La lista de precios es el COSTO: si hay bonificación, se la restamos.
				if (row.precioCosto != null && this.importBonif > 0) {
					row.precioCosto = Math.round(row.precioCosto * (1 - this.importBonif / 100));
				}
				row.dirty = true;
				if (nombreCol === -1 || row.nombre) nuevas.push(row);
			}
			this.rows = [...nuevas, ...this.rows];
			this.dirty = true;
			this.closeImport();
		},
		/**
		 * Reimportar una lista para ACTUALIZAR el costo de productos existentes: matchea
		 * por EAN/GTIN (o SKU), pisa el costo (aplicando la bonificación) y propaga al
		 * precio de tienda (manteniendo el margen) y al precio de ML (proporcional al
		 * cambio de costo). Los no encontrados se ignoran.
		 */
		confirmImportUpdate() {
			if (!this.parsed) return;
			const costoCol = this.mapping.indexOf('precioCosto');
			const precioCol = this.mapping.indexOf('precio');
			const gtinCol = this.mapping.indexOf('gtin');
			const skuCol = this.mapping.indexOf('sku');
			// La lista es de costos: usamos la columna de costo (o la de precio como respaldo).
			const listCol = costoCol !== -1 ? costoCol : precioCol;
			if (listCol === -1) {
				this.$toast.add({ severity: 'warn', summary: this.$t('admin.carga.import.updateNoCol'), life: 5000 });
				return;
			}
			const byGtin = new Map<string, Row>();
			const bySku = new Map<string, Row>();
			for (const row of this.rows) {
				const g = row.gtin.trim();
				const s = row.sku.trim();
				if (g) byGtin.set(g, row);
				if (s) bySku.set(s, row);
			}
			let updated = 0;
			let notFound = 0;
			for (const cells of this.parsed.rows) {
				const lista = parseNumber((cells[listCol] ?? '').trim());
				const g = gtinCol !== -1 ? (cells[gtinCol] ?? '').trim() : '';
				const s = skuCol !== -1 ? (cells[skuCol] ?? '').trim() : '';
				const target = (g ? byGtin.get(g) : undefined) ?? (s ? bySku.get(s) : undefined) ?? null;
				if (!target || lista == null) {
					notFound++;
					continue;
				}
				const nuevoCosto = this.importBonif > 0 ? Math.round(lista * (1 - this.importBonif / 100)) : Math.round(lista);
				const oldCosto = target.precioCosto;
				target.precioCosto = nuevoCosto;
				if (target.margen != null) target.precio = Math.round(nuevoCosto * (1 + target.margen / 100));
				if (target.precioMl != null && oldCosto && oldCosto > 0) {
					target.precioMl = Math.round(target.precioMl * (nuevoCosto / oldCosto));
				}
				target.dirty = true;
				updated++;
			}
			this.dirty = true;
			this.closeImport();
			this.$toast.add({
				severity: updated ? 'success' : 'warn',
				summary: this.$t('admin.carga.import.updatedN', { updated, notFound }),
				life: 6000,
			});
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
			this.mlCatalogPicked = '';
			// Arranca en el camino que ya venía usando esa fila.
			this.mlMode = row.mlCatalogProductId ? 'catalogo' : 'categoria';
			this.mlCharts = null;
			this.mlChartCode = '';
			this.mlVisible = true;
			if (row.mlCategoryId && !this.attrsByCategory[row.mlCategoryId]) {
				void this.loadAttrs(row.rubroId, row.mlCategoryId);
			} else if (row.mlCategoryId) {
				void this.loadSizeCharts();
			}
			this.autoSuggest();
		},
		/** Cambia de camino (solo categoría / traer del catálogo de ML). */
		setMlMode(mode: 'categoria' | 'catalogo') {
			this.mlMode = mode;
			this.autoSuggest();
		},
		/** Vuelve a pedir sugerencias con el nombre que está escrito ahora. */
		resuggest() {
			if (this.mlMode !== 'categoria') return;
			this.mlPredictions = [];
			void this.suggestCategories();
		},
		/** En "solo categoría", si todavía no hay ninguna, sugerimos sin que lo pidan. */
		autoSuggest() {
			if (this.mlMode !== 'categoria' || this.mlPendingCategoryId || this.mlPredictions.length || this.mlPredicting) return;
			if (this.mlRow?.nombre.trim()) void this.suggestCategories();
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
			// Categoría elegida a mano: deja de estar atada a un producto del catálogo.
			// Si antes había traído uno, descartamos su foto y descripción pendientes:
			// este camino no toca lo que el usuario cargó.
			this.mlPendingCatalogId = '';
			this.mlCatalogPicked = '';
			if (this.mlRow) {
				this.mlPendingImageUrl = this.mlRow.imageUrl;
				this.mlPendingDescription = this.mlRow.descripcion;
			}
			// No vaciamos los atributos ya completados: los que la categoría nueva
			// comparte (marca, modelo…) siguen cargados; el resto se descarta para
			// no mandarle a ML atributos que esa categoría no tiene.
			if (this.mlRow) await this.loadAttrs(this.mlRow.rubroId, pred.categoryId);
			const valid = new Set(this.mlAttrs.map(a => a.id));
			this.mlAttrValues = Object.fromEntries(Object.entries(this.mlAttrValues).filter(([k]) => valid.has(k)));
		},
		/**
		 * Busca las guías de talles del vendedor para la categoría elegida, con el
		 * género y la marca cargados en la ficha (ML los exige para buscar).
		 */
		async loadSizeCharts() {
			const row = this.mlRow;
			const categoryId = this.mlPendingCategoryId;
			if (!row || !categoryId) {
				this.mlCharts = null;
				return;
			}
			this.mlChartsLoading = true;
			try {
				this.mlCharts = await this.catalog.fetchMlSizeCharts(row.rubroId, categoryId, this.mlAttrValues.GENDER ?? '', this.mlAttrValues.BRAND ?? '');
				// La guía ya elegida puede no salir en la búsqueda (se cargó por código o
				// cambió el filtro): se trae por su código para no perderla.
				const id = this.mlAttrValues.SIZE_GRID_ID;
				if (id && !this.mlCharts.charts.some(c => c.id === id)) {
					const chart = await this.catalog.fetchMlSizeChartById(row.rubroId, id, categoryId).catch(() => null);
					if (chart) this.mlCharts.charts.push(chart);
					else delete this.mlAttrValues.SIZE_GRID_ID;
				}
			} catch (e) {
				this.mlCharts = null;
				this.$toast.add({ severity: 'error', summary: apiErrorMessage(e, this.$t('admin.carga.ml.chart.error')), life: 6000 });
			} finally {
				this.mlChartsLoading = false;
			}
		},
		/** Usa la guía cuyo código pegó el usuario (se la pide a ML para validarla). */
		async useChartCode() {
			const row = this.mlRow;
			const code = this.mlChartCode.trim();
			if (!row || !code || !this.mlCharts) return;
			this.mlChartCodeLoading = true;
			try {
				const chart = await this.catalog.fetchMlSizeChartById(row.rubroId, code, this.mlPendingCategoryId);
				if (!this.mlCharts.charts.some(c => c.id === chart.id)) this.mlCharts.charts.push(chart);
				this.mlAttrValues.SIZE_GRID_ID = chart.id;
				this.mlChartCode = '';
				this.$toast.add({ severity: 'success', summary: this.$t('admin.carga.ml.chart.codeOk', { name: chart.name }), life: 4000 });
			} catch (e) {
				this.$toast.add({ severity: 'error', summary: apiErrorMessage(e, this.$t('admin.carga.ml.chart.codeError')), life: 6000 });
			} finally {
				this.mlChartCodeLoading = false;
			}
		},
		/** Guía recién creada en ML: queda en la lista y elegida para el producto. */
		onChartCreated(chart: MlSizeChart) {
			if (this.mlCharts && !this.mlCharts.charts.some(c => c.id === chart.id)) this.mlCharts.charts.push(chart);
			this.mlAttrValues.SIZE_GRID_ID = chart.id;
			this.$toast.add({ severity: 'success', summary: this.$t('admin.carga.ml.chart.create.created', { name: chart.name }), life: 5000 });
		},
		async loadAttrs(rubroId: string, categoryId: string) {
			this.mlLoadingAttrs = true;
			try {
				const attrs = await this.catalog.fetchMlAttributes(rubroId, categoryId);
				this.attrsByCategory[categoryId] = attrs;
				this.mlAttrs = attrs;
				void this.loadVarAttrs(rubroId, categoryId);
				void this.loadSizeCharts();
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
			// Con opciones cargadas a mano no se guarda un talle común (cada opción es el
			// suyo). Las importadas de ML traen su talle en la ficha y se respeta.
			if (row.grupo?.startsWith('man:')) for (const id of this.optionAttrIds(row)) delete clean[id];
			// Con opciones: la categoría de ML y los datos que eran iguales en todas
			// (marca, modelo…) valen para todas; los que las distinguen (talle, color)
			// quedan como estaban en cada una.
			if (row.grupo) {
				const prev = row.atributos;
				for (const r of this.groupRows(row)) {
					if (r === row) continue;
					r.mlCategoryId = this.mlPendingCategoryId;
					r.mlCategoryName = this.mlPendingCategoryName;
					if (row.grupo.startsWith('man:')) {
						// Cargado a mano: la ficha es UNA para todas las opciones (lo que las
						// distingue es la opción misma, no la ficha). Si quedan con marca o
						// modelo distintos, ML las trata como productos separados.
						r.atributos = { ...clean };
					} else {
						// Importado de ML: cada publicación trae su ficha; solo pisamos lo
						// que era igual en todas.
						for (const [k, v] of Object.entries(clean)) if (!(k in r.atributos) || r.atributos[k] === prev[k]) r.atributos[k] = v;
					}
					r.dirty = true;
				}
			}
			row.atributos = clean;
			row.mlCatalogProductId = this.mlPendingCatalogId;
			if (this.mlPendingImageUrl && this.mlPendingImageUrl !== row.imageUrl) {
				// Foto traída del catálogo: pasa a ser la portada (primera de la galería);
				// las que ya tenía quedan detrás, no se pierden.
				const url = this.mlPendingImageUrl;
				row.imagenes = [url, ...row.imagenes.filter(i => i !== url)];
				row.imageUrl = url;
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
				// Camino "ya está en ML": el producto elegido trae TODOS sus datos
				// (categoría, ficha, foto y descripción) y reemplaza los cargados. Es
				// explícito: el usuario eligió este camino y el diálogo lo avisa. Nada
				// se aplica a la fila hasta "Aplicar" (salvo el nombre si estaba vacío).
				this.mlPendingCatalogId = p.catalogProductId;
				this.mlCatalogPicked = p.name;
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
			this.imgPrev = JSON.stringify(row.imagenes);
			this.imgVisible = true;
		},
		syncCover() {
			const row = this.imgRow;
			if (row) {
				row.imageUrl = row.imagenes[0] ?? '';
				row.dirty = true;
				// Producto con opciones: las fotos se comparten entre las opciones del
				// MISMO color (todas, si no hay colores). Se copian a las que no tenían o
				// tenían las mismas (las importadas de ML con fotos propias quedan igual).
				if (row.grupo) {
					for (const r of this.groupRows(row)) {
						if (r === row || this.colorOf(r) !== this.colorOf(row)) continue;
						if (r.imagenes.length && JSON.stringify(r.imagenes) !== this.imgPrev) continue;
						r.imagenes = [...row.imagenes];
						r.imageUrl = row.imageUrl;
						r.dirty = true;
					}
					this.imgPrev = JSON.stringify(row.imagenes);
				}
			}
			this.dirty = true;
		},
		onAddImage(url: string) {
			if (url && this.imgRow) {
				this.imgRow.imagenes.push(url);
				this.syncCover();
			}
		},
		/** Fotos llegadas desde el celular (QR): se suman a la galería de la fila. */
		onHandoffPhotos(urls: string[]) {
			if (!this.imgRow || !urls.length) return;
			this.imgRow.imagenes.push(...urls);
			this.syncCover();
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
		/** Quita el fondo (deja blanco) de la imagen i y la reemplaza en la galería. */
		async stripImg(i: number) {
			if (!this.imgRow || this.strippingIdx !== null) return;
			const old = this.imgRow.imagenes[i];
			if (!old) return;
			this.strippingIdx = i;
			try {
				const { url } = await stripBackgroundToUpload(old, { folder: 'productos', format: 'jpeg' });
				this.imgRow.imagenes.splice(i, 1, url);
				this.syncCover();
				void deleteImage(old);
			} catch {
				this.$toast.add({ severity: 'error', summary: this.$t('image.err.removeBg'), life: 5000 });
			} finally {
				this.strippingIdx = null;
			}
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

