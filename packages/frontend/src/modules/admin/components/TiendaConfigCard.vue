<template>
	<section class="glass-card rounded-2xl p-6">
		<div class="mb-5 flex items-center gap-3">
			<div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
				<i class="pi pi-shop text-xl" />
			</div>
			<div class="min-w-0">
				<h3 class="font-semibold text-surface-900 dark:text-surface-0">{{ $t('admin.config.tienda.title') }}</h3>
				<p class="text-xs text-surface-500">{{ $t('admin.config.tienda.hint') }}</p>
			</div>
		</div>

		<div class="space-y-6">
			<!-- WhatsApp: a dónde llegan los pedidos y las consultas de la tienda. -->
			<div class="space-y-1.5">
				<label for="tienda-whatsapp" class="flex items-center gap-1.5 text-sm font-medium">
					<i class="pi pi-whatsapp text-emerald-500" /> {{ $t('admin.config.tienda.whatsapp') }}
				</label>
				<InputText
					id="tienda-whatsapp"
					v-model.trim="form.whatsapp"
					class="w-full"
					type="tel"
					inputmode="tel"
					maxlength="30"
					placeholder="5493511234567"
				/>
				<p class="text-xs text-surface-500">
					{{ $t('admin.config.tienda.whatsappHint') }}
					<template v-if="!form.whatsapp">
						{{ generalWhatsapp ? $t('admin.config.tienda.whatsappFallback', { n: generalWhatsapp }) : $t('admin.config.tienda.whatsappNone') }}
					</template>
				</p>
			</div>

			<!-- Despacho: desde dónde sale el paquete. Con esto se le cotiza el envío al cliente. -->
			<div class="space-y-2 border-t border-surface-200 pt-5 dark:border-surface-700">
				<div>
					<p class="flex items-center gap-1.5 text-sm font-medium"><i class="pi pi-map-marker text-primary" /> {{ $t('admin.config.tienda.despacho') }}</p>
					<p class="text-xs text-surface-500">{{ $t('admin.config.tienda.despachoHint') }}</p>
				</div>
				<div class="grid grid-cols-2 gap-2 sm:grid-cols-6">
					<div class="col-span-2 space-y-1 sm:col-span-4">
						<label for="tienda-calle" class="text-xs font-medium text-surface-500">{{ $t('public.cart.street') }}</label>
						<InputText id="tienda-calle" v-model.trim="form.despacho.calle" class="w-full" maxlength="80" autocomplete="address-line1" />
					</div>
					<div class="space-y-1 sm:col-span-2">
						<label for="tienda-numero" class="text-xs font-medium text-surface-500">{{ $t('public.cart.number') }}</label>
						<InputText id="tienda-numero" v-model.trim="form.despacho.numero" class="w-full" maxlength="12" inputmode="numeric" />
					</div>
					<div class="space-y-1 sm:col-span-2">
						<label for="tienda-cp" class="text-xs font-medium text-surface-500">{{ $t('public.cart.zip') }}</label>
						<InputText id="tienda-cp" v-model.trim="form.despacho.cp" class="w-full" maxlength="8" autocomplete="postal-code" />
					</div>
					<div class="col-span-2 space-y-1 sm:col-span-3">
						<label for="tienda-ciudad" class="text-xs font-medium text-surface-500">{{ $t('public.cart.city') }}</label>
						<InputText id="tienda-ciudad" v-model.trim="form.despacho.ciudad" class="w-full" maxlength="60" autocomplete="address-level2" />
					</div>
					<div class="col-span-2 space-y-1 sm:col-span-3">
						<label for="tienda-provincia" class="text-xs font-medium text-surface-500">{{ $t('public.cart.province') }}</label>
						<Select
							v-model="form.despacho.provincia"
							input-id="tienda-provincia"
							:options="provincias"
							option-label="nombre"
							option-value="code"
							fluid
							:placeholder="$t('public.cart.provincePlaceholder')"
						/>
					</div>
					<div class="col-span-2 space-y-1 sm:col-span-3">
						<label for="tienda-desp-nombre" class="text-xs font-medium text-surface-500">{{ $t('admin.rubros.envios.nombre') }}</label>
						<InputText id="tienda-desp-nombre" v-model.trim="form.despacho.nombre" class="w-full" maxlength="80" />
					</div>
					<div class="col-span-2 space-y-1 sm:col-span-3">
						<label for="tienda-desp-tel" class="text-xs font-medium text-surface-500">{{ $t('admin.rubros.envios.telefono') }}</label>
						<InputText id="tienda-desp-tel" v-model.trim="form.despacho.telefono" class="w-full" type="tel" inputmode="tel" maxlength="30" />
					</div>
				</div>
				<!-- Estado: lo que le importa al vendedor es si el cliente ya ve el costo del envío. -->
				<p class="flex items-start gap-2 rounded-lg px-3 py-2 text-xs font-medium" :class="estado.cls">
					<i class="pi mt-0.5" :class="estado.icon" /> {{ estado.text }}
				</p>
			</div>

			<!-- Datos para transferir: el cliente los ve cuando aceptás su pedido. -->
			<div class="space-y-2 border-t border-surface-200 pt-5 dark:border-surface-700">
				<div>
					<p class="flex items-center gap-1.5 text-sm font-medium"><i class="pi pi-wallet text-primary" /> {{ $t('admin.rubros.pago.title') }}</p>
					<p class="text-xs text-surface-500">{{ $t('admin.rubros.pago.hint') }}</p>
				</div>
				<div class="grid gap-2 sm:grid-cols-2">
					<div class="space-y-1">
						<label for="tienda-alias" class="text-xs font-medium text-surface-500">{{ $t('admin.rubros.pago.alias') }}</label>
						<InputText id="tienda-alias" v-model.trim="form.pagoAlias" class="w-full" maxlength="60" />
					</div>
					<div class="space-y-1">
						<label for="tienda-cbu" class="text-xs font-medium text-surface-500">{{ $t('admin.rubros.pago.cbu') }}</label>
						<InputText id="tienda-cbu" v-model.trim="form.pagoCbu" class="w-full" maxlength="30" inputmode="numeric" />
					</div>
					<div class="space-y-1 sm:col-span-2">
						<label for="tienda-titular" class="text-xs font-medium text-surface-500">{{ $t('admin.rubros.pago.titular') }}</label>
						<InputText id="tienda-titular" v-model.trim="form.pagoTitular" class="w-full" maxlength="80" />
					</div>
				</div>
			</div>

			<!-- Opciones de envío menos frecuentes: plegadas para no tapar lo importante. -->
			<div class="border-t border-surface-200 pt-4 dark:border-surface-700">
				<button
					type="button"
					class="flex w-full items-center justify-between gap-2 text-left text-sm font-medium text-surface-600 hover:text-primary dark:text-surface-300"
					:aria-expanded="avanzado"
					@click="avanzado = !avanzado"
				>
					{{ $t('admin.config.tienda.advanced') }}
					<i class="pi text-xs" :class="avanzado ? 'pi-chevron-up' : 'pi-chevron-down'" />
				</button>
				<div v-if="avanzado" class="mt-4 space-y-5">
					<div class="space-y-1.5">
						<p class="text-sm font-medium">{{ $t('admin.rubros.envios.paquete') }}</p>
						<p class="text-xs text-surface-500">{{ $t('admin.rubros.envios.paqueteHint') }}</p>
						<div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
							<div v-for="k in paqueteKeys" :key="k" class="space-y-1">
								<label :for="'tienda-paq-' + k" class="text-xs font-medium text-surface-500">{{ $t('admin.rubros.envios.' + k) }}</label>
								<InputNumber v-model="form.paquete[k]" :input-id="'tienda-paq-' + k" fluid :min="1" :max="k === 'peso' ? 100000 : 300" />
							</div>
						</div>
					</div>
					<div class="space-y-1.5">
						<p class="text-sm font-medium">{{ $t('admin.rubros.envios.cuenta') }}</p>
						<p class="text-xs" :class="rubro.enviaPropia ? 'text-emerald-600 dark:text-emerald-400' : 'text-surface-500'">
							{{ rubro.enviaPropia ? $t('admin.rubros.envios.cuentaPropia') : $t('admin.rubros.envios.cuentaPlataforma') }}
						</p>
						<!-- El token solo se escribe: nunca vuelve del servidor. -->
						<InputText
							v-model.trim="form.enviaToken"
							class="w-full"
							type="password"
							autocomplete="off"
							maxlength="200"
							:placeholder="$t(rubro.enviaPropia ? 'admin.rubros.envios.tokenReplace' : 'admin.rubros.envios.tokenPlaceholder')"
							:aria-label="$t('admin.rubros.envios.tokenPlaceholder')"
						/>
						<button
							v-if="rubro.enviaPropia"
							type="button"
							class="text-xs font-semibold underline underline-offset-2"
							:class="form.enviaDesconectar ? 'text-red-500' : 'text-surface-500 hover:text-red-500'"
							@click="form.enviaDesconectar = !form.enviaDesconectar"
						>
							{{ form.enviaDesconectar ? $t('admin.rubros.envios.desconectarUndo') : $t('admin.rubros.envios.desconectar') }}
						</button>
					</div>
				</div>
			</div>

			<div class="flex flex-wrap items-center gap-3">
				<Button :label="$t('admin.config.tienda.save')" icon="pi pi-check" :loading="saving" :disabled="!dirty" @click="save" />
				<span v-if="dirty" class="text-xs font-medium text-amber-600 dark:text-amber-400">{{ $t('admin.config.tienda.unsaved') }}</span>
			</div>
		</div>
	</section>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import { PROVINCIAS_AR, type DespachoConfig, type Paquete, type Rubro } from '@base-template/shared';
import { useCatalogStore, type RubroUpdate } from '@/modules/admin/store/catalog';
import { apiErrorMessage } from '@/shared/utils/apiError';

type PaqueteForm = Record<keyof Paquete, number | null>;

interface TiendaForm {
	whatsapp: string;
	despacho: DespachoConfig;
	paquete: PaqueteForm;
	pagoAlias: string;
	pagoCbu: string;
	pagoTitular: string;
	/** Token nuevo de la cuenta propia de envia (solo se escribe). */
	enviaToken: string;
	enviaDesconectar: boolean;
}

const CP_RE = /^[A-Za-z]?\d{4}[A-Za-z]{0,3}$/;

function formFrom(rubro: Rubro): TiendaForm {
	return {
		// Solo mostramos el número propio del rubro; si usa el general, el campo queda vacío.
		whatsapp: rubro.pedidosDestino === 'negocio' ? (rubro.whatsapp ?? '') : '',
		despacho: {
			nombre: rubro.despacho?.nombre ?? '',
			telefono: rubro.despacho?.telefono ?? '',
			calle: rubro.despacho?.calle ?? '',
			numero: rubro.despacho?.numero ?? '',
			ciudad: rubro.despacho?.ciudad ?? '',
			provincia: rubro.despacho?.provincia ?? '',
			cp: rubro.despacho?.cp ?? '',
		},
		paquete: {
			largo: rubro.paqueteDefault?.largo ?? null,
			ancho: rubro.paqueteDefault?.ancho ?? null,
			alto: rubro.paqueteDefault?.alto ?? null,
			peso: rubro.paqueteDefault?.peso ?? null,
		},
		pagoAlias: rubro.pagoAlias ?? '',
		pagoCbu: rubro.pagoCbu ?? '',
		pagoTitular: rubro.pagoTitular ?? '',
		enviaToken: '',
		enviaDesconectar: false,
	};
}

/**
 * Configuración de la tienda del negocio activo: a qué WhatsApp llegan los
 * pedidos, desde dónde se despacha (con eso se le cotiza el envío al cliente) y
 * los datos para transferir.
 */
export default defineComponent({
	name: 'TiendaConfigCard',
	props: {
		rubro: { type: Object as PropType<Rubro>, required: true },
	},
	data() {
		return {
			catalog: useCatalogStore(),
			form: formFrom(this.rubro),
			/** Foto de lo guardado, para saber si hay cambios sin guardar. */
			saved: JSON.stringify(formFrom(this.rubro)),
			saving: false,
			avanzado: false,
			provincias: PROVINCIAS_AR,
			paqueteKeys: ['largo', 'ancho', 'alto', 'peso'] as (keyof Paquete)[],
		};
	},
	computed: {
		dirty(): boolean {
			return JSON.stringify(this.form) !== this.saved;
		},
		/** WhatsApp general del negocio (el de "Sobre Nosotros"), al que caen los pedidos si este queda vacío. */
		generalWhatsapp(): string {
			return this.catalog.miEspacio?.whatsapp ?? '';
		},
		despachoVacio(): boolean {
			const d = this.form.despacho;
			return !d.calle && !d.numero && !d.ciudad && !d.provincia && !d.cp;
		},
		despachoCompleto(): boolean {
			const d = this.form.despacho;
			return d.calle.length >= 2 && !!d.numero && d.ciudad.length >= 2 && !!d.provincia && CP_RE.test(d.cp);
		},
		estado(): { text: string; icon: string; cls: string } {
			if (this.despachoCompleto) {
				return {
					text: this.$t('admin.config.tienda.estado.ok'),
					icon: 'pi-check-circle',
					cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
				};
			}
			if (this.despachoVacio) {
				return { text: this.$t('admin.config.tienda.estado.empty'), icon: 'pi-info-circle', cls: 'bg-surface-500/10 text-surface-600 dark:text-surface-300' };
			}
			return { text: this.$t('admin.config.tienda.estado.incomplete'), icon: 'pi-exclamation-triangle', cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-300' };
		},
	},
	watch: {
		// Cambió el negocio activo: cargamos su configuración.
		'rubro.id'() {
			this.reset();
		},
	},
	methods: {
		/** Carga el formulario desde un rubro (por defecto, el del prop). */
		reset(rubro?: Rubro) {
			this.form = formFrom(rubro ?? this.rubro);
			this.saved = JSON.stringify(this.form);
		},
		async save() {
			// Una dirección a medias no se guarda: avisamos qué falta en vez de pisar la anterior.
			if (!this.despachoCompleto && !this.despachoVacio) {
				this.$toast.add({ severity: 'warn', summary: this.$t('admin.config.tienda.estado.incomplete'), life: 5000 });
				return;
			}
			const f = this.form;
			const whatsapp = f.whatsapp.replace(/\D/g, '');
			const payload: RubroUpdate = {
				// Con número propio, los pedidos van ahí; vacío, al general del negocio.
				whatsapp: whatsapp || null,
				pedidosDestino: whatsapp ? 'negocio' : 'cm',
				pagoAlias: f.pagoAlias || null,
				pagoCbu: f.pagoCbu || null,
				pagoTitular: f.pagoTitular || null,
				despacho: this.despachoCompleto
					? {
							...f.despacho,
							// Si no puso quién despacha ni teléfono, usamos el nombre del negocio y su WhatsApp.
							nombre: f.despacho.nombre || this.rubro.nombre,
							telefono: f.despacho.telefono.replace(/\D/g, '') || whatsapp || this.generalWhatsapp.replace(/\D/g, '') || '0000000000',
						}
					: null,
			};
			const p = f.paquete;
			if (p.largo && p.ancho && p.alto && p.peso) payload.paqueteDefault = { largo: p.largo, ancho: p.ancho, alto: p.alto, peso: p.peso };
			else if (!p.largo && !p.ancho && !p.alto && !p.peso) payload.paqueteDefault = null;
			if (f.enviaToken) payload.enviaToken = f.enviaToken;
			else if (f.enviaDesconectar) payload.enviaToken = null;

			this.saving = true;
			try {
				// Recargamos desde lo que devolvió el servidor (el prop todavía trae el rubro viejo).
				this.reset(await this.catalog.updateRubro(this.rubro.id, payload));
				this.$toast.add({ severity: 'success', summary: this.$t('admin.config.tienda.savedToast'), life: 3000 });
			} catch (e: unknown) {
				this.$toast.add({ severity: 'error', summary: apiErrorMessage(e, this.$t('admin.errors.save')), life: 5000 });
			} finally {
				this.saving = false;
			}
		},
	},
});
</script>
