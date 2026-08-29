import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext";

const ROLE_LABELS = { super_admin: "Super admin", manager: "Manager", supervisor: "Superviseur" };

export default function Users() {
  const { profile } = useAuth();
  const isSuperAdmin = profile?.role === "super_admin";

  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState({
    coficab_id: "",
    full_name: "",
    password: "",
    role: "supervisor",
    department_id: "",
  });
  const [status, setStatus] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function loadUsers() {
    // Un manager ne voit (via RLS) que les superviseurs de son département ;
    // un super admin voit tout le monde.
    const { data } = await supabase.from("profiles").select("*, departments(nom)").order("full_name");
    setUsers(data ?? []);
  }

  async function loadDepartments() {
    const { data } = await supabase.from("departments").select("*").order("nom");
    setDepartments(data ?? []);
  }

  useEffect(() => {
    loadUsers();
    if (isSuperAdmin) loadDepartments();
  }, [isSuperAdmin]);

  async function handleCreate(e) {
    e.preventDefault();
    setSubmitting(true);
    setStatus(null);

    // Un manager crée toujours un superviseur dans son propre département —
    // l'Edge Function réapplique cette règle côté serveur de toute façon, ce
    // n'est pas une garantie côté client, juste l'UI qui reflète la règle.
    const payload = isSuperAdmin
      ? form
      : { coficab_id: form.coficab_id, full_name: form.full_name, password: form.password };

    const { error } = await supabase.functions.invoke("create-user", { body: payload });

setSubmitting(false);
if (error) {
  let message = error.message;
  try {
    const body = await error.context?.json();
    if (body?.error) message = body.error;
  } catch {
    // corps non-JSON ou déjà consommé : on garde le message générique
  }
  setStatus({ type: "error", message });
  return;
}
    setStatus({ type: "success", message: `Utilisateur ${form.coficab_id} créé.` });
    setForm({ coficab_id: "", full_name: "", password: "", role: "supervisor", department_id: "" });
    loadUsers();
  }

  return (
    <div className="p-8 space-y-6 max-w-3xl">
      <h1 className="text-xl font-semibold text-navy-900">Utilisateurs</h1>
      {!isSuperAdmin && (
        <p className="text-sm text-navy-500 -mt-4">
          Tu ajoutes des superviseurs dans ton propre département ({profile?.departments?.nom ?? profile?.department_id}).
        </p>
      )}

      <form onSubmit={handleCreate} className="bg-white rounded-card border border-navy-100 p-5 grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-navy-700 mb-1">ID COFICAB</label>
          <input
            required
            value={form.coficab_id}
            onChange={(e) => setForm({ ...form, coficab_id: e.target.value })}
            className="w-full border border-navy-100 rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm text-navy-700 mb-1">Nom complet</label>
          <input
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            className="w-full border border-navy-100 rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm text-navy-700 mb-1">Mot de passe temporaire</label>
          <input
            type="text"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="w-full border border-navy-100 rounded-md px-3 py-2 text-sm"
          />
        </div>

        {isSuperAdmin ? (
          <>
            <div>
              <label className="block text-sm text-navy-700 mb-1">Rôle</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full border border-navy-100 rounded-md px-3 py-2 text-sm"
              >
                <option value="supervisor">Superviseur</option>
                <option value="manager">Manager</option>
                <option value="super_admin">Super admin</option>
              </select>
            </div>
            {form.role !== "super_admin" && (
              <div>
                <label className="block text-sm text-navy-700 mb-1">Département</label>
                <select
                  required
                  value={form.department_id}
                  onChange={(e) => setForm({ ...form, department_id: e.target.value })}
                  className="w-full border border-navy-100 rounded-md px-3 py-2 text-sm"
                >
                  <option value="" disabled>
                    Choisir…
                  </option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nom}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </>
        ) : (
          <div className="col-span-2 text-sm text-navy-500 flex items-center">
            Rôle attribué automatiquement : <span className="mono-num ml-1">Superviseur</span>
          </div>
        )}

        {status && (
          <p className={`col-span-2 text-sm ${status.type === "error" ? "text-alert-red" : "text-alert-green"}`}>
            {status.message}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="col-span-2 bg-navy-500 hover:bg-navy-600 text-white font-medium rounded-md px-4 py-2 text-sm w-fit disabled:opacity-50"
        >
          {submitting ? "Création…" : "Créer l'utilisateur"}
        </button>
      </form>

      <div className="bg-white rounded-card border border-navy-100 p-5">
        <p className="text-sm font-medium text-navy-700 mb-3">Comptes existants</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-navy-500 text-xs">
              <th className="pb-2">ID COFICAB</th>
              <th className="pb-2">Nom</th>
              <th className="pb-2">Rôle</th>
              <th className="pb-2">Département</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-navy-100">
                <td className="py-2 mono-num text-xs">{u.coficab_id}</td>
                <td className="py-2">{u.full_name ?? "—"}</td>
                <td className="py-2">{ROLE_LABELS[u.role] ?? u.role}</td>
                <td className="py-2">{u.departments?.nom ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
