import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquants — copie .env.example vers .env et renseigne ton projet Supabase."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// L'identifiant COFICAB n'est pas un email : Supabase Auth attend un email,
// on génère donc un email technique stable et invisible pour l'utilisateur.
export function coficabIdToEmail(coficabId) {
  return `${coficabId.trim().toLowerCase()}@cofidash.internal`;
}
