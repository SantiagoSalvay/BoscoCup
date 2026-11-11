-- Endurecimiento de seguridad (RLS y triggers).
-- Correr con: node scripts/run-sql.mjs supabase/migrations/0007_seguridad.sql
--
-- 1. Las funciones de permisos pasan a SECURITY DEFINER con search_path fijo:
--    evita recursión de políticas sobre `profiles` y que un objeto con el
--    mismo nombre en otro schema las secuestre.
-- 2. Un veedor desactivado pierde el acceso a sus partidos al instante.
-- 3. El veedor solo puede tocar el estado y el resultado de su partido, nunca
--    equipos, cancha, horario, grupo o ronda (eso es del organizador).
-- 4. El veedor puede renovar el "candado" de su asignación (bloqueado_en),
--    pero no reasignarse otro partido.
-- 5. La auditoría ya no acepta inserts anónimos.
-- 6. Topes de largo en textos libres, para que nadie llene la base de basura.

begin;

create or replace function is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and rol = 'admin' and activo
  );
$$;

create or replace function veedor_asignado_a(p_partido_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from asignaciones_veedor av
    join partidos p on p.id = av.partido_id
    join profiles pr on pr.id = av.veedor_id
    where av.partido_id = p_partido_id
      and av.veedor_id = auth.uid()
      and pr.activo
      and pr.rol = 'veedor'
      and p.estado != 'finalizado'
  );
$$;

revoke all on function is_admin() from public;
revoke all on function veedor_asignado_a(uuid) from public;
grant execute on function is_admin() to anon, authenticated;
grant execute on function veedor_asignado_a(uuid) to authenticated;

-- ---- 3. el veedor solo mueve estado y resultado ----
create or replace function partidos_guardia_veedor()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if is_admin() or auth.uid() is null then
    -- Admin, o conexión directa del servidor (scripts/seed): sin restricción.
    return new;
  end if;
  if new.categoria_id is distinct from old.categoria_id
    or new.grupo_id is distinct from old.grupo_id
    or new.ronda_eliminatoria is distinct from old.ronda_eliminatoria
    or new.equipo_local_id is distinct from old.equipo_local_id
    or new.equipo_visitante_id is distinct from old.equipo_visitante_id
    or new.cancha_id is distinct from old.cancha_id
    or new.fecha_hora_programada is distinct from old.fecha_hora_programada
    or new.walkover_equipo_id is distinct from old.walkover_equipo_id then
    raise exception 'El veedor solo puede cargar el estado y el resultado del partido'
      using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists partidos_guardia_veedor on partidos;
create trigger partidos_guardia_veedor
  before update on partidos
  for each row execute function partidos_guardia_veedor();

-- ---- 4. candado de la asignación ----
drop policy if exists veedor_renueva_candado on asignaciones_veedor;
create policy veedor_renueva_candado on asignaciones_veedor for update
  using (veedor_id = auth.uid() and veedor_asignado_a(partido_id))
  with check (veedor_id = auth.uid());

create or replace function asignaciones_guardia_veedor()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if is_admin() or auth.uid() is null then
    return new;
  end if;
  if new.partido_id is distinct from old.partido_id or new.veedor_id is distinct from old.veedor_id then
    raise exception 'El veedor no puede cambiar su asignación' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists asignaciones_guardia_veedor on asignaciones_veedor;
create trigger asignaciones_guardia_veedor
  before update on asignaciones_veedor
  for each row execute function asignaciones_guardia_veedor();

-- ---- 5. auditoría ----
drop policy if exists sistema_escribe_auditoria on auditoria;
create policy admin_escribe_auditoria on auditoria for insert with check (is_admin());

-- ---- 6. topes de largo ----
alter table jugadores drop constraint if exists jugadores_nombre_largo;
alter table jugadores add constraint jugadores_nombre_largo check (char_length(nombre) between 1 and 80) not valid;
alter table equipos drop constraint if exists equipos_nombre_largo;
alter table equipos add constraint equipos_nombre_largo check (char_length(nombre) between 1 and 60) not valid;
alter table eventos_partido drop constraint if exists eventos_detalle_largo;
alter table eventos_partido add constraint eventos_detalle_largo check (pg_column_size(detalle) < 4096) not valid;

commit;
