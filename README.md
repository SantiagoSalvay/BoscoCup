# BoscoCup

App en vivo para seguir un torneo de fútbol, vóley y básquet desde el celular: resultados, tablas de posiciones y cruces, sin necesidad de registrarse. Tiene además un panel de administración (equipos, jugadores, canchas, partidos, veedores) y un panel de veedor con login por PIN (ver **Estado del proyecto**).

## Stack y por qué

- **React + Vite + TypeScript**: build rápido, buen soporte de PWA, tipado para la lógica crítica (fixture, desempates, reglas por deporte).
- **Tailwind CSS**: utilidades para el layout; los componentes con identidad propia (marcador, tabla, cruces) tienen su CSS dedicado en `src/index.css`.
- **Supabase** (Postgres + Realtime + Auth + RLS) en vez de Firebase: el modelo de datos del torneo es muy relacional (partidos → eventos → sets/cuartos → formaciones, con llaves foráneas por todos lados), algo que Postgres modela mejor que una base documental. Realtime de Supabase permite suscribirse a cambios de fila (ej. nuevos `eventos_partido`) sin backend propio, y RLS deja los tres roles (público, veedor, admin) definidos como políticas SQL en vez de lógica repetida en el cliente.
- **Prisma** para manejar la estructura de la base (`prisma/schema.prisma`): tablas, columnas y relaciones se editan ahí y se aplican con `npx prisma db push`, en vez de escribir `CREATE TABLE` a mano. Importante — Prisma **no** es la capa de datos de la app en tiempo real: el front-end (`src/`) sigue hablando con Supabase vía `@supabase/supabase-js` (REST + Realtime, respeta RLS, funciona desde el navegador). Prisma Client necesita una conexión directa a Postgres que nunca debe exponerse en el navegador, así que solo se usa para herramientas locales: `db push`, `db seed`, `studio`. Row Level Security tampoco se puede describir en `schema.prisma` — esas políticas viven en SQL aparte (`supabase/migrations/0001_policies.sql`) y se aplican después del `db push`.
- **Koyeb**: hosting del contenedor Docker de la app (ver `Dockerfile`). Supabase se mantiene como servicio separado (su propio hosting administrado para la base y Realtime).

## Cómo correr el proyecto

```bash
npm install
cp .env.example .env   # completar con las credenciales de tu proyecto Supabase (opcional)
npm run dev
```

Sin `.env`, la app levanta igual con datos de ejemplo (`src/lib/mock-data.ts`) para que la demo se vea completa desde el primer momento.

## Base de datos (primera vez)

Con `DATABASE_URL` ya completado en `.env` (connection string **directa** de Postgres, no el pooler — Dashboard → Project Settings → Database):

```bash
# 1) habilitar la extensión que usan los UUID por defecto (una sola vez, SQL Editor de Supabase)
#    supabase/migrations/0000_extensions.sql

# 2) crear todas las tablas a partir de prisma/schema.prisma
npx prisma db push

# 3) cargar el torneo, las 5 categorías y las 5 canchas
npx prisma db seed

# 4) aplicar Row Level Security (SQL Editor de Supabase, o psql)
#    supabase/migrations/0001_policies.sql
```

Para explorar o editar los datos con una interfaz visual: `npm run db:studio` (abre Prisma Studio).

Scripts auxiliares (usan `DATABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` del `.env`, nunca viajan al navegador):
- `node scripts/run-sql.mjs <archivo.sql>` — corre un `.sql` cualquiera contra la base (lo necesitás para `0000_extensions.sql` y `0001_policies.sql`).
- `node scripts/create-admin.mjs <email> <password> <nombre>` — da de alta un usuario admin (Auth + `profiles`) sin pasar por el Dashboard.

Para cambiar la estructura más adelante: editá `prisma/schema.prisma` y corré `npx prisma db push` de nuevo.

### Primer usuario admin

1. Dashboard de Supabase → Authentication → Users → **Add user** (email + contraseña, tildar "Auto confirm user").
2. Authentication → Providers → Email → desactivar **"Confirm email"** (si no, los veedores que se crean desde el panel con PIN no van a poder loguearse).
3. Copiar el UUID del usuario creado y correr en el SQL Editor:
   ```sql
   insert into profiles (id, nombre, rol) values ('<uuid>', 'Tu nombre', 'admin');
   ```

Los veedores, en cambio, se crean directamente desde `/admin` → Veedores (PIN de 6 dígitos, sin email).

## Acceder desde el celular y la PC

En desarrollo (`npm run dev`), Vite ya queda escuchando en la red local (`host: true` en `vite.config.ts`), no solo en `localhost`. La terminal donde corre `npm run dev` muestra dos URLs:

- **Local**: `http://localhost:5173` — para la PC donde corre el servidor.
- **Network**: `http://<tu-ip-local>:5173` — abrí esa misma URL desde el celular, conectado al **mismo WiFi** que la PC. Windows puede pedir permiso de firewall para Node.js la primera vez — hay que aceptarlo.

Rutas útiles: `/` (público), `/admin/login` (organizador), `/veedor/login` (veedor, PIN).

Esto solo funciona mientras la PC y el celular estén en la misma red y el servidor de desarrollo siga corriendo. Para acceder desde cualquier lugar (no solo el mismo WiFi, el día del torneo por ejemplo) hay que desplegar a Koyeb — ver abajo.

## Deploy en Koyeb

Koyeb puede construir la app directamente desde el `Dockerfile` del repo (deploy desde GitHub → "Dockerfile" como método de build). Variables de entorno a configurar en el servicio de Koyeb:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

(`DATABASE_URL` no hace falta en Koyeb — es solo para correr Prisma en tu máquina). El contenedor sirve la app ya compilada con nginx en el puerto `8080` (configurar ese puerto en el servicio de Koyeb).

## Estructura

```
prisma/schema.prisma       estructura de la base (tablas, columnas, relaciones)
prisma/seed.ts             carga el torneo, categorías y canchas iniciales
supabase/migrations/       lo que Prisma no modela: extensión pgcrypto y políticas de RLS
src/
  components/icons.tsx      set de íconos propios (sin emojis)
  components/ProtectedRoute.tsx  guarda de rutas por rol
  lib/auth.tsx               sesión y rol del usuario actual (AuthProvider / useAuth)
  lib/supabase.ts            cliente de Supabase (null si no hay credenciales)
  lib/mock-data.ts           datos de ejemplo para la demo pública
  lib/db-types.ts            tipos de las tablas de la base
  pages/PublicHome.tsx            vista pública: en vivo, tabla y cruces
  pages/admin/                login, layout y pantallas del panel admin
  pages/veedor/               login y "mis partidos" del panel veedor
  types.ts                    tipos de la vista pública
```

## Modelo de datos (resumen)

`torneos` → `categorias` (deporte + rama) → `equipos` → `jugadores`. Los partidos (`partidos`) se agrupan en `grupos` (fase de grupos) o quedan sueltos con `ronda_eliminatoria` (fase eliminatoria). `eventos_partido` es la fuente de verdad de todo lo que pasa en un partido (goles, tarjetas, puntos, faltas, cambios); `sets_voley`, `cuartos_basquet` y `formaciones` son el detalle propio de cada deporte. `asignaciones_veedor` controla qué veedor puede cargar qué partido. `sanciones`, `avisos` y `auditoria` cubren disciplina, comunicados del organizador y trazabilidad de cambios.

## Roles y privilegios

| | Público | Veedor | Admin |
|---|---|---|---|
| Login | No hace falta | PIN de 6 dígitos | Email + contraseña |
| Ver torneo, tablas, cruces, en vivo | ✅ | ✅ | ✅ |
| Cargar eventos/sets/cuartos/formación | — | Solo en sus partidos asignados, nunca si ya finalizaron | ✅ en cualquier partido |
| Alta de equipos, jugadores, canchas, veedores | — | — | ✅ |
| Programar partidos y asignar veedores | — | — | ✅ |
| Auditoría, sanciones, corrección de resultados | — | — | ✅ |

Esto está impuesto por RLS en la base (`supabase/migrations/0001_policies.sql`), no solo oculto en la interfaz — aunque alguien manipule el cliente, Postgres rechaza la operación si no cumple la política.

El login de veedor por PIN funciona así: el admin, al crear un veedor desde `/admin/veedores`, da de alta una cuenta de Supabase Auth con un email sintético derivado del PIN (`veedor-<pin>@boscocup.local`) y el PIN como contraseña — usando un cliente de Supabase aparte que no pisa la sesión del admin (`createProvisioningClient` en `src/lib/supabase.ts`). El PIN se muestra una sola vez al crearlo; no se guarda en texto plano en ningún lado.

## Estado del proyecto

- [x] Fase 0 — Identidad visual y style tile (aprobado)
- [x] Fase 1 — Arquitectura, stack y esquema de base de datos
- [x] Vista pública (en vivo / tabla / cruces) con datos de ejemplo
- [x] Fase 2 — Auth, roles (admin/veedor/público) y RLS de punta a punta
- [x] Panel admin — equipos, jugadores, canchas, veedores, carga manual de partidos
- [x] Panel veedor — login por PIN y "mis partidos"
- [ ] Generación automática de grupos, fixture y programación con detección de conflictos (hoy la carga de partidos es manual)
- [x] Panel del veedor — fútbol: formación, cronómetro, gol/amarilla/roja/doble amarilla/cambio/penal/incidencia, deshacer, modo offline
- [ ] Panel del veedor — vóley y básquet (sets / cuartos)
- [x] Vista pública conectada a Supabase en tiempo real (`src/lib/public-data.ts`; usa datos de ejemplo solo si no hay credenciales configuradas)
- [x] Carrusel de partidos en vivo (todos los deportes, auto-avanza) y tablas por zona cuando hay grupos cargados
- [ ] Disciplina, auditoría, exportaciones, notificaciones y modo TV
