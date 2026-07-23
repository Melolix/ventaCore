<template>
	<div class="flex flex-col gap-2">
		<!-- Campo de URL: sirve para pegar un link de tienda o queda con la URL del APK subido -->
		<InputText v-model="urlProxy" class="w-full" :placeholder="placeholder" />

		<div class="flex flex-wrap items-center gap-2">
			<Button
				:label="modelValue && isUploaded ? $t('file.replaceApk') : $t('file.uploadApk')"
				icon="pi pi-upload"
				size="small"
				outlined
				:loading="uploading"
				@click="pick"
			/>
			<a
				v-if="isUploaded"
				:href="modelValue!"
				target="_blank"
				rel="noopener"
				class="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
			>
				<i class="pi pi-download" /> {{ $t('file.download') }}
			</a>
			<span v-if="isUploaded" class="inline-flex items-center gap-1.5 text-xs text-surface-400">
				<i class="pi pi-check-circle text-green-500" /> {{ $t('file.uploaded') }}
			</span>
		</div>

		<p v-if="errorKey" class="px-1 text-xs text-red-500">{{ $t(errorKey) }}</p>

		<input ref="fileInput" type="file" :accept="accept" class="hidden" @change="onFile" />
	</div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { APK_CONTENT_TYPE, deleteFile, uploadFile, validateApk } from '@/shared/utils/file';

const props = withDefaults(
	defineProps<{
		modelValue: string | null;
		/** Subcarpeta en Storage (ej. 'apks'). */
		folder: string;
		/** Tipos aceptados por el input file. */
		accept?: string;
		placeholder?: string;
	}>(),
	{ accept: '.apk,application/vnd.android.package-archive', placeholder: '' },
);

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const fileInput = ref<HTMLInputElement | null>(null);
const uploading = ref(false);
const errorKey = ref('');

/** ¿La URL actual es un archivo subido a NUESTRO Storage? (vs. un link de tienda pegado a mano) */
const isUploaded = computed(() => !!props.modelValue && /\/o\/uploads(?:%2F|\/)/.test(props.modelValue));

// v-model de la URL editable a mano (pegar link de tienda).
const urlProxy = computed({
	get: () => props.modelValue ?? '',
	set: (val: string) => {
		selfEmitted = val;
		emit('update:modelValue', val);
	},
});

// Subidas hechas por esta instancia y aún NO persistidas por el padre. Si se
// reemplazan o quitan antes de guardar, se borran de Storage para no dejar
// archivos huérfanos (mismo criterio que ImageUpload).
const pending = new Set<string>();
let selfEmitted: string | null = null;
watch(
	() => props.modelValue,
	val => {
		if (val === selfEmitted) return; // cambio propio
		pending.clear(); // cambio externo (carga al editar / reset tras guardar)
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

	const err = validateApk(file);
	if (err) {
		errorKey.value = `file.err.${err}`;
		return;
	}

	uploading.value = true;
	errorKey.value = '';
	try {
		const prevUrl = props.modelValue;
		const url = await uploadFile(file, props.folder, APK_CONTENT_TYPE);
		// Si reemplazamos una subida pendiente (aún sin guardar), la anterior es basura.
		if (prevUrl && pending.has(prevUrl)) {
			pending.delete(prevUrl);
			void deleteFile(prevUrl);
		}
		pending.add(url);
		selfEmitted = url;
		emit('update:modelValue', url);
	} catch {
		errorKey.value = 'file.err.upload';
	} finally {
		uploading.value = false;
	}
}
</script>
