<template>
	<Button
		type="button"
		icon="pi pi-qrcode"
		:label="label ?? $t('handoff.qr.button')"
		severity="secondary"
		outlined
		size="small"
		@click="open"
	/>

	<Dialog v-model:visible="visible" modal :header="$t('handoff.qr.title')" class="w-full max-w-sm" @hide="stop">
		<div class="flex flex-col items-center gap-4 py-2 text-center">
			<p class="text-sm text-surface-500">{{ $t('handoff.qr.subtitle') }}</p>

			<div v-if="loading" class="flex h-56 items-center justify-center">
				<i class="pi pi-spin pi-spinner text-2xl text-primary" />
			</div>

			<template v-else-if="expired">
				<i class="pi pi-clock text-3xl text-amber-500" />
				<p class="text-sm">{{ $t('handoff.qr.expired') }}</p>
				<Button :label="$t('handoff.qr.regenerate')" icon="pi pi-refresh" size="small" @click="open" />
			</template>

			<template v-else-if="errorKey">
				<i class="pi pi-exclamation-triangle text-3xl text-red-500" />
				<p class="text-sm text-red-500">{{ $t(errorKey) }}</p>
				<Button :label="$t('handoff.qr.regenerate')" icon="pi pi-refresh" size="small" @click="open" />
			</template>

			<template v-else>
				<img :src="qrDataUrl" :alt="$t('handoff.qr.title')" class="h-56 w-56 rounded-xl bg-white p-2" />

				<p v-if="received > 0" class="text-sm font-medium text-green-600">
					<i class="pi pi-check-circle" /> {{ $t('handoff.qr.received', { n: received }) }}
				</p>
				<p v-else class="flex items-center gap-2 text-sm text-surface-500">
					<i class="pi pi-spin pi-spinner" /> {{ $t('handoff.qr.waiting') }}
				</p>

				<!-- Link directo: útil si no podés escanear (o para probar en la misma máquina). -->
				<button type="button" class="text-xs text-primary underline" @click="copyLink">
					{{ copied ? $t('handoff.qr.copied') : $t('handoff.qr.copyLink') }}
				</button>
			</template>
		</div>

		<template #footer>
			<Button :label="$t('handoff.qr.done')" text @click="visible = false" />
		</template>
	</Dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import QRCode from 'qrcode';
import { api } from '@/shared/services/api';

defineProps<{ label?: string }>();
const emit = defineEmits<{ photos: [urls: string[]] }>();

const visible = ref(false);
const loading = ref(false);
const expired = ref(false);
const errorKey = ref('');
const qrDataUrl = ref('');
const mobileUrl = ref('');
const received = ref(0);
const copied = ref(false);

let sessionId = '';
let pollTimer: ReturnType<typeof setInterval> | null = null;

function stop(): void {
	if (pollTimer) {
		clearInterval(pollTimer);
		pollTimer = null;
	}
}

async function open(): Promise<void> {
	visible.value = true;
	loading.value = true;
	expired.value = false;
	errorKey.value = '';
	received.value = 0;
	copied.value = false;
	stop();
	try {
		const { data } = await api.post<{ id: string; token: string; expiresAt: number }>('/uploads/handoff');
		sessionId = data.id;
		// El link apunta a esta misma app (origen actual); el token va en el fragmento.
		mobileUrl.value = `${window.location.origin}/m/subir/${data.id}#t=${data.token}`;
		qrDataUrl.value = await QRCode.toDataURL(mobileUrl.value, { width: 240, margin: 1 });
		pollTimer = setInterval(poll, 2000);
	} catch {
		errorKey.value = 'handoff.qr.error';
	} finally {
		loading.value = false;
	}
}

async function poll(): Promise<void> {
	if (!sessionId) return;
	try {
		const { data } = await api.get<{ images: string[]; expiresAt: number }>(`/uploads/handoff/${sessionId}`);
		if (data.images.length > received.value) {
			const nuevas = data.images.slice(received.value);
			received.value = data.images.length;
			emit('photos', nuevas);
		}
	} catch (e: unknown) {
		// 404 → la sesión expiró (o fue barrida). Dejamos de consultar.
		const status = (e as { response?: { status?: number } })?.response?.status;
		if (status === 404) {
			expired.value = true;
			stop();
		}
	}
}

async function copyLink(): Promise<void> {
	try {
		await navigator.clipboard.writeText(mobileUrl.value);
		copied.value = true;
		setTimeout(() => (copied.value = false), 1500);
	} catch {
		/* sin portapapeles: no es crítico */
	}
}
</script>
