import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const MODULES = [
  { id: "dashboard_qualite", label: "Dashboard qualité" },
  { id: "dashboard_production", label: "Dashboard production" },
  { id: "import", label: "Import Excel" },
];

export default function Permissions() {
  const [users, setUsers] = useState([]);
  const [permMap, setPermMap] = useState({}); // { userId: { moduleId: bool } }
  const [saving, setSaving] = useState(null); // clé "userId:moduleId" en cours de sauvegarde

  useEffect(() => {
    async function load() {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("*, departments(nom)")
        .neq("role", "super_admin")
        .order("full_name");
      setUsers(profiles ?? []);

      const { data: perms } = await supabase.from("user_permissions").select("*");
      const map = {};
      (perms ?? []).forEach((p) => {
        map[p.user_id] = map[p.user_id] || {};
        map[p.user_id][p.module_id] = p.can_view;
      });
      setPermMap(map);
    }
    load();
  }, []);

  async function toggle(userId, moduleId) {
    const current = Boolean(permMap[userId]?.[moduleId]);
    const key = `${userId}:${moduleId}`;
    setSaving(key);

    await supabase
      .from("user_permissions")
      .upsert(
        { user_id: userId, module_id: moduleId, can_view: !current },
        { onConflict: "user_id,module_id" }
      );

    setPermMap((prev) => ({
      ...prev,
      [userId]: { ...prev[userId], [moduleId]: !current },
    }));
    setSaving(null);
  }

  return (
    <div className="p-8 space-y-4 max-w-3xl">
      <h1 className="text-xl font-semibold text-navy-900">Permissions d'affichage</h1>
      <p className="text-sm text-navy-500">
        Coche les modules que chaque utilisateur peut voir dans son menu.
      </p>

      <div className="bg-white rounded-card border border-navy-100 p-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-navy-500 text-xs">
              <th className="pb-2 pr-4">Utilisateur</th>
              {MODULES.map((m) => (
                <th key={m.id} className="pb-2 px-3 text-center">
                  {m.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-navy-100">
                <td className="py-2 pr-4">
                  <p className="text-navy-800">{u.full_name ?? u.coficab_id}</p>
                  <p className="text-xs text-navy-400 mono-num">
                    {u.coficab_id} · {u.role === "manager" ? "Manager" : "Superviseur"}
                    {u.departments?.nom ? ` · ${u.departments.nom}` : ""}
                  </p>
                </td>
                {MODULES.map((m) => {
                  const key = `${u.id}:${m.id}`;
                  const checked = Boolean(permMap[u.id]?.[m.id]);
                  return (
                    <td key={m.id} className="text-center px-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={saving === key}
                        onChange={() => toggle(u.id, m.id)}
                        className="accent-navy-500 w-4 h-4"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
