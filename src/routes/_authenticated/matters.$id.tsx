import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getNotarization, recordAttestation, runOverseerReview } from "@/lib/notary.functions";
import { PulseSeal } from "@/components/PulseSeal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/matters/$id")({
  head: () => ({
    meta: [
      { title: "Matter Ledger — Pulse Notary" },
      {
        name: "description",
        content:
          "Inspect the append-only custody chain for a notarial matter, record your attestation and convene the AI overseer.",
      },
      { property: "og:title", content: "Matter Ledger — Pulse Notary" },
      {
        property: "og:description",
        content: "Custody chain, panel attestations and Proof of Service issuance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MatterPage,
});

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="border-b border-border py-3 last:border-0">
      <p className="eyebrow">{label}</p>
      <p className={mono ? "mt-1 break-all font-mono text-xs" : "mt-1 text-sm"}>{value}</p>
    </div>
  );
}

function MatterPage() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const fetchMatter = useServerFn(getNotarization);
  const attest = useServerFn(recordAttestation);
  const overseer = useServerFn(runOverseerReview);
  const [note, setNote] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["matter", id],
    queryFn: () => fetchMatter({ data: { id } }),
  });

  const attestMutation = useMutation({
    mutationFn: (decision: "attested" | "declined") =>
      attest({ data: { notarizationId: id, decision, note: note.trim() || null } }),
    onSuccess: () => {
      toast.success("Attestation written to the chain");
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["matter", id] });
      queryClient.invalidateQueries({ queryKey: ["matters"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const overseerMutation = useMutation({
    mutationFn: () => overseer({ data: { notarizationId: id } }),
    onSuccess: (res) => {
      if (res.verdict === "issued") {
        toast.success("Proof of Service issued", { description: res.proofNumber });
      } else {
        toast.warning("Overseer withheld issuance", { description: res.summary });
      }
      queryClient.invalidateQueries({ queryKey: ["matter", id] });
      queryClient.invalidateQueries({ queryKey: ["matters"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !data) {
    return (
      <main className="mx-auto max-w-6xl px-5 py-16">
        <p className="text-sm text-muted-foreground">Opening the ledger…</p>
      </main>
    );
  }

  const { matter, signers, blocks, proof, profiles, linkage, me } = data;
  const mySeat = signers.find((s) => s.notary_user_id === me);
  const pending = signers.filter((s) => s.status === "pending").length;
  const attested = signers.filter((s) => s.status === "attested").length;
  const isFiler = matter.created_by === me;
  const nameFor = (userId: string) =>
    profiles.find((p) => p.id === userId)?.full_name ?? "Notary";

  return (
    <main className="mx-auto max-w-6xl px-5 py-12">
      <Link to="/dashboard" className="eyebrow hover:text-foreground">
        ← Registry
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl leading-tight">{matter.title}</h1>
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            {matter.verification_code} · {matter.document_name}
            {matter.matter_reference ? ` · ${matter.matter_reference}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={matter.status === "sealed" ? "default" : "secondary"}>
            {matter.status}
          </Badge>
          <Badge variant={linkage.intact ? "outline" : "destructive"}>
            {linkage.intact ? "Chain intact" : `Chain broken at #${linkage.brokenAt}`}
          </Badge>
        </div>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_320px] lg:items-start">
        <div className="space-y-8">
          {/* Panel */}
          <section className="vault-panel p-7">
            <h2 className="text-2xl">Panel of notaries</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {attested} of {matter.required_attestations} required attestations recorded ·{" "}
              {pending} outstanding
            </p>
            <ul className="mt-5 space-y-3">
              {signers.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border pb-3 last:border-0 last:pb-0"
                >
                  <span className="font-mono text-xs text-primary">{s.notary_id_number}</span>
                  <span className="text-sm">{nameFor(s.notary_user_id)}</span>
                  <Badge
                    className="ml-auto"
                    variant={
                      s.status === "attested"
                        ? "default"
                        : s.status === "declined"
                          ? "destructive"
                          : "outline"
                    }
                  >
                    {s.status}
                  </Badge>
                  {s.attestation_hash ? (
                    <span className="w-full break-all font-mono text-[10px] text-muted-foreground">
                      {s.attestation_hash}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          {/* Attest */}
          {mySeat && mySeat.status === "pending" && matter.status !== "sealed" ? (
            <section className="vault-panel p-7">
              <h2 className="text-2xl">Your attestation</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Signing binds your notary identifier to the document digest and appends an
                immutable block. It cannot be revised.
              </p>
              <Textarea
                className="mt-4"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional note of record — identification presented, capacity, observations."
              />
              <div className="mt-4 flex gap-2">
                <Button
                  onClick={() => attestMutation.mutate("attested")}
                  disabled={attestMutation.isPending}
                >
                  Attest and sign
                </Button>
                <Button
                  variant="outline"
                  onClick={() => attestMutation.mutate("declined")}
                  disabled={attestMutation.isPending}
                >
                  Decline
                </Button>
              </div>
            </section>
          ) : null}

          {/* Overseer */}
          <section className="vault-panel p-7">
            <h2 className="text-2xl">AI overseer</h2>
            {proof ? (
              <>
                <p className="mt-1 text-xs text-muted-foreground">
                  Issued {new Date(proof.issued_at).toLocaleString()}
                </p>
                <p className="mt-4 font-mono text-sm text-primary">{proof.proof_number}</p>
                <p className="mt-3 text-sm leading-relaxed">{proof.overseer_summary}</p>
                <dl className="mt-4">
                  <Field label="Merkle root" value={proof.merkle_root} mono />
                  <Field label="Seal transaction" value={proof.tx_hash} mono />
                </dl>
              </>
            ) : (
              <>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  The overseer reconciles commissions, certification, attestation quorum and
                  chain linkage. It convenes only once every panel notary has responded, and
                  only the filing notary may call it.
                </p>
                <Button
                  className="mt-5"
                  onClick={() => overseerMutation.mutate()}
                  disabled={!isFiler || pending > 0 || overseerMutation.isPending}
                >
                  {overseerMutation.isPending ? "Reviewing…" : "Convene the overseer"}
                </Button>
                {overseerMutation.data && overseerMutation.data.verdict !== "issued" ? (
                  <div className="mt-5 rounded-md border border-destructive/40 bg-destructive/5 p-4">
                    <p className="text-sm">{overseerMutation.data.summary}</p>
                    <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                      {overseerMutation.data.findings.map((f, i) => (
                        <li key={i}>
                          · [{f.severity}] {f.detail}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            )}
          </section>

          {/* Ledger */}
          <section className="vault-panel p-7">
            <h2 className="text-2xl">Custody chain</h2>
            <ol className="mt-5 space-y-4">
              {blocks.map((b) => (
                <li key={b.id} className="border-l-2 border-primary/40 pl-4">
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <span className="font-mono text-xs text-primary">
                      #{String(b.block_index).padStart(3, "0")}
                    </span>
                    <span className="text-sm">{b.event_type.replace(/_/g, " ")}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {b.actor_id_number}
                    </span>
                    <span className="ml-auto text-[11px] text-muted-foreground">
                      {new Date(b.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">
                    {b.block_hash}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* Sidebar */}
        <aside className="space-y-6">
          <div className="vault-panel flex flex-col items-center p-6">
            <PulseSeal
              hash={matter.document_hash}
              code={matter.verification_code}
              size={230}
              tone="foil"
            />
            <div className="mt-6 flex w-full flex-col gap-2">
              <Button asChild variant="outline">
                <Link to="/certificate/$id" params={{ id }}>
                  Print certificate
                </Link>
              </Button>
              {proof ? (
                <Button asChild>
                  <Link to="/proof/$id" params={{ id }}>
                    Print Proof of Service
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>

          <div className="vault-panel p-6">
            <dl>
              <Field label="Document digest" value={matter.document_hash} mono />
              <Field label="Registry" value={matter.chain_name ?? "PulseChain"} />
              <Field label="Contract" value={matter.contract_address ?? "pending"} mono />
              <Field label="Jurisdiction" value={matter.jurisdiction ?? "—"} />
              <Field label="Anchored" value={new Date(matter.created_at).toLocaleString()} />
            </dl>
          </div>
        </aside>
      </div>
    </main>
  );
}
