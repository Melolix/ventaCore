<template>
	<div class="mx-auto max-w-7xl">
		<!-- Encabezado -->
		<div class="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
			<div>
				<h1 class="text-3xl font-extrabold tracking-tight text-surface-900 dark:text-surface-0">
					{{ $t('admin.rubros.title') }}
				</h1>
				<p class="mt-2 max-w-2xl text-surface-600 dark:text-surface-300">
					{{ $t('admin.rubros.subtitle') }}
				</p>
			</div>
			<Button
				:label="$t('admin.rubros.exportReport')"
				icon="pi pi-download"
				outlined
				rounded
				disabled
				:title="$t('admin.soon')"
			/>
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
							<InputText v-model="form.imageUrl" class="w-full" placeholder="https://..." />
						</div>

						<div class="space-y-2">
							<label class="px-1 text-xs font-semibold uppercase tracking-wide text-surface-600 dark:text-surface-300">
								{{ $t('admin.rubros.fields.status') }}
							</label>
							<Select v-model="form.status" :options="statusOptions" option-label="label" option-value="value" class="w-full" />
						</div>

						<!-- Dropzone decorativo (sin subida por ahora) -->
						<div class="flex cursor-not-allowed flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-surface-300/60 bg-surface-100/40 p-6 text-center dark:border-surface-600/60 dark:bg-surface-800/20">
							<i class="pi pi-cloud-upload text-3xl text-surface-400" />
							<p class="text-sm text-surface-500">{{ $t('admin.rubros.assetsPlaceholder') }}</p>
							<span class="text-[10px] uppercase tracking-widest text-surface-400">{{ $t('admin.soon') }}</span>
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
							</div>
							<p class="line-clamp-1 text-sm text-surface-600 dark:text-surface-300">
								{{ rubro.descripcion || $t('admin.rubros.noDescription') }}
							</p>
							<div class="mt-3 flex items-center gap-6 text-xs text-surface-400">
								<span class="flex items-center gap-1.5"><i class="pi pi-users" /> — {{ $t('admin.rubros.reach') }}</span>
								<span class="flex items-center gap-1.5"><i class="pi pi-bolt" /> — CTR</span>
							</div>
						</div>

						<div class="flex flex-row gap-2 md:flex-col" @click.stop>
							<Button
								:label="$t('admin.rubros.publishInstagram')"
								icon="pi pi-instagram"
								size="small"
								disabled
								:title="$t('admin.soon')"
								class="flex-1 md:flex-none"
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
					<InputText v-model="edit.imageUrl" class="w-full" placeholder="https://..." />
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
	</div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { RubroStatus, type Rubro } from '@base-template/shared';
import { useCatalogStore } from '@/modules/admin/store/catalog';

export default defineComponent({
	name: 'RubrosView',
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
				status: RubroStatus.DRAFT as RubroStatus,
			},
			editVisible: false,
			editId: '',
			edit: {
				nombre: '',
				descripcion: '',
				imageUrl: '',
				status: RubroStatus.DRAFT as RubroStatus,
			},
		};
	},
	computed: {
		statusOptions(): { label: string; value: RubroStatus }[] {
			return [
				{ label: this.$t('admin.status.active'), value: RubroStatus.ACTIVE },
				{ label: this.$t('admin.status.draft'), value: RubroStatus.DRAFT },
			];
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
					status: this.form.status,
				});
				this.$toast.add({ severity: 'success', summary: this.$t('admin.rubros.created'), life: 3000 });
				this.form = { nombre: '', descripcion: '', imageUrl: '', status: RubroStatus.DRAFT };
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
	},
});
</script>
