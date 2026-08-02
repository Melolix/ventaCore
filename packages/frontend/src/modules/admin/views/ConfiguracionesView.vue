<template>
	<div class="mx-auto max-w-3xl">
		<!-- Encabezado -->
		<div class="mb-6">
			<p class="text-xs font-semibold uppercase tracking-wide text-primary">{{ $t('admin.config.eyebrow') }}</p>
			<h1 class="text-2xl font-extrabold text-surface-900 dark:text-surface-0">{{ $t('admin.config.title') }}</h1>
			<p class="mt-1 text-sm text-surface-500">{{ $t('admin.config.subtitle') }}</p>
		</div>

		<!-- Sin negocio elegido -->
		<div v-if="!rubro" class="glass-card rounded-2xl p-8 text-center text-surface-500">
			<i class="pi pi-arrow-up mb-3 block text-3xl text-surface-400" />
			{{ $t('admin.config.pickAbove') }}
		</div>

		<div v-else class="space-y-6">
			<!-- Contexto -->
			<div class="flex items-center gap-2 text-sm">
				<span class="text-surface-400">{{ $t('admin.config.configuring') }}</span>
				<span class="inline-flex items-center gap-1.5 font-semibold text-surface-800 dark:text-surface-100">
					<i class="pi pi-box text-surface-500" /> {{ rubro.nombre }}
				</span>
			</div>

			<!-- ── Mercado Libre ── -->
			<section class="glass-card rounded-2xl p-6">
				<div class="mb-4 flex items-center gap-3">
					<div class="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
						<i class="pi pi-shopping-cart text-xl" />
					</div>
					<div>
						<h3 class="font-semibold text-surface-900 dark:text-surface-0">{{ $t('admin.ml.title') }}</h3>
						<p class="text-xs text-surface-500">{{ $t('admin.config.mlHint') }}</p>
					</div>
				</div>

				<div v-if="mlLoading" class="py-6 text-center text-surface-500"><i class="pi pi-spin pi-spinner text-2xl" /></div>
				<div v-else class="flex flex-col gap-5">
					<!-- Paso 1: app propia del rubro (BYO) -->
					<div class="space-y-3">
						<label class="text-xs font-semibold uppercase tracking-wide text-surface-600 dark:text-surface-300">{{ $t('admin.ml.appTitle') }}</label>
						<template v-if="!mlState?.appConfigured || mlEditingApp">
							<InputText v-model="mlAppId" :placeholder="$t('admin.ml.appIdLabel')" class="w-full" />
							<InputText v-model="mlAppSecret" type="password" :placeholder="$t('admin.ml.appSecretLabel')" class="w-full" />
							<p class="text-xs text-surface-400">{{ $t('admin.ml.appHint') }}</p>
							<Button :label="$t('admin.ml.saveApp')" size="small" :loading="mlSavingApp" :disabled="!mlAppId || !mlAppSecret" @click="saveMlApp" />
						</template>
						<div v-else class="flex items-center justify-between text-sm text-surface-500">
							<span class="flex items-center gap-1.5"><i class="pi pi-check-circle text-green-500" /> App ID: {{ mlState.appId }}</span>
							<Button :label="$t('admin.ml.changeApp')" text size="small" @click="mlEditingApp = true" />
						</div>
					</div>

					<!-- Paso 2: OAuth -->
					<div v-if="mlState?.appConfigured && !mlEditingApp" class="flex flex-col gap-4 border-t border-surface-200 pt-4 dark:border-surface-700">
						<template v-if="!mlState.connection">
							<p class="text-sm text-surface-500">{{ $t('admin.ml.notConnected') }}</p>
							<Button :label="$t('admin.ml.connect')" icon="pi pi-shopping-cart" severity="warn" :loading="mlConnecting" class="self-start" @click="startMlConnect" />
						</template>
						<template v-else>
							<div class="flex items-center gap-2 text-sm text-surface-600 dark:text-surface-300">
								<i class="pi pi-check-circle text-green-500" />
								<span>{{ $t('admin.ml.connectedAs', { name: mlState.connection.mlNickname || '—' }) }}</span>
								<Tag v-if="mlState.connection.siteId" :value="mlState.connection.siteId" severity="secondary" />
							</div>
							<Button :label="$t('admin.ml.disconnect')" icon="pi pi-times" severity="danger" text size="small" class="self-start" @click="disconnectMl" />
						</template>
					</div>
				</div>
			</section>

			<!-- ── Redes (Meta) ── -->
			<section class="glass-card rounded-2xl p-6">
				<div class="mb-4 flex items-center gap-3">
					<div class="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
						<i class="pi pi-share-alt text-xl" />
					</div>
					<div>
						<h3 class="font-semibold text-surface-900 dark:text-surface-0">{{ $t('admin.meta.title') }}</h3>
						<p class="text-xs text-surface-500">{{ $t('admin.config.metaHint') }}</p>
					</div>
				</div>

				<div v-if="metaLoading" class="py-6 text-center text-surface-500"><i class="pi pi-spin pi-spinner text-2xl" /></div>
				<div v-else class="flex flex-col gap-5">
					<!-- Paso 1: app propia del rubro (BYO) -->
					<div class="space-y-3">
						<label class="text-xs font-semibold uppercase tracking-wide text-surface-600 dark:text-surface-300">{{ $t('admin.meta.appTitle') }}</label>
						<template v-if="!metaState?.appConfigured || editingApp">
							<InputText v-model="appId" :placeholder="$t('admin.meta.appIdLabel')" class="w-full" />
							<InputText v-model="appSecret" type="password" :placeholder="$t('admin.meta.appSecretLabel')" class="w-full" />
							<p class="text-xs text-surface-400">{{ $t('admin.meta.appHint') }}</p>
							<Button :label="$t('admin.meta.saveApp')" size="small" :loading="metaSavingApp" :disabled="!appId || !appSecret" @click="saveApp" />
						</template>
						<div v-else class="flex items-center justify-between text-sm text-surface-500">
							<span class="flex items-center gap-1.5"><i class="pi pi-check-circle text-green-500" /> App ID: {{ metaState.appId }}</span>
							<Button :label="$t('admin.meta.changeApp')" text size="small" @click="editingApp = true" />
						</div>
					</div>

					<!-- Paso 2: OAuth + destino -->
					<div v-if="metaState?.appConfigured && !editingApp" class="flex flex-col gap-4 border-t border-surface-200 pt-4 dark:border-surface-700">
						<template v-if="!metaState.connection">
							<p class="text-sm text-surface-500">{{ $t('admin.meta.notConnected') }}</p>
							<Button :label="$t('admin.meta.connect')" icon="pi pi-facebook" :loading="metaConnecting" class="self-start" @click="startMetaConnect" />
						</template>
						<template v-else>
							<div class="flex items-center gap-2 text-sm text-surface-600 dark:text-surface-300">
								<i class="pi pi-check-circle text-green-500" />
								<span>{{ $t('admin.meta.connectedAs', { name: metaState.connection.metaUserName || '—' }) }}</span>
							</div>
							<div v-if="metaState.connection.targets.length" class="space-y-2">
								<label class="text-xs font-semibold uppercase tracking-wide text-surface-600 dark:text-surface-300">{{ $t('admin.meta.chooseTarget') }}</label>
								<Select v-model="metaTargetId" :options="targetOptions" option-label="label" option-value="value" class="w-full" />
								<p class="text-xs text-surface-400">{{ $t('admin.meta.targetHint') }}</p>
								<Button :label="$t('admin.meta.saveTarget')" size="small" :loading="metaSavingTarget" :disabled="!metaTargetId" @click="saveMetaTarget" />
							</div>
							<p v-else class="rounded-lg bg-amber-50 p-3 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">{{ $t('admin.meta.noTargets') }}</p>
							<Button :label="$t('admin.meta.disconnect')" icon="pi pi-times" severity="danger" text size="small" class="self-start" @click="disconnectMeta" />
						</template>
					</div>
				</div>
			</section>
		</div>
	</div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import type { Rubro, MetaRubroState, MlRubroState } from '@base-template/shared';
import { useCatalogStore } from '@/modules/admin/store/catalog';
import { useAdminContext } from '@/modules/admin/store/context';

export default defineComponent({
	name: 'ConfiguracionesView',
	data() {
		return {
			catalog: useCatalogStore(),
			ctx: useAdminContext(),
			// Mercado Libre
			mlState: null as MlRubroState | null,
			mlLoading: false,
			mlConnecting: false,
			mlAppId: '',
			mlAppSecret: '',
			mlEditingApp: false,
			mlSavingApp: false,
			// Redes (Meta)
			metaState: null as MetaRubroState | null,
			metaLoading: false,
			metaConnecting: false,
			metaSavingTarget: false,
			metaTargetId: '',
			appId: '',
			appSecret: '',
			editingApp: false,
			metaSavingApp: false,
		};
	},
	computed: {
		/** Negocio activo, tomado del contexto persistido. */
		rubro(): Rubro | undefined {
			return this.catalog.rubros.find(r => r.id === this.ctx.currentRubroId);
		},
		/** Opciones del selector de destino: Página (+ IG si tiene). */
		targetOptions(): { label: string; value: string }[] {
			return (this.metaState?.connection?.targets ?? []).map(t => ({
				label: t.igUsername ? `${t.pageName} · @${t.igUsername}` : t.pageName,
				value: t.id,
			}));
		},
	},
	watch: {
		// Al cambiar de negocio arriba, recargamos las conexiones de ese rubro.
		'ctx.currentRubroId'() {
			void this.reload();
		},
	},
	async created() {
		if (!this.catalog.rubros.length) await this.catalog.fetchRubros().catch(() => undefined);
		// Si volvemos del OAuth, la query trae el rubro que se conectó: fijamos el contexto ahí.
		this.absorbReturnRubro();
		await this.reload();
		this.handleMlReturn();
		this.handleMetaReturn();
	},
	methods: {
		/** Si el retorno de OAuth trae rubroId, dejamos ese negocio como el activo. */
		absorbReturnRubro() {
			const q = this.$route.query;
			const rid = String(q.rubroId || '');
			if ((q.ml || q.meta) && rid && this.catalog.rubros.some(r => r.id === rid)) {
				this.ctx.setRubro(rid);
			}
		},
		async reload() {
			this.mlEditingApp = false;
			this.editingApp = false;
			await Promise.all([this.loadMl(), this.loadMeta()]);
		},

		// ── Mercado Libre ──
		async loadMl() {
			if (!this.rubro) {
				this.mlState = null;
				return;
			}
			this.mlLoading = true;
			try {
				this.mlState = await this.catalog.fetchMlState(this.rubro.id);
				this.mlAppId = this.mlState.appId ?? '';
			} catch {
				this.$toast.add({ severity: 'error', summary: this.$t('admin.errors.load'), life: 4000 });
			} finally {
				this.mlLoading = false;
			}
		},
		async saveMlApp() {
			if (!this.rubro || !this.mlAppId || !this.mlAppSecret) return;
			this.mlSavingApp = true;
			try {
				this.mlState = await this.catalog.saveMlApp(this.rubro.id, this.mlAppId.trim(), this.mlAppSecret.trim());
				this.mlAppSecret = '';
				this.mlEditingApp = false;
				this.$toast.add({ severity: 'success', summary: this.$t('admin.ml.appSaved'), life: 3000 });
			} catch {
				this.$toast.add({ severity: 'error', summary: this.$t('admin.errors.save'), life: 4000 });
			} finally {
				this.mlSavingApp = false;
			}
		},
		async startMlConnect() {
			if (!this.rubro) return;
			this.mlConnecting = true;
			try {
				const url = await this.catalog.connectMl(this.rubro.id);
				window.location.href = url; // sale del SPA hacia el consentimiento de ML
			} catch {
				this.$toast.add({ severity: 'error', summary: this.$t('admin.errors.save'), life: 4000 });
				this.mlConnecting = false;
			}
		},
		disconnectMl() {
			const rubro = this.rubro;
			if (!rubro) return;
			this.$confirm.require({
				message: this.$t('admin.ml.disconnectConfirm', { name: rubro.nombre }),
				header: this.$t('admin.ml.disconnect'),
				icon: 'pi pi-exclamation-triangle',
				rejectProps: { label: this.$t('common.cancel'), text: true },
				acceptProps: { label: this.$t('admin.ml.disconnect'), severity: 'danger' },
				accept: async () => {
					try {
						await this.catalog.disconnectMl(rubro.id);
						if (this.mlState) this.mlState.connection = null;
						this.$toast.add({ severity: 'success', summary: this.$t('admin.ml.disconnected'), life: 3000 });
					} catch {
						this.$toast.add({ severity: 'error', summary: this.$t('admin.errors.save'), life: 4000 });
					}
				},
			});
		},
		handleMlReturn() {
			const q = this.$route.query;
			if (q.ml === 'connected') {
				this.$toast.add({ severity: 'success', summary: this.$t('admin.ml.connectedToast'), life: 4000 });
				void this.$router.replace({ query: {} });
			} else if (q.ml === 'error') {
				this.$toast.add({ severity: 'error', summary: this.$t('admin.ml.errorToast', { reason: String(q.reason || '') }), life: 6000 });
				void this.$router.replace({ query: {} });
			}
		},

		// ── Redes (Meta) ──
		async loadMeta() {
			if (!this.rubro) {
				this.metaState = null;
				return;
			}
			this.metaLoading = true;
			try {
				this.metaState = await this.catalog.fetchMetaState(this.rubro.id);
				this.appId = this.metaState.appId ?? '';
				this.metaTargetId = this.rubro.metaTargetId ?? this.metaState.connection?.targets[0]?.id ?? '';
			} catch {
				this.$toast.add({ severity: 'error', summary: this.$t('admin.errors.load'), life: 4000 });
			} finally {
				this.metaLoading = false;
			}
		},
		async saveApp() {
			if (!this.rubro || !this.appId || !this.appSecret) return;
			this.metaSavingApp = true;
			try {
				this.metaState = await this.catalog.saveMetaApp(this.rubro.id, this.appId.trim(), this.appSecret.trim());
				this.appSecret = '';
				this.editingApp = false;
				this.$toast.add({ severity: 'success', summary: this.$t('admin.meta.appSaved'), life: 3000 });
			} catch {
				this.$toast.add({ severity: 'error', summary: this.$t('admin.errors.save'), life: 4000 });
			} finally {
				this.metaSavingApp = false;
			}
		},
		async startMetaConnect() {
			if (!this.rubro) return;
			this.metaConnecting = true;
			try {
				const url = await this.catalog.connectMeta(this.rubro.id);
				window.location.href = url; // sale del SPA hacia el consentimiento de Meta
			} catch {
				this.$toast.add({ severity: 'error', summary: this.$t('admin.errors.save'), life: 4000 });
				this.metaConnecting = false;
			}
		},
		async saveMetaTarget() {
			if (!this.rubro || !this.metaTargetId) return;
			this.metaSavingTarget = true;
			try {
				const conn = await this.catalog.setMetaTarget(this.rubro.id, this.metaTargetId);
				if (this.metaState) this.metaState.connection = conn;
				this.$toast.add({ severity: 'success', summary: this.$t('admin.meta.targetSaved'), life: 3000 });
			} catch {
				this.$toast.add({ severity: 'error', summary: this.$t('admin.errors.save'), life: 4000 });
			} finally {
				this.metaSavingTarget = false;
			}
		},
		disconnectMeta() {
			const rubro = this.rubro;
			if (!rubro) return;
			this.$confirm.require({
				message: this.$t('admin.meta.disconnectConfirm', { name: rubro.nombre }),
				header: this.$t('admin.meta.disconnect'),
				icon: 'pi pi-exclamation-triangle',
				rejectProps: { label: this.$t('common.cancel'), text: true },
				acceptProps: { label: this.$t('admin.meta.disconnect'), severity: 'danger' },
				accept: async () => {
					try {
						await this.catalog.disconnectMeta(rubro.id);
						if (this.metaState) this.metaState.connection = null;
						this.metaTargetId = '';
						this.$toast.add({ severity: 'success', summary: this.$t('admin.meta.disconnected'), life: 3000 });
					} catch {
						this.$toast.add({ severity: 'error', summary: this.$t('admin.errors.save'), life: 4000 });
					}
				},
			});
		},
		handleMetaReturn() {
			const q = this.$route.query;
			if (q.meta === 'connected') {
				this.$toast.add({ severity: 'success', summary: this.$t('admin.meta.connectedToast'), life: 4000 });
				void this.$router.replace({ query: {} });
			} else if (q.meta === 'error') {
				this.$toast.add({ severity: 'error', summary: this.$t('admin.meta.errorToast', { reason: String(q.reason || '') }), life: 6000 });
				void this.$router.replace({ query: {} });
			}
		},
	},
});
</script>
