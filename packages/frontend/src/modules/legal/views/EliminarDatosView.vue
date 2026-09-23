<template>
	<LegalLayout title="Eliminación de datos">
		<!-- Meta redirige acá con ?codigo=... tras un pedido de borrado (callback data-deletion). -->
		<div v-if="codigo" class="mb-8 rounded-xl bg-green-50 p-4 text-green-800 dark:bg-green-950/40 dark:text-green-300">
			<p class="!mb-0">
				<i class="pi pi-check-circle" /> Tu pedido de eliminación fue procesado. Código de confirmación:
				<strong>{{ codigo }}</strong>. Borramos la conexión con Meta y sus tokens de acceso.
			</p>
		</div>

		<p>
			Podés borrar en cualquier momento los datos que <strong>{{ T.producto }}</strong> guarda sobre tu cuenta de
			Facebook e Instagram (identificadores, nombres de Páginas y cuentas, permisos y tokens de acceso). Tenés tres
			formas:
		</p>

		<h2>1. Desde el panel de {{ T.producto }}</h2>
		<p>
			Entrá a <strong>Configuraciones</strong>, en la sección <strong>Redes sociales</strong> tocá
			<strong>Desconectar</strong>. La conexión y sus tokens se borran al instante.
		</p>

		<h2>2. Desde Facebook</h2>
		<ul>
			<li>En Facebook, abrí <strong>Configuración y privacidad → Configuración → Integraciones comerciales</strong> (o "Apps y sitios web").</li>
			<li>Buscá <strong>{{ T.producto }}</strong> y tocá <strong>Eliminar</strong>.</li>
			<li>Si además marcás la opción de borrar los datos, Facebook nos envía el pedido y los eliminamos automáticamente.</li>
		</ul>

		<h2>3. Por correo</h2>
		<p>
			Escribinos a <a :href="`mailto:${T.email}?subject=Eliminación de datos`">{{ T.email }}</a> desde el correo de tu
			cuenta, indicando el negocio. Respondemos y completamos el borrado en un plazo máximo de 10 días hábiles.
		</p>

		<p>
			Más información en la <router-link to="/privacidad">Política de privacidad</router-link>.
		</p>
	</LegalLayout>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import LegalLayout from '../components/LegalLayout.vue';
import { TITULAR } from '../titular';

export default defineComponent({
	name: 'EliminarDatosView',
	components: { LegalLayout },
	data() {
		return { T: TITULAR };
	},
	computed: {
		codigo(): string {
			const c = this.$route.query.codigo;
			return typeof c === 'string' ? c.replace(/[^a-f0-9]/gi, '').slice(0, 32) : '';
		},
	},
});
</script>
