<template>
	<div class="flex flex-col gap-2">
		<!-- Preview / zona de subida -->
		<div
			class="group relative overflow-hidden rounded-2xl border border-dashed border-surface-300 bg-surface-100/60 dark:border-surface-600 dark:bg-surface-800/40"
			:style="{ aspectRatio: String(aspectRatio) }"
		>
			<template v-if="modelValue">
				<img :src="modelValue" class="h-full w-full" :class="rounded ? 'object-contain p-3' : 'object-cover'" alt="" />
				<div
					class="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"
				>
					<Button icon="pi pi-pencil" rounded size="small" :aria-label="$t('common.edit')" @click="pick" />
					<Button icon="pi pi-trash" rounded severity="danger" size="small" :aria-label="$t('common.delete')" @click="remove" />
				</div>
			</template>
			<button
				v-else
				type="button"
				class="flex h-full w-full flex-col items-center justify-center gap-1 text-surface-400 transition-colors hover:text-primary"
				@click="pick"
			>
				<i class="pi pi-image text-2xl" />
				<span class="text-xs font-medium">{{ $t('image.upload') }}</span>
			</button>

			<div
				v-if="uploading"
				class="absolute inset-0 flex items-center justify-center bg-surface-0/70 dark:bg-surface-900/70"
			>
				<i class="pi pi-spin pi-spinner text-2xl text-primary" />
			</div>
		</div>

		<p v-if="hint" class="px-1 text-xs text-surface-400">{{ hint }}</p>
		<p v-if="errorKey" class="px-1 text-xs text-red-500">{{ $t(errorKey) }}</p>
		<p v-if="errorDetail" class="px-1 text-xs break-words text-red-500">{{ errorDetail }}</p>

		<input ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp" class="hidden" @change="onFile" />

		<!-- Recorte -->
		<Dialog v-model:visible="cropVisible" modal :header="$t('image.cropTitle')" class="w-full max-w-xl" @hide="cleanup">
			<div class="h-[360px] overflow-hidden rounded-xl bg-surface-900">
				<Cropper ref="cropper" :src="cropSrc" :stencil-props="{ aspectRatio }" image-restriction="fit-area" class="h-full" />
			</div>
			<template #footer>
				<Button :label="$t('common.cancel')" text @click="cropVisible = false" />
				<Button :label="$t('image.cropSave')" icon="pi pi-check" :loading="uploading" @click="confirmCrop" />
			</template>
		</Dialog>
	</div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Cropper } from 'vue-advanced-cropper';
import 'vue-advanced-cropper/dist/style.css';
import { validateFile, loadImage, checkDimensions, canvasToBlob, uploadImage, type ImageError } from '@/shared/utils/image';

const props = withDefaults(
	defineProps<{
		modelValue: string | null;
		/** Relación de aspecto del recorte (ej. 16/9, 1, 4/3). */
		aspectRatio?: number;
		/** Subcarpeta en Storage (ej. 'rubros', 'productos'). */
		folder: string;
		/** Ancho máximo de salida, en px. */
		maxWidth?: number;
		/** Dimensiones mínimas aceptadas (evita subir fotos que quedarían borrosas). */
		minWidth?: number;
		minHeight?: number;
		/** Preview con object-contain (para logos con fondo transparente). */
		rounded?: boolean;
		hint?: string;
	}>(),
	{ aspectRatio: 16 / 9, maxWidth: 1600, minWidth: 600, minHeight: 0, rounded: false, hint: '' },
);

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const fileInput = ref<HTMLInputElement | null>(null);
const cropper = ref<InstanceType<typeof Cropper> | null>(null);
const cropVisible = ref(false);
const cropSrc = ref('');
const uploading = ref(false);
const errorKey = ref('');
const errorDetail = ref('');

const errKey = (e: ImageError): string => `image.err.${e}`;

function pick(): void {
	errorKey.value = '';
	fileInput.value?.click();
}

async function onFile(ev: Event): Promise<void> {
	const input = ev.target as HTMLInputElement;
	const file = input.files?.[0];
	input.value = ''; // permite re-seleccionar el mismo archivo
	if (!file) return;

	const typeErr = validateFile(file);
	if (typeErr) {
		errorKey.value = errKey(typeErr);
		return;
	}

	try {
		const img = await loadImage(file);
		const dimErr = checkDimensions(img, { minWidth: props.minWidth, minHeight: props.minHeight });
		URL.revokeObjectURL(img.src);
		if (dimErr) {
			errorKey.value = errKey(dimErr);
			return;
		}
	} catch {
		errorKey.value = errKey('decode');
		return;
	}

	cropSrc.value = URL.createObjectURL(file);
	cropVisible.value = true;
}

async function confirmCrop(): Promise<void> {
	if (!cropper.value) return;
	uploading.value = true;
	errorKey.value = '';
	errorDetail.value = '';
	try {
		const { canvas } = (cropper.value as unknown as { getResult(): { canvas?: HTMLCanvasElement } }).getResult();
		if (!canvas) throw new Error('canvas');
		const blob = await canvasToBlob(canvas, props.maxWidth);
		const url = await uploadImage(blob, props.folder);
		emit('update:modelValue', url);
		cropVisible.value = false;
	} catch (e: unknown) {
		errorKey.value = 'image.err.upload';
		// Superficie temporal del error real (código Firebase / mensaje) para diagnóstico.
		const code = (e as { code?: string })?.code;
		const msg = e instanceof Error ? e.message : String(e);
		errorDetail.value = code ? `${code} — ${msg}` : msg;
	} finally {
		uploading.value = false;
	}
}

function remove(): void {
	errorKey.value = '';
	emit('update:modelValue', '');
}

function cleanup(): void {
	if (cropSrc.value) {
		URL.revokeObjectURL(cropSrc.value);
		cropSrc.value = '';
	}
}
</script>
