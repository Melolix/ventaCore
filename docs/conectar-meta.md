# Conectar un negocio con Meta (Facebook + Instagram)

Guía para dejar lista la **app de Meta de un negocio** y poder publicar en su
Facebook e Instagram desde VentaCore.

> **Modelo BYO ("bring your own app"):** cada negocio (rubro) usa **su propia**
> app de Meta. Ventaja: no depende de una aprobación central; el negocio publica
> en sus propias páginas en **modo desarrollo**, sin App Review.

---

## 0. Requisitos previos (esto tiene que existir antes de empezar)

1. **Una cuenta de Facebook** (personal) que sea **administradora** de la Página
   del negocio.
2. **Una Página de Facebook** del negocio (no un perfil personal).
3. **Una cuenta de Instagram Business o Creator** (no personal) **vinculada a esa
   Página de Facebook**.

> ⚠️ Instagram **no** se puede usar con una cuenta personal. Tiene que ser
> **Business** o **Creator**, y **estar vinculada a la Página**. Sin esto, se
> puede conectar Facebook pero **no** aparece Instagram como destino.

### Cómo dejar Instagram como Business y vincularlo a la Página

- En la app de Instagram: **Configuración → Cuenta → Cambiar a cuenta
  profesional** (elegir *Empresa*).
- Vincular a la Página: desde la **Página de Facebook** → *Configuración →
  Cuentas vinculadas → Instagram*, o desde Instagram → *Configuración → Cuenta
  vinculada*.

---

## 1. Crear la app en Meta for Developers

1. Entrar a **https://developers.facebook.com** e iniciar sesión con la cuenta de
   Facebook del punto 0 (la que administra la Página).
2. Arriba a la derecha: **Mis Apps → Crear app**.
3. Elegir el tipo **Empresa** (*Business*).
4. Ponerle un nombre (ej. "Redes NombreDelNegocio") y crear.

---

## 2. Agregar los productos / casos de uso

En la app, menú izquierdo:

1. **Inicio de sesión con Facebook** (*Facebook Login*): si no está, **Agregar
   producto → Facebook Login → Web**. Es lo que habilita el OAuth.
2. **Instagram**: **Agregar producto → Instagram** (o el caso de uso de Instagram
   en *Casos de uso*). Es lo que habilita publicar en IG.

---

## 3. Habilitar los permisos

En **Casos de uso** (*Use cases*) → **Personalizar** (*Customize*) → **Permisos**,
habilitar:

| Permiso | Para qué | Dónde vive |
| --- | --- | --- |
| `pages_show_list` | Listar las Páginas que administrás | Facebook Login |
| `pages_read_engagement` | Leer datos de la Página | Facebook Login |
| `instagram_basic` | Ver la cuenta de IG vinculada | Instagram |
| `instagram_content_publish` | **Publicar en Instagram** | Instagram |
| `pages_manage_posts` | **Publicar en el feed de la Página de FB** | Facebook Login / gestión de Páginas |

> **Nota:** `pages_manage_posts` suele estar en un caso de uso **distinto** al de
> Instagram (el de *Facebook Login for Business* / administración de Páginas). Si
> al pedir el consentimiento aparece **"Invalid Scopes"** para algún permiso, es
> que ese permiso todavía no está habilitado en el caso de uso correspondiente.

> En **modo Desarrollo** estos permisos funcionan **sin App Review** para las
> cuentas que tengan un **rol** en la app (administrador / desarrollador /
> tester). Como el dueño de la app es admin, puede publicar en **sus** páginas
> directamente.

---

## 4. Configurar el redirect URI (una sola vez)

En **Inicio de sesión con Facebook → Configuración**, en **URI de
redireccionamiento de OAuth válidos**, agregar **exactamente** la URL del
callback de VentaCore:

- **Desarrollo (local):**
  ```
  http://localhost:3000/api/meta/callback
  ```
- **Producción:**
  ```
  https://TU_DOMINIO/api/meta/callback
  ```

Dejar activados *"Inicio de sesión de OAuth con el cliente"* y *"Inicio de sesión
de OAuth web"*. Guardar.

> Tiene que coincidir **carácter por carácter** con el `META_REDIRECT_URI` del
> servidor de VentaCore, si no Meta rechaza la conexión.

---

## 5. Copiar las credenciales (App ID y App Secret)

Menú izquierdo: **Configuración → Básica** (*Settings → Basic*):

- **Identificador de la app** (*App ID*) → es público.
- **Clave secreta de la app** (*App Secret*) → botón **"Mostrar"** (pide la
  contraseña de Facebook).

Estos dos valores son los que se cargan en VentaCore.

---

## 6. Cargar y conectar en VentaCore

1. Entrar al panel del negocio (**/admin**) → abrir el rubro → botón **"Redes"**.
2. Cargar **App ID** y **App Secret** → **Guardar credenciales**.
3. **Conectar con Meta** → aceptar los permisos en la ventana de Meta.
4. Elegir la **Página / Instagram** de destino → **Guardar destino**.
5. Listo: desde cada **producto** se puede **Publicar**.

---

## Modo Desarrollo vs. Producción (App Review)

- **Hoy (modo Desarrollo):** la app publica en **las páginas del propio dueño de
  la app**, sin App Review. Perfecto para que cada negocio maneje **lo suyo**.
- **Si en el futuro** una sola app tuviera que publicar en nombre de **terceros
  que no tienen rol en la app**, ahí sí Meta exige **App Review** + verificación
  de negocio. Con el modelo BYO (una app por negocio) **no hace falta**.

---

## Requisitos de la imagen al publicar

Meta **descarga la imagen desde una URL**, así que la foto debe estar en una
**URL pública de internet** (no `localhost`). Además:

- **Instagram solo acepta JPEG.**
- La imagen no debe superar los límites de tamaño/relación de aspecto de IG
  (aprox. entre 4:5 y 1.91:1).

> En **desarrollo local** las imágenes viven en el emulador (`127.0.0.1`), que
> Meta **no puede alcanzar** → para probar se usa el campo *"usar otra imagen"*
> con una URL JPEG pública. En **producción** (Firebase Storage real) las
> imágenes ya quedan con URL pública y se publican directo.

---

## Errores comunes y qué significan

| Mensaje | Causa | Solución |
| --- | --- | --- |
| **Invalid Scopes: `<permiso>`** | Ese permiso no está habilitado en la app | Habilitarlo en el caso de uso correspondiente (paso 3) |
| **(#200) `pages_manage_posts` are not available** | Falta el permiso de publicar en Página | Habilitar `pages_manage_posts` (paso 3) |
| **Instagram: Only photo or video can be accepted as media type** | La imagen no es pública o no es JPEG | URL pública + JPEG (ver "Requisitos de la imagen") |
| **No aparece Instagram como destino** | La cuenta de IG no es Business o no está vinculada a la Página | Ver paso 0 |
| **redirect_uri no coincide** | El redirect en Meta ≠ el del servidor | Igualar la URL exacta (paso 4) |
