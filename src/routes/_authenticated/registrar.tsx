import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listCredentialQueue,
  reviewCredential,
  setCommission,
} from "@/lib/registrar.functions";
import { getCredentialFileLink } from "@/lib/credentials.functions";
import { CREDENTIAL_KIND_LABEL } from "@/lib/clearance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/registrar")({
  head: () => ({
    meta: [
      { title: "Registrar Review — Pulse IP" },
      {
        name: "description",
        content:
          "Verify filed notary credential copies and set commission records before registry access is granted.",
      },
      { property: "og:title", content: "Registrar Review — Pulse IP" },
      {
        property: "og:description",
        content: "Credential verification queue and commission records.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RegistrarReview,
});

function RegistrarReview() {
  const queryClient = useQueryClient();
  const fetchQueue = useServerFn(listCredentialQueue);
  const review = useServerFn(reviewCredential);
  const commission = useServerFn(setCommission);
  const openLink = useServerFn(getCredentialFileLink);

  const { data, isLoading, error } = useQuery({
    queryKey: ["credential-queue"],
    queryFn: () => fetchQueue(),
    retry: false,
  });

  const [notes, setNotes] = useState<Record<string, string>>({});

  const decide = useMutation({
    mutationFn: (v: { id: string; decision: "verified" | "rejected" }) =>
      review({ data: { id: v.id, decision: v.decision, note: notes[v.id] || null } }),
    onSuccess: () => {
      toast.success("Credential reviewed");
      queryClient.invalidateQueries({ queryKey: ["credential-queue"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const certify = useMutation({
    mutationFn: (v: {
      notaryUserId: string;
      isCertified: boolean;
      commissionState: string | null;
      commissionExpiresOn: string | null;
    }) => commission({ data: v }),
    onSuccess: () => {
      toast.success("Commission record updated");
      queryClient.invalidateQueries({ queryKey: ["credential-queue"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function view(id: string) {
    try {
      const res = await openLink({ data: { id } });
      window.open(res.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-20">
        <h1 className="text-3xl">Registrar authority required</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          This bench is reserved for registrars and administrators of the registry.
        </p>
      </main>
    );
  }

  const credentials = data?.credentials ?? [];
  const profiles = data?.profiles ?? [];
  const byNotary = profiles.map((p: any) => ({
    profile: p,
    items: credentials.filter((c: any) => c.user_id === p.id),
  }));

  return (
    <main className="mx-auto max-w-5xl px-5 py-12">
      <p className="eyebrow">Admission bench</p>
      <h1 className="mt-2 text-4xl">Registrar review</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Check every filed copy against the issuing authority before certifying a commission.
        Registry access only opens for a notary once the commission is certified and at least
        one unexpired credential copy is verified.
      </p>

      {isLoading ? (
        <p className="mt-10 text-sm text-muted-foreground">Loading the queue…</p>
      ) : byNotary.length === 0 ? (
        <p className="mt-10 text-sm text-muted-foreground">No credentials have been filed yet.</p>
      ) : (
        <div className="mt-10 space-y-6">
          {byNotary.map(({ profile, items }: any) => (
            <section key={profile.id} className="vault-panel p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xl">{profile.full_name || "Unnamed notary"}</p>
                  <p className="mt-1 font-mono text-xs text-primary">
                    {profile.notary_id_number}
                    {profile.commission_state ? ` · ${profile.commission_state}` : ""}
                  </p>
                </div>
                <Badge variant="outline" className={profile.is_certified ? "text-verdigris" : ""}>
                  {profile.is_certified ? "Certified" : "Not certified"}
                </Badge>
              </div>

              <ul className="mt-5 space-y-4">
                {items.map((c: any) => (
                  <li key={c.id} className="rounded-md border border-border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm">{CREDENTIAL_KIND_LABEL[c.kind] ?? c.kind}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {c.document_name} · {c.issuing_authority ?? "authority not stated"}
                          {c.credential_number ? ` · ${c.credential_number}` : ""}
                          {c.expires_on ? ` · expires ${c.expires_on}` : ""}
                        </p>
                        <p className="mt-2 break-all font-mono text-[10px] text-muted-foreground">
                          {c.file_hash}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <ExpiryBadge expiresOn={c.expires_on} />
                        <Badge variant="outline">{c.status}</Badge>
                      </div>

                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => view(c.id)}>
                        View copy
                      </Button>
                      <Input
                        value={notes[c.id] ?? ""}
                        onChange={(e) => setNotes({ ...notes, [c.id]: e.target.value })}
                        placeholder="Review note"
                        className="h-9 max-w-xs text-xs"
                        maxLength={600}
                      />
                      <Button
                        size="sm"
                        disabled={decide.isPending}
                        onClick={() => decide.mutate({ id: c.id, decision: "verified" })}
                      >
                        Verify
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={decide.isPending}
                        onClick={() => decide.mutate({ id: c.id, decision: "rejected" })}
                      >
                        Reject
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>

              <CommissionForm profile={profile} onSubmit={certify.mutate} pending={certify.isPending} />
            </section>
          ))}
        </div>
      )}
    </main>
  );
}

function CommissionForm({
  profile,
  onSubmit,
  pending,
}: {
  profile: any;
  onSubmit: (v: {
    notaryUserId: string;
    isCertified: boolean;
    commissionState: string | null;
    commissionExpiresOn: string | null;
  }) => void;
  pending: boolean;
}) {
  const [state, setState] = useState(profile.commission_state ?? "");
  const [expires, setExpires] = useState(profile.commission_expires_on ?? "");

  return (
    <form
      className="mt-5 flex flex-wrap items-end gap-3 border-t border-border pt-5"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          notaryUserId: profile.id,
          isCertified: true,
          commissionState: state.trim() || null,
          commissionExpiresOn: expires || null,
        });
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor={`state-${profile.id}`}>Commission state</Label>
        <Input
          id={`state-${profile.id}`}
          value={state}
          onChange={(e) => setState(e.target.value)}
          className="h-9 w-40 text-xs"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`exp-${profile.id}`}>Expires</Label>
        <Input
          id={`exp-${profile.id}`}
          type="date"
          value={expires}
          onChange={(e) => setExpires(e.target.value)}
          className="h-9 w-44 text-xs"
        />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        Certify commission
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() =>
          onSubmit({
            notaryUserId: profile.id,
            isCertified: false,
            commissionState: state.trim() || null,
            commissionExpiresOn: expires || null,
          })
        }
      >
        Revoke certification
      </Button>
    </form>
  );
}
