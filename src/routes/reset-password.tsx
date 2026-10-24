import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Brand } from "@/components/app/Brand";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reset password — TOBADDY AGRO LIVESTOCK" },
      { name: "description", content: "Set a new password for your TOBADDY AGRO LIVESTOCK staff account." },
      { property: "og:title", content: "Reset password — TOBADDY AGRO LIVESTOCK" },
      { property: "og:description", content: "Set a new password for your staff account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const recoveryConfirmed = useRef(false);

  useEffect(() => {
    const isRecovery = new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery";
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") { recoveryConfirmed.current = true; setReady(true); setChecked(true); }
    });
    const t = setTimeout(async () => {
      const { data, error: authError } = await supabase.auth.getUser();
      if (!authError && data.user && (isRecovery || recoveryConfirmed.current)) setReady(true);
      setChecked(true);
    }, 600);
    return () => { clearTimeout(t); sub.subscription.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!ready || busy) return;
    const f = new FormData(e.currentTarget);
    const password = String(f.get("password"));
    const confirm = String(f.get("confirm"));
    setError("");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords do not match.");
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) { setError(err.message); return; }
      toast.success("Password updated. You're now signed in.");
      navigate({ to: "/dashboard", replace: true });
    } catch { setError("Unable to update your password. Please try again."); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8"><Brand tone="dark" /></div>
        <h1 className="text-2xl font-bold">Set a new password</h1>
        {!checked ? (
          <p className="mt-4 text-sm text-muted-foreground">Checking your reset link…</p>
        ) : !ready ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">This reset link is invalid or has expired. Please request a new one from the sign-in page.</p>
            <Button className="w-full" onClick={() => navigate({ to: "/auth" })}>Back to sign in</Button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="space-y-1.5"><Label htmlFor="password">New password</Label><Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" /></div>
            <div className="space-y-1.5"><Label htmlFor="confirm">Confirm new password</Label><Input id="confirm" name="confirm" type="password" required minLength={8} autoComplete="new-password" /></div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button className="w-full" disabled={busy}>{busy ? "Saving…" : "Update password"}</Button>
          </form>
        )}
      </div>
    </div>
  );
}
