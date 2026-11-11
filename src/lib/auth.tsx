import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase, veedorEmailFromPin } from "@/lib/supabase";
import type { Profile } from "@/lib/db-types";
import { chequearBloqueo, registrarExito, registrarFallo } from "@/lib/login-guard";

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signInAdmin: (email: string, password: string) => Promise<void>;
  signInVeedor: (pin: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (!newSession) {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase || !session) return;
    setLoading(true);
    supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single()
      .then(({ data }) => {
        setProfile((data as Profile) ?? null);
        setLoading(false);
      });
  }, [session]);

  async function signInAdmin(email: string, password: string) {
    if (!supabase) throw new Error("Supabase no está configurado. Completá .env.local.");
    chequearBloqueo("admin");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) {
      registrarFallo("admin");
      // Mensaje genérico: no revelar si el email existe.
      throw new Error("Email o contraseña incorrectos.");
    }
    registrarExito("admin");
  }

  async function signInVeedor(pin: string) {
    if (!supabase) throw new Error("Supabase no está configurado. Completá .env.local.");
    if (!/^\d{6}$/.test(pin)) throw new Error("El PIN tiene 6 dígitos.");
    chequearBloqueo("veedor");
    const { error } = await supabase.auth.signInWithPassword({
      email: veedorEmailFromPin(pin),
      password: pin
    });
    if (error) {
      registrarFallo("veedor");
      throw new Error("PIN incorrecto o cuenta inactiva.");
    }
    registrarExito("veedor");
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, signInAdmin, signInVeedor, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
