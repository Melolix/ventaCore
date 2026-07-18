<template>
	<div class="mx-auto max-w-7xl">
		<!-- Encabezado -->
		<div class="mb-8">
			<h1 class="text-3xl font-extrabold tracking-tight text-surface-900 dark:text-surface-0">
				{{ $t('admin.rubros.title') }}
			</h1>
			<p class="mt-2 max-w-2xl text-surface-600 dark:text-surface-300">
				{{ $t('admin.rubros.subtitle') }}
			</p>
		</div>

		<div class="grid grid-cols-1 gap-8 lg:grid-cols-12">
			<!-- Crear nuevo rubro -->
			<section class="flex flex-col gap-6 lg:col-span-5">
				<div class="glass-card rounded-3xl p-8 shadow-sm">
					<div class="mb-8 flex items-center gap-3">
						<div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
							<i class="pi pi-plus-circle text-2xl" />
						</div>
						<div>
							<h3 class="text-xl font-semibold text-surface-900 dark:text-surface-0">
								{{ $t('admin.rubros.createTitle') }}
							</h3>
							<p class="text-xs text-surface-500">{{ $t('admin.rubros.createSubtitle') }}</p>
						</div>
					</div>

					<form class="space-y-6" @submit.prevent="submitCreate">
						<div class="space-y-2">
							<label class="px-1 text-xs font-semibold uppercase tracking-wide text-surface-600 dark:text-surface-300">
								{{ $t('admin.rubros.fields.name') }}
							</label>
							<InputText v-model="form.nombre" class="w-full" :placeholder="$t('admin.rubros.fields.namePlaceholder')" required />
						</div>

						<div class="space-y-2">
							<label class="px-1 text-xs font-semibold uppercase tracking-wide text-surface-600 dark:text-surface-300">
								{{ $t('admin.rubros.fields.description') }}
							</label>
							<Textarea v-model="form.descripcion" class="w-full" rows="4" :placeholder="$t('admin.rubros.fields.descriptionPlaceholder')" />
						</div>

						<div class="space-y-2">
							<label class="px-1 text-xs font-semibold uppercase tracking-wide text-surface-600 dark:text-surface-300">
								{{ $t('admin.rubros.fields.imageUrl') }}
							</label>
							<ImageUpload
								v-model="form.imageUrl"
								folder="rubros"
								:aspect-ratio="3"
								:min-width="900"
								:hint="$t('admin.rubros.fields.imageHint')"
							/>
						</div>

						<div class="space-y-2">
							<label class="px-1 text-xs font-semibold uppercase tracking-wide text-surface-600 dark:text-surface-300">
								{{ $t('admin.rubros.fields.logoUrl') }}
							</label>
							<div class="max-w-[160px]">
								<ImageUpload v-model="form.logoUrl" folder="rubros" :aspect-ratio="1" :min-width="200" />
							</div>
							<p class="px-1 text-xs text-surface-400">{{ $t('admin.rubros.fields.logoHint') }}</p>
						</div>

						<div class="space-y-2">
							<label class="flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-surface-600 dark:text-surface-300">
								<i class="pi pi-instagram" /> {{ $t('admin.rubros.fields.instagram') }}
							</label>
							<InputText v-model="form.instagramUrl" class="w-full" placeholder="https://instagram.com/el.negocio" />
							<p class="px-1 text-xs text-surface-400">{{ $t('admin.rubros.fields.instagramHint') }}</p>
						</div>

						<div class="space-y-2">
							<label class="px-1 text-xs font-semibold uppercase tracking-wide text-surface-600 dark:text-surface-300">
								{{ $t('admin.rubros.fields.status') }}
							</label>
							<Select v-model="form.status" :options="statusOptions" option-label="label" option-value="value" class="w-full" />
						</div>

						<Button
							type="submit"
							:label="$t('admin.rubros.save')"
							:loading="saving"
							class="primary-gradient w-full border-0 py-3 font-semibold text-white"
						/>
					</form>
				</div>
			</section>

			<!-- Rubros existentes -->
			<section class="space-y-6 lg:col-span-7">
				<div class="flex items-center justify-between">
					<h3 class="text-xl font-semibold text-surface-900 dark:text-surface-0">
						{{ $t('admin.rubros.existingTitle') }}
					</h3>
					<div class="flex gap-2">
						<span class="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
							{{ $t('admin.rubros.activeCount', { n: catalog.activos }) }}
						</span>
						<span class="rounded-full bg-surface-200/70 px-3 py-1 text-xs font-semibold text-surface-500 dark:bg-surface-700/70">
							{{ $t('admin.rubros.draftCount', { n: catalog.borradores }) }}
						</span>
					</div>
				</div>

				<div v-if="loading" class="py-12 text-center text-surface-500">
					<i class="pi pi-spin pi-spinner text-2xl" />
				</div>

				<div v-else-if="!catalog.rubros.length" class="glass-card rounded-2xl p-10 text-center text-surface-500">
					{{ $t('admin.rubros.empty') }}
				</div>

				<div v-else class="space-y-4">
					<div
						v-for="rubro in catalog.rubros"
						:key="rubro.id"
						class="glass-card group flex cursor-pointer flex-col gap-6 rounded-2xl border-l-4 p-6 transition-shadow hover:shadow-md md:flex-row md:items-center"
						:class="rubro.status === 'active' ? 'border-l-primary' : 'border-l-surface-300'"
						@click="goToProductos(rubro.id)"
					>
						<div class="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-surface-100 dark:bg-surface-800">
							<img v-if="rubro.imageUrl" :src="rubro.imageUrl" class="h-full w-full object-cover" :alt="rubro.nombre" />
							<div v-else class="flex h-full w-full items-center justify-center text-surface-400">
								<i class="pi pi-box text-2xl" />
							</div>
						</div>

						<div class="flex-1">
							<div class="mb-1 flex items-center gap-2">
								<h4 class="text-lg font-bold text-surface-900 dark:text-surface-0">{{ rubro.nombre }}</h4>
								<Tag
									:value="$t(`admin.status.${rubro.status}`)"
									:severity="rubro.status === 'active' ? 'success' : 'secondary'"
									class="uppercase"
								/>
								<Tag
									v-if="rubro.metaTargetId"
									:value="$t('admin.meta.ready')"
									severity="info"
									icon="pi pi-send"
									class="uppercase"
								/>
							</div>
							<p class="line-clamp-1 text-sm text-surface-600 dark:text-surface-300">
								{{ rubro.descripcion || $t('admin.rubros.noDescription') }}
							</p>
						</div>

						<div class="flex flex-row gap-2 md:flex-col" @click.stop>
							<Button
								:label="$t('admin.meta.button')"
								icon="pi pi-share-alt"
								size="small"
								class="flex-1 md:flex-none"
								@click="openMeta(rubro)"
							/>
							<div class="flex gap-2">
								<Button icon="pi pi-pencil" severity="secondary" outlined size="small" @click="openEdit(rubro)" />
								<Button icon="pi pi-trash" severity="danger" outlined size="small" @click="confirmDelete(rubro)" />
							</div>
						</div>
					</div>
				</div>
			</section>
		</div>

		<!-- Dialog de edición -->
		<Dialog v-model:visible="editVisible" modal :header="$t('admin.rubros.editTitle')" class="w-full max-w-md">
			<div class="flex flex-col gap-4 pt-2">
				<div class="space-y-1">
					<label class="text-sm font-medium">{{ $t('admin.rubros.fields.name') }}</label>
					<InputText v-model="edit.nombre" class="w-full" />
				</div>
				<div class="space-y-1">
					<label class="text-sm font-medium">{{ $t('admin.rubros.fields.description') }}</label>
					<Textarea v-model="edit.descripcion" class="w-full" rows="3" />
				</div>
				<div class="space-y-1">
					<label class="text-sm font-medium">{{ $t('admin.rubros.fields.imageUrl') }}</label>
					<ImageUpload v-model="edit.imageUrl" folder="rubros" :aspect-ratio="3" :min-width="900" />
				</div>
				<div class="space-y-1">
					<label class="text-sm font-medium">{{ $t('admin.rubros.fields.logoUrl') }}</label>
					<div class="max-w-[160px]">
						<ImageUpload v-model="edit.logoUrl" folder="rubros" :aspect-ratio="1" :min-width="200" />
					</div>
				</div>
				<div class="space-y-1">
					<label class="flex items-center gap-1.5 text-sm font-medium"><i class="pi pi-instagram" /> {{ $t('admin.rubros.fields.instagram') }}</label>
					<InputText v-model="edit.instagramUrl" class="w-full" placeholder="https://instagram.com/el.negocio" />
				</div>
				<div class="space-y-1">
					<label class="text-sm font-medium">{{ $t('admin.rubros.fields.status') }}</label>
					<Select v-model="edit.status" :options="statusOptions" option-label="label" option-value="value" class="w-full" />
				</div>
			</div>
			<template #footer>
				<Button :label="$t('common.cancel')" text @click="editVisible = false" />
				<Button :label="$t('admin.rubros.saveChanges')" :loading="savingEdit" @click="submitEdit" />
			</template>
		</Dialog>

		<!-- Dialog de Redes (Meta): conectar la cuenta y elegir dónde publica el rubro -->
		<Dialog v-model:visible="metaVisible" modal :header="$t('admin.meta.title')" class="w-full max-w-md">
			<div v-if="metaLoading" class="py-8 text-center text-surface-500">
				<i class="pi pi-spin pi-spinner text-2xl" />
			</div>
			<div v-else class="flex flex-col gap-5 pt-2">
				<p class="text-sm font-semibold text-surface-800 dark:text-surface-100">{{ metaRubro?.nombre }}</p>

				<!-- Paso 1: la app de Meta propia del rubro (BYO) -->
				<div class="space-y-3">
					<label class="text-xs font-semibold uppercase tracking-wide text-surface-600 dark:text-surface-300">
						{{ $t('admin.meta.appTitle') }}
					</label>
					<template v-if="!metaState?.appConfigured || editingApp">
						<InputText v-model="appId" :placeholder="$t('admin.meta.appIdLabel')" class="w-full" />
						<InputText
							v-model="appSecret"
							type="password"
							:placeholder="$t('admin.meta.appSecretLabel')"
							class="w-full"
						/>
						<p class="text-xs text-surface-400">{{ $t('admin.meta.appHint') }}</p>
						<Button
							:label="$t('admin.meta.saveApp')"
							size="small"
							:loading="metaSavingApp"
							:disabled="!appId || !appSecret"
							@click="saveApp"
						/>
					</template>
					<div v-else class="flex items-center justify-between text-sm text-surface-500">
						<span class="flex items-center gap-1.5">
							<i class="pi pi-check-circle text-green-500" /> App ID: {{ metaState.appId }}
						</span>
						<Button :label="$t('admin.meta.changeApp')" text size="small" @click="editingApp = true" />
					</div>
				</div>

				<!-- Paso 2: conexión OAuth (solo con la app ya configurada) -->
				<div
					v-if="metaState?.appConfigured && !editingApp"
					class="flex flex-col gap-5 border-t border-surface-200 pt-4 dark:border-surface-700"
				>
					<!-- Sin conexión -->
					<template v-if="!metaState.connection">
						<p class="text-sm text-surface-500">{{ $t('admin.meta.notConnected') }}</p>
						<Button
							:label="$t('admin.meta.connect')"
							icon="pi pi-facebook"
							:loading="metaConnecting"
							class="w-full"
							@click="startMetaConnect"
						/>
					</template>

					<!-- Conectado -->
					<template v-else>
						<div class="flex items-center gap-2 text-sm text-surface-600 dark:text-surface-300">
							<i class="pi pi-check-circle text-green-500" />
							<span>{{ $t('admin.meta.connectedAs', { name: metaState.connection.metaUserName || '—' }) }}</span>
						</div>

						<div v-if="metaState.connection.targets.length" class="space-y-2">
							<label class="text-xs font-semibold uppercase tracking-wide text-surface-600 dark:text-surface-300">
								{{ $t('admin.meta.chooseTarget') }}
							</label>
							<Select
								v-model="metaTargetId"
								:options="targetOptions"
								option-label="label"
								option-value="value"
								class="w-full"
							/>
							<p class="text-xs text-surface-400">{{ $t('admin.meta.targetHint') }}</p>
							<Button
								:label="$t('admin.meta.saveTarget')"
								size="small"
								:loading="metaSavingTarget"
								:disabled="!metaTargetId"
								@click="saveMetaTarget"
							/>
						</div>
						<p
							v-else
							class="rounded-lg bg-amber-50 p-3 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
						>
							{{ $t('admin.meta.noTargets') }}
						</p>

						<Button
							:label="$t('admin.meta.disconnect')"
							icon="pi pi-times"
							severity="danger"
							text
							size="small"
							class="self-start"
							@click="disconnectMeta"
						/>
					</template>
				</div>
			</div>
		</Dialog>
	</div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { RubroStatus, type Rubro, type MetaRubroState } from '@base-template/shared';
import { useCatalogStore } from '@/modules/admin/store/catalog';
import ImageUpload from '@/shared/components/ImageUpload.vue';

export default defineComponent({
	name: 'RubrosView',
	components: { ImageUpload },
	data() {
		return {
			catalog: useCatalogStore(),
			loading: false,
			saving: false,
			savingEdit: false,
			form: {
				nombre: '',
				descripcion: '',
				imageUrl: '',
				logoUrl: '',
				instagramUrl: '',
				status: RubroStatus.DRAFT as RubroStatus,
			},
			editVisible: false,
			editId: '',
			edit: {
				nombre: '',
				descripcion: '',
				imageUrl: '',
				logoUrl: '',
				instagramUrl: '',
				status: RubroStatus.DRAFT as RubroStatus,
			},
			// Redes (Meta)
			metaVisible: false,
			metaRubro: null as Rubro | null,
			metaState: null as MetaRubroState | null,
			metaLoading: false,
			metaConnecting: false,
			metaSavingTarget: false,
			metaTargetId: '',
			// App propia del rubro (BYO)
			appId: '',
			appSecret: '',
			editingApp: false,
			metaSavingApp: false,
		};
	},
	computed: {
		statusOptions(): { label: string; value: RubroStatus }[] {
			return [
				{ label: this.$t('admin.status.active'), value: RubroStatus.ACTIVE },
				{ label: this.$t('admin.status.draft'), value: RubroStatus.DRAFT },
			];
		},
		/** Opciones del selector de destino: Página (+ IG si tiene). */
		targetOptions(): { label: string; value: string }[] {
			return (this.metaState?.connection?.targets ?? []).map(t => ({
				label: t.igUsername ? `${t.pageName} · @${t.igUsername}` : t.pageName,
				value: t.id,
			}));
		},
	},
	async created() {
		this.loading = true;
		try {
			await this.catalog.fetchRubros();
		} catch {
			this.$toast.add({ severity: 'error', summary: this.$t('admin.errors.load'), life: 4000 });
		} finally {
			this.loading = false;
		}
		this.handleMetaReturn();
	},
	methods: {
		async submitCreate() {
			if (!this.form.nombre.trim()) return;
			this.saving = true;
			try {
				await this.catalog.createRubro({
					nombre: this.form.nombre.trim(),
					descripcion: this.form.descripcion.trim() || undefined,
					imageUrl: this.form.imageUrl.trim() || undefined,
					logoUrl: this.form.logoUrl.trim() || undefined,
					instagramUrl: this.form.instagramUrl.trim() || undefined,
					status: this.form.status,
				});
				this.$toast.add({ severity: 'success', summary: this.$t('admin.rubros.created'), life: 3000 });
				this.form = { nombre: '', descripcion: '', imageUrl: '', logoUrl: '', instagramUrl: '', status: RubroStatus.DRAFT };
			} catch {
				this.$toast.add({ severity: 'error', summary: this.$t('admin.errors.save'), life: 4000 });
			} finally {
				this.saving = false;
			}
		},
		openEdit(rubro: Rubro) {
			this.editId = rubro.id;
			this.edit = {
				nombre: rubro.nombre,
				descripcion: rubro.descripcion ?? '',
				imageUrl: rubro.imageUrl ?? '',
				logoUrl: rubro.logoUrl ?? '',
				instagramUrl: rubro.instagramUrl ?? '',
				status: rubro.status,
			};
			this.editVisible = true;
		},
		async submitEdit() {
			this.savingEdit = true;
			try {
				await this.catalog.updateRubro(this.editId, {
					nombre: this.edit.nombre.trim(),
					descripcion: this.edit.descripcion.trim() || undefined,
					imageUrl: this.edit.imageUrl.trim() || undefined,
					logoUrl: this.edit.logoUrl.trim() || undefined,
					instagramUrl: this.edit.instagramUrl.trim(),
					status: this.edit.status,
				});
				this.$toast.add({ severity: 'success', summary: this.$t('admin.rubros.updated'), life: 3000 });
				this.editVisible = false;
			} catch {
				this.$toast.add({ severity: 'error', summary: this.$t('admin.errors.save'), life: 4000 });
			} finally {
				this.savingEdit = false;
			}
		},
		confirmDelete(rubro: Rubro) {
			this.$confirm.require({
				message: this.$t('admin.rubros.deleteConfirm', { name: rubro.nombre }),
				header: this.$t('admin.rubros.deleteTitle'),
				icon: 'pi pi-exclamation-triangle',
				rejectProps: { label: this.$t('common.cancel'), text: true },
				acceptProps: { label: this.$t('common.delete'), severity: 'danger' },
				accept: async () => {
					try {
						await this.catalog.deleteRubro(rubro.id);
						this.$toast.add({ severity: 'success', summary: this.$t('admin.rubros.deleted'), life: 3000 });
					} catch {
						this.$toast.add({ severity: 'error', summary: this.$t('admin.errors.delete'), life: 4000 });
					}
				},
			});
		},
		goToProductos(id: string) {
			this.$router.push({ name: 'admin-rubro-productos', params: { id } });
		},

		// ── Redes (Meta) ──
		async openMeta(rubro: Rubro) {
			this.metaRubro = rubro;
			this.metaVisible = true;
			this.metaState = null;
			this.editingApp = false;
			this.appId = '';
			this.appSecret = '';
			await this.loadMeta();
		},
		async loadMeta() {
			if (!this.metaRubro) return;
			this.metaLoading = true;
			try {
				this.metaState = await this.catalog.fetchMetaState(this.metaRubro.id);
				this.appId = this.metaState.appId ?? '';
				this.metaTargetId = this.metaRubro.metaTargetId ?? this.metaState.connection?.targets[0]?.id ?? '';
			} catch {
				this.$toast.add({ severity: 'error', summary: this.$t('admin.errors.load'), life: 4000 });
			} finally {
				this.metaLoading = false;
			}
		},
		async saveApp() {
			if (!this.metaRubro || !this.appId || !this.appSecret) return;
			this.metaSavingApp = true;
			try {
				this.metaState = await this.catalog.saveMetaApp(this.metaRubro.id, this.appId.trim(), this.appSecret.trim());
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
			if (!this.metaRubro) return;
			this.metaConnecting = true;
			try {
				const url = await this.catalog.connectMeta(this.metaRubro.id);
				window.location.href = url; // sale del SPA hacia el consentimiento de Meta
			} catch {
				this.$toast.add({ severity: 'error', summary: this.$t('admin.errors.save'), life: 4000 });
				this.metaConnecting = false;
			}
		},
		async saveMetaTarget() {
			if (!this.metaRubro || !this.metaTargetId) return;
			this.metaSavingTarget = true;
			try {
				const conn = await this.catalog.setMetaTarget(this.metaRubro.id, this.metaTargetId);
				if (this.metaState) this.metaState.connection = conn;
				this.$toast.add({ severity: 'success', summary: this.$t('admin.meta.targetSaved'), life: 3000 });
			} catch {
				this.$toast.add({ severity: 'error', summary: this.$t('admin.errors.save'), life: 4000 });
			} finally {
				this.metaSavingTarget = false;
			}
		},
		disconnectMeta() {
			const rubro = this.metaRubro;
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
		/** Procesa el retorno del OAuth de Meta (query ?meta=connected|error). */
		handleMetaReturn() {
			const q = this.$route.query;
			if (q.meta === 'connected') {
				this.$toast.add({ severity: 'success', summary: this.$t('admin.meta.connectedToast'), life: 4000 });
				const rubro = this.catalog.rubroById(String(q.rubroId || ''));
				if (rubro) void this.openMeta(rubro);
				void this.$router.replace({ query: {} });
			} else if (q.meta === 'error') {
				this.$toast.add({
					severity: 'error',
					summary: this.$t('admin.meta.errorToast', { reason: String(q.reason || '') }),
					life: 6000,
				});
				void this.$router.replace({ query: {} });
			}
		},
	},
});
</script>
