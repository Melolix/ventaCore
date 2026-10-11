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
				<!-- Resumen: cada grupo filtra la lista -->
				<div class="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
					<button
						v-for="g in groups"
						:key="g.key"
						type="button"
						class="glass-card min-w-0 rounded-2xl p-3 text-left transition-colors"
						:class="filter === g.key ? 'ring-2 ring-amber-500' : 'hover:bg-surface-50/60 dark:hover:bg-surface-800/30'"
						@click="filter = filter === g.key ? 'all' : g.key"
					>
						<p class="text-2xl font-extrabold" :class="g.cls">{{ counts[g.key] }}</p>
						<p class="truncate text-xs font-semibold text-surface-600 dark:text-surface-300">{{ $t('admin.ml.estudio.group.' + g.key) }}</p>
					</button>
				</div>

				<div v-if="!shown.length" class="glass-card rounded-2xl p-8 text-center text-sm text-surface-500">{{ $t('admin.ml.estudio.noneInGroup') }}</div>

				<!-- Resultados: primero lo que conviene, de mayor a menor ganancia -->
				<div v-else class="space-y-2">
					<div v-for="row in shown" :key="row.p.id" class="glass-card rounded-2xl p-3 sm:p-4">
						<div class="flex items-start gap-3">
							<div class="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-surface-100 sm:h-12 sm:w-12 dark:bg-surface-800">
								<img v-if="row.p.imageUrl" :src="row.p.imageUrl" class="h-full w-full object-cover" alt="" />
								<div v-else class="flex h-full w-full items-center justify-center text-surface-400"><i class="pi pi-image" /></div>
							</div>
							<div class="min-w-0 flex-1">
								<div class="flex items-start justify-between gap-2">
									<p class="min-w-0 truncate text-sm font-semibold text-surface-900 sm:text-base dark:text-surface-0">{{ row.p.nombre }}</p>
									<span class="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold" :class="verdictCls(row.v)">
										<span class="h-1.5 w-1.5 rounded-full bg-current" />{{ $t('admin.ml.estudio.verdict.' + row.v) }}
									</span>
								</div>

								<!-- Contra qué se comparó -->
								<p v-if="row.r && row.r.noCoincide" class="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
									{{ $t('admin.ml.estudio.wrongCode', { name: row.r.catalogName }) }}
								</p>
								<p v-else-if="row.r && row.r.via === 'similares'" class="mt-0.5 text-xs text-surface-500">
									<span class="font-semibold text-amber-600 dark:text-amber-400">{{ $t('admin.ml.estudio.similar') }}</span>
									{{ row.r.similares.join(' · ') }}
								</p>
								<p v-else-if="row.r && row.r.catalogName && row.r.via" class="mt-0.5 text-xs text-surface-500">
									{{ $t('admin.ml.comp.comparedWith') }}
									<a v-if="row.r.permalink" :href="row.r.permalink" target="_blank" rel="noopener" class="font-medium text-primary hover:underline">{{ row.r.catalogName }}</a>
									<span v-else class="font-medium">{{ row.r.catalogName }}</span>
									<span v-if="row.r.via === 'nombre'" class="ml-1 font-semibold text-amber-600 dark:text-amber-400">· {{ $t('admin.ml.estudio.byName') }}</span>
								</p>
								<p v-else-if="row.v === 'sin_datos'" class="mt-0.5 text-xs text-surface-400">{{ $t('admin.ml.estudio.noMatch') }}</p>
								<p v-else-if="row.v === 'pendiente'" class="mt-0.5 text-xs text-surface-400"><i class="pi pi-spin pi-spinner text-[10px]" /> {{ $t('admin.ml.estudio.pending') }}</p>

								<!-- Números: el costo y qué queda al precio más barato y al del medio -->
								<div v-if="row.r && row.r.precioMin != null && !row.r.noCoincide" class="mt-2 grid grid-cols-3 gap-2 text-xs">
									<div class="min-w-0">
										<p class="truncate text-surface-400">{{ $t('admin.ml.cost') }}</p>
										<p class="truncate font-semibold text-surface-700 dark:text-surface-200">{{ row.r.costo != null ? money(row.r.costo) : '—' }}</p>
										<p class="truncate text-[11px] text-surface-400">{{ $t('admin.ml.estudio.sellers', row.r.vendedores) }}</p>
									</div>
									<div v-for="col in priceCols(row.r)" :key="col.key" class="min-w-0">
										<p class="truncate text-surface-400">{{ $t('admin.ml.estudio.' + col.key) }}</p>
										<p class="truncate font-semibold text-surface-700 dark:text-surface-200">{{ money(col.precio) }}</p>
										<p v-if="col.e && col.e.ganancia != null" class="truncate text-[11px] font-semibold" :class="gainCls(col.e.gananciaPct)">
											{{ $t('admin.ml.estudio.keep', { amount: money(col.e.ganancia), pct: (col.e.gananciaPct! >= 0 ? '+' : '') + col.e.gananciaPct }) }}
										</p>
									</div>
								</div>
								<p v-if="row.v === 'sin_costo'" class="mt-1.5 text-[11px] text-amber-600 dark:text-amber-400">{{ $t('admin.ml.estudio.needCost') }}</p>
								<p v-else-if="row.r && row.r.alMin && !row.r.noCoincide" class="mt-1.5 text-[11px] leading-snug text-surface-400">
									{{ $t('admin.ml.estudio.breakdown', { pct: row.r.alMin.comisionPct }) }}
									<template v-if="row.r.alMin.envio">· {{ $t('admin.ml.estudio.shipping', { cost: money(row.r.alMin.envio) }) }}</template>
									<span v-if="row.r.envioSinMedidas" class="text-amber-600 dark:text-amber-400">· {{ $t('admin.ml.estudio.noShipping') }}</span>
								</p>
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

/** conviene = llega al margen buscado; justo = gana pero menos; no_conviene = pierde. */
type Verdict = 'conviene' | 'justo' | 'no_conviene' | 'sin_costo' | 'sin_datos' | 'pendiente';
type GroupKey = Exclude<Verdict, 'pendiente'>;
const ORDER: Record<Verdict, number> = { conviene: 0, justo: 1, no_conviene: 2, sin_costo: 3, pendiente: 4, sin_datos: 5 };

/**
 * Resultados por producto. Viven fuera del componente para que no se pierdan al
 * cambiar de pestaña: estudiar una lista entera son muchos pedidos a Mercado Libre.
 */
const results = reactive<Record<string, MlEstudio>>({});

/**
 * Estudio de mercado: busca a cuánto se vende cada producto en Mercado Libre y,
 * con su costo, calcula cuánto quedaría vendiéndolo al precio más barato y al
 * del medio. Con el margen que busca el dueño los separa en "conviene", "queda
 * justo" y "no conviene".
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
			groups: [
				{ key: 'conviene', cls: 'text-emerald-600 dark:text-emerald-400' },
				{ key: 'justo', cls: 'text-amber-600 dark:text-amber-400' },
				{ key: 'no_conviene', cls: 'text-red-500' },
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
		rows(): { p: Producto; r: MlEstudio | undefined; v: Verdict }[] {
			return this.productos
				.map(p => ({ p, r: this.results[p.id] as MlEstudio | undefined, v: this.verdict(this.results[p.id]) }))
				// Primero lo que conviene, al final lo que no tiene datos; dentro de cada grupo, de mayor a menor ganancia.
				.sort((a, b) => ORDER[a.v] - ORDER[b.v] || (this.basis(b.r)?.gananciaPct ?? -Infinity) - (this.basis(a.r)?.gananciaPct ?? -Infinity));
		},
		counts(): Record<GroupKey, number> {
			const c: Record<GroupKey, number> = { conviene: 0, justo: 0, no_conviene: 0, sin_costo: 0, sin_datos: 0 };
			for (const row of this.rows) if (row.v !== 'pendiente') c[row.v]++;
			return c;
		},
		shown(): { p: Producto; r: MlEstudio | undefined; v: Verdict }[] {
			return this.filter === 'all' ? this.rows : this.rows.filter(row => row.v === this.filter);
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
		/**
		 * Con qué precio se decide. Si es el mismo producto, contra el más barato (es
		 * a quien hay que ganarle). Si son parecidos de otras marcas, contra el del
		 * medio: el más barato ahí suele ser una marca de menor calidad.
		 */
		basis(r: MlEstudio | undefined): MlEstudioEscenario | null {
			if (!r) return null;
			return r.via === 'similares' ? r.alMedio : r.alMin;
		},
		verdict(r: MlEstudio | undefined): Verdict {
			if (!r) return 'pendiente';
			if (!r.via || r.noCoincide || r.precioMin == null) return 'sin_datos';
			const pct = this.basis(r)?.gananciaPct;
			if (pct == null) return r.costo == null || r.costo <= 0 ? 'sin_costo' : 'sin_datos';
			if (pct <= 0) return 'no_conviene';
			return pct >= (this.target ?? 0) ? 'conviene' : 'justo';
		},
		/** Las dos columnas de precio: el más barato y el del medio. */
		priceCols(r: MlEstudio): { key: 'cheapest' | 'middle'; precio: number; e: MlEstudioEscenario | null }[] {
			const cols: { key: 'cheapest' | 'middle'; precio: number; e: MlEstudioEscenario | null }[] = [];
			if (r.precioMin != null) cols.push({ key: 'cheapest', precio: r.precioMin, e: r.alMin });
			if (r.precioMediana != null) cols.push({ key: 'middle', precio: r.precioMediana, e: r.alMedio });
			return cols;
		},
		verdictCls(v: Verdict): string {
			if (v === 'conviene') return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
			if (v === 'justo') return 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
			if (v === 'no_conviene') return 'bg-red-500/10 text-red-500';
			if (v === 'sin_costo') return 'bg-sky-500/10 text-sky-600 dark:text-sky-400';
			return 'bg-surface-500/10 text-surface-400';
		},
		gainCls(pct: number | null): string {
			if (pct == null) return 'text-surface-400';
			if (pct <= 0) return 'text-red-500';
			return pct >= (this.target ?? 0) ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400';
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
