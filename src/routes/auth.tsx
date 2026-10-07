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

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — TOBADDY AGRO LIVESTOCK" },
      { name: "description", content: "Staff sign in for the TOBADDY AGRO LIVESTOCK management system." },
      { property: "og:title", content: "Sign in — TOBADDY AGRO LIVESTOCK" },
      { property: "og:description", content: "Staff sign in for the management system." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

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
    else toast.success("Account created. Check your email to confirm, then sign in.");
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
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={signUp} className="mt-4 space-y-4">
                <Field name="name" label="Full name" />
                <Field name="email" label="Email" type="email" />
                <Field name="password" label="Password" type="password" minLength={8} />
                <Button className="w-full" disabled={busy}>Create account</Button>
                <p className="text-xs text-muted-foreground">New accounts get basic access. An administrator assigns your role.</p>
              </form>
            </TabsContent>
          </Tabs>
          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
          </div>
          <Button variant="outline" className="w-full" onClick={google}>Continue with Google</Button>
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
