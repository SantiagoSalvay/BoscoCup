-- Orden de los partidos dentro de su cancha (1º, 2º, 3º…).
-- Correr DESPUÉS de 0012: node scripts/run-sql.mjs supabase/migrations/0013_orden_cancha.sql
--
-- El vóley no tiene horario fijo (depende de los sets): solo el primero de
-- cada cancha lleva hora y el resto se juega "a continuación", en este orden.

begin;

alter table partidos add column if not exists orden_cancha int;
alter table partidos drop constraint if exists partidos_orden_cancha_positivo;
alter table partidos add constraint partidos_orden_cancha_positivo check (orden_cancha >= 1) not valid;

commit;
