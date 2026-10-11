<template>
	<Dialog
		:visible="visible"
		modal
		block-scroll
		:header="$t('admin.carga.variantes.title')"
		class="w-full max-w-xl"
		@update:visible="$emit('update:visible', $event)"
	>
		<div class="flex flex-col gap-5 pt-1">
			<!-- Lo que se carga UNA sola vez (vale para todas las opciones) -->
			<section class="space-y-3">
				<p class="text-xs font-semibold uppercase tracking-wide text-surface-400">{{ $t('admin.carga.variantes.shared') }}</p>
				<div class="flex items-end gap-3">
					<button
						type="button"
						class="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-100 text-surface-400 transition-colors hover:text-primary dark:bg-surface-800"
						:title="$t('admin.carga.images.title')"
						@click="$emit('images')"
					>
						<img v-if="imageUrl" :src="imageUrl" class="h-full w-full object-cover" alt="" />
						<i v-else class="pi pi-camera" />
						<span
							v-if="imageCount > 1"
							class="absolute bottom-0 right-0 rounded-tl bg-surface-900/80 px-1 text-[9px] font-semibold text-white"
						>{{ imageCount }}</span>
					</button>
					<div class="min-w-0 flex-1 space-y-1">
						<label class="block text-[11px] font-semibold uppercase tracking-wide text-surface-500">{{ $t('admin.carga.cols.producto') }}</label>
						<InputText v-model="form.nombre" class="w-full" :placeholder="$t('admin.carga.variantes.namePlaceholder')" @blur="loadSuggestion" />
					</div>
				</div>
			</section>

			<!-- Qué cambia entre las opciones: características con nombre (hasta 3).
			     No son solo "color y talle": puede ser peso, sabor, material, medida… -->
			<section class="space-y-3 border-t border-surface-200 pt-4 dark:border-surface-700">
				<div>
					<p class="text-xs font-semibold uppercase tracking-wide text-surface-400">{{ $t('admin.carga.variantes.featsTitle') }}</p>
					<p class="mt-0.5 text-xs text-surface-500">{{ $t('admin.carga.variantes.featsHint') }}</p>
				</div>

				<div v-for="f in feats" :key="f.cid" class="space-y-2 rounded-xl border border-surface-200 p-2.5 dark:border-surface-700">
					<div class="flex items-center gap-2">
						<Select
							v-model="f.nombre"
							:options="suggestionsFor(f)"
							editable
							fluid
							size="small"
							:placeholder="$t('admin.carga.variantes.featPlaceholder')"
							class="min-w-0 flex-1 font-semibold"
						/>
						<button
							type="button"
							class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-surface-400 transition-colors hover:bg-surface-100 hover:text-red-500 dark:hover:bg-surface-800"
							:title="$t('admin.carga.variantes.removeFeat')"
							:aria-label="$t('admin.carga.variantes.removeFeat')"
							@click="removeFeat(f.cid)"
						>
							<i class="pi pi-trash text-sm" />
						</button>
					</div>
					<!-- Sus valores: etiquetas que se pueden corregir o quitar, y un campo para sumar. -->
					<div class="flex flex-wrap items-center gap-1.5">
						<span
							v-for="v in f.values"
							:key="v.vid"
							class="inline-flex items-center gap-0.5 rounded-full bg-primary/10 py-0.5 pl-2.5 pr-1 text-primary"
						>
							<input
								v-model="v.text"
								:size="Math.max(1, v.text.length)"
								class="min-w-0 bg-transparent text-xs font-semibold outline-none"
								:aria-label="$t('admin.carga.variantes.valueEdit')"
							/>
							<button
								type="button"
								class="flex h-4 w-4 items-center justify-center rounded-full hover:bg-primary/20"
								:title="$t('common.delete')"
								:aria-label="$t('common.delete')"
								@click="removeValue(f.cid, v.vid)"
							>
								<i class="pi pi-times text-[8px]" />
							</button>
						</span>
						<input
							v-model="f.draft"
							class="min-w-[9rem] flex-1 rounded-lg border border-surface-300 bg-transparent px-2 py-1 text-sm outline-none focus:border-primary dark:border-surface-600"
							:placeholder="valuesPlaceholder(f)"
							@input="onDraft(f)"
							@keydown.enter.prevent="addValues(f)"
							@blur="addValues(f)"
						/>
					</div>
				</div>

				<Button
					v-if="feats.length < maxFeats"
					:label="$t('admin.carga.variantes.addFeat')"
					icon="pi pi-plus"
					size="small"
					text
					@click="addFeat"
				/>

				<!-- La foto es una decisión aparte: una para todo (yerba) o una por valor (cada color). -->
				<div v-if="photoOptions.length > 1" class="flex flex-wrap items-center gap-2">
					<label class="text-[11px] font-semibold uppercase tracking-wide text-surface-500">{{ $t('admin.carga.variantes.photos') }}</label>
					<Select v-model="photoBy" :options="photoOptions" option-label="label" option-value="value" size="small" class="min-w-0 flex-1" />
				</div>
			</section>

			<!-- Las combinaciones: un renglón por cada una, con su precio y su stock -->
			<section class="space-y-3 border-t border-surface-200 pt-4 dark:border-surface-700">
				<p class="text-xs font-semibold uppercase tracking-wide text-surface-400">
					{{ $t('admin.carga.variantes.combos') }}<template v-if="items.length"> · {{ items.length }}</template>
				</p>

				<div v-if="items.length" class="space-y-3">
					<div
						v-for="g in groups"
						:key="g.cid"
						:class="photoBy ? 'space-y-2 rounded-xl border border-surface-200 p-2.5 dark:border-surface-700' : 'space-y-2'"
					>
						<!-- Cabecera del valor que define la foto (cada color, la suya) -->
						<div v-if="photoBy" class="flex items-center gap-2">
							<button
								type="button"
								class="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-100 text-surface-400 transition-colors hover:text-primary dark:bg-surface-800"
								:title="$t('admin.carga.variantes.valuePhoto', { value: g.color })"
								:aria-label="$t('admin.carga.variantes.valuePhoto', { value: g.color })"
								@click="$emit('color-images', { cid: g.cid, color: g.color, rowKeys: g.rowKeys })"
							>
								<img v-if="thumb(g).url" :src="thumb(g).url" class="h-full w-full object-cover" alt="" />
								<i v-else class="pi pi-camera text-sm" />
								<span
									v-if="thumb(g).count > 1"
									class="absolute bottom-0 right-0 rounded-tl bg-surface-900/80 px-1 text-[9px] font-semibold text-white"
								>{{ thumb(g).count }}</span>
							</button>
							<span class="min-w-0 truncate text-sm font-semibold text-surface-800 dark:text-surface-100">{{ g.color || '—' }}</span>
						</div>

						<div class="grid grid-cols-[minmax(0,1fr)_7rem_4.25rem_2rem] gap-2 px-0.5 text-[11px] font-semibold uppercase tracking-wide text-surface-500 sm:grid-cols-[minmax(0,1fr)_9rem_5.5rem_2rem]">
							<span>{{ $t('admin.carga.variantes.option') }}</span>
							<span>{{ $t('admin.carga.cols.precio') }}</span>
							<span>{{ $t('admin.carga.cols.stock') }}</span>
							<span />
						</div>
						<div
							v-for="it in g.items"
							:key="it.key"
							class="grid grid-cols-[minmax(0,1fr)_7rem_4.25rem_2rem] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_5.5rem_2rem]"
						>
							<span
								class="min-w-0 truncate text-sm font-medium"
								:class="dupes.has(label(it).toLowerCase()) ? 'text-red-500' : 'text-surface-800 dark:text-surface-100'"
								:title="label(it)"
							>{{ rowLabel(it) || $t('admin.carga.variantes.noValue') }}</span>
							<InputNumber
								v-model="it.precio"
								fluid
								mode="currency"
								currency="ARS"
								locale="es-AR"
								:min="0"
								:max-fraction-digits="0"
								input-class="!px-2 tabular-nums"
							/>
							<InputNumber v-model="it.stock" fluid :min="0" input-class="!px-2 text-center tabular-nums" :placeholder="'—'" />
							<button
								type="button"
								class="flex h-8 w-8 items-center justify-center rounded-full text-surface-400 transition-colors hover:bg-surface-100 hover:text-red-500 dark:hover:bg-surface-800"
								:title="$t('common.delete')"
								:aria-label="$t('common.delete')"
								@click="removeItem(it.key)"
							>
								<i class="pi pi-trash text-sm" />
							</button>
						</div>
					</div>
					<!-- Atajo: la mayoría de las veces todas las opciones valen lo mismo. -->
					<button
						v-if="items.length > 1 && items[0].precio != null && items.some(it => it.precio !== items[0].precio)"
						type="button"
						class="block text-xs font-semibold text-primary underline-offset-2 hover:underline"
						@click="samePrice"
					>
						{{ $t('admin.carga.variantes.samePrice', { precio: money(items[0].precio) }) }}
					</button>
					<!-- Lo mismo para el stock. -->
					<button
						v-if="items.length > 1 && items[0].stock != null && items.some(it => it.stock !== items[0].stock)"
						type="button"
						class="block text-xs font-semibold text-primary underline-offset-2 hover:underline"
						@click="sameStock"
					>
						{{ $t('admin.carga.variantes.sameStock', { stock: items[0].stock }) }}
					</button>
				</div>
				<p v-else class="rounded-xl border border-dashed border-surface-300 px-3 py-4 text-center text-xs text-surface-400 dark:border-surface-600">
					{{ $t('admin.carga.variantes.empty') }}
				</p>

				<p v-if="error" class="text-xs font-medium text-red-500">{{ $t(error) }}</p>
			</section>

			<!-- Más datos (también una sola vez). Van DESPUÉS de las opciones, que son la
			     tarea principal: arriba empujaban los renglones debajo del scroll. -->
			<section class="space-y-3 border-t border-surface-200 pt-4 dark:border-surface-700">
				<p class="text-xs font-semibold uppercase tracking-wide text-surface-400">{{ $t('admin.carga.variantes.more') }}</p>
				<div class="space-y-1">
					<label class="block text-[11px] font-semibold uppercase tracking-wide text-surface-500">{{ $t('admin.carga.variantes.description') }}</label>
					<Textarea v-model="form.descripcion" class="w-full" rows="2" auto-resize />
				</div>
				<div class="space-y-1">
					<label class="block text-[11px] font-semibold uppercase tracking-wide text-surface-500">{{ $t('admin.carga.cols.categoria') }}</label>
					<Select
						v-model="form.seccion"
						:options="categoriaOptions"
						editable
						show-clear
						fluid
						:placeholder="$t('admin.carga.categoria.none')"
					/>
					<!-- Es la del menú de la vitrina (no la de ML); ML solo la sugiere. -->
					<p class="text-[11px] text-surface-400">{{ $t('admin.carga.categoria.hint') }}</p>
					<button
						v-if="!form.seccion && suggestion"
						type="button"
						class="block max-w-full truncate text-left text-xs font-semibold text-primary"
						@click="form.seccion = suggestion"
					>
						{{ $t('admin.carga.categoria.useMl', { name: suggestion }) }}
					</button>
				</div>
			</section>
		</div>
		<template #footer>
			<Button :label="$t('common.cancel')" text @click="$emit('update:visible', false)" />
			<Button :label="$t('common.apply')" icon="pi pi-check" @click="apply" />
		</template>
	</Dialog>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import { MAX_OPCIONES, type ProductoOpcion } from '@base-template/shared';

/** Un renglón del resultado: una opción ("1 kg" o "Negro / M") con su precio y stock. */
export interface VarianteItem {
	/** Clave de la fila de la grilla a la que corresponde; null = opción nueva. */
	rowKey: string | null;
	/** Los valores unidos ("Negro / M"): la etiqueta que usan la vitrina y los pedidos. */
	variante: string;
	/** Las características con su nombre ([{ Color: Negro }, { Talle: M }]). */
	opciones?: ProductoOpcion[] | null;
	precio: number | null;
	stock: number | null;
	/** Id (interno del diálogo) del valor que define su foto: la vista lo usa para ubicarlas. */
	colorKey?: string;
}

export interface VariantesShared {
	nombre: string;
	descripcion: string;
	seccion: string | null;
}

export interface VariantesResult {
	shared: VariantesShared;
	items: VarianteItem[];
	/** true = una sola foto para todas las opciones (ninguna característica define la foto). */
	sharedPhotos: boolean;
}

/** Lo que el diálogo le pasa a la vista para ubicar las fotos de un valor (p. ej. un color). */
export interface ColorRef {
	cid: string;
	color: string;
	/** Filas de la grilla que ya tienen ese valor (las fotos salen de ahí). */
	rowKeys: string[];
}

interface Value {
	vid: string;
	text: string;
}
/** Una característica: su nombre ("Peso"), sus valores y lo que se está tipeando. */
interface Feat {
	cid: string;
	nombre: string;
	values: Value[];
	draft: string;
}
/** Una combinación: qué valor tiene de cada característica. */
interface Item {
	key: number;
	rowKey: string | null;
	vals: Record<string, string>;
	precio: number | null;
	stock: number | null;
}

let seq = 0;
const SEP = ' / ';
const uid = (p: string) => p + ++seq;
const norm = (s: string) =>
	s
		.trim()
		.toLowerCase()
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '');
const TALLE = /^(x{0,4}s|m|x{0,4}l|\d{1,2}x[sl]|u|unico|\d{1,3}([.,]\d)?)$/;

/**
 * Producto con opciones. La foto, el nombre y los demás datos se cargan UNA vez;
 * lo que cambia se define con hasta 3 características con nombre (Peso, Talle,
 * Color, Sabor… las que el producto necesite) y sus valores, y cada combinación
 * es un renglón con su precio y su stock. Las fotos son una para todo o una por
 * valor de la característica que se elija (cada color con la suya).
 *
 * No guarda nada: devuelve el resultado en `apply` y la vista arma las filas
 * (cada combinación es un producto del mismo `grupo`).
 */
export default defineComponent({
	name: 'VariantesDialog',
	props: {
		visible: { type: Boolean, required: true },
		shared: { type: Object as PropType<VariantesShared>, required: true },
		initialItems: { type: Array as PropType<VarianteItem[]>, required: true },
		imageUrl: { type: String, default: '' },
		imageCount: { type: Number, default: 0 },
		categoriaOptions: { type: Array as PropType<string[]>, default: () => [] },
		/** Nombres sugeridos para las características (los de la categoría de ML primero). */
		nameSuggestions: { type: Array as PropType<string[]>, default: () => [] },
		/**
		 * Sugiere una categoría para la vitrina a partir del nombre (la vista usa la
		 * categoría de Mercado Libre del producto, o la que ML predice). null = nada.
		 */
		suggestCategoria: { type: Function as PropType<(nombre: string) => Promise<string | null>>, default: null },
		/** Foto de portada (y cantidad) de un valor, según lo que tenga cargado la vista. */
		colorThumb: { type: Function as PropType<(ref: ColorRef) => { url: string; count: number }>, default: null },
	},
	emits: ['update:visible', 'apply', 'images', 'color-images'],
	data() {
		return {
			maxFeats: MAX_OPCIONES,
			form: { nombre: '', descripcion: '', seccion: null } as VariantesShared,
			feats: [] as Feat[],
			items: [] as Item[],
			/** cid de la característica que define la foto; null = una sola para todo. */
			photoBy: null as string | null,
			error: '',
			/** Categoría sugerida por Mercado Libre para el nombre actual. */
			suggestion: '',
			suggestSeq: 0,
		};
	},
	computed: {
		/** "Una sola para todo" + "una por cada <característica>". */
		photoOptions(): { label: string; value: string | null }[] {
			const out: { label: string; value: string | null }[] = [{ label: this.$t('admin.carga.variantes.photoOne'), value: null }];
			for (const f of this.feats) {
				if (f.values.length && f.nombre?.trim()) out.push({ label: this.$t('admin.carga.variantes.photoPer', { name: f.nombre.trim() }), value: f.cid });
			}
			return out;
		},
		/** Los renglones agrupados por el valor que define la foto (un solo grupo si no hay). */
		groups(): { cid: string; color: string; items: Item[]; rowKeys: string[] }[] {
			const by = this.photoBy;
			if (!by) return [{ cid: 'all', color: '', items: this.items, rowKeys: [] }];
			const feat = this.feats.find(f => f.cid === by);
			const out: { cid: string; color: string; items: Item[]; rowKeys: string[] }[] = [];
			for (const it of this.items) {
				const vid = it.vals[by] ?? '';
				let g = out.find(x => x.cid === vid);
				if (!g) {
					g = { cid: vid, color: feat?.values.find(v => v.vid === vid)?.text ?? '', items: [], rowKeys: [] };
					out.push(g);
				}
				g.items.push(it);
				if (it.rowKey) g.rowKeys.push(it.rowKey);
			}
			return out;
		},
		/** Combinaciones repetidas (se marcan en rojo y no dejan aplicar). */
		dupes(): Set<string> {
			const seen = new Set<string>();
			const out = new Set<string>();
			for (const it of this.items) {
				const k = this.label(it).toLowerCase();
				if (!k) continue;
				if (seen.has(k)) out.add(k);
				seen.add(k);
			}
			return out;
		},
	},
	watch: {
		// Cada vez que se abre, arranca de lo que le pasa la vista.
		visible: {
			immediate: true,
			handler(v: boolean) {
				if (!v) return;
				this.form = { ...this.shared };
				this.load();
				this.error = '';
				this.suggestion = '';
				void this.loadSuggestion();
			},
		},
		// Si la característica que definía la foto desaparece, vuelve a "una sola".
		feats: {
			deep: true,
			handler() {
				if (this.photoBy && !this.feats.some(f => f.cid === this.photoBy && f.values.length)) this.photoBy = null;
			},
		},
	},
	methods: {
		/** Arma características y combinaciones a partir de las filas que pasa la vista. */
		load() {
			const feats: Feat[] = [];
			let photoBy: string | null = null;
			const featFor = (nombre: string): Feat => {
				let f = feats.find(x => norm(x.nombre) === norm(nombre));
				if (!f) {
					f = { cid: uid('c'), nombre, values: [], draft: '' };
					feats.push(f);
				}
				return f;
			};
			const valueFor = (f: Feat, text: string): Value => {
				let v = f.values.find(x => norm(x.text) === norm(text));
				if (!v) {
					v = { vid: uid('v'), text };
					f.values.push(v);
				}
				return v;
			};
			// Lo cargado antes de que existieran los nombres: se deducen ("Negro / M" →
			// Color y Talle; una sola parte → Talle si lo parece, si no "Opción").
			const sinNombres = this.initialItems.filter(it => !it.opciones?.length && it.variante.trim());
			const partes = sinNombres.map(it => it.variante.split(SEP).map(s => s.trim()));
			const dims = Math.max(0, ...partes.map(p => p.length));
			const legacyNames =
				dims >= 2
					? [this.$t('admin.carga.variantes.nameColor'), this.$t('admin.carga.variantes.nameSize'), this.$t('admin.carga.variantes.nameOption')]
					: [partes.every(p => TALLE.test(norm(p[0] ?? ''))) ? this.$t('admin.carga.variantes.nameSize') : this.$t('admin.carga.variantes.nameOption')];

			this.items = this.initialItems.map(it => {
				const vals: Record<string, string> = {};
				const ops: ProductoOpcion[] = it.opciones?.length
					? it.opciones
					: it.variante.trim()
						? it.variante.split(SEP).map((valor, i) => ({ nombre: legacyNames[Math.min(i, legacyNames.length - 1)], valor: valor.trim(), foto: dims >= 2 && i === 0 }))
						: [];
				for (const o of ops) {
					if (!o.nombre?.trim() || !o.valor?.trim()) continue;
					const f = featFor(o.nombre.trim());
					vals[f.cid] = valueFor(f, o.valor.trim()).vid;
					if (o.foto) photoBy = f.cid;
				}
				return { key: ++seq, rowKey: it.rowKey, vals, precio: it.precio, stock: it.stock };
			});
			// Siempre hay al menos una característica lista para completar.
			if (!feats.length) feats.push({ cid: uid('c'), nombre: '', values: [], draft: '' });
			this.feats = feats.slice(0, this.maxFeats);
			this.photoBy = photoBy;
		},
		/** Pide la sugerencia de categoría (al abrir y al salir del nombre). */
		async loadSuggestion() {
			const nombre = this.form.nombre.trim();
			if (!this.suggestCategoria || !nombre || this.form.seccion) return;
			const n = ++this.suggestSeq;
			const name = await this.suggestCategoria(nombre).catch(() => null);
			// Si mientras tanto cambió el nombre, vale la respuesta más nueva.
			if (n === this.suggestSeq) this.suggestion = name ?? '';
		},
		/** Nombres sugeridos para una característica (los que no usan las otras). */
		suggestionsFor(f: Feat): string[] {
			const used = new Set(this.feats.filter(x => x.cid !== f.cid).map(x => norm(x.nombre ?? '')));
			return this.nameSuggestions.filter(n => !used.has(norm(n)));
		},
		/** Ejemplo de valores según el nombre elegido (general si no lo reconocemos). */
		valuesPlaceholder(f: Feat): string {
			const n = norm(f.nombre ?? '');
			const key = /talle|talla|numero/.test(n)
				? 'exSize'
				: /color/.test(n)
					? 'exColor'
					: /peso|contenido|capacidad|volumen/.test(n)
						? 'exWeight'
						: /sabor|aroma|fragancia/.test(n)
							? 'exFlavor'
							: 'exGeneric';
			return this.$t('admin.carga.variantes.' + key);
		},
		/** El texto del valor que tiene una combinación en una característica. */
		valueText(it: Item, f: Feat): string {
			return f.values.find(v => v.vid === it.vals[f.cid])?.text.trim() ?? '';
		},
		/** La etiqueta completa de la opción: "Negro / M", "1 kg"… */
		label(it: Item): string {
			return this.feats
				.map(f => this.valueText(it, f))
				.filter(Boolean)
				.join(SEP);
		},
		/** La etiqueta del renglón: sin el valor que ya está en la cabecera del grupo. */
		rowLabel(it: Item): string {
			const rest = this.feats
				.filter(f => f.cid !== this.photoBy)
				.map(f => this.valueText(it, f))
				.filter(Boolean);
			return rest.length ? rest.join(SEP) : this.label(it);
		},
		money(v: number | null): string {
			return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(v ?? 0);
		},
		thumb(g: { cid: string; color: string; rowKeys: string[] }): { url: string; count: number } {
			return this.colorThumb ? this.colorThumb({ cid: g.cid, color: g.color, rowKeys: g.rowKeys }) : { url: '', count: 0 };
		},
		addFeat() {
			if (this.feats.length < this.maxFeats) this.feats.push({ cid: uid('c'), nombre: '', values: [], draft: '' });
		},
		/** Una coma o punto y coma cierra el valor que se está escribiendo. */
		onDraft(f: Feat) {
			if (/[,;]/.test(f.draft)) this.addValues(f);
		},
		/** Todas las combinaciones de valores de las OTRAS características. */
		combosWithout(cid: string): Record<string, string>[] {
			let out: Record<string, string>[] = [{}];
			for (const f of this.feats) {
				if (f.cid === cid || !f.values.length) continue;
				out = out.flatMap(c => f.values.map(v => ({ ...c, [f.cid]: v.vid })));
			}
			return out;
		},
		/**
		 * Suma los valores escritos a una característica y arma sus combinaciones.
		 * El PRIMER valor de una característica no multiplica nada: lo ya cargado
		 * pasa a tener ese valor (un producto existente se convierte sin perderse).
		 */
		addValues(f: Feat) {
			const texts = f.draft
				.split(/[,;\n]/)
				.map(s => s.trim())
				.filter(Boolean);
			f.draft = '';
			for (const text of texts) {
				if (f.values.some(v => norm(v.text) === norm(text))) continue;
				const v: Value = { vid: uid('v'), text };
				const first = !f.values.length;
				f.values.push(v);
				if (first && this.items.length) {
					for (const it of this.items) it.vals[f.cid] = v.vid;
					continue;
				}
				for (const combo of this.combosWithout(f.cid)) {
					// Precio y stock heredados: los de la misma combinación con otro valor; si
					// no, los del último renglón. Casi siempre son iguales y se ajusta lo que difiera.
					const twin = this.items.find(it => Object.keys(combo).every(k => it.vals[k] === combo[k]));
					const last = this.items[this.items.length - 1];
					const precio = twin?.precio ?? last?.precio ?? null;
					const stock = twin?.stock ?? last?.stock ?? null;
					this.items.push({ key: ++seq, rowKey: null, vals: { ...combo, [f.cid]: v.vid }, precio, stock });
				}
			}
			if (texts.length) this.error = '';
		},
		removeValue(cid: string, vid: string) {
			const f = this.feats.find(x => x.cid === cid);
			if (!f) return;
			if (f.values.length === 1) {
				// Era el único valor: la característica deja de distinguir, no se borra nada.
				for (const it of this.items) delete it.vals[cid];
			} else {
				this.items = this.items.filter(it => it.vals[cid] !== vid);
			}
			f.values = f.values.filter(v => v.vid !== vid);
		},
		/** Quita una característica: quedan las combinaciones de su primer valor. */
		removeFeat(cid: string) {
			const f = this.feats.find(x => x.cid === cid);
			if (!f) return;
			if (f.values.length > 1) this.items = this.items.filter(it => it.vals[cid] === f.values[0].vid);
			for (const it of this.items) delete it.vals[cid];
			this.feats = this.feats.filter(x => x.cid !== cid);
			if (!this.feats.length) this.addFeat();
		},
		removeItem(key: number) {
			this.items = this.items.filter(it => it.key !== key);
		},
		samePrice() {
			const precio = this.items[0]?.precio ?? null;
			for (const it of this.items) it.precio = precio;
		},
		sameStock() {
			const stock = this.items[0]?.stock ?? null;
			for (const it of this.items) it.stock = stock;
		},
		apply() {
			// Lo que quedó tipeado sin cerrar también cuenta.
			for (const f of this.feats) if (f.draft.trim()) this.addValues(f);
			const used = this.feats.filter(f => f.values.length);
			if (!this.form.nombre.trim()) {
				this.error = 'admin.carga.variantes.errName';
				return;
			}
			// Cada característica con valores necesita un nombre, y no pueden repetirse.
			const names = used.map(f => norm(f.nombre ?? ''));
			if (names.some(n => !n) || new Set(names).size !== names.length) {
				this.error = 'admin.carga.variantes.errFeatName';
				return;
			}
			// Un renglón de un producto ya cargado sin ningún valor: se avisa en vez de
			// descartarlo (descartarlo borraría ese producto).
			if (this.items.some(it => it.rowKey && !this.label(it))) {
				this.error = 'admin.carga.variantes.errBlank';
				return;
			}
			const items = this.items.filter(it => this.label(it));
			if (items.length < 2) {
				this.error = 'admin.carga.variantes.errMin';
				return;
			}
			if (this.dupes.size) {
				this.error = 'admin.carga.variantes.errDupes';
				return;
			}
			const by = this.photoBy;
			const result: VariantesResult = {
				shared: { nombre: this.form.nombre.trim(), descripcion: this.form.descripcion.trim(), seccion: this.form.seccion?.trim() || null },
				sharedPhotos: !by,
				items: items.map(it => ({
					rowKey: it.rowKey,
					variante: this.label(it),
					opciones: used
						.filter(f => this.valueText(it, f))
						.map(f => ({ nombre: f.nombre.trim(), valor: this.valueText(it, f), ...(f.cid === by ? { foto: true } : {}) })),
					precio: it.precio,
					stock: it.stock,
					...(by ? { colorKey: it.vals[by] } : {}),
				})),
			};
			this.$emit('apply', result);
		},
	},
});
</script>
