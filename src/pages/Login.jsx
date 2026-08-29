import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, coficabIdToEmail } from "../lib/supabaseClient";

export default function Login() {
  const [coficabId, setCoficabId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: coficabIdToEmail(coficabId),
      password,
    });
    setSubmitting(false);
    if (signInError) {
      setError("Identifiant ou mot de passe incorrect.");
      return;
    }
    navigate("/dashboard");
  }

  return (
    <div className="min-h-screen bg-navy-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/logo_coficab.svg" alt="Logo" className="h-14 w-14 mx-auto mb-3" />
          <p className="text-navy-100 text-2xl font-semibold tracking-tight">CofiDash</p>
          <p className="text-navy-400 text-sm mt-1">Suivi Qualité — COFTN</p>
          <div className="navy-rule w-12 mx-auto mt-4" />
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-card p-6 space-y-4">
          <div>
            <label className="block text-sm text-navy-700 mb-1">ID COFICAB</label>
            <input
              type="text"
              required
              value={coficabId}
              onChange={(e) => setCoficabId(e.target.value)}
              placeholder="ex. C012345"
              className="w-full border border-navy-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-navy-500"
            />
          </div>
          <div>
            <label className="block text-sm text-navy-700 mb-1">Mot de passe</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-navy-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-navy-500"
            />
          </div>

          {error && <p className="text-sm text-alert-red">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-navy-500 hover:bg-navy-600 text-white font-medium rounded-md py-2 text-sm transition-colors disabled:opacity-60"
          >
            {submitting ? "Connexion…" : "Se connecter"}
          </button>
        </form>

        <p className="text-center text-navy-400 text-xs mt-4">
          Pas de compte ? Demande au super admin de t'en créer un.
        </p>
      </div>
    </div>
  );
}
