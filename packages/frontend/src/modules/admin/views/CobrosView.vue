<template>
	<div class="mx-auto max-w-3xl">
		<div class="mb-8">
			<h1 class="text-3xl font-extrabold tracking-tight text-surface-900 dark:text-surface-0">
				{{ $t('admin.cobros.title') }}
			</h1>
			<p class="mt-2 text-surface-600 dark:text-surface-300">{{ $t('admin.cobros.subtitle') }}</p>
		</div>

		<div v-if="loading" class="py-16 text-center text-surface-500">
			<i class="pi pi-spin pi-spinner text-2xl" />
		</div>

		<template v-else>
			<form class="glass-card space-y-6 rounded-3xl p-8" @submit.prevent="save">
				<!-- Estado -->
				<div class="flex flex-wrap items-center gap-2">
					<span class="text-xs font-semibold uppercase tracking-wide text-surface-500">Lemon Squeezy</span>
					<Tag
						:value="config?.hasApiKey ? $t('admin.cobros.configured') : $t('admin.cobros.pending')"
						:severity="config?.hasApiKey ? 'success' : 'warn'"
						class="uppercase"
					/>
				</div>

				<!-- URL de webhook (para pegar en Lemon Squeezy) -->
				<div class="space-y-2">
					<label class="text-xs font-semibold uppercase tracking-wide text-surface-600 dark:text-surface-300">
						{{ $t('admin.cobros.webhookUrl') }}
					</label>
					<div class="flex gap-2">
						<InputText :model-value="config?.webhookUrl || ''" readonly class="w-full font-mono text-sm" />
						<Button
							type="button"
							:icon="copied ? 'pi pi-check' : 'pi pi-copy'"
							:label="copied ? $t('admin.cobros.copied') : $t('admin.cobros.copy')"
							severity="secondary"
							outlined
							@click="copyWebhookUrl"
						/>
					</div>
					<p class="text-xs text-surface-400">{{ $t('admin.cobros.webhookUrlHint') }}</p>
				</div>

				<!-- API Key -->
				<div class="space-y-2">
					<label class="text-xs font-semibold uppercase tracking-wide text-surface-600 dark:text-surface-300">
						{{ $t('admin.cobros.apiKey') }}
					</label>
					<InputText
						v-model="form.apiKey"
						type="password"
						class="w-full"
						autocomplete="off"
						:placeholder="config?.hasApiKey ? '••••••••••••' : ''"
					/>
					<p class="text-xs text-surface-400">
						{{ config?.hasApiKey ? $t('admin.cobros.apiKeyKept') : $t('admin.cobros.apiKeyHint') }}
					</p>
				</div>

				<!-- Store ID -->
				<div class="space-y-2">
					<label class="text-xs font-semibold uppercase tracking-wide text-surface-600 dark:text-surface-300">
						{{ $t('admin.cobros.storeId') }}
					</label>
					<InputText v-model="form.storeId" class="w-full" placeholder="123456" />
					<p class="text-xs text-surface-400">{{ $t('admin.cobros.storeIdHint') }}</p>
				</div>

				<!-- Signing secret del webhook -->
				<div class="space-y-2">
					<label class="text-xs font-semibold uppercase tracking-wide text-surface-600 dark:text-surface-300">
						{{ $t('admin.cobros.webhookSecret') }}
					</label>
					<InputText
						v-model="form.webhookSecret"
						type="password"
						class="w-full"
						autocomplete="off"
						:placeholder="config?.hasWebhookSecret ? '••••••••••••' : ''"
					/>
					<p class="text-xs text-surface-400">
						{{ config?.hasWebhookSecret ? $t('admin.cobros.webhookSecretKept') : $t('admin.cobros.webhookSecretHint') }}
					</p>
				</div>

				<!-- Activo -->
				<div class="flex items-center justify-between rounded-2xl bg-surface-50 p-4 dark:bg-surface-800/40">
					<div>
						<p class="text-sm font-semibold text-surface-800 dark:text-surface-100">{{ $t('admin.cobros.active') }}</p>
						<p class="text-xs text-surface-400">{{ $t('admin.cobros.activeHint') }}</p>
					</div>
					<ToggleSwitch v-model="form.active" />
				</div>

				<div class="flex items-center justify-end gap-3 border-t border-surface-200/50 pt-4 dark:border-surface-700/50">
					<Button
						:label="$t('admin.cobros.save')"
						:loading="saving"
						type="submit"
						class="primary-gradient border-0 font-semibold text-white"
					/>
				</div>
			</form>

			<!-- Guía rápida -->
			<div class="glass-card mt-6 rounded-3xl p-8">
				<h3 class="mb-4 flex items-center gap-2 text-lg font-bold text-surface-900 dark:text-surface-0">
					<i class="pi pi-info-circle text-primary" /> {{ $t('admin.cobros.guideTitle') }}
				</h3>
				<ol class="list-decimal space-y-2 pl-5 text-sm text-surface-600 dark:text-surface-300">
					<li>{{ $t('admin.cobros.guideStep1') }}</li>
					<li>{{ $t('admin.cobros.guideStep2') }}</li>
					<li>{{ $t('admin.cobros.guideStep3') }}</li>
					<li>{{ $t('admin.cobros.guideStep4') }}</li>
				</ol>
			</div>
		</template>
	</div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { PaymentProvider, type PaymentProviderConfigPublic } from '@base-template/shared';
import { useCatalogStore } from '@/modules/admin/store/catalog';
import { apiErrorMessage } from '@/shared/utils/apiError';

export default defineComponent({
	name: 'CobrosView',
	data() {
		return {
			catalog: useCatalogStore(),
			loading: false,
			saving: false,
			copied: false,
			config: null as PaymentProviderConfigPublic | null,
			// Los secretos arrancan vacíos: si no se tocan, el backend conserva los guardados.
			form: { apiKey: '', storeId: '', webhookSecret: '', active: true },
		};
	},
	async created() {
		this.loading = true;
		try {
			const config = await this.catalog.fetchPaymentConfig();
			this.config = config;
			this.form.storeId = config.storeId ?? '';
			this.form.active = config.active;
		} catch {
			this.$toast.add({ severity: 'error', summary: this.$t('admin.cobros.errorLoad'), life: 4000 });
		} finally {
			this.loading = false;
		}
	},
	methods: {
		async copyWebhookUrl() {
			if (!this.config?.webhookUrl) return;
			try {
				await navigator.clipboard.writeText(this.config.webhookUrl);
				this.copied = true;
				window.setTimeout(() => (this.copied = false), 1800);
			} catch {
				/* clipboard no disponible: el usuario puede copiar manualmente */
			}
		},
		async save() {
			this.saving = true;
			try {
				// Solo mandamos los secretos si el usuario los cargó (vacío = conservar).
				const updated = await this.catalog.savePaymentConfig({
					provider: PaymentProvider.LEMON_SQUEEZY,
					storeId: this.form.storeId.trim(),
					active: this.form.active,
					...(this.form.apiKey.trim() ? { apiKey: this.form.apiKey.trim() } : {}),
					...(this.form.webhookSecret.trim() ? { webhookSecret: this.form.webhookSecret.trim() } : {}),
				});
				this.config = updated;
				this.form.apiKey = '';
				this.form.webhookSecret = '';
				this.$toast.add({ severity: 'success', summary: this.$t('admin.cobros.saved'), life: 3000 });
			} catch (e: unknown) {
				this.$toast.add({ severity: 'error', summary: apiErrorMessage(e, this.$t('admin.cobros.errorSave')), life: 5000 });
			} finally {
				this.saving = false;
			}
		},
	},
});
</script>
