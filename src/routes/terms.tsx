import { createFileRoute, Link } from "@tanstack/react-router";
import { PulseGlyph } from "@/components/AppShell";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Pulse IP" },
      {
        name: "description",
        content:
          "Terms governing use of the Pulse IP recording platform — a tamper-evident registry tool for commissioned notaries, not a notary service.",
      },
      { property: "og:title", content: "Terms of Service — Pulse IP" },
      {
        property: "og:description",
        content: "Pulse IP is a recording platform; the notarial act always belongs to the commissioned notary.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TermsPage,
});

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "1. What Pulse IP is — and what it is not",
    body: [
      "Pulse IP is a recording platform: software that lets a commissioned notary anchor a document digest to an append-only ledger, gather attestations from other credentialed notaries, and produce a printable Certificate of Notarization and a Proof of Service record.",
      "Pulse IP is not a notary, not a notary service, and not a law firm. No notarial act is performed by Pulse IP. Every notarial act recorded through the platform is performed solely by the commissioned notary named on the record, under that notary's own commission, seal, and legal authority. The Proof of Service issued through the platform belongs to the notary, not to Pulse IP.",
      "Nothing on the platform constitutes legal advice.",
    ],
  },
  {
    title: "2. Eligibility and admission",
    body: [
      "Accounts are restricted to commissioned notaries. Before registry access is granted, a registrar must certify the notary's commission and verify at least one unexpired credential copy filed with the platform. Where an official state registry extract has been imported, the platform cross-checks the commission against it automatically.",
      "You must keep your commission record and credential copies current. The platform may suspend registry access when a commission expires, cannot be confirmed, or when every credential copy on file has lapsed.",
    ],
  },
  {
    title: "3. The notary's responsibilities",
    body: [
      "The notary alone is responsible for the lawfulness of every act they record: verifying signer identity, confirming willingness and capacity, keeping any journal or bond their jurisdiction requires, and complying with the notarial laws of their commissioning state, including any rules governing electronic or remote notarization.",
      "A digest anchored on Pulse IP is evidence that a specific document existed at a point in time and passed through a recorded chain of custody. It does not cure an unlawful notarization, and Pulse IP does not warrant that any recorded act satisfies the requirements of any jurisdiction.",
    ],
  },
  {
    title: "4. The AI overseer",
    body: [
      "An automated overseer reviews each matter before a Proof of Service is issued, under three mandates: legality of each notary signature, clarity of the client's request, and the validity of each participating notary's credentials.",
      "The overseer is a compliance and record-keeping aid. It does not perform or authorize notarial acts, and its clearance is not a legal determination. The notary's professional obligations are unchanged whether the overseer clears, flags, or blocks a matter.",
    ],
  },
  {
    title: "5. Records and immutability",
    body: [
      "Ledger entries are append-only by design: once written, an entry cannot be edited or deleted, only superseded by a later entry. Certificate and Proof of Service documents bear a guilloche mark derived from the document's digest; the mark verifies the document's integrity, not the truth of its contents.",
      "Only cryptographic digests and matter metadata are written to the ledger. Document contents remain under the notary's control.",
    ],
  },
  {
    title: "6. Acceptable use",
    body: [
      "You may not file credentials you do not hold, record acts you did not perform, attempt to alter ledger history, reproduce the Pulse IP mark for documents it was not issued for, or use the public verification lookup to harvest information about other users.",
      "Violation of these terms, or loss of the underlying commission, terminates registry access.",
    ],
  },
  {
    title: "7. Disclaimers and liability",
    body: [
      "The platform is provided \"as is\". Pulse IP disclaims all warranties to the maximum extent permitted by law and is not liable for the validity of any notarial act, for registrar decisions made in good faith, or for indirect or consequential losses.",
      "Nothing in these terms limits liability that cannot be limited by law.",
    ],
  },
];

function TermsPage() {
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
        <h1 className="mt-3 text-4xl">Terms of Service</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Pulse IP is a recording platform for commissioned notaries — a tool, not a notary
          service. Last updated September 2026.
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
          See also the <Link to="/privacy" className="text-primary underline-offset-4 hover:underline">Privacy Policy</Link>.
        </p>
      </main>
    </div>
  );
}
