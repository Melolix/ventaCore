<template>
	<!-- pb-24: cuando hay pedido, la barra fija de abajo no tapa el final de la página. -->
	<div :class="cartCount ? 'pb-24 md:pb-0' : ''">
		<!-- Hero del rubro (3:1 en desktop → coincide con el recorte de la portada) -->
		<!-- En el celu el hero del catálogo es bajo (alto = su contenido) para que los
		     productos asomen sin scrollear; en apps conserva el alto por los botones. -->
		<section
			class="relative mb-5 overflow-hidden rounded-3xl md:mb-10 md:min-h-0 md:rounded-[2rem] md:aspect-[3/1]"
			:class="isApps ? 'min-h-[18rem]' : ''"
		>
			<div
				class="absolute inset-0 bg-cover bg-center"
				:style="rubro?.imageUrl ? { backgroundImage: `url('${rubro.imageUrl}')`, backgroundPosition: rubro.imageFocus || undefined } : {}"
				:class="[{ 'primary-gradient': !rubro?.imageUrl }, isApps && rubro?.imageUrl ? 'scale-110 blur-xl' : '']"
			>
				<!-- En apps el fondo va desenfocado: el título se lee limpio y no compite
				     con el texto de la propia portada/banner. -->
				<div
					class="absolute inset-0"
					:class="isApps ? 'bg-gradient-to-r from-black/80 via-black/60 to-black/40' : 'bg-gradient-to-r from-black/70 to-black/10'"
				/>
			</div>
			<div class="relative flex h-full flex-col justify-center gap-2 p-5 md:gap-3 md:p-12">
				<!-- En modo "home" (negocio de un solo rubro) esta vista ES la vitrina:
				     no hay a dónde "volver" ni sentido en la etiqueta de sector. -->
				<Button
					v-if="!isHome"
					:label="$t('public.back')"
					icon="pi pi-arrow-left"
					text
					size="small"
					class="-ml-2 w-fit !text-white"
					@click="goBack"
				/>
				<span
					v-if="!isHome"
					class="w-fit items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3 py-1 backdrop-blur-md"
					:class="isApps ? 'flex' : 'hidden md:flex'"
				>
					<i :class="isApps ? 'pi pi-th-large' : 'pi pi-tag'" class="text-sm text-white" />
					<span class="text-xs font-bold uppercase tracking-wide text-white">{{ isApps ? $t('public.app') : $t('public.sector') }}</span>
				</span>
				<div class="flex items-center gap-3 md:gap-4">
					<div
						v-if="rubro?.logoUrl"
						class="h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-white/20 shadow-lg md:h-16 md:w-16 md:rounded-2xl"
					>
						<img :src="rubro.logoUrl" :alt="rubro?.nombre" class="h-full w-full object-cover" />
					</div>
					<h1 class="max-w-2xl text-2xl font-extrabold leading-tight text-white md:text-4xl">
						{{ rubro?.nombre || $t('public.detailTitle') }}
					</h1>
				</div>
				<p
					v-if="rubro?.descripcion"
					class="max-w-xl text-sm text-white/85 md:text-base"
					:class="isApps ? '' : 'line-clamp-2 md:line-clamp-none'"
				>
					{{ rubro.descripcion }}
				</p>
				<div v-if="isApps" class="mt-3 flex flex-col gap-3">
					<!-- Plataformas disponibles -->
					<div v-if="appPlatforms.length" class="flex items-center gap-3 text-white/80">
						<i
							v-for="p in appPlatforms"
							:key="p"
							:class="platformIcon(p)"
							class="text-xl"
							:title="$t(`public.platform.${p}`)"
						/>
					</div>
					<!-- Descargas / abrir (con etiquetas claras) -->
					<div v-if="downloads.length" class="flex flex-wrap gap-3">
						<a
							v-for="d in downloads"
							:key="d.key"
							:href="d.url"
							target="_blank"
							rel="noopener"
							class="inline-flex items-center gap-2 rounded-xl px-5 py-3 font-semibold transition-transform hover:scale-[1.03]"
							:class="d.primary
								? 'primary-gradient text-white shadow-lg'
								: 'border border-white/40 bg-white/10 text-white backdrop-blur-md hover:bg-white/20'"
						>
							<i :class="d.icon" /> {{ d.label }}
						</a>
					</div>
				</div>
			</div>
		</section>

		<div class="mx-auto max-w-7xl">
			<!-- Apps con varias audiencias: pestañas por sección (usuario/entrenador/admin…) -->
			<div v-if="isApps && showTabs" class="mb-6 overflow-x-auto">
				<SelectButton
					v-model="activeSeccion"
					:options="seccionOptions"
					option-label="label"
					option-value="value"
					:allow-empty="false"
					class="w-fit"
				/>
			</div>

			<!-- Filtros -->
			<div class="mb-4 flex flex-wrap items-center justify-between gap-3 md:mb-8">
				<p class="text-surface-600 dark:text-surface-300" :class="isApps ? '' : 'hidden md:block'">
					{{ isApps ? $t('public.showingScreens', { n: filtered.length }) : $t('public.showing', { n: filtered.length }) }}
				</p>
				<!-- Si ya pidió en esta tienda: con un pedido, directo a su seguimiento; con
				     varios, a la lista para elegir. -->
				<router-link
					v-if="pedidosAqui.length"
					:to="pedidosAqui.length === 1 ? { name: 'app-pedido', params: { token: pedidosAqui[0].token } } : { name: 'app-mis-pedidos' }"
					class="order-last flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary md:order-none md:w-auto"
				>
					<i class="pi pi-map-marker text-xs" />
					{{ pedidosAqui.length === 1 ? $t('public.cart.trackN', { n: pedidosAqui[0].numero }) : $t('public.misPedidos.linkN', { n: pedidosAqui.length }) }}
				</router-link>
				<!-- Mobile: buscador y orden en una sola fila (el buscador se estira). -->
				<div v-if="!isApps" class="flex w-full min-w-0 gap-2 md:w-auto">
					<IconField class="min-w-0 flex-1">
						<InputIcon class="pi pi-search" />
						<InputText v-model="search" :placeholder="$t('public.searchPlaceholder')" class="w-full md:w-64" />
					</IconField>
					<Select v-model="sort" :options="sortOptions" option-label="label" option-value="value" class="w-36 shrink-0 sm:w-56" />
				</div>
			</div>

			<!-- Grid de productos -->
			<div v-if="loading" class="py-16 text-center text-surface-500">
				<i class="pi pi-spin pi-spinner text-3xl" />
			</div>

			<div v-else-if="!filtered.length" class="glass-card rounded-3xl p-12 text-center text-surface-500">
				{{ isApps ? $t('public.noScreens') : $t('public.noProducts') }}
			</div>

			<!-- Con categorías: menú a la izquierda (lg+) o tira fija arriba (mobile) y
			     los productos agrupados por categoría. Sin categorías (o en apps): un
			     solo grupo sin título, igual que antes. -->
			<div v-else :class="showCategorias ? 'lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-8' : ''">
				<nav
					v-if="showCategorias"
					ref="catNav"
					class="cat-nav sticky top-16 z-30 -mx-4 mb-5 flex gap-2 overflow-x-auto border-b border-surface-200/70 bg-surface-50/95 px-4 py-2.5 sm:-mx-6 sm:px-6 backdrop-blur lg:top-24 lg:mx-0 lg:mb-0 lg:max-h-[calc(100dvh-7.5rem)] lg:flex-col lg:gap-1 lg:self-start lg:overflow-y-auto lg:overflow-x-hidden lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none dark:border-surface-700/70 dark:bg-surface-950/95 lg:dark:bg-transparent"
					:aria-label="$t('public.categories')"
				>
					<p class="mb-1 hidden px-3 text-[11px] font-bold uppercase tracking-widest text-surface-400 lg:block">{{ $t('public.categories') }}</p>
					<button
						v-for="g in groups"
						:key="g.key"
						type="button"
						:data-cat="g.key"
						class="flex shrink-0 items-center justify-between gap-2 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors lg:w-full lg:whitespace-normal lg:rounded-xl lg:border-0 lg:px-3 lg:py-2 lg:text-left"
						:class="activeCat === g.key
							? 'border-primary bg-primary text-primary-contrast lg:bg-primary/10 lg:text-primary'
							: 'border-surface-200 bg-surface-0 text-surface-600 hover:text-primary dark:border-surface-700 dark:bg-surface-900 dark:text-surface-300 lg:bg-transparent lg:hover:bg-surface-100 lg:dark:bg-transparent lg:dark:hover:bg-surface-800'"
						:aria-current="activeCat === g.key ? 'true' : undefined"
						@click="goToCat(g.key)"
					>
						<span class="min-w-0 lg:truncate">{{ g.label }}</span>
						<span class="hidden text-xs font-medium opacity-60 lg:inline">{{ g.items.length }}</span>
					</button>
				</nav>
				<div class="min-w-0 space-y-10">
				<section
					v-for="g in groups"
					:key="g.key"
					:data-cat-section="g.key"
					class="scroll-mt-32 lg:scroll-mt-24"
				>
				<h2 v-if="showCategorias" class="mb-4 flex items-baseline gap-2 text-xl font-extrabold text-surface-900 dark:text-surface-0">
					{{ g.label }}
					<span class="text-sm font-medium text-surface-400">{{ g.items.length }}</span>
				</h2>
				<!-- Apps: las "cards" son capturas grandes (se amplían en el lightbox). -->
				<div v-if="isApps" class="grid grid-cols-1 gap-8 sm:grid-cols-2 xl:grid-cols-3">
					<div
						v-for="producto in g.items"
						:key="producto.id"
						class="glass-card group flex flex-col overflow-hidden rounded-2xl transition-all hover:scale-[1.02]"
					>
						<div class="relative h-72 overflow-hidden bg-surface-100 dark:bg-surface-800">
							<!-- La captura se ve ENTERA (contain) sobre un fondo blur de sí misma →
							     sirve igual para capturas de escritorio (apaisadas) y de celular. -->
							<template v-if="producto.imageUrl">
								<div
									class="absolute inset-0 scale-110 bg-cover bg-center opacity-40 blur-2xl"
									:style="{ backgroundImage: `url('${producto.imageUrl}')` }"
								/>
								<img
									:src="producto.imageUrl"
									:alt="producto.nombre"
									class="relative h-full w-full cursor-zoom-in object-contain transition-transform duration-500 group-hover:scale-105"
									@click="openLightbox(producto)"
								/>
								<button
									type="button"
									class="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100"
									:aria-label="$t('public.viewFull')"
									@click="openLightbox(producto)"
								>
									<i class="pi pi-search-plus" />
								</button>
							</template>
							<div v-else class="flex h-full w-full items-center justify-center text-surface-400">
								<i class="pi pi-image text-4xl" />
							</div>
						</div>
						<div class="flex flex-1 flex-col p-6">
							<h3 class="mb-2 line-clamp-2 text-lg font-bold text-surface-900 dark:text-surface-0" :title="producto.nombre">
								{{ producto.nombre }}
							</h3>
							<p class="line-clamp-4 flex-1 text-sm text-surface-500">{{ producto.descripcion || '' }}</p>
						</div>
					</div>
				</div>

				<!-- Catálogo: cards compactas (2 por fila en el celu). Toda la card abre el
				     producto; el botón consulta directo por WhatsApp. -->
				<div v-else class="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
					<article
						v-for="producto in g.items"
						:key="producto.grupo || producto.id"
						class="glass-card group flex cursor-pointer flex-col overflow-hidden rounded-2xl transition-shadow hover:shadow-xl hover:shadow-primary/10"
						@click="openProducto(producto)"
					>
						<div class="relative aspect-square overflow-hidden bg-surface-100 dark:bg-surface-800">
							<!-- La foto entra ENTERA (contain) sobre un fondo borroso de sí misma: las
							     fotos de los clientes vienen con cualquier proporción (collages,
							     verticales) y así no se recorta nada y el marco queda parejo. -->
							<template v-if="producto.imageUrl">
								<div
									class="absolute inset-0 scale-110 bg-cover bg-center opacity-40 blur-2xl"
									:style="{ backgroundImage: `url('${producto.imageUrl}')` }"
								/>
								<img
									:src="producto.imageUrl"
									:alt="producto.nombre"
									loading="lazy"
									class="relative h-full w-full object-contain transition-transform duration-500 group-hover:scale-105"
								/>
							</template>
							<div v-else class="flex h-full w-full items-center justify-center text-surface-400">
								<i class="pi pi-shopping-bag text-3xl" />
							</div>
							<!-- Stock escrito (no solo color): "Sin stock" / "Quedan 2". -->
							<span
								v-if="stockTag(producto)"
								class="absolute left-2 top-2 rounded-md px-1.5 py-0.5 text-[10px] font-bold"
								:class="stockTag(producto)?.cls"
							>{{ stockTag(producto)?.label }}</span>
						</div>
						<div class="flex flex-1 flex-col gap-1 p-3 sm:p-4">
							<!-- 2 líneas fijas: los títulos largos (típicos de ML) se cortan con "…"
							     y todas las cards quedan del mismo alto. -->
							<h3
								class="line-clamp-2 min-h-[2.5em] text-[13px] font-semibold leading-tight text-surface-900 sm:text-sm dark:text-surface-0"
								:title="producto.nombre"
							>
								{{ producto.nombre }}
							</h3>
							<p v-if="producto.precio != null" class="text-base font-extrabold tabular-nums text-surface-900 sm:text-lg dark:text-surface-0">
								{{ formatPrice(producto.precio) }}
							</p>
							<p v-else class="py-0.5 text-xs font-semibold text-surface-400 sm:py-1">{{ $t('public.consultPrice') }}</p>
							<!-- Variantes (talle, color…): una sola card con selector, en vez de una
							     card repetida por variante. Elegir una cambia precio, foto y stock,
							     y es la que se agrega al pedido. -->
							<div v-if="variantesDe(producto).length" class="flex flex-wrap gap-1 pb-1" role="group" :aria-label="$t('public.variants')" @click.stop>
								<button
									v-for="v in variantesDe(producto)"
									:key="v.id"
									type="button"
									class="min-h-8 min-w-8 rounded-lg border px-2 text-[11px] font-bold transition-colors"
									:class="varianteCls(v, producto)"
									:aria-pressed="v.id === producto.id"
									:title="v.stock === 0 ? $t('public.variantOut', { v: v.variante }) : (v.variante ?? '')"
									@click="pickVariante(v)"
								>
									{{ v.variante || v.nombre }}
								</button>
							</div>
							<!-- Con pedido habilitado: "Agregar" → − n + (se agrega sin salir de la
							     lista). Lo que no se puede comprar (sin precio/stock) se consulta. -->
							<div
								v-if="buyable(producto) && qty(producto)"
								class="mt-auto flex min-h-9 items-center justify-between rounded-xl bg-primary text-primary-contrast"
								@click.stop
							>
								<button type="button" class="flex h-9 w-10 items-center justify-center" :aria-label="$t('public.cart.less')" @click="addQty(producto, -1)">
									<i class="pi pi-minus text-xs" />
								</button>
								<span class="text-sm font-extrabold tabular-nums">{{ qty(producto) }}</span>
								<button
									type="button"
									class="flex h-9 w-10 items-center justify-center disabled:opacity-40"
									:aria-label="$t('public.cart.more')"
									:disabled="qty(producto) >= maxQty(producto)"
									@click="addQty(producto, 1)"
								>
									<i class="pi pi-plus text-xs" />
								</button>
							</div>
							<button
								v-else-if="buyable(producto)"
								type="button"
								class="mt-auto flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-primary/50 px-2 text-xs font-bold text-primary transition-colors hover:bg-primary/10"
								@click.stop="addQty(producto, 1)"
							>
								<i class="pi pi-plus text-[11px]" /> {{ $t('public.cart.add') }}
							</button>
							<button
								v-else-if="orderNumber"
								type="button"
								class="mt-auto flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-surface-300 px-2 text-xs font-bold text-surface-600 transition-colors hover:text-primary dark:border-surface-600 dark:text-surface-300"
								@click.stop="consultarWhatsapp(producto)"
							>
								<i class="pi pi-whatsapp text-sm" /> {{ $t('public.consult') }}
							</button>
						</div>
					</article>
				</div>
				</section>
				</div>
			</div>
		</div>

		<!-- Producto: fotos, descripción completa y consulta. En el celu ocupa toda la
		     pantalla. Se abre con ?p=<id> en la URL → el botón "atrás" lo cierra y el
		     link se puede compartir. -->
		<Dialog
			:visible="!!detail"
			modal
			dismissable-mask
			block-scroll
			:show-header="false"
			class="w-full max-w-4xl"
			:pt="{
				root: { class: 'max-md:!m-0 max-md:!h-full max-md:!max-h-full max-md:!rounded-none' },
				content: { class: '!p-0 md:!rounded-2xl max-md:!rounded-none max-md:h-full' },
			}"
			@update:visible="onDetailVisible"
		>
			<div v-if="detail" class="relative flex min-h-full flex-col md:grid md:min-h-0 md:grid-cols-2">
				<button
					type="button"
					class="absolute left-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/75 md:left-auto md:right-3"
					:aria-label="$t('public.back')"
					@click="closeProducto"
				>
					<span class="md:hidden"><i class="pi pi-arrow-left" /></span>
					<span class="hidden md:inline"><i class="pi pi-times" /></span>
				</button>
				<!-- Galería -->
				<div class="flex flex-col gap-2 bg-surface-100 md:p-4 dark:bg-surface-800">
					<div class="relative aspect-square overflow-hidden md:rounded-xl">
						<template v-if="detailImages.length">
							<div
								class="absolute inset-0 scale-110 bg-cover bg-center opacity-40 blur-2xl"
								:style="{ backgroundImage: `url('${detailImages[detailImg]}')` }"
							/>
							<img :src="detailImages[detailImg]" :alt="detail.nombre" class="relative h-full w-full object-contain" />
						</template>
						<div v-else class="flex h-full w-full items-center justify-center text-surface-400">
							<i class="pi pi-shopping-bag text-5xl" />
						</div>
					</div>
					<div v-if="detailImages.length > 1" class="flex flex-wrap gap-2 px-3 pb-3 md:px-0 md:pb-0">
						<button
							v-for="(img, i) in detailImages"
							:key="img"
							type="button"
							class="h-14 w-14 overflow-hidden rounded-lg border-2 transition-opacity"
							:class="i === detailImg ? 'border-primary' : 'border-transparent opacity-60 hover:opacity-100'"
							:aria-label="$t('public.photoN', { n: i + 1 })"
							@click="detailImg = i"
						>
							<img :src="img" class="h-full w-full object-cover" alt="" />
						</button>
					</div>
				</div>
				<!-- Datos -->
				<div class="flex flex-1 flex-col gap-3 p-5 md:max-h-[80vh] md:overflow-y-auto md:p-7">
					<span
						v-if="detail.seccion"
						class="w-fit rounded-full border border-surface-200 px-2.5 py-0.5 text-xs font-semibold text-surface-500 dark:border-surface-700"
					>{{ detail.seccion }}</span>
					<h2 class="text-xl font-extrabold leading-tight text-surface-900 md:pr-10 md:text-2xl dark:text-surface-0">{{ detail.nombre }}</h2>
					<div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
						<span v-if="detail.precio != null" class="text-2xl font-extrabold tabular-nums text-surface-900 dark:text-surface-0">{{ formatPrice(detail.precio) }}</span>
						<span v-else class="text-sm font-semibold text-surface-400">{{ $t('public.consultPrice') }}</span>
						<span v-if="stockStatus(detail)" class="text-xs font-bold" :class="stockStatus(detail)?.cls">{{ stockStatus(detail)?.label }}</span>
					</div>
					<div v-if="variantesDe(detail).length" class="flex flex-wrap gap-1.5" role="group" :aria-label="$t('public.variants')">
						<button
							v-for="v in variantesDe(detail)"
							:key="v.id"
							type="button"
							class="min-h-10 min-w-10 rounded-xl border px-3 text-sm font-bold transition-colors"
							:class="varianteCls(v, detail)"
							:aria-pressed="v.id === detail.id"
							:title="v.stock === 0 ? $t('public.variantOut', { v: v.variante }) : (v.variante ?? '')"
							@click="pickVarianteDetalle(v)"
						>
							{{ v.variante || v.nombre }}
						</button>
					</div>
					<p v-if="detail.descripcion" class="whitespace-pre-line text-sm leading-relaxed text-surface-600 dark:text-surface-300">{{ detail.descripcion }}</p>
					<!-- Acciones: pegadas abajo en el celu (al alcance del pulgar). -->
					<div
						class="sticky bottom-0 -mx-5 mt-auto flex flex-col gap-2 border-t border-surface-200 bg-surface-0 px-5 py-3 md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 md:pb-0 dark:border-surface-700 dark:bg-surface-900 md:dark:bg-transparent"
					>
						<!-- Se puede comprar: cantidad + agregar (o "Ver pedido" si ya está). -->
						<div v-if="buyable(detail)" class="flex items-center gap-2">
							<div v-if="qty(detail)" class="flex shrink-0 items-center rounded-xl border border-surface-200 dark:border-surface-700">
								<button type="button" class="flex h-11 w-11 items-center justify-center" :aria-label="$t('public.cart.less')" @click="addQty(detail, -1)">
									<i class="pi pi-minus text-xs" />
								</button>
								<span class="w-7 text-center font-extrabold tabular-nums">{{ qty(detail) }}</span>
								<button
									type="button"
									class="flex h-11 w-11 items-center justify-center disabled:opacity-30"
									:aria-label="$t('public.cart.more')"
									:disabled="qty(detail) >= maxQty(detail)"
									@click="addQty(detail, 1)"
								>
									<i class="pi pi-plus text-xs" />
								</button>
							</div>
							<button
								type="button"
								class="primary-gradient flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold text-white"
								@click="qty(detail) ? openCartFromDetail() : addQty(detail, 1)"
							>
								<template v-if="qty(detail)"><i class="pi pi-shopping-cart" /> {{ $t('public.cart.view') }}</template>
								<template v-else><i class="pi pi-plus" /> {{ $t('public.cart.addToOrder') }}</template>
							</button>
						</div>
						<!-- Consultar: acción principal si no se puede comprar; si no, secundaria. -->
						<button
							v-if="orderNumber"
							type="button"
							class="flex items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition-colors"
							:class="buyable(detail)
								? 'min-h-9 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400'
								: 'min-h-11 bg-emerald-600 text-white hover:bg-emerald-700'"
							@click="consultarWhatsapp(detail)"
						>
							<i class="pi pi-whatsapp" /> {{ $t('public.consultWhatsapp') }}
						</button>
						<!-- Admin logueado: armar la publicación (por ahora abre el Instagram del rubro). -->
						<Button
							v-if="isAdmin"
							:label="$t('public.generateAd')"
							icon="pi pi-instagram"
							outlined
							:disabled="!rubro?.instagramUrl"
							:title="rubro?.instagramUrl ? '' : $t('public.noInstagram')"
							@click="publicar"
						/>
					</div>
				</div>
			</div>
		</Dialog>

		<!-- Barra del pedido: aparece al agregar el primer producto. En el celu, fija
		     abajo a todo el ancho; en desktop, un botón flotante abajo a la derecha. -->
		<div
			v-if="canOrder && cartCount"
			class="fixed inset-x-0 bottom-0 z-40 border-t border-surface-200 bg-surface-0/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur md:inset-x-auto md:bottom-6 md:right-6 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none dark:border-surface-700 dark:bg-surface-900/95 md:dark:bg-transparent"
		>
			<button
				type="button"
				class="primary-gradient flex min-h-12 w-full items-center justify-between gap-6 rounded-xl px-4 text-sm font-bold text-white shadow-lg md:w-auto md:rounded-full md:px-6"
				@click="cartVisible = true"
			>
				<span class="flex items-center gap-2"><i class="pi pi-shopping-cart" /> {{ $t('public.cart.viewN', { n: cartCount }) }}</span>
				<span class="tabular-nums">{{ formatPrice(cartTotal) }}</span>
			</button>
		</div>
		<CartDrawer
			v-if="canOrder"
			v-model:visible="cartVisible"
			:rubro-id="rubroId"
			:tienda="rubro?.nombre ?? ''"
			:productos="catalog.publicProductos"
			:whatsapp="orderNumber"
			:envios-activos="!!rubro?.enviosActivos"
		/>

		<!-- Lightbox: captura ampliada al centro (solo apps) -->
		<Dialog
			v-model:visible="lightboxVisible"
			modal
			dismissable-mask
			:show-header="false"
			class="w-full max-w-5xl"
			:pt="{ content: { class: '!p-0 !bg-transparent !overflow-visible' } }"
		>
			<div class="relative">
				<img
					:src="lightboxItem?.imageUrl || ''"
					:alt="lightboxItem?.nombre"
					class="max-h-[82vh] w-full rounded-2xl bg-black object-contain"
				/>
				<button
					type="button"
					class="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/80"
					:aria-label="$t('common.cancel')"
					@click="lightboxVisible = false"
				>
					<i class="pi pi-times" />
				</button>
				<div class="absolute inset-x-0 bottom-0 rounded-b-2xl bg-gradient-to-t from-black/80 to-transparent p-6 text-white">
					<h4 class="text-lg font-bold">{{ lightboxItem?.nombre }}</h4>
					<p v-if="lightboxItem?.descripcion" class="mt-1 text-sm text-white/85">{{ lightboxItem.descripcion }}</p>
				</div>
			</div>
		</Dialog>
	</div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { AppPlatform, EspacioType, Role, type Producto } from '@base-template/shared';
import { useCatalogStore } from '@/modules/admin/store/catalog';
import { useUserStore } from '@/modules/auth/store/user';
import { PLATFORM_ICON, effectivePlatforms } from '@/shared/utils/apps';
import { useCartStore, type PedidoGuardado } from '@/modules/app/store/cart';
import { formatPrice } from '@/modules/app/utils/price';
import CartDrawer, { MAX_QTY, canBuy } from '@/modules/app/components/CartDrawer.vue';
import { groupVariantes, varianteInicial } from '@/modules/app/utils/variantes';

type SortKey = 'relevance' | 'priceAsc' | 'priceDesc';
/** Un grupo del catálogo: una categoría con sus productos. */
interface CatGroup {
	key: string;
	label: string;
	items: Producto[];
}
/** Hasta cuántas unidades avisamos "Quedan N". */
const LOW_STOCK = 3;
/** Clave del grupo de productos sin categoría. */
const OTROS_KEY = '__otros';
interface Download {
	key: string;
	url: string;
	label: string;
	icon: string;
	primary: boolean;
}

export default defineComponent({
	name: 'RubroDetailView',
	components: { CartDrawer },
	props: {
		/** Rubro a mostrar cuando se reusa fuera de la ruta (negocio de un solo rubro).
		 *  Si viene vacío, se toma el `:id` de la URL. */
		forcedRubroId: { type: String, default: '' },
		/** Modo vitrina: esta vista es la home del negocio (oculta "Volver" y la etiqueta). */
		isHome: { type: Boolean, default: false },
	},
	data() {
		return {
			catalog: useCatalogStore(),
			cart: useCartStore(),
			cartVisible: false,
			loading: false,
			search: '',
			sort: 'relevance' as SortKey,
			lightboxVisible: false,
			lightboxItem: null as Producto | null,
			/** Foto activa en la pantalla de producto. */
			detailImg: 0,
			/** ¿Abrimos nosotros el producto (push)? Entonces cerrar = volver atrás. */
			detailPushed: false,
			activeSeccion: '',
			/** Variante elegida en cada card con variantes: `{ [grupo]: productoId }`. */
			varianteSel: {} as Record<string, string>,
			/** Categoría resaltada en el menú (la que se está viendo al hacer scroll). */
			activeCat: '',
			catObserver: null as IntersectionObserver | null,
		};
	},
	computed: {
		rubroId(): string {
			return this.forcedRubroId || (this.$route.params.id as string);
		},
		/** Secciones/pestañas distintas de las capturas, en orden de aparición. */
		secciones(): string[] {
			const out: string[] = [];
			for (const p of this.catalog.publicProductos) {
				if (p.seccion && !out.includes(p.seccion)) out.push(p.seccion);
			}
			return out;
		},
		seccionOptions(): { label: string; value: string }[] {
			return this.secciones.map(s => ({ label: s.charAt(0).toUpperCase() + s.slice(1), value: s }));
		},
		/** Muestra pestañas solo si la app tiene capturas de 2+ secciones. */
		showTabs(): boolean {
			return this.isApps && this.secciones.length >= 2;
		},
		rubro() {
			return this.catalog.currentRubro;
		},
		espacio() {
			return this.catalog.currentEspacio;
		},
		/** Plataformas de la app (con fallback a los links si el admin no eligió). */
		appPlatforms(): AppPlatform[] {
			return this.rubro ? effectivePlatforms(this.rubro) : [];
		},
		/** Botones de descarga/abrir del hero, con etiquetas claras. */
		downloads(): Download[] {
			const r = this.rubro;
			if (!r) return [];
			const list: Download[] = [];
			if (r.androidUrl) {
				const isStore = /play\.google\.com/i.test(r.androidUrl);
				list.push({
					key: 'android',
					url: r.androidUrl,
					label: this.$t(isStore ? 'public.download.playstore' : 'public.download.apk'),
					icon: 'pi pi-android',
					primary: true,
				});
			}
			if (r.iosUrl) {
				list.push({ key: 'ios', url: r.iosUrl, label: this.$t('public.download.appstore'), icon: 'pi pi-apple', primary: false });
			}
			if (r.webUrl) {
				list.push({ key: 'web', url: r.webUrl, label: this.$t('public.download.openWeb'), icon: 'pi pi-globe', primary: false });
			}
			return list;
		},
		/** Espacios tipo "apps": los "productos" son capturas de la app. */
		isApps(): boolean {
			return this.espacio?.type === EspacioType.APPS;
		},
		isAdmin(): boolean {
			return useUserStore().role === Role.ADMIN;
		},
		sortOptions(): { label: string; value: SortKey }[] {
			return [
				{ label: this.$t('public.sort.relevance'), value: 'relevance' },
				{ label: this.$t('public.sort.priceAsc'), value: 'priceAsc' },
				{ label: this.$t('public.sort.priceDesc'), value: 'priceDesc' },
			];
		},
		/**
		 * Productos agrupados por categoría, en el orden del menú que armó el
		 * vendedor (`rubro.categorias`). Después van las categorías que usan los
		 * productos pero no están en la lista, y al final "Otros" (sin categoría).
		 * Solo grupos con productos (el buscador los achica). En apps: un grupo.
		 */
		/**
		 * WhatsApp que recibe pedidos y consultas de ESTE rubro (solo dígitos): el
		 * propio del rubro si los lleva el negocio; si no, el general del espacio.
		 */
		orderNumber(): string {
			const own = this.rubro?.pedidosDestino === 'negocio' ? this.rubro.whatsapp : null;
			return (own || this.espacio?.whatsapp || '').replace(/\D/g, '');
		},
		/** Pedidos que este cliente hizo en ESTA tienda desde este dispositivo. */
		pedidosAqui(): PedidoGuardado[] {
			return this.canOrder ? this.cart.pedidos.filter(p => p.rubroId === this.rubroId) : [];
		},
		/** Hay tienda con pedido si es un catálogo (no apps) y hay a quién mandarlo. */
		canOrder(): boolean {
			return !this.isApps && !!this.orderNumber;
		},
		/** Unidades y total del pedido, contando solo lo que hoy se puede comprar. */
		cartCount(): number {
			return this.cartLines.reduce((sum, l) => sum + l.qty, 0);
		},
		cartTotal(): number {
			return this.cartLines.reduce((sum, l) => sum + l.qty * l.precio, 0);
		},
		cartLines(): { qty: number; precio: number }[] {
			const cart = this.cart.carts[this.rubroId] ?? {};
			const out: { qty: number; precio: number }[] = [];
			for (const p of this.catalog.publicProductos) {
				const want = cart[p.id];
				if (!want || !canBuy(p) || p.precio == null) continue;
				out.push({ qty: Math.min(want, p.stock ?? MAX_QTY), precio: p.precio });
			}
			return out;
		},
		/** Producto abierto: sale del `?p=<id>` de la URL (compartible, y "atrás" lo cierra). */
		detail(): Producto | undefined {
			const id = this.$route.query.p;
			if (typeof id !== 'string' || !id || this.isApps) return undefined;
			return this.catalog.publicProductos.find(p => p.id === id);
		},
		detailImages(): string[] {
			const p = this.detail;
			if (!p) return [];
			const imgs = (p.imagenes ?? []).filter(Boolean);
			return imgs.length ? imgs : p.imageUrl ? [p.imageUrl] : [];
		},
		groups(): CatGroup[] {
			if (this.isApps) return [{ key: 'all', label: '', items: this.filtered }];
			const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();
			const order: { key: string; label: string }[] = (this.rubro?.categorias ?? []).map(c => ({ key: norm(c), label: c.trim() }));
			const known = new Set(order.map(o => o.key));
			const buckets = new Map<string, Producto[]>();
			for (const p of this.filtered) {
				const key = norm(p.seccion);
				if (key && !known.has(key)) {
					known.add(key);
					order.push({ key, label: (p.seccion ?? '').trim() });
				}
				const list = buckets.get(key);
				if (list) list.push(p);
				else buckets.set(key, [p]);
			}
			const out: CatGroup[] = [];
			for (const o of order) {
				const items = buckets.get(o.key);
				if (items?.length) out.push({ key: o.key, label: o.label, items });
			}
			const sin = buckets.get('');
			if (sin?.length) out.push({ key: OTROS_KEY, label: this.$t('public.otherCategory'), items: sin });
			return out;
		},
		/** Hay menú de categorías si el catálogo (sin filtrar) usa al menos una. */
		showCategorias(): boolean {
			return !this.isApps && this.catalog.publicProductos.some(p => (p.seccion ?? '').trim());
		},
		/** Variantes por grupo (talles, colores…), ordenadas. Solo grupos de 2 o más. */
		variantes(): Map<string, Producto[]> {
			return this.isApps ? new Map() : groupVariantes(this.catalog.publicProductos);
		},
		filtered(): Producto[] {
			const term = this.search.trim().toLowerCase();
			let list = this.catalog.publicProductos.filter(p => !term || p.nombre.toLowerCase().includes(term));
			// Apps con pestañas: mostrar solo las capturas de la sección activa.
			if (this.showTabs) list = list.filter(p => p.seccion === this.activeSeccion);
			// Variantes: cada grupo ocupa UNA card (en el lugar de su primera variante),
			// mostrando la variante elegida.
			const vistos = new Set<string>();
			list = list.flatMap(p => {
				const grupo = p.grupo && this.variantes.get(p.grupo);
				if (!p.grupo || !grupo) return [p];
				if (vistos.has(p.grupo)) return [];
				vistos.add(p.grupo);
				return [grupo.find(v => v.id === this.varianteSel[p.grupo as string]) ?? varianteInicial(grupo)];
			});
			if (this.sort !== 'relevance') {
				const dir = this.sort === 'priceAsc' ? 1 : -1;
				list = [...list].sort((a, b) => ((a.precio ?? 0) - (b.precio ?? 0)) * dir);
			}
			return list;
		},
	},
	watch: {
		// Al cambiar de producto arrancamos en su primera foto.
		'detail.id'() {
			this.detailImg = 0;
		},
		// Las secciones cambian con el buscador/orden: re-enganchamos el seguimiento.
		groups() {
			this.$nextTick(() => this.observeSections());
		},
	},
	beforeUnmount() {
		this.catObserver?.disconnect();
	},
	async created() {
		this.loading = true;
		try {
			// Sesión no bloqueante (para saber si mostrar acciones de admin).
			void useUserStore().currentUser();
			await Promise.all([
				this.catalog.fetchPublicRubro(this.rubroId),
				this.catalog.fetchPublicProductos(this.rubroId),
			]);
			// Si hay pestañas, arrancamos en la primera sección.
			if (this.showTabs) this.activeSeccion = this.secciones[0];
		} catch {
			// Rubro inexistente o en borrador → volver a la vitrina del negocio.
			// (En modo home no redirigimos: esta vista ya ES la vitrina.)
			if (!this.isHome) this.goBack();
		} finally {
			this.loading = false;
			// Las secciones recién existen en el DOM cuando termina la carga.
			this.$nextTick(() => this.observeSections());
		}
	},
	methods: {
		/** ¿Se puede agregar al pedido? (hay destino, tiene precio y no está sin stock). */
		buyable(p: Producto): boolean {
			return this.canOrder && canBuy(p);
		},
		maxQty(p: Producto): number {
			return p.stock ?? MAX_QTY;
		},
		/** Unidades de ese producto en el pedido (acotadas al stock actual). */
		qty(p: Producto): number {
			return Math.min(this.cart.qty(this.rubroId, p.id), this.maxQty(p));
		},
		addQty(p: Producto, delta: number) {
			const next = Math.max(0, Math.min(this.qty(p) + delta, this.maxQty(p)));
			this.cart.setQty(this.rubroId, p.id, next);
		},
		/** Desde la pantalla del producto: la cierra y abre el pedido. */
		openCartFromDetail() {
			this.closeProducto();
			this.cartVisible = true;
		},
		/** Abre la pantalla del producto (queda en la URL como ?p=<id>). */
		openProducto(producto: Producto) {
			this.detailPushed = true;
			void this.$router.push({ query: { ...this.$route.query, p: producto.id } });
		},
		/** Cierra el producto: si lo abrimos acá, es "atrás"; si llegó por link, limpia la URL. */
		closeProducto() {
			if (this.detailPushed) {
				this.detailPushed = false;
				this.$router.back();
				return;
			}
			const query = { ...this.$route.query };
			delete query.p;
			void this.$router.replace({ query });
		},
		/** El diálogo pide cerrarse (clic afuera o Escape). */
		onDetailVisible(visible: boolean) {
			if (!visible) this.closeProducto();
		},
		/** Etiqueta sobre la foto de la card: solo cuando hay algo que avisar. */
		stockTag(p: Producto): { label: string; cls: string } | null {
			if (p.stock === 0) return { label: this.$t('public.stock.out'), cls: 'bg-red-600 text-white' };
			if (p.stock != null && p.stock <= LOW_STOCK) return { label: this.$t('public.stock.low', p.stock), cls: 'bg-amber-400 text-amber-950' };
			return null;
		},
		/** Estado de stock en la pantalla del producto (null = el negocio no lleva stock). */
		stockStatus(p: Producto): { label: string; cls: string } | null {
			if (p.stock == null) return null;
			if (p.stock === 0) return { label: this.$t('public.stock.out'), cls: 'text-red-500' };
			if (p.stock <= LOW_STOCK) return { label: this.$t('public.stock.low', p.stock), cls: 'text-amber-600 dark:text-amber-400' };
			return { label: this.$t('public.stock.available'), cls: 'text-emerald-600 dark:text-emerald-400' };
		},
		/** Baja hasta la sección de esa categoría. */
		goToCat(key: string) {
			this.activeCat = key;
			const el = this.$el.querySelector(`[data-cat-section="${CSS.escape(key)}"]`) as HTMLElement | null;
			el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		},
		/**
		 * Marca en el menú la categoría que se está viendo. En mobile además trae
		 * su chip a la vista dentro de la tira (la tira scrollea sola, la página no).
		 */
		observeSections() {
			this.catObserver?.disconnect();
			if (!this.showCategorias) return;
			const sections = [...this.$el.querySelectorAll('[data-cat-section]')] as HTMLElement[];
			if (!sections.length) return;
			if (!sections.some(s => s.dataset.catSection === this.activeCat)) this.activeCat = sections[0].dataset.catSection ?? '';
			// El observer solo avisa de las secciones que CAMBIAN: llevamos la cuenta de
			// cuáles están en la franja y la activa es la primera de ellas (orden del DOM).
			const visible = new Set<Element>();
			this.catObserver = new IntersectionObserver(
				entries => {
					for (const e of entries) {
						if (e.isIntersecting) visible.add(e.target);
						else visible.delete(e.target);
					}
					const top = sections.find(s => visible.has(s));
					if (!top) return;
					this.activeCat = top.dataset.catSection ?? '';
					const nav = this.$refs.catNav as HTMLElement | undefined;
					const chip = nav?.querySelector(`[data-cat="${CSS.escape(this.activeCat)}"]`) as HTMLElement | null;
					if (nav && chip && nav.scrollWidth > nav.clientWidth) {
						nav.scrollTo({ left: chip.offsetLeft - nav.clientWidth / 2 + chip.clientWidth / 2, behavior: 'smooth' });
					}
				},
				// Franja de "lectura": debajo del header + menú fijos, mitad superior de la pantalla.
				{ rootMargin: '-140px 0px -55% 0px' },
			);
			for (const s of sections) this.catObserver.observe(s);
		},
		goBack() {
			this.$router.push('/');
		},
		formatPrice(value: number): string {
			return formatPrice(value);
		},
		platformIcon(p: AppPlatform): string {
			return PLATFORM_ICON[p];
		},
		/** Abre una captura ampliada en el lightbox central. */
		openLightbox(producto: Producto) {
			this.lightboxItem = producto;
			this.lightboxVisible = true;
		},
		/** Admin: por ahora abre el Instagram del rubro para armar la publicación. */
		publicar() {
			const url = this.rubro?.instagramUrl;
			if (url) window.open(url, '_blank', 'noopener');
		},
		/** Cliente: abre WhatsApp con una consulta sobre el producto. */
		/** Las variantes del producto de la card ([] si es un producto suelto). */
		variantesDe(producto: Producto): Producto[] {
			return (producto.grupo && this.variantes.get(producto.grupo)) || [];
		},
		pickVariante(v: Producto) {
			if (v.grupo) this.varianteSel = { ...this.varianteSel, [v.grupo]: v.id };
		},
		/** En la pantalla de producto: además de elegirla, pasa a mostrar esa variante (misma entrada del historial). */
		pickVarianteDetalle(v: Producto) {
			this.pickVariante(v);
			void this.$router.replace({ query: { ...this.$route.query, p: v.id } });
		},
		/** Estilo del botón de una variante: elegida, sin stock (tachada) o disponible. */
		varianteCls(v: Producto, actual: Producto): string {
			if (v.id === actual.id) return 'border-primary bg-primary text-primary-contrast';
			if (v.stock === 0) return 'border-surface-200 text-surface-400 line-through dark:border-surface-700';
			return 'border-surface-300 text-surface-700 hover:border-primary hover:text-primary dark:border-surface-600 dark:text-surface-200';
		},
		consultarWhatsapp(producto: Producto) {
			const num = this.orderNumber;
			if (!num) return;
			// Con variantes, la consulta aclara cuál eligió ("Chomba piqué — L").
			const esVariante = this.variantesDe(producto).length > 0 && producto.variante;
			const nombre = esVariante ? `${producto.nombre} — ${producto.variante}` : producto.nombre;
			const msg = this.$t('public.whatsappMsg', { producto: nombre });
			window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
		},
	},
});
</script>

<style scoped>
/* La tira de categorías (mobile) se desliza con el dedo, sin barra a la vista. */
.cat-nav {
	scrollbar-width: none;
}
.cat-nav::-webkit-scrollbar {
	display: none;
}
</style>
