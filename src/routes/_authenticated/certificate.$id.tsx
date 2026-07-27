import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getNotarization } from "@/lib/notary.functions";
import { PulseSeal } from "@/components/PulseSeal";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/certificate/$id")({
  head: () => ({
    meta: [
      { title: "Certificate of Notarization — Pulse Notary" },
      {
        name: "description",
        content:
          "Printable Certificate of Notarization bearing the hash-derived Pulse IP guilloche mark and the full panel of attesting notaries.",
      },
      { property: "og:title", content: "Certificate of Notarization — Pulse Notary" },
      {
        property: "og:description",
        content: "The sealed, printable notarial deliverable.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CertificatePage,
});

function Line({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="doc-line">
      <span className="doc-label">{label}</span>
      <span className={mono ? "doc-value font-mono" : "doc-value"}>{value}</span>
    </div>
  );
}

function CertificatePage() {
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

  const { matter, signers, profiles, proof } = data;
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
          Print certificate
        </Button>
      </div>

      <article className="doc-sheet">
        <header className="doc-head">
          <div>
            <p className="doc-eyebrow">Pulse Notary Registry</p>
            <h1 className="doc-title">Certificate of Notarization</h1>
            <p className="doc-sub">
              Issued under a zero-trust append-only custody chain. This instrument certifies
              the anchoring and attestation of the document identified below; it does not
              reproduce the document itself.
            </p>
          </div>
          <div className="doc-code">
            <span className="doc-label">Verification</span>
            <span className="font-mono text-lg tracking-[0.2em]">
              {matter.verification_code}
            </span>
          </div>
        </header>

        <section className="doc-section">
          <h2 className="doc-h2">I. The matter</h2>
          <Line label="Title" value={matter.title} />
          <Line label="Reference" value={matter.matter_reference ?? "—"} />
          <Line label="Jurisdiction" value={matter.jurisdiction ?? "—"} />
          <Line label="Instrument" value={matter.document_name} />
          <Line
            label="Anchored"
            value={new Date(matter.created_at).toLocaleString(undefined, {
              dateStyle: "long",
              timeStyle: "short",
            })}
          />
        </section>

        <section className="doc-section">
          <h2 className="doc-h2">II. The anchor</h2>
          <Line label="SHA-256 digest" value={matter.document_hash} mono />
          <Line label="Registry" value={matter.chain_name ?? "PulseChain Notary Registry"} />
          <Line label="Contract" value={matter.contract_address ?? "—"} mono />
        </section>

        <section className="doc-section">
          <h2 className="doc-h2">III. Attesting notaries</h2>
          <table className="doc-table">
            <thead>
              <tr>
                <th>Notary</th>
                <th>Identifier</th>
                <th>Attested</th>
                <th>Attestation hash</th>
              </tr>
            </thead>
            <tbody>
              {attesting.map((s) => (
                <tr key={s.id}>
                  <td>{nameFor(s.notary_user_id)}</td>
                  <td className="font-mono">{s.notary_id_number}</td>
                  <td>{s.attested_at ? new Date(s.attested_at).toLocaleDateString() : "—"}</td>
                  <td className="font-mono doc-hash">{s.attestation_hash?.slice(0, 32)}…</td>
                </tr>
              ))}
            </tbody>
          </table>
          {attesting.some((s) => s.attestation_note) ? (
            <div className="doc-notes">
              {attesting
                .filter((s) => s.attestation_note)
                .map((s) => (
                  <p key={s.id}>
                    <span className="font-mono">{s.notary_id_number}</span> —{" "}
                    {s.attestation_note}
                  </p>
                ))}
            </div>
          ) : null}
        </section>

        <footer className="doc-foot">
          <div className="doc-foot-text">
            <p className="doc-label">Pulse IP mark</p>
            <p>
              The seal opposite is lathed from the document digest above. Its rosette
              geometry, legend ring and latent pulse trace are a deterministic function of
              that digest; a mark transposed from any other instrument will not reconcile.
            </p>
            <p className="doc-fine">
              Verify at /verify with code{" "}
              <span className="font-mono">{matter.verification_code}</span>.
              {proof ? (
                <>
                  {" "}
                  Proof of Service <span className="font-mono">{proof.proof_number}</span>{" "}
                  issued under this matter.
                </>
              ) : (
                " No Proof of Service has yet been issued under this matter."
              )}
            </p>
          </div>
          <PulseSeal
            hash={matter.document_hash}
            code={matter.verification_code}
            legend="PULSE NOTARY REGISTRY"
            size={210}
            tone="ink"
          />
        </footer>
      </article>
    </main>
  );
}
