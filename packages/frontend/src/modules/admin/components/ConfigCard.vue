<template>
	<section class="glass-card overflow-hidden rounded-2xl">
		<!-- Cabecera: siempre visible. Cerrada, resume en qué estado está (así se ven
		     todas las configuraciones de un vistazo); abrirla muestra lo que hay que completar. -->
		<button
			type="button"
			class="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-surface-100/40 sm:p-5 dark:hover:bg-surface-800/30"
			:aria-expanded="open"
			@click="open = !open"
		>
			<div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" :class="iconClass">
				<i :class="icon" class="text-xl" />
			</div>
			<div class="min-w-0 flex-1">
				<h3 class="truncate font-semibold text-surface-900 dark:text-surface-0">{{ title }}</h3>
				<p class="truncate text-xs text-surface-500">{{ open ? hint : summary || hint }}</p>
			</div>
			<!-- Estado: en el celu solo el punto de color; desde sm, también el texto. -->
			<span
				v-if="status"
				class="inline-flex shrink-0 items-center gap-1.5 rounded-full px-1 py-0.5 text-[11px] font-semibold sm:px-2.5"
				:class="toneCls"
				:title="status"
			>
				<span class="h-2 w-2 rounded-full bg-current" />
				<span class="hidden sm:inline">{{ status }}</span>
			</span>
			<span class="inline-flex shrink-0 text-surface-400 transition-transform" :class="open ? 'rotate-180' : ''">
				<i class="pi pi-chevron-down text-sm" />
			</span>
		</button>
		<!-- v-show (no v-if): el contenido se carga igual, así el resumen de la
		     cabecera está disponible con la tarjeta cerrada y no se pierde lo tipeado. -->
		<div v-show="open" class="border-t border-surface-200/60 p-4 sm:p-6 dark:border-surface-700/60">
			<slot />
		</div>
	</section>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';

/**
 * Tarjeta desplegable de Configuraciones. Cerrada muestra ícono, nombre, un
 * resumen de una línea y el estado (listo / falta / neutro); al tocarla se abre
 * el formulario. Todas arrancan cerradas para que la pantalla entre de un vistazo.
 */
export default defineComponent({
	name: 'ConfigCard',
	props: {
		icon: { type: String, required: true },
		/** Clases de color del cuadrito del ícono (ej. "bg-amber-500/10 text-amber-500"). */
		iconClass: { type: String, default: 'bg-primary/10 text-primary' },
		title: { type: String, required: true },
		/** Explicación de para qué sirve (se ve con la tarjeta abierta, o cerrada si no hay resumen). */
		hint: { type: String, default: '' },
		/** Resumen de lo configurado, para la tarjeta cerrada ("Conectado como …"). */
		summary: { type: String, default: '' },
		/** Texto corto del estado ("Conectado", "Falta configurar"). Vacío = sin indicador. */
		status: { type: String, default: '' },
		tone: { type: String as PropType<'ok' | 'warn' | 'muted'>, default: 'muted' },
		defaultOpen: { type: Boolean, default: false },
	},
	data() {
		return { open: this.defaultOpen };
	},
	computed: {
		toneCls(): string {
			if (this.tone === 'ok') return 'text-emerald-600 sm:bg-emerald-500/10 dark:text-emerald-400';
			if (this.tone === 'warn') return 'text-amber-600 sm:bg-amber-500/10 dark:text-amber-400';
			return 'text-surface-400 sm:bg-surface-500/10';
		},
	},
});
</script>
