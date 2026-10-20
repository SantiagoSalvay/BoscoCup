-- Permite al admin eliminar equipos y jugadores aunque ya tengan partidos,
-- eventos o formaciones cargadas. Antes todas estas FKs estaban en
-- NO ACTION, así que Postgres rechazaba el DELETE y el panel no podía borrar.
--
-- Criterio:
-- - Borrar un EQUIPO borra sus partidos (y con ellos eventos, sets, cuartos,
--   formaciones y asignaciones, que ya cascadean desde partidos), sus
--   formaciones y sanciones.
-- - Borrar un JUGADOR borra sus formaciones; los eventos que protagonizó
--   (goles, tarjetas) se conservan sin jugador, para no alterar resultados.
-- Correr con: node scripts/run-sql.mjs supabase/migrations/0005_borrado_en_cascada.sql

begin;

-- ---- equipos ----
alter table partidos drop constraint if exists partidos_equipo_local_id_fkey;
alter table partidos add constraint partidos_equipo_local_id_fkey
  foreign key (equipo_local_id) references equipos(id) on delete cascade;

alter table partidos drop constraint if exists partidos_equipo_visitante_id_fkey;
alter table partidos add constraint partidos_equipo_visitante_id_fkey
  foreign key (equipo_visitante_id) references equipos(id) on delete cascade;

alter table partidos drop constraint if exists partidos_walkover_equipo_id_fkey;
alter table partidos add constraint partidos_walkover_equipo_id_fkey
  foreign key (walkover_equipo_id) references equipos(id) on delete set null;

alter table eventos_partido drop constraint if exists eventos_partido_equipo_id_fkey;
alter table eventos_partido add constraint eventos_partido_equipo_id_fkey
  foreign key (equipo_id) references equipos(id) on delete cascade;

alter table formaciones drop constraint if exists formaciones_equipo_id_fkey;
alter table formaciones add constraint formaciones_equipo_id_fkey
  foreign key (equipo_id) references equipos(id) on delete cascade;

alter table sanciones drop constraint if exists sanciones_equipo_id_fkey;
alter table sanciones add constraint sanciones_equipo_id_fkey
  foreign key (equipo_id) references equipos(id) on delete cascade;

alter table sets_voley drop constraint if exists sets_voley_ganador_equipo_id_fkey;
alter table sets_voley add constraint sets_voley_ganador_equipo_id_fkey
  foreign key (ganador_equipo_id) references equipos(id) on delete set null;

-- ---- jugadores ----
alter table eventos_partido drop constraint if exists eventos_partido_jugador_id_fkey;
alter table eventos_partido add constraint eventos_partido_jugador_id_fkey
  foreign key (jugador_id) references jugadores(id) on delete set null;

alter table eventos_partido drop constraint if exists eventos_partido_jugador_asistencia_id_fkey;
alter table eventos_partido add constraint eventos_partido_jugador_asistencia_id_fkey
  foreign key (jugador_asistencia_id) references jugadores(id) on delete set null;

alter table formaciones drop constraint if exists formaciones_jugador_id_fkey;
alter table formaciones add constraint formaciones_jugador_id_fkey
  foreign key (jugador_id) references jugadores(id) on delete cascade;

-- ---- partidos (al borrarse en cascada no deben trabar avisos/sanciones) ----
alter table avisos drop constraint if exists avisos_partido_id_fkey;
alter table avisos add constraint avisos_partido_id_fkey
  foreign key (partido_id) references partidos(id) on delete set null;

alter table sanciones drop constraint if exists sanciones_partido_origen_id_fkey;
alter table sanciones add constraint sanciones_partido_origen_id_fkey
  foreign key (partido_origen_id) references partidos(id) on delete set null;

commit;
