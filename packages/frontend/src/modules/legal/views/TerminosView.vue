<template>
	<LegalLayout title="Términos y condiciones">
		<p>
			Estos términos regulan el uso de <strong>{{ T.producto }}</strong>, un servicio de {{ T.nombreLegal }} (nombre
			comercial "{{ T.marca }}", CUIT {{ T.cuit }}). Al usar el panel o conectar cuentas de terceros, el negocio los acepta.
		</p>

		<h2>1. El servicio</h2>
		<p>
			{{ T.producto }} permite a un negocio armar una vitrina online con sus rubros y productos, y gestionar su presencia
			en canales externos (Instagram, Facebook, Mercado Libre, WhatsApp) desde un único panel.
		</p>

		<h2>2. Cuentas y responsabilidades del negocio</h2>
		<ul>
			<li>El negocio es responsable de la veracidad del contenido que carga y publica (productos, precios, imágenes y textos).</li>
			<li>Debe tener derechos sobre las imágenes y marcas que usa, y cumplir las políticas de cada plataforma conectada.</li>
			<li>Debe mantener seguras sus credenciales de acceso al panel.</li>
		</ul>

		<h2>3. Integraciones con terceros</h2>
		<p>
			Al conectar Meta (Facebook e Instagram) o Mercado Libre, el negocio autoriza a {{ T.producto }} a actuar en su
			nombre <strong>solo</strong> para las acciones que él mismo inicia desde el panel (por ejemplo, publicar un
			producto). Esas plataformas tienen sus propios términos, que el negocio también debe respetar. La conexión puede
			revocarse en cualquier momento desde el panel o desde la plataforma de origen.
		</p>
		<p>
			{{ T.producto }} no controla la disponibilidad ni los cambios de esas plataformas; si una de ellas rechaza una
			publicación o suspende su API, la funcionalidad correspondiente puede verse afectada.
		</p>

		<h2>4. Uso aceptable</h2>
		<p>
			No se permite usar {{ T.producto }} para publicar contenido ilegal, engañoso, que infrinja derechos de terceros o
			que viole las políticas de las plataformas conectadas. Podemos suspender cuentas que incumplan estos términos.
		</p>

		<h2>5. Datos personales</h2>
		<p>
			El tratamiento de datos se rige por nuestra
			<router-link to="/privacidad">Política de privacidad</router-link>.
		</p>

		<h2>6. Limitación de responsabilidad</h2>
		<p>
			El servicio se presta "tal cual". En la medida permitida por la ley, {{ T.marca }} no responde por pérdidas
			derivadas de interrupciones del servicio, de fallas de plataformas de terceros o del contenido publicado por los
			negocios.
		</p>

		<h2>7. Cambios y contacto</h2>
		<p>
			Podemos actualizar estos términos; la versión vigente es la publicada en esta página. Consultas:
			<a :href="`mailto:${T.email}`">{{ T.email }}</a>. Rige la ley de la República Argentina.
		</p>
	</LegalLayout>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import LegalLayout from '../components/LegalLayout.vue';
import { TITULAR } from '../titular';

export default defineComponent({
	name: 'TerminosView',
	components: { LegalLayout },
	data() {
		return { T: TITULAR };
	},
});
</script>
