import { useEffect, useState, type FormEvent } from "react";
import { createProvisioningClient, supabase, veedorEmailFromPin } from "@/lib/supabase";
import type { Profile } from "@/lib/db-types";

export function AdminVeedores() {
  const [veedores, setVeedores] = useState<Profile[]>([]);
  const [nombre, setNombre] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    if (!supabase) return;
    const { data } = await supabase.from("profiles").select("*").eq("rol", "veedor").order("nombre");
    setVeedores((data as Profile[]) ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!supabase) return setError("Supabase no está configurado.");
    if (pin.length !== 6) return setError("El PIN debe tener 6 dígitos.");
    setSubmitting(true);
    try {
      const provisioning = createProvisioningClient();
      const { data, error: signUpError } = await provisioning.auth.signUp({
        email: veedorEmailFromPin(pin),
        password: pin
      });
      if (signUpError) throw signUpError;
      if (!data.user) throw new Error("No se pudo crear la cuenta.");

      const { error: profileError } = await supabase
        .from("profiles")
        .insert({ id: data.user.id, nombre, rol: "veedor", activo: true });
      if (profileError) throw profileError;

      setSuccess(`Veedor creado. Anotá el PIN ${pin} para dárselo — no se puede volver a ver.`);
      setNombre("");
      setPin("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el veedor.");
    } finally {
      setSubmitting(false);
    }
  }

  async function onToggleActivo(v: Profile) {
    if (!supabase) return;
    await supabase.from("profiles").update({ activo: !v.activo }).eq("id", v.id);
    load();
  }

  return (
    <div>
      <h2 className="page-title">Veedores</h2>
      <p className="form-hint">
        Cada veedor entra con un PIN de 6 dígitos, sin email ni contraseña que recordar. El PIN solo se
        muestra una vez al crearlo — anotalo antes de cerrar.
      </p>

      <form className="panel form-row" onSubmit={onSubmit}>
        <label className="field">
          <span>Nombre</span>
          <input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        </label>
        <label className="field" style={{ maxWidth: 140 }}>
          <span>PIN (6 dígitos)</span>
          <input
            className="input pin-input"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            required
          />
        </label>
        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? "Creando…" : "Crear veedor"}
        </button>
      </form>
      {error && <p className="form-error">{error}</p>}
      {success && <p className="form-success">{success}</p>}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {veedores.map((v) => (
              <tr key={v.id}>
                <td>{v.nombre}</td>
                <td>
                  <button className="btn btn-ghost btn-sm" onClick={() => onToggleActivo(v)}>
                    {v.activo ? "Activo" : "Desactivado"}
                  </button>
                </td>
              </tr>
            ))}
            {veedores.length === 0 && (
              <tr>
                <td colSpan={2} className="empty-row">
                  Todavía no hay veedores cargados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
