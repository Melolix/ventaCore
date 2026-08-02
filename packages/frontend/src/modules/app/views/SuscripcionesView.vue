<template>
	<div class="mx-auto max-w-5xl">
		<!-- Encabezado -->
		<header class="mb-12 text-center">
			<span class="text-xs font-bold uppercase tracking-widest text-primary">{{ $t('public.subscriptions.title') }}</span>
			<h1 class="mx-auto mt-3 max-w-2xl text-3xl font-extrabold leading-tight text-surface-900 dark:text-surface-0 md:text-4xl">
				{{ espacio?.nombre || $t('public.subscriptions.title') }}
			</h1>
			<p class="mx-auto mt-3 max-w-xl text-surface-600 dark:text-surface-300">
				{{ $t('public.subscriptions.subtitle') }}
			</p>
		</header>

		<div v-if="loading" class="py-24 text-center text-surface-400">
			<i class="pi pi-spin pi-spinner text-3xl" />
		</div>

		<div v-else-if="!items.length" class="glass-card rounded-3xl p-12 text-center text-surface-500">
			{{ $t('public.subscriptions.empty') }}
		</div>

		<div v-else class="space-y-12">
			<section v-for="item in items" :key="item.rubro.id">
				<!-- Rubro -->
				<div class="mb-5 flex items-center gap-3">
					<div v-if="item.rubro.logoUrl" class="h-11 w-11 overflow-hidden rounded-xl border border-surface-200 dark:border-surface-700">
						<img :src="item.rubro.logoUrl" :alt="item.rubro.nombre" class="h-full w-full object-cover" />
					</div>
					<div>
						<h2 class="text-xl font-bold text-surface-900 dark:text-surface-0">{{ item.rubro.nombre }}</h2>
						<p v-if="item.rubro.descripcion" class="text-sm text-surface-500">{{ item.rubro.descripcion }}</p>
					</div>
				</div>

				<!-- Planes -->
				<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
					<div
						v-for="plan in item.plans"
						:key="plan.id"
						class="glass-card flex flex-col rounded-3xl p-7 transition-transform hover:scale-[1.02]"
					>
						<h3 class="text-lg font-bold text-surface-900 dark:text-surface-0">{{ plan.nombre }}</h3>
						<div class="mt-3 flex items-baseline gap-1">
							<span class="text-3xl font-extrabold text-primary">{{ formatPrice(plan.precio, plan.moneda) }}</span>
							<span class="text-sm font-medium text-surface-400">{{ intervalLabel(plan.intervalo) }}</span>
						</div>
						<p v-if="plan.descripcion" class="mt-3 flex-1 text-sm leading-relaxed text-surface-600 dark:text-surface-300">
							{{ plan.descripcion }}
						</p>
						<div v-else class="flex-1" />
						<Button
							:label="$t('public.subscriptions.subscribe')"
							icon="pi pi-credit-card"
							class="primary-gradient mt-6 w-full border-0 py-2.5 font-semibold text-white"
							@click="openSubscribe(plan)"
						/>
					</div>
				</div>
			</section>

			<p class="flex items-center justify-center gap-2 text-center text-xs text-surface-400">
				<i class="pi pi-lock" /> {{ $t('public.subscriptions.secure') }}
			</p>
		</div>

		<!-- Dialog: email para iniciar el checkout -->
		<Dialog
			v-model:visible="dialogVisible"
			modal
			:header="$t('public.subscriptions.dialogTitle', { plan: selectedPlan?.nombre || '' })"
			class="w-full max-w-sm"
			:closable="!submitting"
		>
			<div class="flex flex-col gap-4 pt-2">
				<div class="space-y-1">
					<label class="text-sm font-medium">{{ $t('public.subscriptions.emailLabel') }}</label>
					<InputText
						v-model="email"
						type="email"
						class="w-full"
						:placeholder="$t('public.subscriptions.emailPlaceholder')"
						:invalid="emailTouched && !emailValid"
						@keyup.enter="submit"
					/>
					<small v-if="emailTouched && !emailValid" class="text-red-500">
						{{ $t('public.subscriptions.invalidEmail') }}
					</small>
				</div>
				<div class="space-y-1">
					<label class="text-sm font-medium">{{ $t('public.subscriptions.nameLabel') }}</label>
					<InputText v-model="name" class="w-full" />
				</div>
			</div>
			<template #footer>
				<Button :label="$t('common.cancel')" text :disabled="submitting" @click="dialogVisible = false" />
				<Button
					:label="submitting ? $t('public.subscriptions.redirecting') : $t('public.subscriptions.continue')"
					icon="pi pi-arrow-right"
					icon-pos="right"
					:loading="submitting"
					@click="submit"
				/>
			</template>
		</Dialog>
	</div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { SubscriptionInterval, type Espacio, type SubscribableRubroPublic, type SubscriptionPlan } from '@base-template/shared';
import { useCatalogStore } from '@/modules/admin/store/catalog';
import { apiErrorMessage } from '@/shared/utils/apiError';

export default defineComponent({
	name: 'SuscripcionesView',
	data() {
		return {
			catalog: useCatalogStore(),
			loading: false,
			items: [] as SubscribableRubroPublic[],
			dialogVisible: false,
			selectedPlan: null as SubscriptionPlan | null,
			email: '',
			name: '',
			emailTouched: false,
			submitting: false,
		};
	},
	computed: {
		espacio(): Espacio | null {
			return this.catalog.currentEspacio;
		},
		emailValid(): boolean {
			return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email.trim());
		},
	},
	async created() {
		this.loading = true;
		try {
			this.items = await this.catalog.fetchSubscribables();
		} catch {
			this.items = [];
		} finally {
			this.loading = false;
		}
	},
	methods: {
		formatPrice(value: number, currency: string): string {
			try {
				return new Intl.NumberFormat('es-AR', { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 0 }).format(value);
			} catch {
				return `${value} ${currency}`;
			}
		},
		intervalLabel(interval: SubscriptionInterval): string {
			return interval === SubscriptionInterval.YEAR
				? this.$t('public.subscriptions.perYear')
				: this.$t('public.subscriptions.perMonth');
		},
		openSubscribe(plan: SubscriptionPlan) {
			this.selectedPlan = plan;
			this.email = '';
			this.name = '';
			this.emailTouched = false;
			this.dialogVisible = true;
		},
		async submit() {
			this.emailTouched = true;
			if (!this.emailValid || !this.selectedPlan || this.submitting) return;
			this.submitting = true;
			try {
				const url = await this.catalog.createSubscriptionCheckout(
					this.selectedPlan.id,
					this.email.trim(),
					this.name.trim() || undefined,
				);
				// Salimos del SPA hacia el checkout hosteado del proveedor.
				window.location.href = url;
			} catch (e: unknown) {
				this.submitting = false;
				this.$toast.add({
					severity: 'error',
					summary: apiErrorMessage(e, this.$t('public.subscriptions.errorCheckout')),
					life: 5000,
				});
			}
		},
	},
});
</script>
