import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/access";

type Profile = { id: string; full_name: string | null; email: string | null };

type AuthState = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  permissions: Set<string>;
  can: (perm: string) => boolean;
  hasRole: (role: AppRole) => boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [permissions, setPermissions] = useState<Set<string>>(new Set());

  const loadAccess = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null); setRoles([]); setPermissions(new Set());
      return;
    }
    const [{ data: prof }, { data: roleRows }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    const r = (roleRows ?? []).map((x) => x.role as AppRole);
    setProfile(prof ?? null);
    setRoles(r);
    if (r.length) {
      const { data: perms } = await supabase.from("role_permissions").select("permission_key").in("role", r);
      setPermissions(new Set((perms ?? []).map((p) => p.permission_key)));
    } else {
      setPermissions(new Set());
    }
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setTimeout(() => { void loadAccess(s?.user.id).finally(() => setLoading(false)); }, 0);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      void loadAccess(data.session?.user.id).finally(() => setLoading(false));
    });
    return () => sub.subscription.unsubscribe();
  }, [loadAccess]);

  const value: AuthState = {
    loading,
    session,
    user: session?.user ?? null,
    profile,
    roles,
    permissions,
    can: (p) => permissions.has(p),
    hasRole: (r) => roles.includes(r),
    refresh: () => loadAccess(session?.user.id),
    signOut: async () => { await supabase.auth.signOut(); },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
