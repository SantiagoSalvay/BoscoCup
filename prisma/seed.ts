// Carga los datos iniciales del torneo. Correr con: npx prisma db seed
// Idempotente: se puede correr varias veces sin duplicar nada.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TORNEO_ID = "00000000-0000-0000-0000-000000000001";

async function main() {
  await prisma.torneo.upsert({
    where: { id: TORNEO_ID },
    update: {},
    create: {
      id: TORNEO_ID,
      nombre: "BoscoCup",
      fechaInicio: new Date(),
      fechaFin: new Date()
    }
  });

  const categorias = [
    { deporte: "futbol" as const, rama: "Masculino", puntosVictoria: 3, puntosEmpate: 1, puntosDerrota: 0 },
    { deporte: "futbol" as const, rama: "Femenino", puntosVictoria: 3, puntosEmpate: 1, puntosDerrota: 0 },
    { deporte: "voley" as const, rama: "Masculino", puntosVictoria: 0, puntosEmpate: 0, puntosDerrota: 0 },
    { deporte: "voley" as const, rama: "Femenino", puntosVictoria: 0, puntosEmpate: 0, puntosDerrota: 0 },
    { deporte: "basquet" as const, rama: "Único", puntosVictoria: 2, puntosEmpate: 0, puntosDerrota: 1 }
  ];

  for (const c of categorias) {
    await prisma.categoria.upsert({
      where: { torneoId_deporte_rama: { torneoId: TORNEO_ID, deporte: c.deporte, rama: c.rama } },
      update: {},
      create: { torneoId: TORNEO_ID, ...c, cantidadClasificanPorGrupo: 2 }
    });
  }

  const canchas = [
    { id: "00000000-0000-0000-0000-000000000011", nombre: "Cancha 1 (Fútbol)", deportes: ["futbol" as const] },
    { id: "00000000-0000-0000-0000-000000000012", nombre: "Cancha 2 (Fútbol)", deportes: ["futbol" as const] },
    { id: "00000000-0000-0000-0000-000000000013", nombre: "Cancha 3 (Vóley)", deportes: ["voley" as const] },
    { id: "00000000-0000-0000-0000-000000000014", nombre: "Cancha 4 (Vóley)", deportes: ["voley" as const] },
    { id: "00000000-0000-0000-0000-000000000015", nombre: "Cancha 5 (Básquet)", deportes: ["basquet" as const] }
  ];

  for (const c of canchas) {
    await prisma.cancha.upsert({
      where: { id: c.id },
      update: {},
      create: { id: c.id, torneoId: TORNEO_ID, nombre: c.nombre, deportesCompatibles: c.deportes }
    });
  }

  console.log("Seed listo: torneo, 5 categorías y 5 canchas.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
