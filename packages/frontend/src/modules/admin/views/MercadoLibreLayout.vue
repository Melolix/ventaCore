<template>
	<div class="mx-auto max-w-6xl">
		<!-- Sub-pestañas de Mercado Libre. En mobile: 6 columnas con el ícono arriba
		     (entran todas en una fila, sin partirse ni esconderse en un scroll);
		     desde sm: fila horizontal clásica. -->
		<div class="mb-6 grid grid-cols-[1.3fr_1fr_1fr_1fr_1fr_1fr] border-b border-surface-200 sm:flex sm:gap-1 dark:border-surface-700">
			<router-link
				v-for="tab in tabs"
				:key="tab.name"
				:to="{ name: tab.name }"
				class="-mb-px flex min-w-0 flex-col items-center justify-center gap-1 border-b-2 px-0.5 py-2 text-[10px] font-semibold transition-colors sm:flex-row sm:gap-1.5 sm:px-4 sm:py-2.5 sm:text-sm"
				:class="
					isActive(tab.name)
						? 'border-amber-500 text-surface-900 dark:text-surface-0'
						: 'border-transparent text-surface-500 hover:text-surface-700 dark:hover:text-surface-200'
				"
			>
				<i :class="tab.icon" /><span class="max-w-full truncate">{{ $t(tab.label) }}</span>
			</router-link>
		</div>
		<router-view />
	</div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
	name: 'MercadoLibreLayout',
	data() {
		return {
			tabs: [
				{ name: 'admin-ml-publicaciones', label: 'admin.ml.tabs.publicaciones', icon: 'pi pi-shopping-cart' },
				{ name: 'admin-ml-talles', label: 'admin.ml.tabs.talles', icon: 'pi pi-table' },
				{ name: 'admin-ml-ventas', label: 'admin.ml.tabs.ventas', icon: 'pi pi-receipt' },
				{ name: 'admin-ml-preguntas', label: 'admin.ml.tabs.preguntas', icon: 'pi pi-comments' },
				{ name: 'admin-ml-metricas', label: 'admin.ml.tabs.metricas', icon: 'pi pi-chart-bar' },
				{ name: 'admin-ml-estudio', label: 'admin.ml.tabs.estudio', icon: 'pi pi-chart-line' },
			],
		};
	},
	methods: {
		isActive(name: string): boolean {
			return this.$route.name === name;
		},
	},
});
</script>
