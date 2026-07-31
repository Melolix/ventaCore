<template>
	<div class="mx-auto max-w-4xl">
		<!-- Encabezado -->
		<Button
			:label="$t('admin.plans.back')"
			icon="pi pi-arrow-left"
			text
			class="mb-4 !px-0"
			@click="goBack"
		/>
		<div class="mb-8">
			<h1 class="text-3xl font-extrabold tracking-tight text-surface-900 dark:text-surface-0">
				{{ $t('admin.plans.title') }}
			</h1>
			<p class="mt-2 text-surface-600 dark:text-surface-300">
				{{ rubro?.nombre }} — {{ $t('admin.plans.subtitle') }}
			</p>
		</div>

		<div v-if="loading" class="py-16 text-center text-surface-500">
			<i class="pi pi-spin pi-spinner text-2xl" />
		</div>

		<template v-else>
			<!-- Toggle habilitar suscripciones -->
			<div class="glass-card mb-6 flex items-center justify-between rounded-3xl p-6">
				<div>
					<p class="text-sm font-semibold text-surface-800 dark:text-surface-100">{{ $t('admin.plans.enableTitle') }}</p>
					<p class="text-xs text-surface-400">{{ $t('admin.plans.enableHint') }}</p>
				</div>
				<ToggleSwitch v-model="enabled" :disabled="togglingEnabled" @update:model-value="onToggleEnabled" />
			</div>

			<!-- Aviso: falta configurar cobros -->
			<Message v-if="!configured" severity="warn" class="mb-6">
				{{ $t('admin.plans.noConfigWarning') }}
			</Message>

			<!-- Lista de planes -->
			<div class="mb-4 flex items-center justify-between">
				<h3 class="text-lg font-bold text-surface-900 dark:text-surface-0">{{ $t('admin.plans.title') }}</h3>
				<Button :label="$t('admin.plans.newPlan')" icon="pi pi-plus" size="small" @click="openCreate" />
			</div>

			<div v-if="!plans.length" class="glass-card rounded-2xl p-10 text-center text-surface-500">
				{{ $t('admin.plans.empty') }}
			</div>

			<div v-else class="space-y-3">
				<div
					v-for="plan in plans"
					:key="plan.id"
					class="glass-card flex flex-col gap-4 rounded-2xl p-5 md:flex-row md:items-center"
				>
					<div class="flex-1">
						<div class="mb-1 flex flex-wrap items-center gap-2">
							<h4 class="text-base font-bold text-surface-900 dark:text-surface-0">{{ plan.nombre }}</h4>
							<Tag v-if="!plan.active" :value="$t('admin.plans.inactive')" severity="secondary" class="uppercase" />
							<Tag
								v-if="!plan.providerVariantId"
								:value="$t('admin.plans.fields.variantId')"
								severity="warn"
								icon="pi pi-exclamation-triangle"
							/>
						</div>
						<p class="text-sm text-surface-600 dark:text-surface-300">
							<span class="font-semibold text-primary">{{ formatPrice(plan.precio, plan.moneda) }}</span>
							/ {{ $t(`admin.plans.interval.${plan.intervalo}`) }}
						</p>
						<p v-if="plan.descripcion" class="mt-1 line-clamp-1 text-xs text-surface-400">{{ plan.descripcion }}</p>
					</div>
					<div class="flex gap-2">
						<Button icon="pi pi-pencil" severity="secondary" outlined size="small" @click="openEdit(plan)" />
						<Button icon="pi pi-trash" severity="danger" outlined size="small" @click="confirmDelete(plan)" />
					</div>
				</div>
			</div>
		</template>

		<!-- Dialog crear/editar plan -->
		<Dialog
			v-model:visible="dialogVisible"
			modal
			:header="editId ? $t('admin.plans.editTitle') : $t('admin.plans.createTitle')"
			class="w-full max-w-md"
		>
			<div class="flex flex-col gap-4 pt-2">
				<div class="space-y-1">
					<label class="text-sm font-medium">{{ $t('admin.plans.fields.name') }}</label>
					<InputText v-model="form.nombre" class="w-full" :placeholder="$t('admin.plans.fields.namePlaceholder')" />
				</div>
				<div class="space-y-1">
					<label class="text-sm font-medium">{{ $t('admin.plans.fields.description') }}</label>
					<Textarea v-model="form.descripcion" class="w-full" rows="2" />
				</div>
				<div class="grid grid-cols-2 gap-3">
					<div class="space-y-1">
						<label class="text-sm font-medium">{{ $t('admin.plans.fields.price') }}</label>
						<InputNumber v-model="form.precio" class="w-full" :min="0" :min-fraction-digits="0" :max-fraction-digits="2" />
					</div>
					<div class="space-y-1">
						<label class="text-sm font-medium">{{ $t('admin.plans.fields.currency') }}</label>
						<InputText v-model="form.moneda" class="w-full" placeholder="USD" />
					</div>
				</div>
				<div class="space-y-1">
					<label class="text-sm font-medium">{{ $t('admin.plans.fields.interval') }}</label>
					<Select
						v-model="form.intervalo"
						:options="intervalOptions"
						option-label="label"
						option-value="value"
						class="w-full"
					/>
				</div>
				<div class="space-y-1">
					<label class="text-sm font-medium">{{ $t('admin.plans.fields.variantId') }}</label>
					<InputText v-model="form.providerVariantId" class="w-full" placeholder="987654" />
					<p class="text-xs text-surface-400">{{ $t('admin.plans.fields.variantHint') }}</p>
				</div>
				<div class="flex items-center justify-between">
					<label class="text-sm font-medium">{{ $t('admin.plans.fields.active') }}</label>
					<ToggleSwitch v-model="form.active" />
				</div>
			</div>
			<template #footer>
				<Button :label="$t('common.cancel')" text @click="dialogVisible = false" />
				<Button :label="$t('admin.plans.save')" :loading="saving" :disabled="!form.nombre.trim()" @click="submit" />
			</template>
		</Dialog>
	</div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { SubscriptionInterval, type Rubro, type SubscriptionPlan } from '@base-template/shared';
import { useCatalogStore } from '@/modules/admin/store/catalog';
import { apiErrorMessage } from '@/shared/utils/apiError';

export default defineComponent({
	name: 'SubscripcionesView',
	data() {
		return {
			catalog: useCatalogStore(),
			loading: false,
			saving: false,
			togglingEnabled: false,
			enabled: false,
			configured: false,
			plans: [] as SubscriptionPlan[],
			dialogVisible: false,
			editId: '',
			form: {
				nombre: '',
				descripcion: '',
				precio: 0 as number,
				moneda: 'USD',
				intervalo: SubscriptionInterval.MONTH as SubscriptionInterval,
				providerVariantId: '',
				active: true,
			},
		};
	},
	computed: {
		rubroId(): string {
			return this.$route.params.id as string;
		},
		rubro(): Rubro | undefined {
			return this.catalog.rubroById(this.rubroId);
		},
		intervalOptions(): { label: string; value: SubscriptionInterval }[] {
			return [
				{ label: this.$t('admin.plans.interval.month'), value: SubscriptionInterval.MONTH },
				{ label: this.$t('admin.plans.interval.year'), value: SubscriptionInterval.YEAR },
			];
		},
	},
	async created() {
		this.loading = true;
		try {
			// Garantizamos tener el rubro (nombre + flag) aunque se entre por URL directa.
			if (!this.catalog.rubros.length) await this.catalog.fetchRubros();
			if (!this.rubro) {
				this.goBack();
				return;
			}
			this.enabled = this.rubro.subscriptionsEnabled;
			const [plans, config] = await Promise.all([
				this.catalog.fetchPlans(this.rubroId),
				this.catalog.fetchPaymentConfig().catch(() => null),
			]);
			this.plans = plans;
			this.configured = !!config?.hasApiKey;
		} catch (e: unknown) {
			this.$toast.add({ severity: 'error', summary: apiErrorMessage(e, this.$t('admin.plans.errorLoad')), life: 5000 });
		} finally {
			this.loading = false;
		}
	},
	methods: {
		goBack() {
			this.$router.push({ name: 'admin-rubros' });
		},
		formatPrice(value: number, currency: string): string {
			try {
				return new Intl.NumberFormat('es-AR', { style: 'currency', currency: currency || 'USD' }).format(value);
			} catch {
				return `${value} ${currency}`;
			}
		},
		async onToggleEnabled(value: boolean) {
			this.togglingEnabled = true;
			try {
				await this.catalog.updateRubro(this.rubroId, { subscriptionsEnabled: value });
			} catch (e: unknown) {
				this.enabled = !value; // revertir
				this.$toast.add({ severity: 'error', summary: apiErrorMessage(e, this.$t('admin.errors.save')), life: 5000 });
			} finally {
				this.togglingEnabled = false;
			}
		},
		resetForm() {
			this.form = {
				nombre: '',
				descripcion: '',
				precio: 0,
				moneda: 'USD',
				intervalo: SubscriptionInterval.MONTH,
				providerVariantId: '',
				active: true,
			};
		},
		openCreate() {
			this.editId = '';
			this.resetForm();
			this.dialogVisible = true;
		},
		openEdit(plan: SubscriptionPlan) {
			this.editId = plan.id;
			this.form = {
				nombre: plan.nombre,
				descripcion: plan.descripcion ?? '',
				precio: plan.precio,
				moneda: plan.moneda,
				intervalo: plan.intervalo,
				providerVariantId: plan.providerVariantId ?? '',
				active: plan.active,
			};
			this.dialogVisible = true;
		},
		async submit() {
			if (!this.form.nombre.trim()) return;
			this.saving = true;
			const input = {
				nombre: this.form.nombre.trim(),
				descripcion: this.form.descripcion.trim() || undefined,
				precio: this.form.precio ?? 0,
				moneda: this.form.moneda.trim() || 'USD',
				intervalo: this.form.intervalo,
				providerVariantId: this.form.providerVariantId.trim() || undefined,
				active: this.form.active,
			};
			try {
				if (this.editId) {
					const updated = await this.catalog.updatePlan(this.rubroId, this.editId, input);
					const i = this.plans.findIndex(p => p.id === this.editId);
					if (i !== -1) this.plans[i] = updated;
					this.$toast.add({ severity: 'success', summary: this.$t('admin.plans.saved'), life: 3000 });
				} else {
					const created = await this.catalog.createPlan(this.rubroId, input);
					this.plans.push(created);
					this.$toast.add({ severity: 'success', summary: this.$t('admin.plans.created'), life: 3000 });
				}
				this.dialogVisible = false;
			} catch (e: unknown) {
				this.$toast.add({ severity: 'error', summary: apiErrorMessage(e, this.$t('admin.plans.errorSave')), life: 5000 });
			} finally {
				this.saving = false;
			}
		},
		confirmDelete(plan: SubscriptionPlan) {
			this.$confirm.require({
				message: this.$t('admin.plans.deleteConfirm'),
				header: plan.nombre,
				icon: 'pi pi-exclamation-triangle',
				rejectProps: { label: this.$t('common.cancel'), text: true },
				acceptProps: { label: this.$t('common.delete'), severity: 'danger' },
				accept: async () => {
					try {
						await this.catalog.deletePlan(this.rubroId, plan.id);
						this.plans = this.plans.filter(p => p.id !== plan.id);
						this.$toast.add({ severity: 'success', summary: this.$t('admin.plans.deleted'), life: 3000 });
					} catch (e: unknown) {
						this.$toast.add({ severity: 'error', summary: apiErrorMessage(e, this.$t('admin.plans.errorDelete')), life: 5000 });
					}
				},
			});
		},
	},
});
</script>
