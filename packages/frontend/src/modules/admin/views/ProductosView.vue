<template>
	<div class="mx-auto max-w-6xl">
		<!-- Encabezado con volver -->
		<div class="mb-8 flex items-center gap-4">
			<Button icon="pi pi-arrow-left" rounded text severity="secondary" @click="$router.push('/admin')" />
			<div>
				<p class="text-xs font-semibold uppercase tracking-wide text-primary">{{ $t('admin.productos.eyebrow') }}</p>
				<h1 class="text-2xl font-extrabold text-surface-900 dark:text-surface-0">
					{{ rubroNombre || $t('admin.productos.title') }}
				</h1>
			</div>
		</div>

		<div class="grid grid-cols-1 gap-8 lg:grid-cols-12">
			<!-- Crear producto -->
			<section class="lg:col-span-5">
				<div class="glass-card rounded-3xl p-8 shadow-sm">
					<div class="mb-6 flex items-center gap-3">
						<div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
							<i class="pi pi-plus-circle text-2xl" />
						</div>
						<h3 class="text-xl font-semibold text-surface-900 dark:text-surface-0">
							{{ $t('admin.productos.createTitle') }}
						</h3>
					</div>

					<form class="space-y-5" @submit.prevent="submitCreate">
						<div class="space-y-2">
							<label class="px-1 text-xs font-semibold uppercase tracking-wide text-surface-600 dark:text-surface-300">
								{{ $t('admin.productos.fields.name') }}
							</label>
							<InputText v-model="form.nombre" class="w-full" required />
						</div>
						<div class="space-y-2">
							<label class="px-1 text-xs font-semibold uppercase tracking-wide text-surface-600 dark:text-surface-300">
								{{ $t('admin.productos.fields.description') }}
							</label>
							<Textarea v-model="form.descripcion" class="w-full" rows="3" />
						</div>
						<div v-if="!isApps" class="space-y-2">
							<label class="px-1 text-xs font-semibold uppercase tracking-wide text-surface-600 dark:text-surface-300">
								{{ $t('admin.productos.fields.price') }}
							</label>
							<InputNumber v-model="form.precio" class="w-full" mode="currency" currency="ARS" locale="es-AR" :min="0" />
						</div>
						<div class="space-y-2">
							<label class="px-1 text-xs font-semibold uppercase tracking-wide text-surface-600 dark:text-surface-300">
								{{ $t('admin.productos.fields.imageUrl') }}
							</label>
							<ImageUpload v-model="form.imageUrl" folder="productos" :aspect-ratio="1" :min-width="500" format="jpeg" />
						</div>
						<Button
							type="submit"
							:label="$t('admin.productos.save')"
							:loading="saving"
							class="primary-gradient w-full border-0 py-3 font-semibold text-white"
						/>
					</form>
				</div>
			</section>

			<!-- Lista de productos -->
			<section class="lg:col-span-7">
				<h3 class="mb-4 text-xl font-semibold text-surface-900 dark:text-surface-0">
					{{ $t('admin.productos.listTitle', { n: catalog.productos.length }) }}
				</h3>

				<div v-if="loading" class="py-12 text-center text-surface-500">
					<i class="pi pi-spin pi-spinner text-2xl" />
				</div>

				<div v-else-if="!catalog.productos.length" class="glass-card rounded-2xl p-10 text-center text-surface-500">
					{{ $t('admin.productos.empty') }}
				</div>

				<div v-else class="space-y-3">
					<div
						v-for="producto in catalog.productos"
						:key="producto.id"
						class="glass-card flex items-center gap-4 rounded-2xl p-4"
					>
						<div class="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-surface-100 dark:bg-surface-800">
							<img v-if="producto.imageUrl" :src="producto.imageUrl" class="h-full w-full object-cover" :alt="producto.nombre" />
							<div v-else class="flex h-full w-full items-center justify-center text-surface-400">
								<i class="pi pi-shopping-bag" />
							</div>
						</div>
						<div class="flex-1">
							<h4 class="font-semibold text-surface-900 dark:text-surface-0">{{ producto.nombre }}</h4>
							<p class="line-clamp-1 text-sm text-surface-500">{{ producto.descripcion || '—' }}</p>
						</div>
						<span v-if="!isApps && producto.precio != null" class="font-bold text-primary">{{ formatPrice(producto.precio) }}</span>
						<div class="flex gap-2">
							<Button
								icon="pi pi-send"
								:label="$t('admin.publish.button')"
								size="small"
								:disabled="!metaReady"
								:title="metaReady ? '' : $t('admin.publish.notReady')"
								@click="openPublish(producto)"
							/>
							<Button icon="pi pi-pencil" severity="secondary" outlined size="small" @click="openEdit(producto)" />
							<Button icon="pi pi-trash" severity="danger" outlined size="small" @click="confirmDelete(producto)" />
						</div>
					</div>
				</div>
			</section>
		</div>

		<!-- Dialog edición -->
		<Dialog v-model:visible="editVisible" modal :header="$t('admin.productos.editTitle')" class="w-full max-w-md">
			<div class="flex flex-col gap-4 pt-2">
				<div class="space-y-1">
					<label class="text-sm font-medium">{{ $t('admin.productos.fields.name') }}</label>
					<InputText v-model="edit.nombre" class="w-full" />
				</div>
				<div class="space-y-1">
					<label class="text-sm font-medium">{{ $t('admin.productos.fields.description') }}</label>
					<Textarea v-model="edit.descripcion" class="w-full" rows="3" />
				</div>
				<div v-if="!isApps" class="space-y-1">
					<label class="text-sm font-medium">{{ $t('admin.productos.fields.price') }}</label>
					<InputNumber v-model="edit.precio" class="w-full" mode="currency" currency="ARS" locale="es-AR" :min="0" />
				</div>
				<div class="space-y-1">
					<label class="text-sm font-medium">{{ $t('admin.productos.fields.imageUrl') }}</label>
					<ImageUpload v-model="edit.imageUrl" folder="productos" :aspect-ratio="1" :min-width="500" format="jpeg" />
				</div>
			</div>
			<template #footer>
				<Button :label="$t('common.cancel')" text @click="editVisible = false" />
				<Button :label="$t('admin.productos.saveChanges')" :loading="savingEdit" @click="submitEdit" />
			</template>
		</Dialog>

		<!-- Dialog de publicación en redes -->
		<Dialog v-model:visible="publishVisible" modal :header="$t('admin.publish.confirmTitle')" class="w-full max-w-md">
			<div class="flex flex-col gap-4 pt-2">
				<p class="text-sm font-semibold text-surface-800 dark:text-surface-100">{{ publishRef?.nombre }}</p>

				<div class="space-y-1">
					<label class="text-xs font-semibold uppercase tracking-wide text-surface-600 dark:text-surface-300">
						{{ $t('admin.publish.captionLabel') }}
					</label>
					<Textarea v-model="publishCaption" class="w-full" rows="3" :placeholder="$t('admin.publish.captionPlaceholder')" />
				</div>

				<div v-if="!showTestUrl">
					<Button
						:label="$t('admin.publish.useTestImage')"
						text
						size="small"
						icon="pi pi-image"
						class="px-0"
						@click="showTestUrl = true"
					/>
				</div>
				<div v-else class="space-y-1">
					<label class="text-xs font-semibold uppercase tracking-wide text-surface-600 dark:text-surface-300">
						{{ $t('admin.publish.testUrlLabel') }}
					</label>
					<InputText v-model="publishTestUrl" class="w-full" placeholder="https://.../foto.jpg" />
					<p class="text-xs text-surface-400">{{ $t('admin.publish.testUrlHint') }}</p>
				</div>
			</div>
			<template #footer>
				<Button :label="$t('common.cancel')" text @click="publishVisible = false" />
				<Button :label="$t('admin.publish.button')" icon="pi pi-send" :loading="publishing" @click="doPublish" />
			</template>
		</Dialog>
	</div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { EspacioType, type Producto } from '@base-template/shared';
import { useCatalogStore } from '@/modules/admin/store/catalog';
import { apiErrorMessage } from '@/shared/utils/apiError';
import ImageUpload from '@/shared/components/ImageUpload.vue';

export default defineComponent({
	name: 'ProductosView',
	components: { ImageUpload },
	data() {
		return {
			catalog: useCatalogStore(),
			loading: false,
			saving: false,
			savingEdit: false,
			rubroNombre: '',
			// Publicación en redes
			publishVisible: false,
			publishRef: null as Producto | null,
			publishCaption: '',
			publishTestUrl: '',
			showTestUrl: false,
			publishing: false,
			form: { nombre: '', descripcion: '', precio: null as number | null, imageUrl: '' },
			editVisible: false,
			editId: '',
			edit: { nombre: '', descripcion: '', precio: null as number | null, imageUrl: '' },
		};
	},
	computed: {
		rubroId(): string {
			return this.$route.params.id as string;
		},
		/** El rubro está listo para publicar si eligió un destino de Meta. */
		metaReady(): boolean {
			return !!this.catalog.rubroById(this.rubroId)?.metaTargetId;
		},
		/** Espacios tipo "apps": los "productos" son capturas de la app (sin precio). */
		isApps(): boolean {
			return this.catalog.miEspacio?.type === EspacioType.APPS;
		},
	},
	async created() {
		this.loading = true;
		try {
			// El layout ya suele cargar miEspacio; lo aseguramos para saber si es una app.
			if (!this.catalog.miEspacio) await this.catalog.fetchMiEspacio().catch(() => undefined);
			// Asegura tener el rubro cargado para mostrar su nombre.
			if (!this.catalog.rubroById(this.rubroId)) await this.catalog.fetchRubros();
			this.rubroNombre = this.catalog.rubroById(this.rubroId)?.nombre ?? '';
			await this.catalog.fetchProductos(this.rubroId);
		} catch {
			this.$toast.add({ severity: 'error', summary: this.$t('admin.errors.load'), life: 4000 });
		} finally {
			this.loading = false;
		}
	},
	methods: {
		formatPrice(value: number): string {
			return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
		},
		async submitCreate() {
			if (!this.form.nombre.trim()) return;
			this.saving = true;
			try {
				await this.catalog.createProducto(this.rubroId, {
					nombre: this.form.nombre.trim(),
					descripcion: this.form.descripcion.trim() || undefined,
					precio: this.form.precio ?? undefined,
					imageUrl: this.form.imageUrl.trim() || undefined,
				});
				this.$toast.add({ severity: 'success', summary: this.$t('admin.productos.created'), life: 3000 });
				this.form = { nombre: '', descripcion: '', precio: null, imageUrl: '' };
			} catch (e: unknown) {
				this.$toast.add({ severity: 'error', summary: apiErrorMessage(e, this.$t('admin.errors.save')), life: 5000 });
			} finally {
				this.saving = false;
			}
		},
		openEdit(producto: Producto) {
			this.editId = producto.id;
			this.edit = {
				nombre: producto.nombre,
				descripcion: producto.descripcion ?? '',
				precio: producto.precio,
				imageUrl: producto.imageUrl ?? '',
			};
			this.editVisible = true;
		},
		async submitEdit() {
			this.savingEdit = true;
			try {
				await this.catalog.updateProducto(this.rubroId, this.editId, {
					nombre: this.edit.nombre.trim(),
					descripcion: this.edit.descripcion.trim() || undefined,
					precio: this.edit.precio ?? undefined,
					imageUrl: this.edit.imageUrl.trim() || undefined,
				});
				this.$toast.add({ severity: 'success', summary: this.$t('admin.productos.updated'), life: 3000 });
				this.editVisible = false;
			} catch (e: unknown) {
				this.$toast.add({ severity: 'error', summary: apiErrorMessage(e, this.$t('admin.errors.save')), life: 5000 });
			} finally {
				this.savingEdit = false;
			}
		},
		confirmDelete(producto: Producto) {
			this.$confirm.require({
				message: this.$t('admin.productos.deleteConfirm', { name: producto.nombre }),
				header: this.$t('admin.productos.deleteTitle'),
				icon: 'pi pi-exclamation-triangle',
				rejectProps: { label: this.$t('common.cancel'), text: true },
				acceptProps: { label: this.$t('common.delete'), severity: 'danger' },
				accept: async () => {
					try {
						await this.catalog.deleteProducto(this.rubroId, producto.id);
						this.$toast.add({ severity: 'success', summary: this.$t('admin.productos.deleted'), life: 3000 });
					} catch (e: unknown) {
						this.$toast.add({ severity: 'error', summary: apiErrorMessage(e, this.$t('admin.errors.delete')), life: 5000 });
					}
				},
			});
		},

		// ── Publicar en redes (Meta) ──
		/** Arma el texto por defecto con los datos del producto (igual que el backend). */
		buildCaption(producto: Producto): string {
			const parts = [producto.nombre];
			if (producto.descripcion) parts.push(producto.descripcion);
			if (producto.precio != null) parts.push(this.formatPrice(producto.precio));
			return parts.join('\n\n');
		},
		openPublish(producto: Producto) {
			this.publishRef = producto;
			this.publishCaption = this.buildCaption(producto);
			this.publishTestUrl = '';
			this.showTestUrl = false;
			this.publishVisible = true;
		},
		async doPublish() {
			const producto = this.publishRef;
			if (!producto) return;
			this.publishing = true;
			try {
				const results = await this.catalog.publishProducto(this.rubroId, producto.id, {
					caption: this.publishCaption.trim() || undefined,
					imageUrl: this.publishTestUrl.trim() || undefined,
				});
				const net = (n: string): string => (n === 'facebook' ? 'Facebook' : 'Instagram');
				const ok = results.filter(r => r.ok).map(r => net(r.network));
				const fail = results.filter(r => !r.ok);
				if (!fail.length) {
					this.$toast.add({ severity: 'success', summary: this.$t('admin.publish.done'), detail: ok.join(', '), life: 4000 });
					this.publishVisible = false;
				} else if (ok.length) {
					const okPart = `✓ ${ok.join(', ')}`;
					const failPart = fail.map(f => `✗ ${net(f.network)}: ${f.error}`).join(' · ');
					this.$toast.add({
						severity: 'warn',
						summary: this.$t('admin.publish.partial'),
						detail: `${okPart} · ${failPart}`,
						life: 8000,
					});
				} else {
					this.$toast.add({
						severity: 'error',
						summary: this.$t('admin.publish.failed'),
						detail: fail.map(f => `${net(f.network)}: ${f.error}`).join(' · '),
						life: 7000,
					});
				}
			} catch (e: unknown) {
				const detail = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
				this.$toast.add({ severity: 'error', summary: this.$t('admin.publish.failed'), detail, life: 6000 });
			} finally {
				this.publishing = false;
			}
		},
	},
});
</script>
