import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null); // { id, coficab_id, full_name, role }
  const [permissions, setPermissions] = useState({}); // { module_id: true/false }
  const [loading, setLoading] = useState(true);

  const loadProfileAndPermissions = useCallback(async (userId) => {
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("*, departments(nom)")
      .eq("id", userId)
      .single();
    setProfile(profileRow ?? null);

    const { data: permRows } = await supabase
      .from("user_permissions")
      .select("module_id, can_view")
      .eq("user_id", userId);

    const map = {};
    (permRows ?? []).forEach((p) => {
      map[p.module_id] = p.can_view;
    });
    // le super admin voit tout, même sans ligne explicite dans user_permissions
    if (profileRow?.role === "super_admin") {
      map.__all__ = true;
    }
    setPermissions(map);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) loadProfileAndPermissions(session.user.id);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        loadProfileAndPermissions(session.user.id);
      } else {
        setProfile(null);
        setPermissions({});
      }
    });

    return () => listener.subscription.unsubscribe();
  }, [loadProfileAndPermissions]);

  function can(moduleId) {
    return Boolean(permissions.__all__ || permissions[moduleId]);
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider
      value={{ session, profile, permissions, can, signOut, loading }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans <AuthProvider>");
  return ctx;
}
