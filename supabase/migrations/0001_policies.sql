-- Correr esto DESPUÉS de "npx prisma db push" (que crea las tablas).
-- Row Level Security: quién puede leer/escribir qué. Esto no se puede
-- describir en schema.prisma, así que vive acá como SQL aparte.

create or replace function is_admin()
returns boolean language sql stable as $$
  select exists (
    select 1 from profiles where id = auth.uid() and rol = 'admin' and activo
  );
$$;

create or replace function veedor_asignado_a(p_partido_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from asignaciones_veedor av
    join partidos p on p.id = av.partido_id
    where av.partido_id = p_partido_id
      and av.veedor_id = auth.uid()
      and p.estado != 'finalizado'
  );
$$;

alter table torneos enable row level security;
alter table categorias enable row level security;
alter table equipos enable row level security;
alter table jugadores enable row level security;
alter table canchas enable row level security;
alter table grupos enable row level security;
alter table grupo_equipos enable row level security;
alter table partidos enable row level security;
alter table eventos_partido enable row level security;
alter table sets_voley enable row level security;
alter table cuartos_basquet enable row level security;
alter table formaciones enable row level security;
alter table profiles enable row level security;
alter table asignaciones_veedor enable row level security;
alter table sanciones enable row level security;
alter table avisos enable row level security;
alter table auditoria enable row level security;

-- Lectura pública (anon + authenticated) de todo lo que ve el espectador.
create policy publico_lee_torneos on torneos for select using (true);
create policy publico_lee_categorias on categorias for select using (true);
create policy publico_lee_equipos on equipos for select using (true);
create policy publico_lee_jugadores on jugadores for select using (true);
create policy publico_lee_canchas on canchas for select using (true);
create policy publico_lee_grupos on grupos for select using (true);
create policy publico_lee_grupo_equipos on grupo_equipos for select using (true);
create policy publico_lee_partidos on partidos for select using (true);
create policy publico_lee_eventos on eventos_partido for select using (not anulado);
create policy publico_lee_sets on sets_voley for select using (true);
create policy publico_lee_cuartos on cuartos_basquet for select using (true);
create policy publico_lee_formaciones on formaciones for select using (true);
create policy publico_lee_avisos on avisos for select using (activo);

-- El admin tiene control total sobre toda la configuración del torneo.
create policy admin_todo_torneos on torneos for all using (is_admin()) with check (is_admin());
create policy admin_todo_categorias on categorias for all using (is_admin()) with check (is_admin());
create policy admin_todo_equipos on equipos for all using (is_admin()) with check (is_admin());
create policy admin_todo_jugadores on jugadores for all using (is_admin()) with check (is_admin());
create policy admin_todo_canchas on canchas for all using (is_admin()) with check (is_admin());
create policy admin_todo_grupos on grupos for all using (is_admin()) with check (is_admin());
create policy admin_todo_grupo_equipos on grupo_equipos for all using (is_admin()) with check (is_admin());
create policy admin_todo_partidos on partidos for all using (is_admin()) with check (is_admin());
create policy admin_todo_eventos on eventos_partido for all using (is_admin()) with check (is_admin());
create policy admin_todo_sets on sets_voley for all using (is_admin()) with check (is_admin());
create policy admin_todo_cuartos on cuartos_basquet for all using (is_admin()) with check (is_admin());
create policy admin_todo_formaciones on formaciones for all using (is_admin()) with check (is_admin());
create policy admin_todo_profiles on profiles for all using (is_admin()) with check (is_admin());
create policy admin_todo_asignaciones on asignaciones_veedor for all using (is_admin()) with check (is_admin());
create policy admin_todo_sanciones on sanciones for all using (is_admin()) with check (is_admin());
create policy admin_todo_avisos on avisos for all using (is_admin()) with check (is_admin());
create policy admin_lee_auditoria on auditoria for select using (is_admin());
create policy sistema_escribe_auditoria on auditoria for insert with check (true);

-- Cada usuario ve su propio perfil (para saber su rol al iniciar sesión).
create policy propio_perfil on profiles for select using (id = auth.uid());

-- El veedor solo opera los partidos que tiene asignados, y nunca los finalizados.
create policy veedor_ve_su_asignacion on asignaciones_veedor for select using (veedor_id = auth.uid());

create policy veedor_carga_eventos on eventos_partido for insert
  with check (veedor_asignado_a(partido_id));
create policy veedor_corrige_sus_eventos on eventos_partido for update
  using (veedor_asignado_a(partido_id)) with check (veedor_asignado_a(partido_id));

create policy veedor_carga_sets on sets_voley for insert with check (veedor_asignado_a(partido_id));
create policy veedor_actualiza_sets on sets_voley for update
  using (veedor_asignado_a(partido_id)) with check (veedor_asignado_a(partido_id));

create policy veedor_carga_cuartos on cuartos_basquet for insert with check (veedor_asignado_a(partido_id));
create policy veedor_actualiza_cuartos on cuartos_basquet for update
  using (veedor_asignado_a(partido_id)) with check (veedor_asignado_a(partido_id));

create policy veedor_carga_formacion on formaciones for insert with check (veedor_asignado_a(partido_id));

-- El veedor solo puede mover el estado/horario real del partido que le asignaron.
create policy veedor_actualiza_su_partido on partidos for update
  using (veedor_asignado_a(id)) with check (veedor_asignado_a(id));
