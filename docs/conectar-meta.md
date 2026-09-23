# Instagram / Facebook en VentaCore

Hay **una sola app de Meta para toda la plataforma**: la app **VentaCore**
(App ID `2447424345747180`), dentro del portfolio comercial **Melolix**. Cada
negocio (rubro) solo autoriza su Página e Instagram con "Conectar con Meta"; no
crea apps ni copia claves.

La guía tiene dos partes:

- **A. Plataforma**: se hace una vez (dueño de VentaCore).
- **B. Cada negocio**: lo que hace un cliente para conectar su rubro.

---

## A. Plataforma (una sola vez)

### A1. Portfolio y app

- Portfolio comercial: **Melolix** (business.facebook.com). Titular: Florencia
  Cerquette, CUIT 23-35642353-4 (tiene que coincidir con ARCA para la
  verificación).
- App: **VentaCore**, tipo Empresa, asignada al portfolio Melolix.
- La app vieja (`986366827416308`, portfolio Hugo Cerquette) queda solo para
  WhatsApp: **no borrarla ni moverla**, su usuario del sistema
  (VentacoreWhatsapp) genera el token de `WHATSAPP_TOKEN`.

### A2. Caso de uso y permisos

Casos de uso → **API de Instagram** → *Configuración de la API con inicio de
sesión con Facebook* (NO la de "inicio de sesión de Instagram") → **Add required
content permissions**. Queda:

| Permiso | Para qué |
| --- | --- |
| `pages_show_list` | Listar las Páginas del negocio |
| `pages_read_engagement` | Leer la Página y su Instagram vinculado |
| `business_management` | Ver Páginas que viven dentro de un portfolio comercial |
| `instagram_basic` | Datos de la cuenta de IG |
| `instagram_content_publish` | Publicar en el feed y en historias |

Tienen que coincidir con `SCOPES` en
`packages/api/src/modules/social/meta-oauth.service.ts`. `pages_manage_posts`
(publicar en la Página de Facebook) está afuera a propósito; si se agrega, hay
que pedirlo también en el App Review.

### A3. URLs en la app de Meta

**Inicio de sesión con Facebook para empresas → Configuración**:

- URI de redireccionamiento de OAuth válidos:
  - `http://localhost:3000/api/meta/callback`
  - `https://ventacore.melolix.ar/api/meta/callback`
- URL de devolución de llamada para cancelar autorización:
  `https://ventacore.melolix.ar/api/meta/deauthorize`

**Configuración de la app → Básica**:

| Campo | Valor |
| --- | --- |
| Dominios de la app | `melolix.ar` |
| Política de privacidad | `https://melolix.ar/privacidad` |
| Condiciones del servicio | `https://melolix.ar/terminos` |
| Eliminación de datos | *URL de devolución de llamada* → `https://ventacore.melolix.ar/api/meta/data-deletion` |
| Categoría | Negocios y páginas |
| Ícono | 1024×1024 |

Las páginas legales son globales (módulo `packages/frontend/src/modules/legal`):
funcionan en cualquier dominio. Los datos del titular están en `titular.ts`.

### A4. Servidor (`.env.production`)

```
META_APP_ID=2447424345747180
META_APP_SECRET=<Configuración → Básica → Clave secreta>
META_REDIRECT_URI=https://ventacore.melolix.ar/api/meta/callback
META_POST_CONNECT_REDIRECT=https://ventacore.melolix.ar/admin/configuraciones
META_TOKEN_ENC_KEY=<no cambiarla: si cambia, hay que reconectar todo>
```

### A5. Verificación y App Review (para abrirlo a cualquier cliente)

Mientras la app esté en **modo Desarrollo**, solo pueden conectar cuentas con
rol en la app (Roles de la app → agregar como *tester*; la persona acepta en
developers.facebook.com/requests). Para que cualquier negocio se conecte solo:

1. **Verificación del negocio** de Melolix (business.facebook.com → Centro de
   seguridad). Documentos: constancia de ARCA + factura o servicio con el
   domicilio. Contacto por `contacto@melolix.ar`.
2. **App Review**: un video por permiso mostrando el flujo en VentaCore
   (conectar → elegir destino → publicar).
3. Pasar la app a **modo Live**.

---

## B. Cada negocio (lo que hace el cliente)

### B1. Requisitos del lado de Meta

1. Una **Página de Facebook** del negocio, de la que sea administrador.
2. Un **Instagram profesional de tipo Empresa** (Instagram → Configuración →
   Tipo de cuenta). Las cuentas de Creador publican en el feed pero **no** pueden
   publicar historias por la API.
3. El Instagram **vinculado a la Página** (Página → Configuración → Cuentas
   vinculadas → Instagram).
4. *Solo mientras la app esté en modo Desarrollo*: rol de tester en la app.

### B2. Conectar

1. Panel del negocio → **Configuraciones** → elegir el rubro → **Conectar con Meta**.
2. En la ventana de Meta: iniciar sesión, **marcar la Página del negocio** y
   dejar todos los permisos tildados.
3. Elegir el destino (Página + Instagram) → **Guardar destino**.
4. Listo: se publica desde el **Estudio de Instagram** de cada producto.

---

## Mantenimiento de la conexión

- Si Meta rechaza el token al publicar (contraseña cambiada, permisos quitados),
  la conexión pasa a **vencida** y el panel muestra **Reconectar con Meta**.
- Si el negocio quita VentaCore desde Facebook, Meta llama a
  `/api/meta/deauthorize` y la conexión pasa a **revocada**.
- Si pide borrar sus datos desde Facebook, Meta llama a
  `/api/meta/data-deletion`: se borra la conexión con sus tokens y Meta muestra
  el código de confirmación (`/eliminar-datos?codigo=...`).
- Si al conectar destildó permisos, el panel avisa cuáles faltan.

---

## Requisitos de la imagen al publicar

Meta **descarga la imagen desde una URL pública** (no `localhost`) y
**Instagram solo acepta JPEG**, con relación de aspecto aprox. entre 4:5 y
1.91:1. En desarrollo local las imágenes viven en el emulador, que Meta no
alcanza: para probar se usa *"usar otra imagen"* con una URL JPEG pública.

## Historias de Instagram

- Solo Instagram (no Facebook) y solo cuentas **Empresa** vinculadas a la Página.
- Mismo permiso que el feed (`instagram_content_publish`).
- **Sin texto**: Instagram ignora el `caption` en `media_type=STORIES`.
- 9:16 (1080×1920), duran 24 h y no tienen link público.

## Errores comunes

| Mensaje | Causa | Solución |
| --- | --- | --- |
| **Invalid Scopes: `<permiso>`** | El permiso no está agregado en el caso de uso | Paso A2 |
| **No llegó ninguna Página** | No se marcó la Página en la ventana de Meta, o la cuenta no la administra | Desconectar, reconectar y marcar la Página |
| **No aparece Instagram como destino** | IG no es Empresa o no está vinculado a la Página | Paso B1 |
| **La app no está disponible / no se puede iniciar sesión** | App en modo Desarrollo y la cuenta no tiene rol | Agregarla como tester (A5) |
| **Only photo or video can be accepted as media type** | Imagen no pública o no JPEG | Ver "Requisitos de la imagen" |
| **redirect_uri no coincide** | El callback en Meta ≠ `META_REDIRECT_URI` | Paso A3 / A4 |
