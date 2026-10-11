<template>
	<div>
		<!-- Encabezado -->
		<div class="mb-6">
			<p class="text-xs font-semibold uppercase tracking-wide text-amber-500">{{ $t('admin.ml.estudio.eyebrow') }}</p>
			<h1 class="text-2xl font-extrabold text-surface-900 dark:text-surface-0">{{ $t('admin.ml.estudio.pageTitle') }}</h1>
			<p class="mt-1 text-sm text-surface-500">{{ $t('admin.ml.estudio.pageSubtitle') }}</p>
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
			<!-- Qué margen se busca + arrancar el estudio -->
			<div class="glass-card mb-4 rounded-2xl p-4 sm:p-5">
				<div class="flex flex-col gap-3 sm:flex-row sm:items-end">
					<div class="space-y-1.5 sm:w-48">
						<label class="block text-xs font-semibold uppercase tracking-wide text-surface-500">{{ $t('admin.ml.estudio.target') }}</label>
						<InputNumber v-model="target" fluid suffix=" %" :min="0" :max="500" />
					</div>
					<p class="min-w-0 flex-1 text-xs leading-snug text-surface-500">{{ $t('admin.ml.estudio.targetHint') }}</p>
					<Button v-if="running" :label="$t('admin.ml.estudio.stop')" icon="pi pi-times" outlined severity="secondary" @click="stop" />
					<Button
						v-else
						:label="$t(studied ? 'admin.ml.estudio.again' : 'admin.ml.estudio.run', { n: productos.length })"
						icon="pi pi-search"
						:disabled="!productos.length"
						@click="run(studied > 0)"
					/>
				</div>
				<!-- Avance -->
				<div v-if="running" class="mt-4">
					<div class="h-2 overflow-hidden rounded-full bg-surface-200 dark:bg-surface-700">
						<div class="h-full rounded-full bg-amber-500 transition-all" :style="{ width: progressPct + '%' }" />
					</div>
					<p class="mt-1.5 text-xs text-surface-500">{{ $t('admin.ml.estudio.progress', { done, total }) }}</p>
				</div>
			</div>

			<!-- Sin productos -->
			<div v-if="!productos.length" class="glass-card rounded-2xl p-8 text-center text-surface-500">
				<i class="pi pi-inbox mb-3 block text-3xl text-surface-400" />
				<p class="mb-4">{{ $t('admin.ml.estudio.empty') }}</p>
				<Button :label="$t('admin.ml.estudio.goLoad')" icon="pi pi-upload" outlined @click="$router.push({ name: 'admin-carga-masiva' })" />
			</div>

			<!-- Todavía no se estudió -->
			<div v-else-if="!studied && !running" class="glass-card rounded-2xl p-8 text-center text-surface-500">
				<i class="pi pi-chart-line mb-3 block text-3xl text-amber-400" />
				<p>{{ $t('admin.ml.estudio.intro') }}</p>
			</div>

			<template v-else>
				<!-- Resumen: cada grupo filtra la lista. Los grupos vacíos no se muestran. -->
				<div class="mb-3 flex flex-wrap gap-2">
					<button
						v-for="g in visibleGroups"
						:key="g.key"
						type="button"
						class="glass-card min-w-[7.5rem] flex-1 rounded-2xl p-3 text-left transition-colors"
						:class="filter === g.key ? 'ring-2 ring-amber-500' : 'hover:bg-surface-50/60 dark:hover:bg-surface-800/30'"
						@click="filter = filter === g.key ? 'all' : g.key"
					>
						<p class="text-2xl font-extrabold" :class="g.cls">{{ counts[g.key] }}</p>
						<p class="truncate text-xs font-semibold text-surface-600 dark:text-surface-300">{{ $t('admin.ml.estudio.group.' + g.key) }}</p>
					</button>
				</div>

				<!-- Contra qué precio se calcula la ganancia de TODAS las filas -->
				<div class="mb-3 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
					<span class="text-xs font-semibold uppercase tracking-wide text-surface-500">{{ $t('admin.ml.estudio.basis.label') }}</span>
					<SelectButton v-model="basisKey" :options="basisOptions" option-label="label" option-value="value" :allow-empty="false" />
				</div>

				<!-- Buscar + ordenar -->
				<div class="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
					<IconField class="min-w-0 flex-1">
						<InputIcon class="pi pi-search" />
						<InputText v-model="search" fluid :placeholder="$t('admin.ml.estudio.search')" />
					</IconField>
					<Select v-model="sort" :options="sortOptions" option-label="label" option-value="value" class="sm:w-60" />
				</div>
				<p v-if="filter === 'all' && counts.sin_datos" class="mb-3 text-xs text-surface-500">
					{{ $t('admin.ml.estudio.onlyWithData', { n: counts.sin_datos }) }}
				</p>

				<div v-if="!shown.length" class="glass-card rounded-2xl p-8 text-center text-sm text-surface-500">{{ $t('admin.ml.estudio.noneInGroup') }}</div>

				<!-- Resultados. La fila muestra la conclusión; al tocarla se abre el detalle. -->
				<div v-else class="space-y-2">
					<div v-for="row in shown" :key="row.p.id" class="glass-card overflow-hidden rounded-2xl">
						<button type="button" class="flex w-full items-center gap-3 p-3 text-left sm:gap-4 sm:p-3.5" :aria-expanded="open === row.p.id" @click="open = open === row.p.id ? null : row.p.id">
							<div class="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-surface-100 sm:h-12 sm:w-12 dark:bg-surface-800">
								<img v-if="row.p.imageUrl" :src="row.p.imageUrl" class="h-full w-full object-cover" alt="" />
								<div v-else class="flex h-full w-full items-center justify-center text-surface-400"><i class="pi pi-image" /></div>
							</div>
							<div class="min-w-0 flex-1">
								<p class="truncate text-sm font-semibold text-surface-900 sm:text-base dark:text-surface-0">{{ row.p.nombre }}</p>
								<!-- En el celu la etiqueta y el dato van en renglones separados: juntos no entran. -->
								<p class="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-surface-500 sm:flex-nowrap">
									<span v-if="row.r && row.r.via && !row.r.noCoincide" class="shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-semibold" :class="confCls(row.r.via)">
										{{ $t('admin.ml.estudio.conf.' + row.r.via) }}
									</span>
									<span class="min-w-0 sm:truncate">{{ subline(row) }}</span>
								</p>
							</div>
							<!-- Lo que decide: cuánto queda. Grande y a la derecha. -->
							<div class="shrink-0 text-right">
								<template v-if="row.e && row.e.ganancia != null">
									<p class="text-base font-extrabold sm:text-lg" :class="toneCls(row.v)">{{ money(row.e.ganancia) }}</p>
									<p class="text-xs font-semibold" :class="toneCls(row.v)">{{ pctLabel(row.e.gananciaPct) }}</p>
								</template>
								<p v-else-if="row.e" class="text-sm font-semibold text-surface-700 dark:text-surface-200">{{ money(row.e.precio) }}</p>
								<span class="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" :class="verdictCls(row.v)">
									<span class="h-1.5 w-1.5 rounded-full bg-current" />{{ $t('admin.ml.estudio.verdict.' + row.v) }}
								</span>
							</div>
							<span class="hidden shrink-0 text-surface-400 transition-transform sm:inline-flex" :class="open === row.p.id ? 'rotate-180' : ''">
								<i class="pi pi-chevron-down text-xs" />
							</span>
						</button>

						<!-- Detalle -->
						<div v-if="open === row.p.id" class="space-y-3 border-t border-surface-200/60 p-3 text-sm sm:p-4 dark:border-surface-700/60">
							<p v-if="row.v === 'revisar'" class="flex items-start gap-1.5 rounded-lg bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-400">
								<i class="pi pi-exclamation-triangle mt-0.5" /><span>{{ $t('admin.ml.estudio.reviewHint') }}</span>
							</p>
							<p v-if="row.r && row.r.noCoincide" class="text-xs text-amber-600 dark:text-amber-400">{{ $t('admin.ml.estudio.wrongCode', { name: row.r.catalogName }) }}</p>
							<p v-else-if="row.v === 'sin_datos'" class="text-xs text-surface-500">{{ $t('admin.ml.estudio.noMatch') }}</p>

							<template v-if="row.r && row.r.precioMin != null && !row.r.noCoincide">
								<!-- Contra qué se comparó -->
								<div class="text-xs text-surface-500">
									<p class="font-semibold text-surface-600 dark:text-surface-300">{{ $t('admin.ml.estudio.comparedTitle.' + row.r.via) }}</p>
									<p class="mt-0.5">
										<template v-if="row.r.via === 'similares'">{{ row.r.similares.join(' · ') }}</template>
										<a v-else-if="row.r.permalink" :href="row.r.permalink" target="_blank" rel="noopener" class="font-medium text-primary hover:underline">{{ row.r.catalogName }}</a>
										<template v-else>{{ row.r.catalogName }}</template>
									</p>
								</div>
								<!-- Los dos precios, cada uno con lo que queda -->
								<div class="grid gap-2" :class="priceCols(row.r).length > 1 ? 'sm:grid-cols-2' : ''">
									<div
										v-for="col in priceCols(row.r)"
										:key="col.key"
										class="rounded-xl border p-3"
										:class="col.e === row.e ? 'border-amber-400/60 bg-amber-500/5' : 'border-surface-200 dark:border-surface-700'"
									>
										<p class="text-xs text-surface-500">{{ $t('admin.ml.estudio.' + col.key) }}</p>
										<p class="font-semibold text-surface-800 dark:text-surface-100">{{ $t('admin.ml.estudio.sellingAt', { price: money(col.precio) }) }}</p>
										<p v-if="col.e && col.e.ganancia != null" class="text-xs font-semibold" :class="gainCls(col.e.gananciaPct)">
											{{ $t('admin.ml.estudio.keep', { amount: money(col.e.ganancia), pct: pctLabel(col.e.gananciaPct) }) }}
										</p>
										<p v-if="col.e" class="mt-1 text-[11px] text-surface-500">
											{{ $t('admin.ml.estudio.breakdown', { pct: dec(col.e.comisionPct), fee: money(col.e.comision) }) }}
											<template v-if="col.e.envio"> · {{ $t('admin.ml.estudio.shipping', { cost: money(col.e.envio) }) }}</template>
										</p>
									</div>
								</div>
								<p class="text-xs text-surface-500">
									{{ row.r.costo != null ? $t('admin.ml.estudio.costLine', { cost: money(row.r.costo) }) : $t('admin.ml.estudio.needCost') }}
									· {{ $t('admin.ml.estudio.sellers', row.r.vendedores) }}
									<span v-if="row.r.envioSinMedidas" class="text-amber-600 dark:text-amber-400">· {{ $t('admin.ml.estudio.noShipping') }}</span>
								</p>
							</template>
							<div>
								<Button :label="$t('admin.ml.estudio.openProduct')" icon="pi pi-sliders-h" size="small" outlined @click="goProduct(row.p)" />
							</div>
						</div>
					</div>
				</div>
			</template>
		</template>
	</div>
</template>

<script lang="ts">
import { defineComponent, reactive } from 'vue';
import type { MlEstudio, MlEstudioEscenario, Producto, Rubro } from '@base-template/shared';
import { useCatalogStore } from '@/modules/admin/store/catalog';
import { useAdminContext } from '@/modules/admin/store/context';

/**
 * conviene = llega al margen buscado; justo = gana pero menos; no_conviene =
 * pierde; revisar = la referencia de otra marca da una ganancia imposible.
 */
type Verdict = 'conviene' | 'justo' | 'no_conviene' | 'revisar' | 'sin_costo' | 'sin_datos' | 'pendiente';
type GroupKey = Exclude<Verdict, 'pendiente'>;
type SortKey = 'best' | 'pct' | 'amount' | 'sellers';
interface Row {
	p: Producto;
	r: MlEstudio | undefined;
	v: Verdict;
	/** El precio con el que se decide (ver `basis`). */
	e: MlEstudioEscenario | null;
}

const ORDER: Record<Verdict, number> = { conviene: 0, justo: 1, no_conviene: 2, revisar: 3, sin_costo: 4, pendiente: 5, sin_datos: 6 };
/** Qué tan seguro es que se comparó contra el mismo producto (menos = más seguro). */
const CONF: Record<string, number> = { publicacion: 0, ean: 0, nombre: 1, similares: 2 };
/**
 * Una referencia de OTRA marca que deja más de esto sobre el costo casi seguro no
 * es comparable (un pack contra la unidad, otra medida): se manda a revisar en vez
 * de mostrarla como la mejor oportunidad.
 */
const MAX_PCT_REFERENCIA = 200;

/**
 * Resultados por producto. Viven fuera del componente para que no se pierdan al
 * cambiar de pestaña: estudiar una lista entera son muchos pedidos a Mercado Libre.
 */
const results = reactive<Record<string, MlEstudio>>({});

/**
 * Estudio de mercado: busca a cuánto se vende cada producto en Mercado Libre y,
 * con su costo, calcula cuánto quedaría. Con el margen que busca el dueño los
 * separa en "conviene", "queda justo" y "no conviene". La fila muestra la
 * conclusión (cuánto queda); el detalle se abre al tocarla.
 */
export default defineComponent({
	name: 'EstudioMercadoView',
	data() {
		return {
			catalog: useCatalogStore(),
			ctx: useAdminContext(),
			results,
			loading: false,
			mlConnected: false,
			target: 20 as number | null,
			running: false,
			cancel: false,
			done: 0,
			total: 0,
			filter: 'all' as GroupKey | 'all',
			search: '',
			sort: 'best' as SortKey,
			/** Contra qué precio se calcula lo que queda: el más barato (por defecto) o el del medio. */
			basisKey: 'min' as 'min' | 'medio',
			/** Fila con el detalle abierto. */
			open: null as string | null,
			groups: [
				{ key: 'conviene', cls: 'text-emerald-600 dark:text-emerald-400' },
				{ key: 'justo', cls: 'text-amber-600 dark:text-amber-400' },
				{ key: 'no_conviene', cls: 'text-red-500' },
				{ key: 'revisar', cls: 'text-violet-600 dark:text-violet-400' },
				{ key: 'sin_costo', cls: 'text-sky-600 dark:text-sky-400' },
				{ key: 'sin_datos', cls: 'text-surface-400' },
			] as { key: GroupKey; cls: string }[],
		};
	},
	computed: {
		rubro(): Rubro | undefined {
			return this.catalog.rubros.find(r => r.id === this.ctx.currentRubroId);
		},
		productos(): Producto[] {
			return this.catalog.allProductos.filter(p => p.rubroId === this.ctx.currentRubroId);
		},
		/** Cuántos productos ya tienen resultado. */
		studied(): number {
			return this.productos.filter(p => this.results[p.id]).length;
		},
		progressPct(): number {
			return this.total ? Math.round((this.done / this.total) * 100) : 0;
		},
		basisOptions(): { label: string; value: 'min' | 'medio' }[] {
			return [
				{ value: 'min', label: this.$t('admin.ml.estudio.basis.min') },
				{ value: 'medio', label: this.$t('admin.ml.estudio.basis.medio') },
			];
		},
		sortOptions(): { label: string; value: SortKey }[] {
			return (['best', 'pct', 'amount', 'sellers'] as SortKey[]).map(value => ({ value, label: this.$t('admin.ml.estudio.sort.' + value) }));
		},
		rows(): Row[] {
			return this.productos.map(p => {
				const r = this.results[p.id] as MlEstudio | undefined;
				return { p, r, v: this.verdict(r), e: this.basis(r) };
			});
		},
		counts(): Record<GroupKey, number> {
			const c: Record<GroupKey, number> = { conviene: 0, justo: 0, no_conviene: 0, revisar: 0, sin_costo: 0, sin_datos: 0 };
			for (const row of this.rows) if (row.v !== 'pendiente') c[row.v]++;
			return c;
		},
		visibleGroups(): { key: GroupKey; cls: string }[] {
			return this.groups.filter(g => this.counts[g.key] > 0);
		},
		shown(): Row[] {
			const q = this.search.trim().toLowerCase();
			const pct = (row: Row) => row.e?.gananciaPct ?? -Infinity;
			const by: Record<SortKey, (a: Row, b: Row) => number> = {
				// Recomendado: por grupo, después lo más confiable, después la ganancia.
				best: (a, b) => ORDER[a.v] - ORDER[b.v] || (CONF[a.r?.via ?? ''] ?? 9) - (CONF[b.r?.via ?? ''] ?? 9) || pct(b) - pct(a),
				pct: (a, b) => pct(b) - pct(a),
				amount: (a, b) => (b.e?.ganancia ?? -Infinity) - (a.e?.ganancia ?? -Infinity),
				sellers: (a, b) => (b.r?.vendedores ?? 0) - (a.r?.vendedores ?? 0),
			};
			return this.rows
				.filter(row => {
					// Sin filtro: solo lo que tiene datos. "Sin datos" se ve al tocar su contador.
					if (this.filter === 'all' ? row.v === 'sin_datos' || row.v === 'pendiente' : row.v !== this.filter) return false;
					return !q || row.p.nombre.toLowerCase().includes(q);
				})
				.sort(by[this.sort]);
		},
	},
	async created() {
		await this.reload();
	},
	watch: {
		// Se mira el rubro RESUELTO: en carga directa el id ya viene persistido y lo
		// que llega tarde es la lista de rubros.
		rubro(next: Rubro | undefined, prev: Rubro | undefined) {
			if (next?.id !== prev?.id) {
				this.stop();
				void this.reload();
			}
		},
	},
	beforeUnmount() {
		this.stop();
	},
	methods: {
		money(n: number): string {
			return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
		},
		/** Porcentaje con un decimal como mucho ("14,8"). */
		dec(n: number): string {
			return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 }).format(n);
		},
		pctLabel(pct: number | null): string {
			return pct == null ? '' : `${pct > 0 ? '+' : ''}${pct}%`;
		},
		/**
		 * Con qué precio se decide: el mismo para todas las filas, el que eligió el
		 * dueño arriba (el más barato por defecto, o el del medio).
		 */
		basis(r: MlEstudio | undefined): MlEstudioEscenario | null {
			if (!r || r.noCoincide) return null;
			return this.basisKey === 'medio' ? r.alMedio : r.alMin;
		},
		verdict(r: MlEstudio | undefined): Verdict {
			if (!r) return 'pendiente';
			if (!r.via || r.noCoincide || r.precioMin == null) return 'sin_datos';
			const pct = this.basis(r)?.gananciaPct;
			if (pct == null) return r.costo == null || r.costo <= 0 ? 'sin_costo' : 'sin_datos';
			if (r.via === 'similares' && pct > MAX_PCT_REFERENCIA) return 'revisar';
			if (pct <= 0) return 'no_conviene';
			return pct >= (this.target ?? 0) ? 'conviene' : 'justo';
		},
		/** Segunda línea de la fila: a qué precio se calculó y cuánta competencia hay. */
		subline(row: Row): string {
			const r = row.r;
			if (!r) return this.$t('admin.ml.estudio.pending');
			if (r.noCoincide) return this.$t('admin.ml.estudio.wrongCodeShort');
			if (!row.e) return this.$t('admin.ml.estudio.noMatchShort');
			return `${this.$t('admin.ml.estudio.sellingAt', { price: this.money(row.e.precio) })} · ${this.$t('admin.ml.estudio.sellers', r.vendedores)}`;
		},
		/** Las columnas de precio del detalle; una sola si el más barato y el del medio coinciden. */
		priceCols(r: MlEstudio): { key: 'cheapest' | 'middle' | 'onlyPrice'; precio: number; e: MlEstudioEscenario | null }[] {
			if (r.precioMin == null) return [];
			if (r.precioMediana == null || r.precioMediana === r.precioMin) return [{ key: 'onlyPrice', precio: r.precioMin, e: r.alMin }];
			return [
				{ key: 'cheapest', precio: r.precioMin, e: r.alMin },
				{ key: 'middle', precio: r.precioMediana, e: r.alMedio },
			];
		},
		confCls(via: string): string {
			if (via === 'similares') return 'bg-amber-500/10 text-amber-700 dark:text-amber-400';
			if (via === 'nombre') return 'bg-sky-500/10 text-sky-700 dark:text-sky-400';
			return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400';
		},
		toneCls(v: Verdict): string {
			if (v === 'conviene') return 'text-emerald-600 dark:text-emerald-400';
			if (v === 'justo') return 'text-amber-600 dark:text-amber-400';
			if (v === 'no_conviene') return 'text-red-500';
			return 'text-surface-400';
		},
		verdictCls(v: Verdict): string {
			if (v === 'conviene') return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400';
			if (v === 'justo') return 'bg-amber-500/10 text-amber-700 dark:text-amber-400';
			if (v === 'no_conviene') return 'bg-red-500/10 text-red-600 dark:text-red-400';
			if (v === 'revisar') return 'bg-violet-500/10 text-violet-700 dark:text-violet-400';
			if (v === 'sin_costo') return 'bg-sky-500/10 text-sky-700 dark:text-sky-400';
			return 'bg-surface-500/10 text-surface-500';
		},
		gainCls(pct: number | null): string {
			if (pct == null) return 'text-surface-400';
			if (pct <= 0) return 'text-red-500';
			return pct >= (this.target ?? 0) ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400';
		},
		/** Abre el producto en Publicaciones, donde se le ajusta el precio y se publica. */
		goProduct(p: Producto) {
			void this.$router.push({ name: 'admin-ml-publicaciones', query: { p: p.id } });
		},
		async reload() {
			if (!this.catalog.rubros.length) await this.catalog.fetchRubros().catch(() => undefined);
			if (!this.rubro) return;
			this.loading = true;
			try {
				const state = await this.catalog.fetchMlState(this.rubro.id);
				this.mlConnected = !!state.connection;
				if (this.mlConnected) await this.catalog.fetchAllProductos();
			} catch {
				this.$toast.add({ severity: 'error', summary: this.$t('admin.errors.load'), life: 4000 });
			} finally {
				this.loading = false;
			}
		},
		stop() {
			this.cancel = true;
		},
		/** Estudia los productos de a 3 (Mercado Libre limita la cantidad de pedidos). */
		async run(refresh: boolean) {
			if (!this.rubro || this.running) return;
			const rubroId = this.rubro.id;
			const queue = [...this.productos];
			if (refresh) for (const p of queue) delete this.results[p.id];
			this.running = true;
			this.cancel = false;
			this.done = 0;
			this.total = queue.length;
			let failed = 0;
			const worker = async () => {
				for (;;) {
					const p = queue.shift();
					if (!p || this.cancel) return;
					try {
						this.results[p.id] = await this.catalog.fetchMlEstudio(rubroId, p.id, refresh);
					} catch {
						failed++;
					}
					this.done++;
				}
			};
			await Promise.all([worker(), worker(), worker()]);
			this.running = false;
			if (failed) this.$toast.add({ severity: 'warn', summary: this.$t('admin.ml.estudio.failed', failed), life: 5000 });
		},
	},
});
</script>
