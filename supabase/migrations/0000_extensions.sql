-- Correr esto PRIMERO, una sola vez, antes de "npx prisma db push".
-- Prisma crea las tablas, pero necesita que pgcrypto ya esté habilitado
-- porque varias columnas usan gen_random_uuid() como valor por defecto.

create extension if not exists pgcrypto;
