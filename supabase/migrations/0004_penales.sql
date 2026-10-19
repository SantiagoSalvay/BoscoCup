-- Resultado de la tanda de penales, para partidos de eliminatoria que
-- terminan empatados en el resultado (resultado_local = resultado_visitante).
-- Prisma no puede aplicar esto con `db push` porque la introspección choca
-- con el FK de profiles -> auth.users, así que se corre a mano con
-- scripts/run-sql.mjs (igual que las demás migraciones de esta carpeta).
alter table partidos
  add column if not exists penales_local integer,
  add column if not exists penales_visitante integer;
