<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/logo-bosco-cup-dark.png">
  <img src="public/logo-bosco-cup.png" alt="Logo de BoscoCup" width="160">
</picture>

# BoscoCup

**El torneo, en vivo, en tu celular.**

Resultados al instante · Tablas de posiciones · Cuadro de playoffs

![Fútbol masculino](https://img.shields.io/badge/F%C3%BAtbol-masculino-0f2147?style=for-the-badge)
![Fútbol femenino](https://img.shields.io/badge/F%C3%BAtbol-femenino-0f2147?style=for-the-badge)
![Vóley mixto](https://img.shields.io/badge/V%C3%B3ley-mixto-e3262e?style=for-the-badge)

📅 **Domingo 22 de noviembre de 2026** · ⏰ Primer partido a las **10:00**

</div>

---

## 🏆 ¿Qué es BoscoCup?

BoscoCup es una página web hecha para el torneo. Sirve para que **cualquiera pueda seguir los partidos desde el celular**, aunque no esté al lado de la cancha:

- ⚽ ¿Cómo va el partido de mi equipo? → lo ves **en vivo**, con el marcador cambiando solo.
- 📊 ¿En qué puesto quedamos? → la **tabla** se actualiza apenas termina cada partido.
- 🔀 ¿Contra quién jugamos en playoffs? → el **cuadro** se arma solo cuando terminan los grupos.

**No hace falta registrarse ni descargar nada**: se entra al link y listo. Si se quiere, se puede "instalar" en el celular para tenerla como una app más.

<div align="center">
<img src="manual-veedores/img/01-inicio.jpg" alt="Pantalla de inicio de BoscoCup" width="260">
<br>
<sub>La pantalla de inicio: arriba se elige el deporte y la rama; abajo, las secciones.</sub>
</div>

---

## 👥 ¿Quién la usa?

La app tiene tres partes, una para cada tipo de persona.

### 👀 1. El público: cualquiera que quiera seguir el torneo

Entra al link y, con la barra de abajo, se mueve entre cuatro secciones:

| Sección | Qué muestra |
|---|---|
| 🏠 **Inicio** | Los partidos que se están jugando **ahora mismo** y un resumen de la tabla y los cruces. |
| 📊 **Tabla** | Las posiciones de cada grupo: partidos jugados, ganados, empatados, perdidos, goles, tarjetas y puntos. |
| 🔀 **Cruces** | El cuadro de playoffs, que se completa a medida que avanzan los equipos. |
| 📜 **Historial** | Todos los resultados de los partidos ya terminados. |

Tocando cualquier equipo se abre su **ficha**: jugadores, partidos jugados y posición.

Arriba se elige **Fútbol** o **Vóley mixto** y, en fútbol, **Masculino** o **Femenino**. También hay un botón 🌙 para usar la app en **modo oscuro**.

### 📋 2. El veedor: quien anota lo que pasa en el partido

En cada partido hay un veedor que, desde su celular, va cargando lo que pasa en la cancha. **Todo lo que carga lo ve el público al instante.**

Para entrar usa un **PIN de 6 dígitos** que le da el organizador, y ve **solo los partidos que le tocan**.

<table>
<tr>
<td align="center" width="50%">
<img src="manual-veedores/img/09-marcador.jpg" alt="Pantalla del veedor en un partido de fútbol" width="230">
<br><b>⚽ Fútbol</b><br>
<sub>Botones grandes para <b>Gol</b>, <b>Amarilla</b> y <b>Roja</b>; más chicos para gol en contra e incidencias. Abajo queda el registro de todo lo que pasó.</sub>
</td>
<td align="center" width="50%">
<img src="manual-veedores/img/13-voley-puntos.jpg" alt="Pantalla del veedor en un partido de vóley" width="230">
<br><b>🏐 Vóley</b><br>
<sub>Un botón gigante por equipo para sumar cada punto. La app avisa cuándo se puede cerrar el set y cuándo termina el partido.</sub>
</td>
</tr>
</table>

Algunas cosas que le hacen la vida fácil al veedor:

- ↩️ **Si se equivoca, puede deshacer** el último evento.
- 📶 **Si se corta internet** en la cancha, la app guarda lo cargado y lo sube sola cuando vuelve la señal.
- 🟨 **Le avisa si un jugador está suspendido** por tarjetas de partidos anteriores.
- ⏱️ Tiene un **cronómetro** con la duración que corresponde a cada partido.

Cuando el veedor toca **Finalizar partido**, el resultado pasa automáticamente a la tabla.

📖 Hay un **manual paso a paso con capturas** para veedores en [`manual-veedores/`](manual-veedores/).

### 🛠️ 3. El organizador: quien arma el torneo

Entra con email y contraseña al **panel de administración**, desde donde maneja todo:

- 👕 **Equipos y jugadores**: carga los equipos de cada categoría y sus planteles (con el capitán marcado).
- 🏟️ **Canchas**: qué canchas hay y para qué deporte sirve cada una.
- 📅 **Partidos**: programa los partidos de grupo (cancha y horario) y le asigna un veedor a cada uno.
- 🔀 **Cruces**: cuando terminan los grupos, genera el cuadro de playoffs con un botón.
- 🔑 **Veedores**: crea las cuentas de los veedores. El PIN se muestra **una sola vez**: hay que anotarlo y pasárselo al veedor.
- ✏️ **Correcciones**: si hubo un error en un resultado, lo puede arreglar.

---

## 📐 ¿Cómo funciona el torneo?

### 1️⃣ Fase de grupos

Los equipos de cada categoría se dividen en grupos y **juegan todos contra todos** dentro de su grupo. Cada partido suma puntos a la tabla:

<table>
<tr>
<th>⚽ Fútbol</th>
<th>🏐 Vóley <sub>(al mejor de 3 sets)</sub></th>
</tr>
<tr>
<td valign="top">

| Resultado | Puntos |
|---|:-:|
| Victoria | **3** |
| Empate | **1** |
| Derrota | **0** |

</td>
<td valign="top">

| Resultado | Puntos |
|---|:-:|
| Victoria (2-0 o 2-1) | **3** |
| Derrota | **0** |

</td>
</tr>
</table>

> 💡 En vóley cada set se juega a **20 puntos** y hay que ganarlo por **2 de diferencia** (si llegan 19-19, sigue hasta que uno saque 2). Gana el partido el primero que gana 2 sets.

**¿Y si dos equipos terminan con los mismos puntos?** La tabla los ordena, en este orden, por:

1. Mejor **diferencia de gol** (en vóley, diferencia de sets).
2. En vóley, mejor **diferencia de tantos** (los puntos hechos dentro de los sets).
3. **Menos tarjetas amarillas.**
4. **Menos tarjetas rojas.**

Si aun así siguen iguales, la tabla lo marca y se define con un **partido de desempate**.

### 2️⃣ Playoffs

Terminada la fase de grupos, **entran todos los equipos al cuadro**. La posición en el grupo decide el cruce: primero van los 1° de cada grupo, después los 2°, y así. El mejor ubicado juega contra el peor, el segundo contra el anteúltimo, etc. Si los equipos no alcanzan para llenar la ronda, los mejores ubicados **pasan directo** a la siguiente. Según cuántos equipos haya, se juegan octavos, cuartos, semifinales, 3er puesto y final.

- En playoffs **no hay empate**: en fútbol se define por **penales** (tanda de 3).
- Los partidos de playoffs **no cambian** la tabla de grupos.

### 📏 Reglas que la app tiene en cuenta

| | ⚽ Fútbol | 🏐 Vóley |
|---|---|---|
| **Duración** | Todos los partidos: 25 minutos (10' + 5' de descanso + 10'), uno tras otro. Solo la final: 15' + 5' + 15'. Femenino: liguilla (gana la que más puntos suma). | Al mejor de 3 sets a 20 puntos, con 2 de diferencia. |
| **Planteles** | De 7 a 10 jugadores. La app no deja anotar un jugador número 11. | — |
| **Tarjetas** | Con **2 amarillas** acumuladas, o una **roja**, el jugador se pierde el **partido siguiente**. | — |

---

## ⚡ ¿Cómo se actualiza todo en vivo?

No hace falta recargar la página. Así viaja un gol desde la cancha hasta el celular de cada persona:

```
  🥅 Gol en la cancha
        │
        ▼
  📋 El veedor toca "Gol"
        │
        ▼
  ☁️  Se guarda en la base de datos
        │
        ▼
  📱 Todos los celulares que están mirando se enteran solos
     y actualizan el marcador (y, al final del partido, la tabla)
```

El día del torneo puede haber mucha gente conectada a la vez, así que la app es cuidadosa con lo que pide:

- 📦 Lo que casi no cambia (equipos, grupos, canchas) se descarga **una sola vez**.
- 🎯 Con cada gol o tarjeta se vuelve a pedir **solo lo que cambió**, no el torneo entero.
- 🔄 Si el organizador edita algo, la app también se entera y lo actualiza.
- 💤 Si el celular estuvo bloqueado un rato, al volver se recarga todo para no mostrar datos viejos.

---

## 🎨 Identidad visual

| | Color | Dónde se usa |
|---|---|---|
| ![](https://img.shields.io/badge/-%20%20%20%20%20%20-0f2147?style=flat-square) | **Azul marino** `#0f2147` | Color principal: barra de navegación, marcadores, fútbol |
| ![](https://img.shields.io/badge/-%20%20%20%20%20%20-e3262e?style=flat-square) | **Rojo** `#e3262e` | Acento: "en vivo", botones importantes, vóley, tarjetas rojas |
| ![](https://img.shields.io/badge/-%20%20%20%20%20%20-f4c430?style=flat-square) | **Amarillo** `#f4c430` | Tarjetas amarillas |
| ![](https://img.shields.io/badge/-%20%20%20%20%20%20-12a150?style=flat-square) | **Verde** `#12a150` | Goles y confirmaciones |

Tipografías: **Bricolage Grotesque** para títulos y **Geist** para el texto. La app tiene **modo claro y modo oscuro**, y se adapta sola a la preferencia del celular.

---

<details>
<summary><h2>🔧 Para quien mantiene la app (parte técnica)</h2></summary>

Esta sección es para quien tenga que instalar, modificar o publicar la app.

### Con qué está hecha

- **React + TypeScript** (con Vite): la app que se ve en el navegador. Se puede instalar en el celular (PWA).
- **Supabase**: la base de datos, el inicio de sesión y las actualizaciones en vivo. La propia base controla quién puede hacer qué.
- **Koyeb**: donde está publicada la app.

### Probarla en tu computadora

Necesitás tener instalado [Node.js](https://nodejs.org).

```bash
npm install
```

```bash
npm run dev
```

Después abrí `http://localhost:5173` en el navegador.

- **Sin configurar nada**, la app arranca con **datos de ejemplo**, para ver cómo se ve.
- **Para conectarla a la base real**, copiá `.env.example` a `.env` y completá los datos de tu proyecto de Supabase.

**Desde el celular**: con la PC y el celular en el **mismo WiFi**, abrí en el celular la dirección "Network" que muestra la terminal (algo como `http://192.168.x.x:5173`). La primera vez Windows puede pedir permiso en el firewall: hay que aceptarlo.

Direcciones: `/` (público) · `/admin/login` (organizador) · `/veedor/login` (veedores).

### Armar la base de datos (solo la primera vez)

Hace falta tener en `.env` el `DATABASE_URL` (la conexión **directa** a la base: en Supabase, *Project Settings → Database*).

1. Habilitar la extensión necesaria:
   ```bash
   node scripts/run-sql.mjs supabase/migrations/0000_extensions.sql
   ```
2. Crear las tablas:
   ```bash
   npx prisma db push
   ```
3. Cargar el torneo, las categorías y las canchas iniciales:
   ```bash
   npx prisma db seed
   ```
4. Aplicar los permisos y el resto de los ajustes, **en orden**, desde `0001` hasta el último archivo de `supabase/migrations/`:
   ```bash
   node scripts/run-sql.mjs supabase/migrations/0001_policies.sql
   ```

Para ver o editar los datos con una interfaz visual: `npm run db:studio`.

### Crear el primer organizador

```bash
node scripts/create-admin.mjs <email> <contraseña> <nombre>
```

Además, en Supabase: *Authentication → Providers → Email* → desactivar **"Confirm email"**. Si no, los veedores no van a poder entrar con su PIN.

Los veedores **no** se crean así: los crea el organizador desde el panel (`/admin` → Veedores).

### Hacer cambios en la base de datos más adelante

> ⚠️ **Una vez armada la base, no vuelvas a usar `npx prisma db push`.** Puede proponer borrar la tabla de usuarios y dejar a todos sin poder iniciar sesión.

Para cambiar la estructura:

1. Escribí el cambio en SQL en un archivo nuevo dentro de `supabase/migrations/`, siguiendo la numeración (por ejemplo `0013_lo-que-sea.sql`).
2. Corrélo:
   ```bash
   node scripts/run-sql.mjs supabase/migrations/0013_lo-que-sea.sql
   ```
3. Actualizá `prisma/schema.prisma` para que siga reflejando cómo es la base, y corré `npx prisma generate`.

### Quién puede hacer qué

| | Público | Veedor | Organizador |
|---|---|---|---|
| Cómo entra | No necesita | PIN de 6 dígitos | Email y contraseña |
| Ver partidos, tablas y cruces | ✅ | ✅ | ✅ |
| Cargar lo que pasa en un partido | — | Solo en sus partidos y mientras no estén finalizados | ✅ en cualquiera |
| Equipos, jugadores, canchas y veedores | — | — | ✅ |
| Programar partidos y asignar veedores | — | — | ✅ |
| Corregir resultados | — | — | ✅ |

Estos permisos los controla **la base de datos**, no solo la pantalla: aunque alguien intentara saltearse la interfaz, la base rechaza lo que no le corresponde.

### Publicar la app (Koyeb)

Koyeb arma la app solo a partir del repositorio de GitHub, usando el `Dockerfile`. En el servicio hay que configurar:

- Las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (las mismas que en `.env`).
- El puerto **8080**.

### Dónde está cada cosa

```
src/pages/PublicHome.tsx    la vista pública
src/pages/admin/            el panel del organizador
src/pages/veedor/           el panel del veedor (fútbol y vóley)
src/lib/standings.ts        cómo se calculan las tablas y los desempates
src/lib/bracket.ts          cómo se arma el cuadro de playoffs
src/lib/reglas.ts           horarios y reglas del reglamento
src/lib/suspensiones.ts     quién está suspendido por tarjetas
src/lib/mock-data.ts        los datos de ejemplo
supabase/migrations/        cambios a la base de datos y permisos, en orden
manual-veedores/            el manual para los veedores
```

</details>
