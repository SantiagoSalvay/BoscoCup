import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";

const NAV = [
  { to: "/admin", label: "Resumen", end: true },
  { to: "/admin/equipos", label: "Equipos" },
  { to: "/admin/jugadores", label: "Jugadores" },
  { to: "/admin/canchas", label: "Canchas" },
  { to: "/admin/partidos", label: "Partidos" },
  { to: "/admin/veedores", label: "Veedores" }
];

export function AdminLayout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  async function onSignOut() {
    await signOut();
    navigate("/admin/login");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="wordmark" style={{ padding: "4px 4px 18px" }}>
          <span className="ball" />
          Bosco<span className="cup">Cup</span>
        </div>
        <nav className="sidebar-nav">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? "navlink active" : "navlink")}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <span className="badge-role">Admin · {profile?.nombre}</span>
          <button className="btn btn-ghost" onClick={onSignOut}>
            Salir
          </button>
        </header>
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
