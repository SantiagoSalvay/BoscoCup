import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string)
  : null;

/**
 * Cliente aparte, que no persiste sesión, para que el admin pueda dar de alta
 * una cuenta de veedor (supabase.auth.signUp) sin reemplazar su propia sesión
 * activa. No usa ninguna clave privilegiada: es el mismo anon key.
 */
export function createProvisioningClient(): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error("Supabase no está configurado");
  }
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, storageKey: "boscocup-provisioning" }
  });
}

export function veedorEmailFromPin(pin: string): string {
  return `veedor-${pin}@boscocup.local`;
}
