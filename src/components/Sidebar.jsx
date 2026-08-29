import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard qualité", module: "dashboard_qualite" },
  { to: "/dashboard-production", label: "Dashboard production", module: "dashboard_production" },
  { to: "/import", label: "Import Excel", module: "import" },
  { to: "/organigramme", label: "Organigramme", module: null },
];

const navLinkClass = ({ isActive }) =>
  `block px-3 py-2 rounded-md text-sm transition-colors ${
    isActive ? "bg-navy-500 text-white font-medium" : "text-navy-100 hover:bg-navy-800"
  }`;

export default function Sidebar() {
  const { profile, can } = useAuth();

  return (
    <aside className="w-60 shrink-0 bg-navy-900 text-navy-100 min-h-screen flex flex-col">
      <div className="px-5 py-6 flex flex-col items-center text-center gap-2">
        <img src="/logo_coficab.svg" alt="Logo COFICAB" className="h-14 w-auto max-w-full" />
        <div>
          <p className="font-semibold text-lg tracking-tight leading-none">CofiDash</p>
          <div className="navy-rule w-12 mx-auto my-2" />
          <p className="text-xs text-navy-300">Suivi Qualité — COFTN</p>
        </div>
      </div>

      <nav className="flex-1 px-3 pt-2 space-y-1">
        {NAV_ITEMS.filter((item) => !item.module || can(item.module)).map((item) => (
          <NavLink key={item.to} to={item.to} className={navLinkClass}>
            {item.label}
          </NavLink>
        ))}

        {profile?.role === "super_admin" && (
          <>
            <p className="px-3 pt-5 pb-1 text-xs uppercase tracking-wide text-navy-300">
              Super admin
            </p>
            <NavLink to="/admin/utilisateurs" className={navLinkClass}>
              Utilisateurs
            </NavLink>
            <NavLink to="/admin/permissions" className={navLinkClass}>
              Permissions
            </NavLink>
          </>
        )}

        {profile?.role === "manager" && (
          <>
            <p className="px-3 pt-5 pb-1 text-xs uppercase tracking-wide text-navy-300">
              Mon équipe
            </p>
            <NavLink to="/admin/utilisateurs" className={navLinkClass}>
              Utilisateurs
            </NavLink>
          </>
        )}
      </nav>
    </aside>
  );
}