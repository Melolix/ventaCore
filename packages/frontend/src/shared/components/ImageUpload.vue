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
import { ref, watch } from 'vue';
import { Cropper } from 'vue-advanced-cropper';
import 'vue-advanced-cropper/dist/style.css';
import { validateFile, loadImage, checkDimensions, canvasToBlob, uploadImage, deleteImage, type ImageError } from '@/shared/utils/image';

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

const errKey = (e: ImageError): string => `image.err.${e}`;

// URLs subidas por esta instancia y todavía NO persistidas (el padre no guardó).
// Si el usuario las descarta (reemplaza o quita) antes de guardar, las borramos
// de Storage para no dejar huérfanos. Nunca contiene la imagen ya guardada de un
// rubro en edición: esas llegan como cambio EXTERNO de modelValue y limpian el set.
const pending = new Set<string>();
// Distingue un cambio de modelValue causado por nosotros (emit) de uno externo
// (carga al editar, reset tras guardar). Ante un cambio externo, lo ya subido
// quedó persistido o el padre siguió de largo: en ningún caso es seguro borrarlo.
let selfEmitted: string | null = null;
watch(
	() => props.modelValue,
	val => {
		if (val === selfEmitted) return; // cambio propio: lo ignoramos
		pending.clear(); // cambio externo (guardado/carga): olvidamos lo pendiente
	},
);

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
	try {
		const { canvas } = (cropper.value as unknown as { getResult(): { canvas?: HTMLCanvasElement } }).getResult();
		if (!canvas) throw new Error('canvas');
		const blob = await canvasToBlob(canvas, props.maxWidth);
		const prevUrl = props.modelValue;
		const url = await uploadImage(blob, props.folder);
		// Si reemplazamos una subida pendiente (aún sin guardar), la anterior es
		// basura: la borramos ya. La imagen persistida no está en `pending`.
		if (prevUrl && pending.has(prevUrl)) {
			pending.delete(prevUrl);
			void deleteImage(prevUrl);
		}
		pending.add(url);
		selfEmitted = url;
		emit('update:modelValue', url);
		cropVisible.value = false;
	} catch {
		errorKey.value = 'image.err.upload';
	} finally {
		uploading.value = false;
	}
}

function remove(): void {
	errorKey.value = '';
	const cur = props.modelValue;
	// Solo borramos de Storage si era una subida pendiente (sin guardar). Si es la
	// imagen ya persistida de un rubro, la limpia el store al guardar el cambio;
	// borrarla acá rompería el rubro si el usuario cancela la edición.
	if (cur && pending.has(cur)) {
		pending.delete(cur);
		void deleteImage(cur);
	}
	selfEmitted = '';
	emit('update:modelValue', '');
}

function cleanup(): void {
	if (cropSrc.value) {
		URL.revokeObjectURL(cropSrc.value);
		cropSrc.value = '';
	}
}
</script>
