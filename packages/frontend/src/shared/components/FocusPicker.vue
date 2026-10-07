<template>
	<div class="space-y-2">
		<p class="flex items-center gap-1.5 px-1 text-xs text-surface-500">
			<i class="pi pi-bullseye text-[11px]" /> {{ $t('focusPicker.hint') }}
		</p>
		<div class="flex items-start gap-3">
			<!-- La portada entera (3:1): tocá o arrastrá para mover el foco. -->
			<div
				ref="area"
				class="relative min-w-0 flex-1 cursor-crosshair touch-none select-none overflow-hidden rounded-xl"
				:style="{ aspectRatio: String(aspectRatio) }"
				@pointerdown="onDown"
				@pointermove="onMove"
				@pointerup="dragging = false"
				@pointercancel="dragging = false"
			>
				<img :src="src" class="pointer-events-none h-full w-full object-cover" alt="" draggable="false" />
				<span
					class="pointer-events-none absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary/60 shadow-[0_0_0_2px_rgba(0,0,0,0.35)]"
					:style="{ left: point.x + '%', top: point.y + '%' }"
				/>
			</div>
			<!-- Cómo queda recortada en el celu (caja casi cuadrada). -->
			<div class="w-20 shrink-0 space-y-1 sm:w-24">
				<div class="aspect-square overflow-hidden rounded-lg border border-surface-200 dark:border-surface-700">
					<img :src="src" class="h-full w-full object-cover" :style="{ objectPosition: position }" alt="" />
				</div>
				<p class="text-center text-[10px] leading-tight text-surface-400"><i class="pi pi-mobile text-[10px]" /> {{ $t('focusPicker.mobile') }}</p>
			</div>
		</div>
		<button
			v-if="modelValue"
			type="button"
			class="px-1 text-xs font-medium text-surface-500 underline-offset-2 hover:text-primary hover:underline"
			@click="$emit('update:modelValue', null)"
		>
			{{ $t('focusPicker.reset') }}
		</button>
	</div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';

/**
 * Elegir el punto de foco de una portada. Guarda "x% y%" (CSS object-position):
 * donde se muestre recortada (p. ej. casi cuadrada en el celu), el recorte se
 * centra en lo importante de la foto. null = centro.
 */
export default defineComponent({
	name: 'FocusPicker',
	props: {
		src: { type: String, required: true },
		modelValue: { type: String as PropType<string | null>, default: null },
		/** Proporción con la que se sube la portada (la del área para tocar). */
		aspectRatio: { type: Number, default: 3 },
	},
	emits: ['update:modelValue'],
	data() {
		return { dragging: false };
	},
	computed: {
		point(): { x: number; y: number } {
			const m = /^(\d+)% (\d+)%$/.exec(this.modelValue ?? '');
			return m ? { x: Number(m[1]), y: Number(m[2]) } : { x: 50, y: 50 };
		},
		position(): string {
			return `${this.point.x}% ${this.point.y}%`;
		},
	},
	methods: {
		onDown(e: PointerEvent) {
			this.dragging = true;
			(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
			this.setFrom(e);
		},
		onMove(e: PointerEvent) {
			if (this.dragging) this.setFrom(e);
		},
		setFrom(e: PointerEvent) {
			const r = (this.$refs.area as HTMLElement).getBoundingClientRect();
			const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(n)));
			const x = clamp(((e.clientX - r.left) / r.width) * 100);
			const y = clamp(((e.clientY - r.top) / r.height) * 100);
			this.$emit('update:modelValue', `${x}% ${y}%`);
		},
	},
});
</script>
