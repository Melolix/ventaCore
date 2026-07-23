<template>
	<div class="mx-auto max-w-6xl">
		<!-- Encabezado -->
		<div class="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
			<div>
				<h1 class="text-3xl font-extrabold tracking-tight text-surface-900 dark:text-surface-0">
					{{ $t('superadmin.espacios.title') }}
				</h1>
				<p class="mt-2 max-w-2xl text-surface-600 dark:text-surface-300">
					{{ $t('superadmin.espacios.subtitle') }}
				</p>
			</div>
			<Button
				:label="$t('superadmin.espacios.new')"
				icon="pi pi-plus"
				class="primary-gradient border-0 font-semibold text-white"
				@click="openCreate"
			/>
		</div>

		<div v-if="loading" class="py-16 text-center text-surface-500">
			<i class="pi pi-spin pi-spinner text-3xl" />
		</div>

		<div v-else-if="!store.espacios.length" class="glass-card rounded-3xl p-12 text-center text-surface-500">
			{{ $t('superadmin.espacios.empty') }}
		</div>

		<div v-else class="grid grid-cols-1 gap-5 md:grid-cols-2">
			<div
				v-for="espacio in store.espacios"
				:key="espacio.id"
				class="glass-card flex flex-col gap-4 rounded-2xl p-6"
			>
				<div class="flex items-start gap-4">
					<div class="h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl bg-surface-100 dark:bg-surface-800">
						<img v-if="espacio.logoUrl" :src="espacio.logoUrl" class="h-full w-full object-cover" :alt="espacio.nombre" />
						<div v-else class="flex h-full w-full items-center justify-center text-surface-400">
							<i class="pi pi-building text-xl" />
						</div>
					</div>
					<div class="min-w-0 flex-1">
						<div class="flex items-center gap-2">
							<h3 class="truncate text-lg font-bold text-surface-900 dark:text-surface-0">{{ espacio.nombre }}</h3>
							<Tag
								:value="$t(espacio.active ? 'superadmin.espacios.active' : 'superadmin.espacios.suspended')"
								:severity="espacio.active ? 'success' : 'secondary'"
							/>
						</div>
						<a
							class="text-xs text-primary hover:underline"
							:href="previewUrl(espacio)"
							target="_blank"
							rel="noopener"
						>{{ previewHost(espacio) }} <i class="pi pi-external-link text-[10px]" /></a>
					</div>
				</div>

				<div class="flex items-center gap-4 text-sm text-surface-600 dark:text-surface-300">
					<span class="flex items-center gap-1.5"><i class="pi pi-user text-surface-400" /> {{ espacio.adminEmail || '—' }}</span>
					<span class="flex items-center gap-1.5"><i class="pi pi-tags text-surface-400" /> {{ $t('superadmin.espacios.rubros', { n: espacio.rubroCount ?? 0 }) }}</span>
				</div>

				<div class="mt-auto flex flex-wrap gap-2 border-t border-surface-200/50 pt-4 dark:border-surface-700/50">
					<Button :label="$t('common.edit')" icon="pi pi-pencil" severity="secondary" outlined size="small" @click="openEdit(espacio)" />
					<Button
						:label="$t(espacio.active ? 'superadmin.espacios.suspend' : 'superadmin.espacios.activate')"
						:icon="espacio.active ? 'pi pi-ban' : 'pi pi-check'"
						severity="secondary"
						text
						size="small"
						@click="toggleActive(espacio)"
					/>
					<Button :label="$t('common.delete')" icon="pi pi-trash" severity="danger" text size="small" class="ml-auto" @click="confirmDelete(espacio)" />
				</div>
			</div>
		</div>

		<!-- Dialog crear -->
		<Dialog v-model:visible="createVisible" modal :header="$t('superadmin.espacios.createTitle')" class="w-full max-w-lg">
			<form class="flex flex-col gap-4 pt-2" @submit.prevent="submitCreate">
				<div class="space-y-1">
					<label class="text-sm font-medium">{{ $t('superadmin.espacios.fields.name') }}</label>
					<InputText v-model="form.nombre" class="w-full" required />
				</div>
				<div class="space-y-1">
					<label class="text-sm font-medium">{{ $t('superadmin.espacios.fields.type') }}</label>
					<Select v-model="form.type" :options="typeOptions" option-label="label" option-value="value" class="w-full" />
					<p class="text-xs text-surface-400">{{ $t('superadmin.espacios.typeHint') }}</p>
				</div>
				<div class="space-y-1">
					<label class="text-sm font-medium">{{ $t('superadmin.espacios.fields.description') }}</label>
					<Textarea v-model="form.descripcion" class="w-full" rows="2" />
				</div>
				<div class="space-y-1">
					<label class="text-sm font-medium">{{ $t('superadmin.espacios.fields.logoUrl') }}</label>
					<div class="max-w-[160px]">
						<ImageUpload v-model="form.logoUrl" folder="espacios" :aspect-ratio="1" :min-width="200" />
					</div>
				</div>
				<div class="space-y-1">
					<label class="text-sm font-medium">{{ $t('superadmin.espacios.fields.domain') }}</label>
					<InputText v-model="form.domain" class="w-full" placeholder="mitienda.com" />
					<p class="text-xs text-surface-400">{{ $t('superadmin.espacios.domainHint') }}</p>
				</div>
				<div class="rounded-xl bg-surface-100/60 p-4 dark:bg-surface-800/40">
					<p class="mb-3 text-xs font-semibold uppercase tracking-wide text-surface-500">
						{{ $t('superadmin.espacios.adminSection') }}
					</p>
					<div class="flex flex-col gap-3">
						<div class="space-y-1">
							<label class="text-sm font-medium">{{ $t('common.email') }}</label>
							<InputText v-model="form.adminEmail" type="email" class="w-full" autocomplete="off" required />
						</div>
						<div class="space-y-1">
							<label class="text-sm font-medium">{{ $t('common.password') }}</label>
							<Password v-model="form.adminPassword" input-class="w-full" class="w-full" :feedback="false" toggle-mask fluid autocomplete="new-password" />
						</div>
					</div>
				</div>
				<Message v-if="error" severity="error" :closable="false">{{ error }}</Message>
			</form>
			<template #footer>
				<Button :label="$t('common.cancel')" text @click="createVisible = false" />
				<Button :label="$t('superadmin.espacios.create')" :loading="saving" @click="submitCreate" />
			</template>
		</Dialog>

		<!-- Dialog editar -->
		<Dialog v-model:visible="editVisible" modal :header="$t('superadmin.espacios.editTitle')" class="w-full max-w-md">
			<div class="flex flex-col gap-4 pt-2">
				<div class="space-y-1">
					<label class="text-sm font-medium">{{ $t('superadmin.espacios.fields.name') }}</label>
					<InputText v-model="edit.nombre" class="w-full" />
				</div>
				<div class="space-y-1">
					<label class="text-sm font-medium">{{ $t('superadmin.espacios.fields.type') }}</label>
					<Select v-model="edit.type" :options="typeOptions" option-label="label" option-value="value" class="w-full" />
				</div>
				<div class="space-y-1">
					<label class="text-sm font-medium">{{ $t('superadmin.espacios.fields.description') }}</label>
					<Textarea v-model="edit.descripcion" class="w-full" rows="2" />
				</div>
				<div class="space-y-1">
					<label class="text-sm font-medium">{{ $t('superadmin.espacios.fields.logoUrl') }}</label>
					<div class="max-w-[160px]">
						<ImageUpload v-model="edit.logoUrl" folder="espacios" :aspect-ratio="1" :min-width="200" />
					</div>
				</div>
				<div class="space-y-1">
					<label class="text-sm font-medium">{{ $t('superadmin.espacios.fields.domain') }}</label>
					<InputText v-model="edit.domain" class="w-full" placeholder="mitienda.com" />
				</div>
			</div>
			<template #footer>
				<Button :label="$t('common.cancel')" text @click="editVisible = false" />
				<Button :label="$t('superadmin.espacios.saveChanges')" :loading="savingEdit" @click="submitEdit" />
			</template>
		</Dialog>
	</div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { ALL_ESPACIO_TYPES, EspacioType, type Espacio } from '@base-template/shared';
import { useSpacesStore } from '@/modules/superadmin/store/spaces';
import { vitrinaHost, vitrinaUrl } from '@/shared/utils/site';
import { apiErrorMessage } from '@/shared/utils/apiError';
import ImageUpload from '@/shared/components/ImageUpload.vue';

export default defineComponent({
	name: 'EspaciosView',
	components: { ImageUpload },
	data() {
		return {
			store: useSpacesStore(),
			loading: false,
			saving: false,
			savingEdit: false,
			error: '',
			createVisible: false,
			form: {
				nombre: '',
				type: EspacioType.CATALOG as EspacioType,
				descripcion: '',
				logoUrl: '',
				domain: '',
				adminEmail: '',
				adminPassword: '',
			},
			editVisible: false,
			editId: '',
			edit: { nombre: '', type: EspacioType.CATALOG as EspacioType, descripcion: '', logoUrl: '', domain: '' },
		};
	},
	computed: {
		typeOptions(): { label: string; value: EspacioType }[] {
			return ALL_ESPACIO_TYPES.map(value => ({ label: this.$t(`superadmin.espacios.types.${value}`), value }));
		},
	},
	async created() {
		this.loading = true;
		try {
			await this.store.fetchEspacios();
		} catch {
			this.$toast.add({ severity: 'error', summary: this.$t('superadmin.espacios.errorLoad'), life: 4000 });
		} finally {
			this.loading = false;
		}
	},
	methods: {
		/** Host visible del negocio: su dominio propio o {slug}.<base>. */
		previewHost(espacio: Espacio): string {
			return vitrinaHost(espacio);
		},
		/** URL para abrir la vitrina del negocio. */
		previewUrl(espacio: Espacio): string {
			return vitrinaUrl(espacio);
		},
		openCreate() {
			this.form = {
				nombre: '',
				type: EspacioType.CATALOG,
				descripcion: '',
				logoUrl: '',
				domain: '',
				adminEmail: '',
				adminPassword: '',
			};
			this.error = '';
			this.createVisible = true;
		},
		async submitCreate() {
			if (!this.form.nombre.trim() || !this.form.adminEmail.trim() || this.form.adminPassword.length < 6) {
				this.error = this.$t('superadmin.espacios.errorForm');
				return;
			}
			this.saving = true;
			this.error = '';
			try {
				await this.store.createEspacio({
					nombre: this.form.nombre.trim(),
					type: this.form.type,
					descripcion: this.form.descripcion.trim() || undefined,
					logoUrl: this.form.logoUrl.trim() || undefined,
					domain: this.form.domain.trim() || undefined,
					adminEmail: this.form.adminEmail.trim(),
					adminPassword: this.form.adminPassword,
				});
				this.$toast.add({ severity: 'success', summary: this.$t('superadmin.espacios.created'), life: 3000 });
				this.createVisible = false;
			} catch (e: unknown) {
				this.error = apiErrorMessage(e, this.$t('superadmin.espacios.errorSave'));
			} finally {
				this.saving = false;
			}
		},
		openEdit(espacio: Espacio) {
			this.editId = espacio.id;
			this.edit = {
				nombre: espacio.nombre,
				type: espacio.type,
				descripcion: espacio.descripcion ?? '',
				logoUrl: espacio.logoUrl ?? '',
				domain: espacio.domain ?? '',
			};
			this.editVisible = true;
		},
		async submitEdit() {
			this.savingEdit = true;
			try {
				await this.store.updateEspacio(this.editId, {
					nombre: this.edit.nombre.trim(),
					type: this.edit.type,
					descripcion: this.edit.descripcion.trim() || undefined,
					logoUrl: this.edit.logoUrl.trim() || undefined,
					domain: this.edit.domain.trim() || undefined,
				});
				this.$toast.add({ severity: 'success', summary: this.$t('superadmin.espacios.updated'), life: 3000 });
				this.editVisible = false;
			} catch (e: unknown) {
				this.$toast.add({ severity: 'error', summary: apiErrorMessage(e, this.$t('superadmin.espacios.errorSave')), life: 5000 });
			} finally {
				this.savingEdit = false;
			}
		},
		async toggleActive(espacio: Espacio) {
			const activando = !espacio.active;
			try {
				await this.store.updateEspacio(espacio.id, { active: activando });
				// Refrescamos del server para que el estado (y metadatos) se vea al instante, sin F5.
				await this.store.fetchEspacios();
				this.$toast.add({
					severity: 'success',
					summary: this.$t(activando ? 'superadmin.espacios.activatedToast' : 'superadmin.espacios.suspendedToast'),
					life: 3000,
				});
			} catch (e: unknown) {
				this.$toast.add({ severity: 'error', summary: apiErrorMessage(e, this.$t('superadmin.espacios.errorSave')), life: 5000 });
			}
		},
		confirmDelete(espacio: Espacio) {
			this.$confirm.require({
				message: this.$t('superadmin.espacios.deleteConfirm', { name: espacio.nombre }),
				header: this.$t('superadmin.espacios.deleteTitle'),
				icon: 'pi pi-exclamation-triangle',
				rejectProps: { label: this.$t('common.cancel'), text: true },
				acceptProps: { label: this.$t('common.delete'), severity: 'danger' },
				accept: async () => {
					try {
						await this.store.deleteEspacio(espacio.id);
						this.$toast.add({ severity: 'success', summary: this.$t('superadmin.espacios.deleted'), life: 3000 });
					} catch (e: unknown) {
						this.$toast.add({ severity: 'error', summary: apiErrorMessage(e, this.$t('superadmin.espacios.errorDelete')), life: 5000 });
					}
				},
			});
		},
	},
});
</script>
