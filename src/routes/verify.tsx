import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { verifyByCode } from "@/lib/notary.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PulseSeal } from "@/components/PulseSeal";
import { PulseGlyph } from "@/components/AppShell";

export const Route = createFileRoute("/verify")({
  head: () => ({
    meta: [
      { title: "Verify a Notarial Seal — Pulse IP Registry" },
      {
        name: "description",
        content:
          "Enter a verification code to confirm a document anchor, attestation count and Proof of Service against the Pulse IP registry. No account required.",
      },
      { property: "og:title", content: "Verify a Notarial Seal — Pulse IP Registry" },
      {
        property: "og:description",
        content: "Public, account-free confirmation of a Pulse IP seal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VerifyPage,
});

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border py-3 last:border-0 sm:flex-row sm:items-baseline sm:gap-6">
      <dt className="eyebrow sm:w-48 sm:shrink-0">{label}</dt>
      <dd className={mono ? "break-all font-mono text-xs" : "text-sm"}>{value}</dd>
    </div>
  );
}

function VerifyPage() {
  const [code, setCode] = useState("");
  const lookup = useServerFn(verifyByCode);
  const mutation = useMutation({
    mutationFn: (value: string) => lookup({ data: { code: value } }),
  });

  const result = mutation.data;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-4xl items-center px-5">
          <Link to="/" className="flex items-center gap-2.5">
            <PulseGlyph />
            <span className="font-display text-lg leading-none">
              Pulse<span className="text-primary">IP</span>
            </span>
          </Link>
          <Button asChild variant="ghost" size="sm" className="ml-auto">
            <Link to="/auth">Notary sign in</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-16">
        <p className="eyebrow">Public registry lookup</p>
        <h1 className="mt-3 text-5xl">Verify a seal</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
          The verification code is printed beneath the Pulse IP mark on every certificate and
          Proof of Service. The registry confirms the anchor without disclosing parties,
          titles or documents.
        </p>

        <form
          className="mt-8 flex max-w-md gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) mutation.mutate(code.trim());
          }}
        >
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. 8FQ2K7ZP"
            className="font-mono tracking-[0.18em]"
            aria-label="Verification code"
          />
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Checking…" : "Verify"}
          </Button>
        </form>

        {mutation.isError ? (
          <p className="mt-6 text-sm text-destructive">
            The registry could not be reached. Try again in a moment.
          </p>
        ) : null}

        {result && !result.found ? (
          <div className="vault-panel mt-10 p-8">
            <h2 className="text-2xl">No record</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              No matter in this registry carries that verification code. Check the characters
              against the printed instrument.
            </p>
          </div>
        ) : null}

        {result && result.found ? (
          <div className="mt-10 grid gap-8 lg:grid-cols-[260px_1fr] lg:items-start">
            <div className="flex justify-center">
              <PulseSeal
                hash={result.documentHash}
                code={result.verificationCode}
                size={240}
                tone="foil"
              />
            </div>
            <div className="vault-panel p-8">
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="text-2xl">
                  {result.proof ? "Sealed and served" : "Anchored, not yet sealed"}
                </h2>
                <span className="eyebrow">{result.status}</span>
              </div>
              <dl className="mt-6">
                <Row label="Document digest" value={result.documentHash} mono />
                <Row label="Registry" value={result.chainName ?? "PulseChain"} />
                <Row
                  label="Contract"
                  value={result.contractAddress ?? "pending anchor"}
                  mono
                />
                <Row
                  label="Attestations"
                  value={`${result.attestationCount} of ${result.requiredAttestations} required`}
                />
                <Row label="Anchored" value={new Date(result.anchoredAt).toLocaleString()} />
                {result.proof ? (
                  <>
                    <Row label="Proof of Service" value={result.proof.proof_number} mono />
                    <Row
                      label="Issuing notary ID"
                      value={result.proof.issuing_notary_id_number}
                      mono
                    />
                    <Row label="Merkle root" value={result.proof.merkle_root} mono />
                    <Row label="Seal transaction" value={result.proof.tx_hash} mono />
                  </>
                ) : null}
              </dl>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
