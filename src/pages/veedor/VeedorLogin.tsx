import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase";

export function VeedorLogin() {
  const { session, profile, signInVeedor } = useAuth();
  const navigate = useNavigate();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (session && profile?.rol === "veedor") return <Navigate to="/veedor" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signInVeedor(pin);
      navigate("/veedor");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="login-card" onSubmit={onSubmit}>
        <div className="wordmark" style={{ marginBottom: 18 }}>
          <span className="ball" />
          Bosco<span className="cup">Cup</span>
        </div>
        <h1 className="login-title">Soy veedor</h1>
        <p className="form-hint">Ingresá el PIN de 6 dígitos que te dio el organizador.</p>

        {!isSupabaseConfigured && (
          <p className="form-hint form-hint-warn">
            Supabase no está configurado todavía (faltan las variables en .env.local).
          </p>
        )}

        <label className="field">
          <span>PIN</span>
          <input
            className="input pin-input"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            required
            autoFocus
          />
        </label>

        {error && <p className="form-error">{error}</p>}

        <button className="btn btn-primary" type="submit" disabled={submitting || pin.length < 6}>
          {submitting ? "Ingresando…" : "Ingresar"}
        </button>
      </form>
    </div>
  );
}
