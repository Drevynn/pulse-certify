import { createFileRoute, Link } from "@tanstack/react-router";
import { PulseSeal } from "@/components/PulseSeal";
import { PulseGlyph } from "@/components/AppShell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pulse Notary — Blockchain Notarization for Certified Notaries" },
      {
        name: "description",
        content:
          "Anchor documents to an append-only chain, collect attestations from certified notaries, and issue an AI-overseen Proof of Service bearing the notary's ID number.",
      },
      {
        property: "og:title",
        content: "Pulse Notary — Blockchain Notarization for Certified Notaries",
      },
      {
        property: "og:description",
        content:
          "Zero-trust notarization: hash-anchored matters, multi-notary attestation, guilloche-sealed certificates and AI-overseen Proof of Service.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const STEPS = [
  {
    n: "01",
    title: "Anchor",
    body: "The document never leaves the notary's machine. Only its SHA-256 digest is written to the registry contract, opening an append-only chain of custody.",
  },
  {
    n: "02",
    title: "Attest",
    body: "Each certified notary on the panel signs independently. Every attestation is its own hash, linked to the block before it. No party can rewrite an earlier entry.",
  },
  {
    n: "03",
    title: "Oversee",
    body: "Once the last attestation lands, the AI overseer discharges three mandates: legality of every signature, clarity of the client's clearance request, and a double-check of each notary's credentials.",
  },
  {
    n: "04",
    title: "Issue",
    body: "Two deliverables: a printable certificate bearing the Pulse IP mark, and a Proof of Service labelled with the issuing notary's ID number.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="no-print sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-5">
          <Link to="/" className="flex items-center gap-2.5">
            <PulseGlyph />
            <span className="font-display text-lg leading-none">
              Pulse<span className="text-primary">Notary</span>
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/verify">Verify a seal</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/auth">Notary sign in</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="engraved-grid relative overflow-hidden border-b border-border">
          <div className="mx-auto grid max-w-6xl gap-14 px-5 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-28">
            <div className="animate-[var(--animate-rise)]">
              <p className="eyebrow">Zero-trust notarial infrastructure</p>
              <h1 className="mt-5 text-5xl leading-[1.02] sm:text-6xl lg:text-7xl">
                Notarization that
                <br />
                <span className="foil-text">cannot be quietly rewritten.</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground">
                Pulse Notary is a registry for commissioned notaries. Documents are anchored
                by digest, attestations are collected from a certified panel, and a Proof of
                Service is issued only after an independent AI overseer reconciles the whole
                chain.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link to="/auth">Open the registry</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/verify">Verify a document</Link>
                </Button>
              </div>
              <dl className="mt-14 grid max-w-lg grid-cols-3 gap-6 border-t border-border pt-8">
                {[
                  ["SHA-256", "Document anchor"],
                  ["Append-only", "Custody ledger"],
                  ["AI-gated", "Proof issuance"],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="font-mono text-sm text-primary">{k}</dt>
                    <dd className="mt-1 text-xs text-muted-foreground">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="relative flex justify-center">
              <div className="absolute inset-0 -z-10 rounded-full bg-primary/10 blur-3xl" />
              <PulseSeal
                hash="c41f7b8e05a9d3266f1b4e70a8c95d3218be7f04a3269cd58bf1740e93a6cb27"
                legend="PULSE NOTARY REGISTRY"
                code="SPECIMEN"
                size={420}
                animated
                className="max-w-full"
              />
            </div>
          </div>
        </section>

        {/* Deliverables */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-6xl px-5 py-20">
            <p className="eyebrow">Two instruments, one chain</p>
            <h2 className="mt-4 max-w-2xl text-4xl">
              A sealed certificate for the file. A Proof of Service for the record.
            </h2>
            <div className="mt-12 grid gap-6 md:grid-cols-2">
              <article className="vault-panel p-8">
                <h3 className="text-2xl">Certificate of Notarization</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  The printable deliverable. It carries the Pulse IP mark — a guilloche
                  rosette lathed from the document&rsquo;s own digest, with a micro-text
                  legend ring and a latent pulse trace. Because the geometry is a function
                  of the hash, a mark scanned from another document will not reproduce.
                </p>
                <ul className="mt-6 space-y-2 font-mono text-xs text-muted-foreground">
                  <li>· Hash-derived guilloche geometry</li>
                  <li>· Micro-text legend ring at 8.6pt</li>
                  <li>· Panel roster with per-notary attestation hashes</li>
                </ul>
              </article>
              <article className="vault-panel p-8">
                <h3 className="text-2xl">Proof of Service</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Minted only after the AI overseer clears the matter, and labelled with the
                  issuing notary&rsquo;s ID number. It carries the Merkle root over the
                  document digest and every attestation, plus the registry transaction that
                  sealed it.
                </p>
                <ul className="mt-6 space-y-2 font-mono text-xs text-muted-foreground">
                  <li>· Proof number bound to the notary ID</li>
                  <li>· Verdict and findings under each of the three mandates</li>
                  <li>· Merkle root over all attestations</li>
                </ul>
              </article>
            </div>
          </div>
        </section>

        {/* Process */}
        <section className="border-b border-border bg-vault">
          <div className="mx-auto max-w-6xl px-5 py-20">
            <p className="eyebrow">Chain of custody</p>
            <h2 className="mt-4 text-4xl">How a matter is sealed</h2>
            <div className="mt-12 grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step) => (
                <div key={step.n} className="bg-card p-7">
                  <span className="font-mono text-xs text-primary">{step.n}</span>
                  <h3 className="mt-4 text-2xl">{step.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {step.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-20 text-center">
          <h2 className="text-4xl">Hold a verification code?</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
            Anyone can confirm a seal against the registry without an account. Parties,
            titles and documents are never disclosed by the public lookup.
          </p>
          <Button asChild size="lg" className="mt-8">
            <Link to="/verify">Open the public lookup</Link>
          </Button>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-10 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <span>© {new Date().getFullYear()} Pulse Notary Registry</span>
          <span className="sm:ml-auto font-mono">
            Registry contracts are deterministic per matter.
          </span>
        </div>
      </footer>
    </div>
  );
}
