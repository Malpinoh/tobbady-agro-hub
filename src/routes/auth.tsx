import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brand } from "@/components/app/Brand";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — TOBADDY AGRO LIVESTOCK" },
      { name: "description", content: "Staff sign in for the TOBADDY AGRO LIVESTOCK management system." },
      { property: "og:title", content: "Sign in — TOBADDY AGRO LIVESTOCK" },
      { property: "og:description", content: "Staff sign in for the management system." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetMessage, setResetMessage] = useState("");
  const [resetError, setResetError] = useState("");

  async function requestReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("recovery-email") ?? "").trim();
    setResetBusy(true); setResetMessage(""); setResetError("");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
      if (error) { setResetError("Unable to send a reset request right now. Please try again later."); return; }
      setResetMessage("If an account exists for this email, you’ll receive a password reset link. Check your inbox and spam folder.");
    } catch { setResetError("Unable to connect. Please try again."); }
    finally { setResetBusy(false); }
  }

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard", replace: true });
  }, [loading, user, navigate]);

  async function signIn(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(f.get("email")),
      password: String(f.get("password")),
    });
    setBusy(false);
    if (error) toast.error(error.message);
  }

  async function signUp(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: String(f.get("email")),
      password: String(f.get("password")),
      options: { emailRedirectTo: window.location.origin, data: { full_name: String(f.get("name")) } },
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Account created. Check your email to confirm. Your account will remain pending until the CEO or Administrator assigns a role.");
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) toast.error(r.error.message ?? "Google sign-in failed");
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <Brand />
        <div>
          <h2 className="text-3xl font-bold">Run the farm like a business.</h2>
          <p className="mt-3 max-w-md text-sidebar-muted">Livestock, finance, sales and staff — all in one secure place.</p>
        </div>
        <p className="text-xs text-sidebar-muted">Authorized staff only. All activity is logged.</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden"><Brand tone="dark" /></div>
          <h1 className="text-2xl font-bold">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in with your staff account.</p>
          <Tabs defaultValue="signin" className="mt-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>
            <TabsContent value="signin">
              <form onSubmit={signIn} className="mt-4 space-y-4">
                <Field name="email" label="Email" type="email" />
                <Field name="password" label="Password" type="password" />
                <Button className="w-full" disabled={busy}>Sign in</Button>
                <Button type="button" variant="link" className="w-full" onClick={() => { setResetMessage(""); setResetError(""); setForgotOpen(true); }}>Forgot password?</Button>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={signUp} className="mt-4 space-y-4">
                <Field name="name" label="Full name" />
                <Field name="email" label="Email" type="email" />
                <Field name="password" label="Password" type="password" minLength={8} />
                <Button className="w-full" disabled={busy}>Create account</Button>
                <p className="text-xs text-muted-foreground">New accounts receive no role or farm access until the CEO or Administrator reviews the request and assigns a role.</p>
              </form>
            </TabsContent>
          </Tabs>
          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
          </div>
          <Button variant="outline" className="w-full" onClick={google}>Continue with Google</Button>
          <Dialog open={forgotOpen} onOpenChange={(open) => { if (!resetBusy) setForgotOpen(open); }}>
            <DialogContent className="sm:max-w-sm"><DialogHeader><DialogTitle>Reset your password</DialogTitle><DialogDescription>Enter the email address for your staff account.</DialogDescription></DialogHeader>
              <form onSubmit={requestReset} className="space-y-4">
                <Label htmlFor="recovery-email">Email</Label><Input id="recovery-email" name="recovery-email" type="email" autoComplete="email" required disabled={resetBusy} />
                {resetMessage && <p role="status" className="text-sm text-success">{resetMessage}</p>}
                {resetError && <p role="alert" className="text-sm text-destructive">{resetError}</p>}
                <Button className="w-full" disabled={resetBusy}>{resetBusy ? "Sending…" : "Send reset link"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}

function Field({ name, label, type = "text", minLength }: { name: string; label: string; type?: string; minLength?: number }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} required minLength={minLength} />
    </div>
  );
}
