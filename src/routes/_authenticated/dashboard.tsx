import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  createNotarization,
  getMyProfile,
  listNotarizations,
} from "@/lib/notary.functions";
import { getMyClearance } from "@/lib/credentials.functions";
import { CLEARANCE_MESSAGE } from "@/lib/clearance";
import { hashFile } from "@/lib/hash";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Notary Registry — Pulse IP" },
      {
        name: "description",
        content:
          "File new matters, hash-anchor documents and track attestation progress across your notarial panel.",
      },
      { property: "og:title", content: "Notary Registry — Pulse IP" },
      {
        property: "og:description",
        content: "Your matters, panels and issued Proofs of Service.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const STATUS_LABEL: Record<string, string> = {
  collecting: "Collecting attestations",
  under_review: "Overseer review",
  sealed: "Sealed",
  rejected: "Declined",
};

function Dashboard() {
  const queryClient = useQueryClient();
  const fetchProfile = useServerFn(getMyProfile);
  const fetchList = useServerFn(listNotarizations);
  const createMatter = useServerFn(createNotarization);

  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile() });
  const fetchClearance = useServerFn(getMyClearance);
  const { data: clearance } = useQuery({
    queryKey: ["clearance"],
    queryFn: () => fetchClearance(),
  });
  const cleared = clearance?.cleared ?? false;
  const { data: list, isLoading } = useQuery({
    queryKey: ["matters"],
    queryFn: () => fetchList(),
  });

  const fileInput = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [reference, setReference] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");
  const [coSigners, setCoSigners] = useState("");
  const [required, setRequired] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [digest, setDigest] = useState<string | null>(null);
  const [hashing, setHashing] = useState(false);

  const create = useMutation({
    mutationFn: async () => {
      if (!file || !digest) throw new Error("Attach a document to anchor first.");
      return createMatter({
        data: {
          title: title.trim(),
          matterReference: reference.trim() || null,
          jurisdiction: jurisdiction.trim() || null,
          documentName: file.name,
          documentHash: digest,
          documentBytes: file.size,
          requiredAttestations: required,
          coSignerIdNumbers: coSigners
            .split(/[,\s]+/)
            .map((s) => s.trim())
            .filter(Boolean),
        },
      });
    },
    onSuccess: (res) => {
      toast.success("Matter anchored", { description: `Verification code ${res.verificationCode}` });
      setTitle("");
      setReference("");
      setJurisdiction("");
      setCoSigners("");
      setFile(null);
      setDigest(null);
      if (fileInput.current) fileInput.current.value = "";
      queryClient.invalidateQueries({ queryKey: ["matters"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function onFile(selected: File | null) {
    setFile(selected);
    setDigest(null);
    if (!selected) return;
    setHashing(true);
    try {
      setDigest(await hashFile(selected));
    } catch {
      toast.error("Could not read that file.");
    } finally {
      setHashing(false);
    }
  }

  const matters = list?.matters ?? [];
  const signers = list?.signers ?? [];
  const proofs = list?.proofs ?? [];

  return (
    <main className="mx-auto max-w-6xl px-5 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Notary of record</p>
          <h1 className="mt-2 text-4xl">{profile?.full_name ?? "Your registry"}</h1>
          <p className="mt-2 font-mono text-xs text-primary">
            {profile?.notary_id_number ?? "—"}
            {profile?.commission_state ? ` · ${profile.commission_state}` : ""}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-sm">
            Registry access ·{" "}
            <span className={cleared ? "text-verdigris" : "text-muted-foreground"}>
              {cleared ? "Cleared" : "Withheld"}
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            Certified commission ·{" "}
            {profile?.is_certified ? "On record" : "Not on record"} · Verified credential
            copies: {clearance?.verifiedCredentials ?? 0}
          </p>
        </div>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[380px_1fr] lg:items-start">
        {/* File a matter */}
        <section className="vault-panel p-7">
          <h2 className="text-2xl">File a matter</h2>
          {!cleared ? (
            <div className="mt-4 rounded-md border border-border bg-muted/30 p-4">
              <p className="text-sm">Filing is withheld until your credentials are verified.</p>
              <ul className="mt-2 space-y-1">
                {(clearance?.reasons ?? []).map((r) => (
                  <li key={r} className="text-[11px] text-muted-foreground">
                    — {CLEARANCE_MESSAGE[r]}
                  </li>
                ))}
              </ul>
              <Link
                to="/credentials"
                className="mt-3 inline-block text-xs text-primary underline underline-offset-4"
              >
                Open the credential vault
              </Link>
            </div>
          ) : null}
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            The document is hashed in your browser. Only the digest is anchored — the file
            itself never leaves this machine.
          </p>

          <fieldset disabled={!cleared} className={cleared ? "" : "opacity-50"}>
          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="title">Matter title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Deed of assignment — Halloran"
                required
                minLength={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ref">Reference</Label>
                <Input
                  id="ref"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="2026-0147"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="jur">Jurisdiction</Label>
                <Input
                  id="jur"
                  value={jurisdiction}
                  onChange={(e) => setJurisdiction(e.target.value)}
                  placeholder="New York"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="doc">Document</Label>
              <Input
                id="doc"
                type="file"
                ref={fileInput}
                onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                required
              />
              {hashing ? (
                <p className="font-mono text-[11px] text-muted-foreground">Hashing…</p>
              ) : null}
              {digest ? (
                <p className="break-all font-mono text-[11px] text-verdigris">{digest}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="panel">Co-signing notary IDs</Label>
              <Input
                id="panel"
                value={coSigners}
                onChange={(e) => setCoSigners(e.target.value.toUpperCase())}
                placeholder="PN-26-04A1B2, PN-26-77C3D9"
                className="font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Comma separated. You are always on the panel.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="req">Attestations required</Label>
              <Input
                id="req"
                type="number"
                min={1}
                max={12}
                value={required}
                onChange={(e) => setRequired(Number(e.target.value))}
              />
            </div>

            <Button type="submit" className="w-full" disabled={create.isPending || hashing}>
              {create.isPending ? "Anchoring…" : "Anchor to registry"}
            </Button>
          </form>
        </section>

        {/* Matters */}
        <section>
          <h2 className="text-2xl">Matters</h2>
          {isLoading ? (
            <p className="mt-4 text-sm text-muted-foreground">Loading the registry…</p>
          ) : matters.length === 0 ? (
            <div className="vault-panel mt-4 p-10 text-center">
              <p className="text-sm text-muted-foreground">
                Nothing anchored yet. File your first matter to open a chain of custody.
              </p>
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {matters.map((matter) => {
                const panel = signers.filter((s) => s.notarization_id === matter.id);
                const attested = panel.filter((s) => s.status === "attested").length;
                const proof = proofs.find((p) => p.notarization_id === matter.id);
                const mine = panel.find(
                  (s) => s.notary_user_id === list?.me && s.status === "pending",
                );
                return (
                  <li key={matter.id}>
                    <Link
                      to="/matters/$id"
                      params={{ id: matter.id }}
                      className="vault-panel block p-6 transition-colors hover:border-primary/50"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-xl leading-tight">{matter.title}</h3>
                          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                            {matter.verification_code} · {matter.document_name}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {mine ? <Badge variant="outline">Awaiting you</Badge> : null}
                          <Badge variant={matter.status === "sealed" ? "default" : "secondary"}>
                            {STATUS_LABEL[matter.status] ?? matter.status}
                          </Badge>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-muted-foreground">
                        <span>
                          {attested} / {matter.required_attestations} attestations
                        </span>
                        <span>{new Date(matter.created_at).toLocaleDateString()}</span>
                        {proof ? (
                          <span className="font-mono text-primary">{proof.proof_number}</span>
                        ) : null}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
