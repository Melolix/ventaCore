<template>
	<!-- Destinatario de WhatsApp del negocio: recibe TANTO las preguntas de ML como
	     los DMs de Instagram (uno por rubro). Vive en Configuraciones, independiente
	     de que ML o IG estén conectados. -->
	<section class="glass-card rounded-2xl p-6">
		<div class="mb-4 flex items-center gap-3">
			<div class="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
				<i class="pi pi-whatsapp text-xl" />
			</div>
			<div class="min-w-0">
				<h3 class="font-semibold text-surface-900 dark:text-surface-0">{{ $t('admin.ml.wa.title') }}</h3>
				<p class="text-xs text-surface-500">{{ $t('admin.ml.wa.subtitle') }}</p>
			</div>
		</div>

		<div v-if="loading" class="py-4 text-center text-surface-500"><i class="pi pi-spin pi-spinner text-xl" /></div>

		<template v-else>
			<!-- Sin destinatario o editando -->
			<div v-if="!recipient || editing" class="flex flex-wrap items-end gap-2">
				<div class="min-w-0 flex-1" style="min-width: 220px">
					<label class="mb-1 block text-xs font-medium text-surface-500">{{ $t('admin.ml.wa.phoneLabel') }}</label>
					<input
						v-model="phone"
						type="tel"
						placeholder="+5493511234567"
						class="w-full rounded-lg border border-surface-300 bg-surface-0 p-2 text-sm text-surface-900 focus:border-emerald-500 focus:outline-none dark:border-surface-700 dark:bg-surface-900 dark:text-surface-0"
						@keyup.enter="save"
					/>
					<p class="mt-1 text-xs text-surface-400">{{ $t('admin.ml.wa.phoneHint') }}</p>
				</div>
				<div class="flex gap-2">
					<Button
						:label="$t('admin.ml.wa.save')"
						icon="pi pi-check"
						size="small"
						:loading="saving"
						:disabled="!phone.trim()"
						@click="save"
					/>
					<Button v-if="recipient && editing" :label="$t('common.cancel')" size="small" text @click="cancelEdit" />
				</div>
			</div>

			<!-- Con destinatario -->
			<div v-else class="flex flex-wrap items-center justify-between gap-2">
				<div class="flex items-center gap-2 text-sm text-surface-700 dark:text-surface-200">
					<i class="pi pi-phone text-surface-400" />
					<span class="font-medium">{{ recipient.phoneE164 }}</span>
					<span
						class="rounded-full px-2 py-0.5 text-xs font-semibold"
						:class="
							recipient.active
								? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
								: 'bg-surface-200 text-surface-500 dark:bg-surface-700 dark:text-surface-300'
						"
					>
						{{ recipient.active ? $t('admin.ml.wa.active') : $t('admin.ml.wa.paused') }}
					</span>
				</div>
				<div class="flex gap-2">
					<Button
						:label="recipient.active ? $t('admin.ml.wa.pause') : $t('admin.ml.wa.resume')"
						:icon="recipient.active ? 'pi pi-pause' : 'pi pi-play'"
						size="small"
						outlined
						:loading="saving"
						@click="toggleActive"
					/>
					<Button icon="pi pi-pencil" size="small" text @click="startEdit" />
					<Button icon="pi pi-trash" size="small" text severity="danger" :loading="deleting" @click="remove" />
				</div>
			</div>
		</template>
	</section>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import type { WhatsappRecipientView } from '@base-template/shared';
import { useCatalogStore } from '@/modules/admin/store/catalog';
import { apiErrorMessage } from '@/shared/utils/apiError';

/** Tarjeta de Configuraciones para definir a qué WhatsApp llegan los avisos del rubro. */
export default defineComponent({
	name: 'WhatsappRecipientCard',
	props: {
		rubroId: { type: String, required: true },
	},
	data() {
		return {
			catalog: useCatalogStore(),
			recipient: null as WhatsappRecipientView | null,
			phone: '',
			editing: false,
			loading: false,
			saving: false,
			deleting: false,
		};
	},
	watch: {
		rubroId() {
			void this.load();
		},
	},
	created() {
		void this.load();
	},
	methods: {
		async load() {
			if (!this.rubroId) return;
			this.loading = true;
			try {
				this.recipient = await this.catalog.fetchWhatsappRecipient(this.rubroId);
				this.editing = false;
				this.phone = this.recipient?.phoneE164 ?? '';
			} catch {
				this.recipient = null;
			} finally {
				this.loading = false;
			}
		},
		startEdit() {
			this.phone = this.recipient?.phoneE164 ?? '';
			this.editing = true;
		},
		cancelEdit() {
			this.editing = false;
			this.phone = this.recipient?.phoneE164 ?? '';
		},
		async save() {
			const phone = this.phone.trim();
			if (!phone) return;
			if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
				this.$toast.add({ severity: 'warn', summary: this.$t('admin.ml.wa.invalidPhone'), life: 4000 });
				return;
			}
			this.saving = true;
			try {
				this.recipient = await this.catalog.saveWhatsappRecipient(this.rubroId, { phoneE164: phone });
				this.editing = false;
				this.$toast.add({ severity: 'success', summary: this.$t('admin.ml.wa.saved'), life: 3000 });
			} catch (e) {
				this.$toast.add({ severity: 'error', summary: apiErrorMessage(e, this.$t('admin.ml.wa.saveError')), life: 5000 });
			} finally {
				this.saving = false;
			}
		},
		async toggleActive() {
			if (!this.recipient) return;
			this.saving = true;
			try {
				this.recipient = await this.catalog.saveWhatsappRecipient(this.rubroId, {
					phoneE164: this.recipient.phoneE164,
					active: !this.recipient.active,
				});
			} catch (e) {
				this.$toast.add({ severity: 'error', summary: apiErrorMessage(e, this.$t('admin.ml.wa.saveError')), life: 5000 });
			} finally {
				this.saving = false;
			}
		},
		async remove() {
			if (!this.recipient) return;
			this.deleting = true;
			try {
				await this.catalog.deleteWhatsappRecipient(this.rubroId);
				this.recipient = null;
				this.phone = '';
				this.editing = false;
				this.$toast.add({ severity: 'success', summary: this.$t('admin.ml.wa.removed'), life: 3000 });
			} catch (e) {
				this.$toast.add({ severity: 'error', summary: apiErrorMessage(e, this.$t('admin.ml.wa.saveError')), life: 5000 });
			} finally {
				this.deleting = false;
			}
		},
	},
});
</script>
