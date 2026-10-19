import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/lib/auth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PublicHome } from "@/pages/PublicHome";
import { AdminLogin } from "@/pages/admin/AdminLogin";
import { AdminLayout } from "@/pages/admin/AdminLayout";
import { AdminDashboard } from "@/pages/admin/AdminDashboard";
import { AdminEquipos } from "@/pages/admin/AdminEquipos";
import { AdminJugadores } from "@/pages/admin/AdminJugadores";
import { AdminCanchas } from "@/pages/admin/AdminCanchas";
import { AdminPartidos } from "@/pages/admin/AdminPartidos";
import { AdminCruces } from "@/pages/admin/AdminCruces";
import { AdminVeedores } from "@/pages/admin/AdminVeedores";
import { VeedorLogin } from "@/pages/veedor/VeedorLogin";
import { VeedorHome } from "@/pages/veedor/VeedorHome";
import { PartidoRoute } from "@/pages/veedor/PartidoRoute";

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<PublicHome />} />

          <Route path="/admin/login" element={<AdminLogin />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute rol="admin" redirectTo="/admin/login">
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="equipos" element={<AdminEquipos />} />
            <Route path="jugadores" element={<AdminJugadores />} />
            <Route path="canchas" element={<AdminCanchas />} />
            <Route path="partidos" element={<AdminPartidos />} />
            <Route path="cruces" element={<AdminCruces />} />
            <Route path="veedores" element={<AdminVeedores />} />
          </Route>

          <Route path="/veedor/login" element={<VeedorLogin />} />
          <Route
            path="/veedor"
            element={
              <ProtectedRoute rol="veedor" redirectTo="/veedor/login">
                <VeedorHome />
              </ProtectedRoute>
            }
          />
          <Route
            path="/veedor/partido/:id"
            element={
              <ProtectedRoute rol="veedor" redirectTo="/veedor/login">
                <PartidoRoute />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
