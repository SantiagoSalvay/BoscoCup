-- El torneo queda con tres categorías: Fútbol Masculino, Fútbol Femenino y
-- Vóley Mixto. Se elimina básquet y las dos ramas de vóley se unifican.
-- Correr con: node scripts/run-sql.mjs supabase/migrations/0006_futbol_y_voley_mixto.sql
--
-- El valor 'basquet' del enum `deporte` se deja en la base (Postgres no
-- permite borrar valores de un enum sin recrearlo), pero ya no lo usa nada.

begin;

-- Equipos que hubiera en vóley femenino pasan a la categoría mixta antes de borrarla.
update equipos e
set categoria_id = m.id
from categorias f, categorias m
where e.categoria_id = f.id
  and f.deporte = 'voley' and f.rama = 'Femenino'
  and m.deporte = 'voley' and m.rama = 'Masculino'
  and f.torneo_id = m.torneo_id;

delete from categorias where deporte = 'voley' and rama = 'Femenino';
update categorias set rama = 'Mixto' where deporte = 'voley' and rama = 'Masculino';

-- Básquet: se borra la categoría (cascadea equipos, grupos y partidos).
delete from categorias where deporte = 'basquet';

-- Canchas: se saca básquet de las compatibles y se borran las que solo eran de básquet.
update canchas set deportes_compatibles = array_remove(deportes_compatibles, 'basquet'::deporte)
where 'basquet' = any(deportes_compatibles);
delete from canchas c
where cardinality(c.deportes_compatibles) = 0
  and not exists (select 1 from partidos p where p.cancha_id = c.id);

-- El número y la posición dejan de pedirse al inscribir jugadores.
alter table jugadores drop constraint if exists jugadores_equipo_id_numero_key;

commit;
