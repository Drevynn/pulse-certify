import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PulseGlyph } from "@/components/AppShell";
import { PulseSeal } from "@/components/PulseSeal";

export const Route = createFileRoute("/auth")({
  validateSearch: z.object({ redirect: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Notary Sign In — Pulse IP Registry" },
      {
        name: "description",
        content:
          "Sign in or enrol as a certified notary to anchor documents, attest matters and issue AI-overseen Proof of Service.",
      },
      { property: "og:title", content: "Notary Sign In — Pulse IP Registry" },
      {
        property: "og:description",
        content: "Credentialed access to the Pulse IP zero-trust registry.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function safePath(value?: string): string {
  if (!value) return "/dashboard";
  if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const target = safePath(search.redirect);

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [commissionState, setCommissionState] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: target, replace: true });
    });
  }, [navigate, target]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}${target}`,
            data: { full_name: fullName, commission_state: commissionState },
          },
        });
        if (error) throw error;
        toast.success("Enrolment submitted", {
          description: "Check your inbox to confirm, then complete your commission record.",
        });
        const { data } = await supabase.auth.getSession();
        if (data.session) navigate({ to: target, replace: true });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: target, replace: true });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      toast.error("Google sign-in failed");
      return;
    }
    if (result.redirected) return;
    navigate({ to: target, replace: true });
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <section className="engraved-grid relative hidden flex-col justify-between overflow-hidden border-r border-border bg-vault p-12 lg:flex">
        <Link to="/" className="flex items-center gap-2.5">
          <PulseGlyph />
          <span className="font-display text-lg">
            Pulse<span className="text-primary">IP</span>
          </span>
        </Link>
        <div className="relative flex flex-col items-center">
          <PulseSeal
            hash="7f3c9a1e4b8d20556ce1a97f04b3d8e2417c6a90fd5b3821e7c40a96b5d1f382"
            legend="PULSE IP REGISTRY"
            code="SPECIMEN"
            size={330}
            animated
          />
          <p className="mt-8 max-w-sm text-center text-sm leading-relaxed text-muted-foreground">
            Every mark is lathed from the document&rsquo;s own digest. No two seals share
            geometry, and none survives being copied off another instrument.
          </p>
        </div>
        <p className="eyebrow">Zero-trust · Multi-notary · AI overseen</p>
      </section>

      <section className="flex items-center justify-center px-5 py-16">
        <div className="w-full max-w-sm animate-[var(--animate-rise)]">
          <p className="eyebrow">Credentialed access</p>
          <h1 className="mt-3 text-4xl">
            {mode === "signin" ? "Enter the registry" : "Enrol as a notary"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Restricted to commissioned notaries. Every session is bound to your notary
            identifier and written into the ledger.
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            {mode === "signup" ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="fullName">Full legal name</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Adaeze N. Whitfield"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="state">Commissioning jurisdiction</Label>
                  <Input
                    id="state"
                    value={commissionState}
                    onChange={(e) => setCommissionState(e.target.value)}
                    placeholder="New York"
                  />
                </div>
              </>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={busy}>
              {mode === "signin" ? "Sign in" : "Create notary account"}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="eyebrow">or</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button variant="outline" className="w-full" onClick={google} disabled={busy}>
            Continue with Google
          </Button>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signin" ? "No registry account?" : "Already commissioned?"}{" "}
            <button
              type="button"
              className="text-primary underline-offset-4 hover:underline"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin" ? "Enrol" : "Sign in"}
            </button>
          </p>
        </div>
      </section>
    </main>
  );
}
