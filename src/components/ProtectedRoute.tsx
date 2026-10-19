import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import type { Rol } from "@/lib/db-types";

export function ProtectedRoute({ rol, redirectTo, children }: { rol: Rol; redirectTo: string; children: JSX.Element }) {
  const { session, profile, loading } = useAuth();

  if (loading) return <div className="auth-loading">Cargando…</div>;
  if (!session || !profile || profile.rol !== rol || !profile.activo) {
    return <Navigate to={redirectTo} replace />;
  }
  return children;
}
