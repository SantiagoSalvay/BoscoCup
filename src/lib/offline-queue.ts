import { supabase } from "@/lib/supabase";

interface QueuedOp {
  id: string;
  op: "insert" | "update";
  table: string;
  payload: Record<string, unknown>;
  matchId?: string;
}

const STORAGE_KEY = "boscocup-offline-queue";

function readQueue(): QueuedOp[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeQueue(q: QueuedOp[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(q));
}

export function queueSize(): number {
  return readQueue().length;
}

export function isQueued(id: string): boolean {
  return readQueue().some((op) => op.id === id);
}

function isNetworkError(message: string): boolean {
  return /fetch|network|offline/i.test(message);
}

/** Inserta ahora; si falla por red, lo deja en cola para reintentar al reconectar. */
export async function insertWithFallback(
  table: string,
  payload: Record<string, unknown> & { id: string }
): Promise<{ queued: boolean; error?: string }> {
  if (!supabase) return { queued: false, error: "Supabase no está configurado." };

  if (!navigator.onLine) {
    const q = readQueue();
    q.push({ id: payload.id, op: "insert", table, payload });
    writeQueue(q);
    return { queued: true };
  }

  const { error } = await supabase.from(table).insert(payload);
  if (!error) return { queued: false };

  if (isNetworkError(error.message)) {
    const q = readQueue();
    q.push({ id: payload.id, op: "insert", table, payload });
    writeQueue(q);
    return { queued: true };
  }
  return { queued: false, error: error.message };
}

/** Cancela un insert que todavía está en la cola sin sincronizar (para "deshacer"). */
export function cancelQueuedInsert(id: string) {
  writeQueue(readQueue().filter((op) => op.id !== id));
}

/** Marca un evento ya sincronizado como anulado; si falla por red, lo encola. */
export async function updateWithFallback(
  table: string,
  matchId: string,
  payload: Record<string, unknown>
): Promise<{ queued: boolean; error?: string }> {
  if (!supabase) return { queued: false, error: "Supabase no está configurado." };

  if (!navigator.onLine) {
    const q = readQueue();
    q.push({ id: crypto.randomUUID(), op: "update", table, payload, matchId });
    writeQueue(q);
    return { queued: true };
  }

  const { error } = await supabase.from(table).update(payload).eq("id", matchId);
  if (!error) return { queued: false };

  if (isNetworkError(error.message)) {
    const q = readQueue();
    q.push({ id: crypto.randomUUID(), op: "update", table, payload, matchId });
    writeQueue(q);
    return { queued: true };
  }
  return { queued: false, error: error.message };
}

export async function flushQueue(): Promise<number> {
  if (!supabase || !navigator.onLine) return queueSize();

  const q = readQueue();
  for (const item of [...q]) {
    const result =
      item.op === "insert"
        ? await supabase.from(item.table).insert(item.payload)
        : await supabase.from(item.table).update(item.payload).eq("id", item.matchId as string);

    if (!result.error) {
      writeQueue(readQueue().filter((i) => i.id !== item.id));
    } else if (!isNetworkError(result.error.message)) {
      // error real (no de red): la sacamos de la cola para no reintentar algo que siempre va a fallar
      writeQueue(readQueue().filter((i) => i.id !== item.id));
    } else {
      break;
    }
  }
  return queueSize();
}
