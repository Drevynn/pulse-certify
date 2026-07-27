import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getNotarization } from "@/lib/notary.functions";
import { PulseSeal } from "@/components/PulseSeal";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/proof/$id")({
  head: () => ({
    meta: [
      { title: "Proof of Service — Pulse Notary" },
      {
        name: "description",
        content:
          "Printable Proof of Service labelled with the issuing notary's ID number, minted after the AI overseer reconciles the full custody chain.",
      },
      { property: "og:title", content: "Proof of Service — Pulse Notary" },
      {
        property: "og:description",
        content: "AI-overseen proof of notarial service with Merkle root and seal transaction.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProofPage,
});

interface Finding {
  severity?: string;
  code?: string;
  detail?: string;
}

function Line({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="doc-line">
      <span className="doc-label">{label}</span>
      <span className={mono ? "doc-value font-mono" : "doc-value"}>{value}</span>
    </div>
  );
}

function ProofPage() {
  const { id } = Route.useParams();
  const fetchMatter = useServerFn(getNotarization);
  const { data } = useQuery({
    queryKey: ["matter", id],
    queryFn: () => fetchMatter({ data: { id } }),
  });

  if (!data) {
    return (
      <main className="mx-auto max-w-4xl px-5 py-16">
        <p className="text-sm text-muted-foreground">Preparing the instrument…</p>
      </main>
    );
  }

  const { matter, signers, profiles, proof, blocks } = data;

  if (!proof) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-20 text-center">
        <h1 className="text-3xl">No Proof of Service yet</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          The overseer has not issued under this matter. Collect every panel attestation, then
          convene the overseer from the matter page.
        </p>
        <Button asChild className="mt-6">
          <Link to="/matters/$id" params={{ id }}>
            Back to matter
          </Link>
        </Button>
      </main>
    );
  }

  const findings = (proof.overseer_findings ?? []) as unknown as Finding[];
  const attesting = signers.filter((s) => s.status === "attested");
  const nameFor = (userId: string) =>
    profiles.find((p) => p.id === userId)?.full_name ?? "Notary of record";

  return (
    <main className="print-stage">
      <div className="no-print mx-auto flex max-w-[820px] items-center gap-3 px-5 pt-8">
        <Link to="/matters/$id" params={{ id }} className="eyebrow hover:text-foreground">
          ← Matter
        </Link>
        <Button className="ml-auto" onClick={() => window.print()}>
          Print Proof of Service
        </Button>
      </div>

      <article className="doc-sheet">
        <header className="doc-head">
          <div>
            <p className="doc-eyebrow">Pulse Notary Registry · AI Overseer</p>
            <h1 className="doc-title">Proof of Service</h1>
            <p className="doc-sub">
              Minted upon reconciliation of the complete custody chain. This proof is labelled
              with the identification number of the issuing notary of record.
            </p>
          </div>
          <div className="doc-code">
            <span className="doc-label">Proof number</span>
            <span className="font-mono text-sm tracking-[0.14em]">{proof.proof_number}</span>
            <span className="doc-label" style={{ marginTop: "0.5rem" }}>
              Issuing notary ID
            </span>
            <span className="font-mono text-lg tracking-[0.16em]">
              {proof.issuing_notary_id_number}
            </span>
          </div>
        </header>

        <section className="doc-section">
          <h2 className="doc-h2">I. Service rendered</h2>
          <Line label="Matter" value={matter.title} />
          <Line label="Instrument" value={matter.document_name} />
          <Line label="Document digest" value={matter.document_hash} mono />
          <Line
            label="Attestations"
            value={`${attesting.length} recorded of ${matter.required_attestations} required`}
          />
          <Line
            label="Issued"
            value={new Date(proof.issued_at).toLocaleString(undefined, {
              dateStyle: "long",
              timeStyle: "short",
            })}
          />
        </section>

        <section className="doc-section">
          <h2 className="doc-h2">II. Overseer determination</h2>
          <Line label="Verdict" value={proof.overseer_verdict.toUpperCase()} />
          <p className="doc-body">{proof.overseer_summary}</p>
          {findings.length ? (
            <ul className="doc-findings">
              {findings.map((f, i) => (
                <li key={i}>
                  <span className="font-mono">[{f.severity ?? "note"}]</span>{" "}
                  {f.detail ?? f.code}
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className="doc-section">
          <h2 className="doc-h2">III. Chain reconciliation</h2>
          <Line label="Merkle root" value={proof.merkle_root} mono />
          <Line label="Seal transaction" value={proof.tx_hash} mono />
          <Line label="Contract" value={matter.contract_address ?? "—"} mono />
          <Line label="Blocks in chain" value={String(blocks.length)} />
          <table className="doc-table">
            <thead>
              <tr>
                <th>Notary</th>
                <th>Identifier</th>
                <th>Attestation hash</th>
              </tr>
            </thead>
            <tbody>
              {attesting.map((s) => (
                <tr key={s.id}>
                  <td>{nameFor(s.notary_user_id)}</td>
                  <td className="font-mono">{s.notary_id_number}</td>
                  <td className="font-mono doc-hash">{s.attestation_hash?.slice(0, 32)}…</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <footer className="doc-foot">
          <div className="doc-foot-text">
            <p className="doc-label">Authority of issue</p>
            <p>
              This proof was issued by the registry overseer only after every panel notary
              responded, commissions were reconciled and the custody chain was found intact.
              It is void if the document digest above does not reproduce from the served
              instrument.
            </p>
            <p className="doc-fine">
              Verify at /verify with code{" "}
              <span className="font-mono">{matter.verification_code}</span>.
            </p>
          </div>
          <PulseSeal
            hash={proof.merkle_root}
            code={proof.issuing_notary_id_number}
            legend="PROOF OF SERVICE · AI OVERSEER"
            size={210}
            tone="ink"
          />
        </footer>
      </article>
    </main>
  );
}
