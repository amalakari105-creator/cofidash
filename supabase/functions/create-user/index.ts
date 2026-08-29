// Edge Function : crée un compte (auth.users + profiles) à partir d'un ID COFICAB.
// Utilise la service role key côté serveur uniquement — jamais dans le front-end.
// Applique la hiérarchie à 3 niveaux :
//   - super_admin : peut créer manager ou superviseur, dans le département de son choix
//   - manager     : peut seulement créer un superviseur, dans SON PROPRE département
//   - superviseur : ne peut créer personne
// Ces règles sont réappliquées ici, côté serveur — jamais fait confiance à ce que le
// front-end envoie pour role/department_id au-delà de ce que l'appelant a le droit de faire.
// Déployer avec : supabase functions deploy create-user

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ---------- Qui appelle ? ----------
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace("Bearer ", "");
    const {
      data: { user: caller },
      error: callerError,
    } = await supabaseAdmin.auth.getUser(jwt);

    if (callerError || !caller) {
      return json({ error: "Authentification requise." }, 401);
    }

    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("role, department_id")
      .eq("id", caller.id)
      .single();

    if (!callerProfile) {
      return json({ error: "Profil appelant introuvable." }, 403);
    }

    // ---------- Que demande le front-end ? ----------
    const body = await req.json();
    const { coficab_id, full_name, password } = body;
    const requestedRole = body.role;
    const requestedDepartment = body.department_id;

    if (!coficab_id || !password) {
      return json({ error: "coficab_id et password sont requis" }, 400);
    }

    // ---------- Rôle/département réellement autorisés selon l'appelant ----------
    let finalRole: string;
    let finalDepartment: string | null;

    if (callerProfile.role === "super_admin") {
      finalRole = ["manager", "super_admin"].includes(requestedRole) ? requestedRole : "supervisor";
      finalDepartment = finalRole === "super_admin" ? null : requestedDepartment ?? null;
      if (finalRole !== "super_admin" && !finalDepartment) {
        return json({ error: "department_id est requis pour un manager ou un superviseur." }, 400);
      }
    } else if (callerProfile.role === "manager") {
      finalRole = "supervisor";
      finalDepartment = callerProfile.department_id;
    } else {
      return json({ error: "Tu n'as pas le droit de créer des utilisateurs." }, 403);
    }

    // ---------- Création ----------
    const email = `${coficab_id.trim().toLowerCase()}@cofidash.internal`;

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createError) return json({ error: createError.message }, 400);

    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      id: created.user.id,
      coficab_id,
      full_name: full_name || null,
      role: finalRole,
      department_id: finalDepartment,
    });
    if (profileError) return json({ error: profileError.message }, 400);

    return json({ success: true });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
