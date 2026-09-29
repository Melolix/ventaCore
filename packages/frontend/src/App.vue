<template>
	<router-view />
	<!-- En celu el toast (400px fijos por defecto) se salía de la pantalla:
	     debajo de 640px ocupa el ancho con 12px de margen a cada lado. -->
	<Toast :breakpoints="{ '640px': { width: 'auto', left: '0.75rem', right: '0.75rem', top: '4.5rem' } }" />
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { useDocumentTitle } from '@/composables/useDocumentTitle';

export default defineComponent({
	name: 'App',
	setup() {
		useDocumentTitle();
	},
});
</script>
