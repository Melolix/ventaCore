<template>
	<div class="flex min-h-screen flex-col items-center justify-center gap-6 bg-surface-50 px-6 py-10 text-center dark:bg-surface-950">
		<!-- Token faltante / sesión inválida -->
		<template v-if="!token">
			<i class="pi pi-exclamation-triangle text-4xl text-amber-500" />
			<div>
				<h1 class="text-lg font-semibold">{{ $t('handoff.mobile.invalidTitle') }}</h1>
				<p class="mt-1 text-sm text-surface-500">{{ $t('handoff.mobile.invalidMsg') }}</p>
			</div>
		</template>

		<template v-else>
			<div class="space-y-1">
				<h1 class="text-lg font-semibold">{{ $t('handoff.mobile.title') }}</h1>
				<p class="text-sm text-surface-500">{{ $t('handoff.mobile.subtitle') }}</p>
			</div>

			<!-- Fotos ya enviadas en esta sesión -->
			<div v-if="sent.length" class="grid w-full max-w-xs grid-cols-3 gap-2">
				<img
					v-for="(src, i) in sent"
					:key="i"
					:src="src"
					class="aspect-square w-full rounded-lg border border-surface-200 object-cover dark:border-surface-700"
					alt=""
				/>
			</div>

			<p v-if="sent.length" class="text-sm font-medium text-green-600">
				<i class="pi pi-check-circle" /> {{ $t('handoff.mobile.success', { n: sent.length }) }}
			</p>

			<p v-if="errorKey" class="text-sm text-red-500">{{ $t(errorKey) }}</p>
			<p v-if="errorDetail" class="max-w-xs break-all rounded bg-surface-100 px-2 py-1 font-mono text-[10px] text-surface-500 dark:bg-surface-800">
				{{ errorDetail }}
			</p>

			<!-- Botón de cámara (abre la cámara trasera en el celular) -->
			<label
				class="flex w-full max-w-xs cursor-pointer items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 text-base font-semibold text-white shadow-lg transition active:scale-95"
				:class="uploading ? 'pointer-events-none opacity-60' : ''"
			>
				<i :class="uploading ? 'pi pi-spin pi-spinner' : 'pi pi-camera'" class="text-xl" />
				{{ uploading ? $t('handoff.mobile.uploading') : sent.length ? $t('handoff.mobile.another') : $t('handoff.mobile.takePhoto') }}
				<input type="file" accept="image/*" capture="environment" class="hidden" :disabled="uploading" @change="onPhoto" />
			</label>

			<p class="max-w-xs text-xs text-surface-400">{{ $t('handoff.mobile.hint') }}</p>
		</template>
	</div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { api } from '@/shared/services/api';
import { loadImage, canvasToBlob, validateFile } from '@/shared/utils/image';

/** Redibuja el archivo en un canvas y lo exporta comprimido a JPEG (máx 1600px). */
async function toJpegBlob(file: File): Promise<Blob> {
	const img = await loadImage(file);
	const canvas = document.createElement('canvas');
	canvas.width = img.naturalWidth;
	canvas.height = img.naturalHeight;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('canvas');
	ctx.drawImage(img, 0, 0);
	URL.revokeObjectURL(img.src);
	return canvasToBlob(canvas, 1600, { format: 'jpeg' });
}

/**
 * Página pública que se abre al escanear el QR desde el celular. Deja sacar una
 * foto con la cámara y la sube al backend usando el token de la sesión (que
 * viaja en el fragmento de la URL, #t=...). La compu la recibe por polling.
 */
export default defineComponent({
	name: 'MobileUploadView',
	data() {
		return {
			id: String(this.$route.params.id ?? ''),
			token: '',
			uploading: false,
			sent: [] as string[],
			errorKey: '',
			// Detalle técnico del error (para diagnosticar en dev).
			errorDetail: '',
		};
	},
	created() {
		// El token viaja en el fragmento (#t=...): no se manda al servidor en la
		// navegación ni queda en logs/referer, a diferencia del query string.
		const hash = window.location.hash.replace(/^#/, '');
		this.token = new URLSearchParams(hash).get('t') ?? '';
	},
	methods: {
		async onPhoto(ev: Event) {
			const input = ev.target as HTMLInputElement;
			const file = input.files?.[0];
			input.value = '';
			if (!file) return;

			this.errorKey = '';
			this.errorDetail = '';
			const typeErr = validateFile(file);
			if (typeErr && typeErr !== 'size') {
				// El peso lo resolvemos comprimiendo; solo cortamos por tipo inválido.
				this.errorKey = `image.err.${typeErr}`;
				this.errorDetail = `tipo: ${file.type || 'desconocido'}`;
				return;
			}

			this.uploading = true;
			let stage = 'procesar-foto';
			try {
				const blob = await toJpegBlob(file);
				stage = 'subir';
				const fd = new FormData();
				fd.append('file', blob, 'foto.jpg');
				const { data } = await api.post<{ url: string }>(`/uploads/handoff/${this.id}/foto`, fd, {
					headers: { 'x-handoff-token': this.token },
				});
				this.sent.push(data.url);
			} catch (e: unknown) {
				this.errorKey = 'handoff.mobile.errUpload';
				const err = e as { response?: { status?: number; data?: unknown }; request?: unknown; message?: string };
				if (err.response) this.errorDetail = `[${stage}] HTTP ${err.response.status} — ${JSON.stringify(err.response.data)}`;
				else if (err.request) this.errorDetail = `[${stage}] sin respuesta del servidor (red/proxy). API=${api.defaults.baseURL}`;
				else this.errorDetail = `[${stage}] ${err.message ?? String(e)}`;
			} finally {
				this.uploading = false;
			}
		},
	},
});
</script>
