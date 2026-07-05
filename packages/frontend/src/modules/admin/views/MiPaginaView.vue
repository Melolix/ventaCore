<template>
	<div class="mx-auto max-w-3xl">
		<div class="mb-8">
			<h1 class="text-3xl font-extrabold tracking-tight text-surface-900 dark:text-surface-0">
				{{ $t('admin.about.title') }}
			</h1>
			<p class="mt-2 text-surface-600 dark:text-surface-300">{{ $t('admin.about.subtitle') }}</p>
		</div>

		<div v-if="loading" class="py-16 text-center text-surface-500">
			<i class="pi pi-spin pi-spinner text-2xl" />
		</div>

		<form v-else class="glass-card space-y-6 rounded-3xl p-8" @submit.prevent="save">
			<div class="space-y-2">
				<label class="text-xs font-semibold uppercase tracking-wide text-surface-600 dark:text-surface-300">
					{{ $t('admin.about.fields.headline') }}
				</label>
				<InputText v-model="form.aboutHeadline" class="w-full" :placeholder="$t('admin.about.fields.headlinePlaceholder')" />
			</div>

			<div class="space-y-2">
				<label class="text-xs font-semibold uppercase tracking-wide text-surface-600 dark:text-surface-300">
					{{ $t('admin.about.fields.text') }}
				</label>
				<Editor v-model="form.aboutText" editorStyle="height: 240px" :placeholder="$t('admin.about.fields.textPlaceholder')">
					<template #toolbar>
						<span class="ql-formats">
							<button class="ql-bold" type="button"></button>
							<button class="ql-italic" type="button"></button>
							<button class="ql-underline" type="button"></button>
						</span>
						<span class="ql-formats">
							<button class="ql-list" value="ordered" type="button"></button>
							<button class="ql-list" value="bullet" type="button"></button>
						</span>
					</template>
				</Editor>
			</div>

			<div class="space-y-2">
				<label class="text-xs font-semibold uppercase tracking-wide text-surface-600 dark:text-surface-300">
					{{ $t('admin.about.fields.image') }}
				</label>
				<InputText v-model="form.aboutImageUrl" class="w-full" placeholder="https://..." />
			</div>

			<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
				<div class="space-y-2">
					<label class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-surface-600 dark:text-surface-300">
						<i class="pi pi-whatsapp" /> {{ $t('admin.about.fields.whatsapp') }}
					</label>
					<InputText v-model="form.whatsapp" class="w-full" placeholder="54 9 11 1234 5678" />
					<p class="text-xs text-surface-400">{{ $t('admin.about.fields.whatsappHint') }}</p>
				</div>
				<div class="space-y-2">
					<label class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-surface-600 dark:text-surface-300">
						<i class="pi pi-instagram" /> {{ $t('admin.about.fields.instagram') }}
					</label>
					<InputText v-model="form.instagramUrl" class="w-full" placeholder="https://instagram.com/tu.negocio" />
				</div>
			</div>

			<div v-if="form.aboutImageUrl" class="overflow-hidden rounded-2xl border border-surface-200 dark:border-surface-700">
				<img :src="form.aboutImageUrl" class="max-h-56 w-full object-cover" alt="preview" />
			</div>

			<div class="flex items-center justify-end gap-3 border-t border-surface-200/50 pt-4 dark:border-surface-700/50">
				<Button :label="$t('admin.about.save')" :loading="saving" type="submit" class="primary-gradient border-0 font-semibold text-white" />
			</div>
		</form>
	</div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { useCatalogStore } from '@/modules/admin/store/catalog';

export default defineComponent({
	name: 'MiPaginaView',
	data() {
		return {
			catalog: useCatalogStore(),
			loading: false,
			saving: false,
			form: { aboutHeadline: '', aboutText: '', aboutImageUrl: '', whatsapp: '', instagramUrl: '' },
		};
	},
	async created() {
		this.loading = true;
		try {
			await this.catalog.fetchMiEspacio();
			const e = this.catalog.miEspacio;
			if (e) {
				this.form = {
					aboutHeadline: e.aboutHeadline ?? '',
					aboutText: e.aboutText ?? '',
					aboutImageUrl: e.aboutImageUrl ?? '',
					whatsapp: e.whatsapp ?? '',
					instagramUrl: e.instagramUrl ?? '',
				};
			}
		} catch {
			this.$toast.add({ severity: 'error', summary: this.$t('admin.about.errorLoad'), life: 4000 });
		} finally {
			this.loading = false;
		}
	},
	methods: {
		/** El Editor emite null o "<p><br></p>" cuando queda vacío: lo normalizamos a "". */
		normalizeAboutText(): string {
			const html = this.form.aboutText || '';
			const sinFormato = html.replace(/<[^>]+>/g, '').replace(/ /g, ' ').trim();
			return sinFormato.length === 0 ? '' : html.trim();
		},
		async save() {
			this.saving = true;
			try {
				await this.catalog.updateMiEspacio({
					aboutHeadline: this.form.aboutHeadline.trim(),
					aboutText: this.normalizeAboutText(),
					aboutImageUrl: this.form.aboutImageUrl.trim(),
					whatsapp: this.form.whatsapp.trim(),
					instagramUrl: this.form.instagramUrl.trim(),
				});
				this.$toast.add({ severity: 'success', summary: this.$t('admin.about.saved'), life: 3000 });
			} catch {
				this.$toast.add({ severity: 'error', summary: this.$t('admin.about.errorSave'), life: 4000 });
			} finally {
				this.saving = false;
			}
		},
	},
});
</script>
