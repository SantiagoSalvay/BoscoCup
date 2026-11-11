/**
 * Freno de intentos de login en este navegador: después de 5 fallos seguidos
 * bloquea un rato (30 s, 60 s, 2 min… hasta 15 min). No reemplaza al límite
 * del servidor de Supabase, pero corta el "probar PINs a mano" desde la app.
 */
const KEY = "boscocup-login-guard";
const MAX_FALLOS = 5;

interface Estado {
  fallos: number;
  hasta: number;
}

function leer(scope: string): Estado {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, Estado>;
    return all[scope] ?? { fallos: 0, hasta: 0 };
  } catch {
    return { fallos: 0, hasta: 0 };
  }
}

function escribir(scope: string, e: Estado) {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, Estado>;
    all[scope] = e;
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* sin almacenamiento: no hay freno local, queda el del servidor */
  }
}

/** Tira error si el login está frenado; si no, no hace nada. */
export function chequearBloqueo(scope: string) {
  const { hasta } = leer(scope);
  const resta = hasta - Date.now();
  if (resta > 0) {
    const seg = Math.ceil(resta / 1000);
    throw new Error(`Demasiados intentos fallidos. Probá de nuevo en ${seg >= 60 ? `${Math.ceil(seg / 60)} min` : `${seg} s`}.`);
  }
}

export function registrarFallo(scope: string) {
  const e = leer(scope);
  const fallos = e.fallos + 1;
  let hasta = e.hasta;
  if (fallos >= MAX_FALLOS) {
    const tanda = fallos - MAX_FALLOS;
    hasta = Date.now() + Math.min(30_000 * 2 ** tanda, 15 * 60_000);
  }
  escribir(scope, { fallos, hasta });
}

export function registrarExito(scope: string) {
  escribir(scope, { fallos: 0, hasta: 0 });
}
