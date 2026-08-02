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

						<template v-if="isApps">
							<div class="space-y-2">
								<label class="flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-surface-600 dark:text-surface-300">
									<i class="pi pi-th-large" /> {{ $t('admin.rubros.fields.platforms') }}
								</label>
								<MultiSelect
									v-model="form.platforms"
									:options="platformOptions"
									option-label="label"
									option-value="value"
									display="chip"
									:placeholder="$t('admin.rubros.fields.platformsPlaceholder')"
									class="w-full"
								/>
								<p class="px-1 text-xs text-surface-400">{{ $t('admin.rubros.fields.platformsHint') }}</p>
							</div>
							<div v-if="form.platforms.includes('android')" class="space-y-2">
								<label class="flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-surface-600 dark:text-surface-300">
									<i class="pi pi-android" /> {{ $t('admin.rubros.fields.androidUrl') }}
								</label>
								<ApkUpload
									v-model="form.androidUrl"
									folder="apks"
									:placeholder="$t('admin.rubros.fields.androidPlaceholder')"
								/>
								<p class="px-1 text-xs text-surface-400">{{ $t('admin.rubros.fields.androidHint') }}</p>
							</div>
							<div v-if="form.platforms.includes('ios')" class="space-y-2">
								<label class="flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-surface-600 dark:text-surface-300">
									<i class="pi pi-apple" /> {{ $t('admin.rubros.fields.iosUrl') }}
								</label>
								<InputText v-model="form.iosUrl" class="w-full" placeholder="https://apps.apple.com/app/id..." />
							</div>
							<div v-if="form.platforms.includes('web') || form.platforms.includes('desktop')" class="space-y-2">
								<label class="flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-surface-600 dark:text-surface-300">
									<i class="pi pi-globe" /> {{ $t('admin.rubros.fields.webUrl') }}
								</label>
								<InputText v-model="form.webUrl" class="w-full" placeholder="https://app.miempresa.com" />
								<p class="px-1 text-xs text-surface-400">{{ $t('admin.rubros.fields.linksHint') }}</p>
							</div>
						</template>

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
							<div class="mb-1 flex flex-wrap items-center gap-2">
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
							<div class="mt-2.5 flex flex-wrap gap-1.5">
								<span :class="channelPillClass(!!rubro.metaTargetId)">
									<i :class="rubro.metaTargetId ? 'pi pi-check-circle' : 'pi pi-circle'" />
									{{ $t('admin.rubros.channelMeta') }}
								</span>
								<span :class="channelPillClass(!!mlStateByRubro[rubro.id])">
									<i :class="mlStateByRubro[rubro.id] ? 'pi pi-check-circle' : 'pi pi-circle'" />
									{{ $t('admin.rubros.channelMl') }}
								</span>
							</div>
						</div>

						<div class="flex flex-row gap-2 md:flex-col" @click.stop>
							<Button
								:label="$t('admin.rubros.configure')"
								icon="pi pi-cog"
								size="small"
								outlined
								class="flex-1 md:flex-none"
								@click="goToConfig(rubro.id)"
							/>
							<Button
								:label="$t('admin.plans.button')"
								icon="pi pi-credit-card"
								severity="help"
								size="small"
								class="flex-1 md:flex-none"
								@click="goToPlanes(rubro.id)"
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
				<template v-if="isApps">
					<div class="space-y-1">
						<label class="flex items-center gap-1.5 text-sm font-medium"><i class="pi pi-th-large" /> {{ $t('admin.rubros.fields.platforms') }}</label>
						<MultiSelect
							v-model="edit.platforms"
							:options="platformOptions"
							option-label="label"
							option-value="value"
							display="chip"
							:placeholder="$t('admin.rubros.fields.platformsPlaceholder')"
							class="w-full"
						/>
					</div>
					<div v-if="edit.platforms.includes('android')" class="space-y-1">
						<label class="flex items-center gap-1.5 text-sm font-medium"><i class="pi pi-android" /> {{ $t('admin.rubros.fields.androidUrl') }}</label>
						<ApkUpload v-model="edit.androidUrl" folder="apks" :placeholder="$t('admin.rubros.fields.androidPlaceholder')" />
					</div>
					<div v-if="edit.platforms.includes('ios')" class="space-y-1">
						<label class="flex items-center gap-1.5 text-sm font-medium"><i class="pi pi-apple" /> {{ $t('admin.rubros.fields.iosUrl') }}</label>
						<InputText v-model="edit.iosUrl" class="w-full" placeholder="https://apps.apple.com/app/id..." />
					</div>
					<div v-if="edit.platforms.includes('web') || edit.platforms.includes('desktop')" class="space-y-1">
						<label class="flex items-center gap-1.5 text-sm font-medium"><i class="pi pi-globe" /> {{ $t('admin.rubros.fields.webUrl') }}</label>
						<InputText v-model="edit.webUrl" class="w-full" placeholder="https://app.miempresa.com" />
					</div>
				</template>
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
import { ALL_APP_PLATFORMS, AppPlatform, EspacioType, RubroStatus, type Rubro } from '@base-template/shared';
import { useCatalogStore } from '@/modules/admin/store/catalog';
import { useAdminContext } from '@/modules/admin/store/context';
import { apiErrorMessage } from '@/shared/utils/apiError';
import ImageUpload from '@/shared/components/ImageUpload.vue';
import ApkUpload from '@/shared/components/ApkUpload.vue';

export default defineComponent({
	name: 'RubrosView',
	components: { ImageUpload, ApkUpload },
	data() {
		return {
			catalog: useCatalogStore(),
			ctx: useAdminContext(),
			loading: false,
			saving: false,
			savingEdit: false,
			form: {
				nombre: '',
				descripcion: '',
				imageUrl: '',
				logoUrl: '',
				instagramUrl: '',
				platforms: [] as string[],
				androidUrl: '',
				iosUrl: '',
				webUrl: '',
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
				platforms: [] as string[],
				androidUrl: '',
				iosUrl: '',
				webUrl: '',
				status: RubroStatus.DRAFT as RubroStatus,
			},
			// ¿Cada rubro tiene ML conectado? (para los chips de la card)
			mlStateByRubro: {} as Record<string, boolean>,
		};
	},
	computed: {
		statusOptions(): { label: string; value: RubroStatus }[] {
			return [
				{ label: this.$t('admin.status.active'), value: RubroStatus.ACTIVE },
				{ label: this.$t('admin.status.draft'), value: RubroStatus.DRAFT },
			];
		},
		/** Espacios tipo "apps": cada rubro es una app con links de descarga. */
		isApps(): boolean {
			return this.catalog.miEspacio?.type === EspacioType.APPS;
		},
		/** Opciones del multiselect de plataformas de la app. */
		platformOptions(): { label: string; value: string }[] {
			return ALL_APP_PLATFORMS.map(value => ({ label: this.$t(`admin.rubros.platforms.${value}`), value }));
		},
	},
	async created() {
		this.loading = true;
		try {
			// El layout ya suele cargar miEspacio; lo aseguramos para saber si mostrar los links.
			if (!this.catalog.miEspacio) await this.catalog.fetchMiEspacio().catch(() => undefined);
			await this.catalog.fetchRubros();
		} catch {
			this.$toast.add({ severity: 'error', summary: this.$t('admin.errors.load'), life: 4000 });
		} finally {
			this.loading = false;
		}
		void this.loadMlStates();
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
					platforms: this.isApps ? (this.form.platforms as AppPlatform[]) : undefined,
					androidUrl: this.isApps ? this.form.androidUrl.trim() || undefined : undefined,
					iosUrl: this.isApps ? this.form.iosUrl.trim() || undefined : undefined,
					webUrl: this.isApps ? this.form.webUrl.trim() || undefined : undefined,
					status: this.form.status,
				});
				this.$toast.add({ severity: 'success', summary: this.$t('admin.rubros.created'), life: 3000 });
				this.form = {
					nombre: '',
					descripcion: '',
					imageUrl: '',
					logoUrl: '',
					instagramUrl: '',
					platforms: [],
					androidUrl: '',
					iosUrl: '',
					webUrl: '',
					status: RubroStatus.DRAFT,
				};
			} catch (e: unknown) {
				this.$toast.add({ severity: 'error', summary: apiErrorMessage(e, this.$t('admin.errors.save')), life: 5000 });
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
				platforms: [...(rubro.platforms ?? [])],
				androidUrl: rubro.androidUrl ?? '',
				iosUrl: rubro.iosUrl ?? '',
				webUrl: rubro.webUrl ?? '',
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
					...(this.isApps
						? {
								platforms: this.edit.platforms as AppPlatform[],
								androidUrl: this.edit.androidUrl.trim(),
								iosUrl: this.edit.iosUrl.trim(),
								webUrl: this.edit.webUrl.trim(),
							}
						: {}),
					status: this.edit.status,
				});
				this.$toast.add({ severity: 'success', summary: this.$t('admin.rubros.updated'), life: 3000 });
				this.editVisible = false;
			} catch (e: unknown) {
				this.$toast.add({ severity: 'error', summary: apiErrorMessage(e, this.$t('admin.errors.save')), life: 5000 });
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
					} catch (e: unknown) {
						this.$toast.add({ severity: 'error', summary: apiErrorMessage(e, this.$t('admin.errors.delete')), life: 5000 });
					}
				},
			});
		},
		goToProductos(id: string) {
			this.$router.push({ name: 'admin-rubro-productos', params: { id } });
		},
		goToPlanes(id: string) {
			this.$router.push({ name: 'admin-rubro-planes', params: { id } });
		},
		/** Va a Configuraciones con ese negocio como contexto activo. */
		goToConfig(id: string) {
			this.ctx.setRubro(id);
			this.$router.push({ name: 'admin-configuraciones' });
		},
		/** Trae el estado de ML de cada rubro (para los chips de conexión). */
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
		/** Clase del chip de canal (verde si conectado, gris si no). */
		channelPillClass(connected: boolean): string {
			const base = 'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium';
			return connected
				? `${base} bg-emerald-500/10 text-emerald-600 dark:text-emerald-400`
				: `${base} bg-surface-100 text-surface-400 dark:bg-surface-800`;
		},
	},
});
</script>
