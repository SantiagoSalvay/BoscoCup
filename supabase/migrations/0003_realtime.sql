-- Habilita Realtime (suscripción a cambios de fila) en las tablas que la
-- vista pública necesita ver actualizarse solas: nuevos eventos de partido,
-- cambios de estado/resultado de partidos y avisos del organizador.

alter publication supabase_realtime add table partidos;
alter publication supabase_realtime add table eventos_partido;
alter publication supabase_realtime add table avisos;
