<template>
	<LegalLayout title="Política de privacidad">
		<p>
			Esta política explica qué datos trata <strong>{{ T.producto }}</strong>, el producto de {{ T.marca }} para que los
			negocios armen su tienda online y publiquen en sus redes, y cómo los protege. Rige para el panel de
			administración, las vitrinas públicas de cada negocio y las integraciones con Meta (Facebook e Instagram) y Mercado
			Libre.
		</p>

		<h2>1. Responsable del tratamiento</h2>
		<ul>
			<li><strong>Titular:</strong> {{ T.nombreLegal }}, nombre comercial "{{ T.marca }}".</li>
			<li><strong>CUIT:</strong> {{ T.cuit }}</li>
			<li><strong>Domicilio:</strong> {{ T.domicilio }}</li>
			<li><strong>Contacto:</strong> <a :href="`mailto:${T.email}`">{{ T.email }}</a> · {{ T.telefono }}</li>
		</ul>

		<h2>2. Qué datos tratamos</h2>
		<ul>
			<li>
				<strong>Cuenta del panel:</strong> nombre y correo electrónico de las personas que administran un negocio en
				{{ T.producto }}.
			</li>
			<li>
				<strong>Contenido del negocio:</strong> rubros, productos, precios, imágenes, textos institucionales y datos de
				contacto (WhatsApp, Instagram) que el negocio carga para mostrar en su vitrina.
			</li>
			<li>
				<strong>Datos de Meta (Facebook e Instagram)</strong>, solo si el negocio conecta su cuenta: identificador y nombre
				de la cuenta de Facebook que autoriza, las Páginas de Facebook que administra (identificador y nombre), la cuenta
				de Instagram profesional vinculada (identificador y nombre de usuario), los permisos otorgados y los tokens de
				acceso que Meta entrega. También guardamos un registro de las publicaciones hechas desde {{ T.producto }}
				(imagen, texto, fecha y enlace).
			</li>
			<li>
				<strong>Datos de Mercado Libre</strong>, solo si el negocio conecta su cuenta: publicaciones, ventas y preguntas
				necesarias para gestionarlas desde el panel.
			</li>
			<li>
				<strong>Visitantes de las vitrinas:</strong> no pedimos registro. Si un visitante consulta por WhatsApp, la
				conversación ocurre directamente en WhatsApp con el negocio.
			</li>
		</ul>

		<h2>3. Para qué usamos los datos de Meta</h2>
		<p>Usamos los datos y permisos de Meta <strong>únicamente</strong> para que el negocio pueda, desde el panel:</p>
		<ul>
			<li>elegir en qué Página de Facebook y cuenta de Instagram publica (<em>pages_show_list</em>, <em>pages_read_engagement</em>, <em>business_management</em>, <em>instagram_basic</em>);</li>
			<li>publicar en su Instagram, en el feed o como historia, el contenido que él mismo elige y confirma (<em>instagram_content_publish</em>);</li>
			<li>ver el historial de lo que publicó desde {{ T.producto }}.</li>
		</ul>
		<p>
			No publicamos nada sin una acción explícita del negocio, no leemos mensajes privados, no usamos estos datos para
			publicidad ni para crear perfiles, y <strong>no los vendemos ni los compartimos con terceros</strong>.
		</p>

		<h2>4. Cómo los protegemos y dónde se guardan</h2>
		<ul>
			<li>Los tokens de acceso de Meta y Mercado Libre se guardan <strong>cifrados</strong> (AES-256) y nunca se envían al navegador.</li>
			<li>La información se aloja en servidores contratados por el titular y en Google Firebase (autenticación e imágenes).</li>
			<li>Toda la comunicación viaja cifrada por HTTPS.</li>
		</ul>

		<h2>5. Cuánto tiempo los conservamos</h2>
		<p>
			Los datos de una conexión con Meta se conservan mientras la conexión esté activa. Si el negocio la desconecta desde
			el panel, quita {{ T.producto }} desde la configuración de Facebook o pide la eliminación, borramos la conexión y
			sus tokens. Los datos de la cuenta y del contenido del negocio se conservan mientras la cuenta exista.
		</p>

		<h2>6. Tus derechos</h2>
		<p>
			Podés pedir acceso, rectificación, actualización o supresión de tus datos en cualquier momento, de forma gratuita,
			escribiendo a <a :href="`mailto:${T.email}`">{{ T.email }}</a>. Para borrar los datos de Meta ver
			<router-link to="/eliminar-datos">Eliminación de datos</router-link>.
		</p>
		<p>
			La Agencia de Acceso a la Información Pública, en su carácter de Órgano de Control de la Ley N° 25.326, tiene la
			atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por
			incumplimiento de las normas vigentes en materia de protección de datos personales.
		</p>

		<h2>7. Cambios</h2>
		<p>
			Si modificamos esta política, publicaremos la nueva versión en esta misma página con su fecha de actualización.
		</p>
	</LegalLayout>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import LegalLayout from '../components/LegalLayout.vue';
import { TITULAR } from '../titular';

export default defineComponent({
	name: 'PrivacidadView',
	components: { LegalLayout },
	data() {
		return { T: TITULAR };
	},
});
</script>
