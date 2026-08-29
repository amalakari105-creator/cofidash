import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import Avatar from "../components/Avatar";

export default function Organigramme() {
  const [directeur, setDirecteur] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: dirData } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "super_admin")
        .limit(1)
        .maybeSingle();
      setDirecteur(dirData ?? null);

      const { data: deptData } = await supabase.from("departments").select("*").order("nom");
      setDepartments(deptData ?? []);

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .in("role", ["manager", "supervisor"]);
      setProfiles(profileData ?? []);

      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="p-8 text-navy-500">Chargement…</div>;

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-navy-900">Organigramme</h1>
        <p className="text-sm text-navy-500 mt-1">Site COFTN — Sidi Hassine</p>
      </div>

      <div className="flex flex-col items-center">
        <div className="bg-navy-900 text-white rounded-card px-6 py-4 flex items-center gap-3 shadow-sm">
          <Avatar name={directeur?.full_name} size={40} />
          <div>
            <p className="text-xs uppercase tracking-wide text-navy-300">Super admin — Directeur de site</p>
            <p className="font-medium">{directeur?.full_name ?? "À définir"}</p>
          </div>
        </div>
        <div className="w-px h-8 bg-navy-200" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
        {departments.map((dept) => {
          const manager = profiles.find((p) => p.role === "manager" && p.department_id === dept.id);
          const supervisors = profiles.filter(
            (p) => p.role === "supervisor" && p.department_id === dept.id
          );
          return (
            <div key={dept.id} className="flex flex-col items-center">
              <div className="w-px h-6 bg-navy-200" />
              <div className="bg-white border border-navy-100 rounded-card px-4 py-3 w-full text-center">
                <p className="text-xs uppercase tracking-wide text-navy-500">{dept.nom}</p>
                <div className="flex items-center justify-center gap-2 mt-2">
                  <Avatar name={manager?.full_name} size={28} />
                  <p className="font-medium text-navy-900 text-sm">{manager?.full_name ?? "À définir"}</p>
                </div>
              </div>
              <div className="w-px h-6 bg-navy-200" />

              <div className="w-full space-y-2">
                {supervisors.length === 0 && (
                  <p className="text-center text-xs text-navy-400 italic">Superviseur(s) à définir</p>
                )}
                {supervisors.map((s) => (
                  <div
                    key={s.id}
                    className="border border-navy-100 rounded-md px-3 py-2 flex items-center gap-2"
                  >
                    <Avatar name={s.full_name} size={24} />
                    <p className="text-sm text-navy-700">{s.full_name ?? s.coficab_id}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-navy-400 text-center">
        Cet organigramme se met à jour automatiquement : crée les comptes manquants depuis
        "Utilisateurs" pour qu'ils apparaissent ici.
      </p>
    </div>
  );
}
