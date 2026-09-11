import { createFileRoute, Link } from "@tanstack/react-router";
import { PulseGlyph } from "@/components/AppShell";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Pulse IP" },
      {
        name: "description",
        content:
          "How the Pulse IP recording platform handles notary credentials, ledger records and document digests.",
      },
      { property: "og:title", content: "Privacy Policy — Pulse IP" },
      {
        property: "og:description",
        content: "Credential copies, ledger digests and verification data on the Pulse IP recording platform.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PrivacyPage,
});

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "1. Scope",
    body: [
      "Pulse IP is a recording platform used by commissioned notaries. This policy covers the data the platform holds about notaries, their filed credentials, and the matters they record. Pulse IP does not act as a notary and does not take custody of the underlying documents' contents.",
    ],
  },
  {
    title: "2. What we collect",
    body: [
      "Account data: your name, email address, commissioning jurisdiction and the notary identifier the platform assigns you.",
      "Credential copies: the documents you file into the credential vault (commission certificate, identification, bond or insurance evidence), together with their file hashes and review status.",
      "Matter records: document digests (SHA-256, not the documents themselves), titles, reference numbers, jurisdictions, signer roles, attestation events, ledger entries, overseer findings, and the Certificates and Proofs of Service issued.",
      "Usage and security data: sign-in events and technical logs needed to operate and secure the platform.",
    ],
  },
  {
    title: "3. How it is used",
    body: [
      "To admit and clear notaries: registrars review filed credential copies, and where an official state registry extract has been imported, commissions are cross-checked against it automatically.",
      "To operate the ledger: digests, attestations and issuance events are written to an append-only record that cannot later be edited or removed.",
      "To run the automated overseer's three mandates before a Proof of Service is issued.",
      "To send expiry and clearance alerts about your commission and credentials.",
    ],
  },
  {
    title: "4. What is public",
    body: [
      "The public verification lookup confirms whether a verification code or digest matches a sealed matter. It discloses the seal's existence and integrity status only — never the parties, titles, or document contents.",
      "Your notary identifier appears on Proofs of Service you issue and on matters you attest, visible to the participants of those matters.",
    ],
  },
  {
    title: "5. Retention and immutability",
    body: [
      "Ledger entries are permanent by design and survive account closure; they contain digests and event metadata, not document contents.",
      "Credential copies are retained while your account is active and for a reasonable period afterwards to support dispute resolution, then deleted from the vault.",
      "You may request correction of your account data at any time; historical ledger entries can only be superseded, never rewritten.",
    ],
  },
  {
    title: "6. Sharing",
    body: [
      "We do not sell personal data. Data is shared only with the infrastructure providers that operate the platform (hosting, database, authentication, and the AI provider that runs the overseer review), each under confidentiality obligations, and where the law requires disclosure.",
    ],
  },
  {
    title: "7. Your rights",
    body: [
      "Depending on your jurisdiction you may have rights to access, correct, export, or delete personal data we hold. Because ledger entries are integrity records, deletion rights are satisfied by removing identifying account data rather than altering sealed history. Contact the platform operator to exercise these rights.",
    ],
  },
];

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-3xl items-center px-5">
          <Link to="/" className="flex items-center gap-2.5">
            <PulseGlyph />
            <span className="font-display text-lg">
              Pulse<span className="text-primary">IP</span>
            </span>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-14">
        <p className="eyebrow">Legal</p>
        <h1 className="mt-3 text-4xl">Privacy Policy</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          How the Pulse IP recording platform handles your data. Last updated September 2026.
        </p>
        <div className="mt-10 space-y-10">
          {SECTIONS.map((s) => (
            <section key={s.title}>
              <h2 className="text-2xl">{s.title}</h2>
              {s.body.map((p, i) => (
                <p key={i} className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {p}
                </p>
              ))}
            </section>
          ))}
        </div>
        <p className="mt-12 border-t border-border pt-6 text-xs text-muted-foreground">
          See also the <Link to="/terms" className="text-primary underline-offset-4 hover:underline">Terms of Service</Link>.
        </p>
      </main>
    </div>
  );
}
