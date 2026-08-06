<template>
	<div>
		<!-- Encabezado -->
		<div class="mb-6">
			<p class="text-xs font-semibold uppercase tracking-wide text-amber-500">{{ $t('admin.ml.preguntas.eyebrow') }}</p>
			<h1 class="text-2xl font-extrabold text-surface-900 dark:text-surface-0">{{ $t('admin.ml.preguntas.pageTitle') }}</h1>
			<p class="mt-1 text-sm text-surface-500">{{ $t('admin.ml.preguntas.pageSubtitle') }}</p>
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
			<!-- Barra: filtro + sincronizar -->
			<div class="mb-4 flex flex-wrap items-center justify-between gap-3">
				<div class="flex flex-wrap gap-1.5">
					<button
						v-for="f in filters"
						:key="f.key"
						class="rounded-full px-3 py-1.5 text-sm font-semibold transition-colors"
						:class="
							filter === f.key
								? 'bg-amber-500 text-white'
								: 'bg-surface-100 text-surface-600 hover:bg-surface-200 dark:bg-surface-800 dark:text-surface-300'
						"
						@click="setFilter(f.key)"
					>
						{{ $t(f.label) }}
					</button>
				</div>
				<Button
					:label="$t('admin.ml.preguntas.sync')"
					icon="pi pi-sync"
					size="small"
					outlined
					:loading="syncing"
					@click="sync"
				/>
			</div>

			<!-- Sin preguntas -->
			<div v-if="!questions.length" class="glass-card rounded-2xl p-8 text-center text-surface-500">
				<i class="pi pi-comments mb-3 block text-3xl text-surface-400" />
				<p class="mb-1">{{ $t('admin.ml.preguntas.empty') }}</p>
				<p class="text-xs">{{ $t('admin.ml.preguntas.emptyHint') }}</p>
			</div>

			<!-- Lista de preguntas -->
			<div v-else class="space-y-3">
				<div v-for="q in questions" :key="q.id" class="glass-card rounded-2xl p-4">
					<div class="mb-2 flex items-center justify-between gap-2">
						<span class="truncate text-sm font-semibold text-surface-900 dark:text-surface-0">
							{{ q.itemTitle || q.mlItemId }}
						</span>
						<span class="whitespace-nowrap text-xs text-surface-400">{{ formatDate(q.dateCreated) }}</span>
					</div>

					<!-- Pregunta -->
					<p class="mb-3 flex gap-2 text-surface-700 dark:text-surface-200">
						<i class="pi pi-question-circle mt-0.5 text-amber-500" />
						<span>{{ q.text }}</span>
					</p>

					<!-- Respuesta ya publicada -->
					<div
						v-if="q.status === 'ANSWERED'"
						class="flex gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"
					>
						<i class="pi pi-check-circle mt-0.5" />
						<span>{{ q.answerText }}</span>
					</div>

					<!-- Pregunta cerrada sin responder (no se puede responder) -->
					<div v-else-if="q.status !== 'UNANSWERED'" class="text-xs text-surface-400">
						{{ $t('admin.ml.preguntas.closed') }}
					</div>

					<!-- Responder -->
					<div v-else>
						<textarea
							v-model="drafts[q.id]"
							:placeholder="$t('admin.ml.preguntas.answerPlaceholder')"
							rows="2"
							class="w-full resize-y rounded-lg border border-surface-300 bg-surface-0 p-2 text-sm text-surface-900 focus:border-amber-500 focus:outline-none dark:border-surface-700 dark:bg-surface-900 dark:text-surface-0"
						/>
						<div class="mt-2 flex justify-end">
							<Button
								:label="$t('admin.ml.preguntas.answer')"
								icon="pi pi-send"
								size="small"
								:loading="answering === q.id"
								:disabled="!(drafts[q.id] && drafts[q.id].trim())"
								@click="submitAnswer(q)"
							/>
						</div>
					</div>
				</div>
			</div>
		</template>
	</div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import type { MlQuestionView, Rubro } from '@base-template/shared';
import { useCatalogStore } from '@/modules/admin/store/catalog';
import { useAdminContext } from '@/modules/admin/store/context';
import { apiErrorMessage } from '@/shared/utils/apiError';

type QuestionFilter = 'unanswered' | 'all';

export default defineComponent({
	name: 'PreguntasView',
	data() {
		return {
			catalog: useCatalogStore(),
			ctx: useAdminContext(),
			loading: false,
			syncing: false,
			mlConnected: false,
			questions: [] as MlQuestionView[],
			filter: 'unanswered' as QuestionFilter,
			drafts: {} as Record<string, string>,
			answering: null as string | null,
			filters: [
				{ key: 'unanswered' as QuestionFilter, label: 'admin.ml.preguntas.filterUnanswered' },
				{ key: 'all' as QuestionFilter, label: 'admin.ml.preguntas.filterAll' },
			],
		};
	},
	computed: {
		rubro(): Rubro | undefined {
			return this.catalog.rubros.find(r => r.id === this.ctx.currentRubroId);
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
		async reload() {
			if (!this.rubro) return;
			this.loading = true;
			try {
				const state = await this.catalog.fetchMlState(this.rubro.id);
				this.mlConnected = !!state.connection;
				this.questions = this.mlConnected
					? await this.catalog.fetchMlQuestions(this.rubro.id, this.filter === 'unanswered' ? 'UNANSWERED' : undefined)
					: [];
			} catch (e) {
				this.$toast.add({ severity: 'error', summary: apiErrorMessage(e, this.$t('admin.ml.preguntas.loadError')), life: 4000 });
			} finally {
				this.loading = false;
			}
		},
		setFilter(f: QuestionFilter) {
			if (this.filter === f) return;
			this.filter = f;
			void this.reload();
		},
		async sync() {
			if (!this.rubro) return;
			this.syncing = true;
			try {
				const res = await this.catalog.syncMlQuestions(this.rubro.id);
				this.$toast.add({ severity: 'success', summary: this.$t('admin.ml.preguntas.synced', { n: res.imported }), life: 4000 });
				await this.reload();
			} catch (e) {
				this.$toast.add({ severity: 'error', summary: apiErrorMessage(e, this.$t('admin.ml.preguntas.syncError')), life: 5000 });
			} finally {
				this.syncing = false;
			}
		},
		async submitAnswer(q: MlQuestionView) {
			if (!this.rubro) return;
			const text = (this.drafts[q.id] || '').trim();
			if (!text) return;
			this.answering = q.id;
			try {
				const updated = await this.catalog.answerMlQuestion(this.rubro.id, q.id, text);
				this.$toast.add({ severity: 'success', summary: this.$t('admin.ml.preguntas.answered'), life: 3000 });
				delete this.drafts[q.id];
				// Si el filtro es "sin responder", la pregunta ya no aplica → la sacamos.
				if (this.filter === 'unanswered') {
					this.questions = this.questions.filter(x => x.id !== q.id);
				} else {
					const i = this.questions.findIndex(x => x.id === q.id);
					if (i !== -1) this.questions.splice(i, 1, updated);
				}
			} catch (e) {
				this.$toast.add({ severity: 'error', summary: apiErrorMessage(e, this.$t('admin.ml.preguntas.answerError')), life: 5000 });
			} finally {
				this.answering = null;
			}
		},
		formatDate(iso: string | null): string {
			if (!iso) return '—';
			return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
		},
	},
});
</script>
