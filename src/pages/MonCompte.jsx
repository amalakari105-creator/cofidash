import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import Avatar from "../components/Avatar";

const ROLE_LABELS = { super_admin: "Super admin", manager: "Manager", supervisor: "Superviseur" };

export default function MonCompte() {
  const { profile } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [status, setStatus] = useState(null);

  async function handlePasswordChange(e) {
    e.preventDefault();
    setStatus(null);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setStatus({ type: "error", message: error.message });
    } else {
      setStatus({ type: "success", message: "Mot de passe mis à jour." });
      setNewPassword("");
    }
  }

  return (
    <div className="p-8 max-w-lg space-y-6">
      <h1 className="text-xl font-semibold text-navy-900">Mon compte</h1>

      <div className="bg-white rounded-card border border-navy-100 p-5">
        <p className="text-sm font-medium text-navy-700 mb-4">Mon profil</p>
        <div className="flex items-center gap-4">
          <Avatar name={profile?.full_name ?? profile?.coficab_id} size={56} />
          <div>
            <p className="font-medium text-navy-900">{profile?.full_name ?? "—"}</p>
            <p className="text-xs text-navy-400 mono-num mt-0.5">{profile?.coficab_id}</p>
            <p className="text-xs text-navy-500 mt-1">{ROLE_LABELS[profile?.role] ?? profile?.role}</p>
          </div>
        </div>
        <p className="text-xs text-navy-400 mt-4">
          Photo de profil : pas encore disponible — reviendra avec l'ajout d'un stockage de fichiers.
        </p>
      </div>

      <div className="bg-white rounded-card border border-navy-100 p-5">
        <p className="text-sm font-medium text-navy-700 mb-4">Paramètres de sécurité</p>
        <form onSubmit={handlePasswordChange} className="space-y-3">
          <div>
            <label className="block text-sm text-navy-700 mb-1">Nouveau mot de passe</label>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Nouveau mot de passe"
              className="w-full border border-navy-100 rounded-md px-3 py-2 text-sm"
            />
          </div>
          {status && (
            <p className={`text-sm ${status.type === "error" ? "text-alert-red" : "text-alert-green"}`}>
              {status.message}
            </p>
          )}
          <button
            type="submit"
            className="bg-navy-500 hover:bg-navy-600 text-white font-medium rounded-md px-4 py-2 text-sm"
          >
            Mettre à jour le mot de passe
          </button>
        </form>
      </div>
    </div>
  );
}
