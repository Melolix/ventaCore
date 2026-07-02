# VentaCore

App de publicidad sobre un stack Vue 3 + NestJS + Firebase. El público navega
**sin cuenta**; solo los roles administrativos inician sesión. El router tiene
**3 áreas** y un **login único** que redirige a cada quien según su rol:

| Área          | Ruta base      | Acceso                         | Rol requerido |
| ------------- | -------------- | ------------------------------ | ------------- |
| Aplicación    | `/app`         | **público** (sin login)        | —             |
| Super Admin   | `/superadmin`  | requiere sesión (`/login`)     | `superadmin`  |
| Administración| `/admin`       | requiere sesión (`/login`)     | `admin`       |

El header de la app pública muestra un botón **"Iniciar sesión"** que lleva a
`/login`. Ese formulario único autentica contra **Firebase** y, según el rol del
usuario, lo redirige a su panel (`/superadmin` o `/admin`). El guard del router
protege cada área verificando `meta.area` + rol.

> Jerarquía de producto (a futuro): **superadmin** (dueño de la plataforma) →
> **admin** (dueño de un negocio) → **cliente** (entidad gestionada por el admin,
> sin login) → **usuario/público** (anónimo). Hoy solo existen `superadmin`,
> `admin` y el público anónimo.

## Stack

- **Monorepo:** Turbo + npm workspaces (Node 24)
- **Frontend** (`packages/frontend`): Vue 3 (Options API), Vite, PrimeVue 4, Tailwind 4,
  Pinia (+ persistedstate), vue-router, vue-i18n, Zod, Firebase Web SDK, PWA
- **API** (`packages/api`): NestJS 11, TypeORM (Postgres), Swagger, Firebase Admin,
  guards de auth y autorización por rol
- **Shared** (`packages/shared`): tipos compartidos (roles, áreas, usuario)
- **SDK** (`packages/sdk`): autogenerado desde el Swagger (`typescript-axios`)

## Estructura

```
packages/
  frontend/
    src/
      modules/
        auth/        ← store de usuario + LoginForm + AreaLayout (reutilizables)
        superadmin/  ← área /superadmin (routes + views)
        admin/       ← área /admin
        app/         ← área /app
      router/        ← router + guard único por rol (basado en shared/AREAS)
      shared/        ← providers (firebase), services (api/axios), views
      i18n/          ← es / en
  api/
    src/
      common/
        firebase/    ← FirebaseService (Firebase Admin)
        auth/        ← FirebaseAuthGuard, RolesGuard, @Roles, @CurrentUser
      modules/
        auth/        ← GET /auth/me (perfil + rol)
        users/       ← CRUD de usuarios (alta crea el usuario en Firebase Auth)
  shared/            ← Role, AREAS, UserProfile, ...
  sdk/               ← autogenerado (no editar)
```

## Cómo extender

- **Nueva área / sección:** agregá la entrada en `packages/shared/src/types/area.ts`
  (`AREAS`) y creá un módulo en `frontend/src/modules/<area>/` con su `routes.ts`
  (replicá `app/`). El guard funciona automáticamente leyendo `meta.area`.
- **Nuevo módulo de negocio en un área:** agregá vistas como `children` de la ruta
  del área.
- **Proteger un endpoint por rol:** `@UseGuards(FirebaseAuthGuard, RolesGuard)` +
  `@Roles(Role.ADMIN)`.

## Puesta en marcha

La autenticación corre contra el **emulador de Firebase Auth** (local, sin
proyecto real ni service account). El emulador de Auth no requiere Java.

1. **Postgres** instalado y corriendo, con la base creada:
   ```sql
   CREATE DATABASE ventacore;
   ```
   Ajustá en `.env.development` las variables `DB_*` (sobre todo `DB_PASSWORD` y
   `DB_NAME`) según tu Postgres local. Con `DB_SYNCHRONIZE=true` TypeORM crea las
   tablas solo. El resto del `.env.development` ya viene configurado para el
   emulador (`FIREBASE_AUTH_EMULATOR_HOST`, proyecto `demo-ventacore`).
2. Instalar dependencias (Node 24):
   ```bash
   npm install
   ```
3. **Levantar todo** (emulador + API + frontend en paralelo) desde la raíz:
   ```bash
   npm run dev
   ```
   - Emulador Auth: `:9099` — UI del emulador: `:4400`
   - API: http://localhost:3000/api — Swagger en `/api/docs`
   - Frontend: http://localhost:5173
   - `Ctrl+C` corta los tres juntos (concurrently mata el árbol de procesos).
4. **Sembrar datos de demo** (la primera vez, con `npm run dev` corriendo). En
   otra terminal:
   ```bash
   npm run seed:demo
   ```
   Crea los usuarios de acceso y un catálogo de ejemplo (4 rubros × 5 productos).
   Es idempotente: si ya hay datos, no los duplica.

   | Rol        | Email                      | Contraseña      | Panel         |
   | ---------- | -------------------------- | --------------- | ------------- |
   | Superadmin | `superadmin@ventacore.com` | `superadmin123` | `/superadmin` |
   | Admin      | `admin@ventacore.com`      | `admin123`      | `/admin`      |

5. Abrí **http://localhost:5173** (público) o iniciá sesión para entrar al panel.
6. **Generar el SDK** (opcional, con el API corriendo): `npm run generate:sdk`.

> Los usuarios del emulador y los datos de Postgres **no** están en el repo
> (`.firebase-data/` está en `.gitignore`), por eso el `seed:demo` es el paso que
> deja todo listo tras clonar. Para sembrar sólo usuarios sueltos:
> `npm run seed -- <email> <password> <rol>`. Para correr sólo el emulador:
> `npm run emulator`.

> **Producción / Firebase real:** dejá vacías (o quitá) las variables
> `*_AUTH_EMULATOR_HOST` y completá el proyecto Firebase real (config web +
> `GOOGLE_APPLICATION_CREDENTIALS` con el service account). El código detecta el
> emulador por esas variables; sin ellas usa credenciales reales.

## Flujo de auth (resumen)

1. El público entra a `/app` (o `/`) **sin login**. El header ofrece "Iniciar sesión".
2. En `/login`, `LoginForm` hace `signInWithEmailAndPassword` (Firebase/emulador)
   y luego pide `GET /auth/me`.
3. El API verifica el ID token (Firebase Admin), busca el perfil + rol en Postgres
   y lo devuelve.
4. El front redirige al panel según el rol (`areaForRole(role).homePath`).
5. El guard del router (`router/index.ts`) protege `/admin` y `/superadmin` según
   `meta.area` + rol; si no hay sesión, manda a `/login?redirect=...`.
