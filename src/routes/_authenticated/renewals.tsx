import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyCredentials } from "@/lib/credentials.functions";
import {
  CLEARANCE_MESSAGE,
  CREDENTIAL_KIND_LABEL,
  daysUntil,
  expiryLabel,
} from "@/lib/clearance";
import { ExpiryBadge, ExpiryNotices } from "@/components/ExpiryAlerts";
import { CredentialFiler, type FilerPrefill } from "@/components/CredentialFiler";
import { VerificationHistory } from "@/components/VerificationHistory";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/renewals")({
  head: () => ({
    meta: [
      { title: "Renewal Portal — Pulse IP" },
      {
        name: "description",
        content:
          "Renew your notary commission and vault credentials before they lapse, with the same expiry badges and alerts as the registry dashboard.",
      },
      { property: "og:title", content: "Renewal Portal — Pulse IP" },
      {
        property: "og:description",
        content: "Track and file commission and credential renewals in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RenewalPortal,
});

function RenewalPortal() {
  const queryClient = useQueryClient();
  const fetchList = useServerFn(listMyCredentials);
  const { data, isLoading } = useQuery({
    queryKey: ["credentials"],
    queryFn: () => fetchList(),
  });

  const credentials: any[] = data?.credentials ?? [];
  const clearance = data?.clearance;

  const [prefill, setPrefill] = useState<FilerPrefill>({ kind: "commission_certificate" });

  // Renewable items: the commission of record plus every reviewed copy on file.
  const items = useMemo(() => {
    const rows = credentials
      .filter((c) => c.status !== "pending")
      .map((c) => ({
        id: c.id as string,
        kind: c.kind as string,
        label: CREDENTIAL_KIND_LABEL[c.kind] ?? c.kind,
        authority: c.issuing_authority as string | null,
        number: c.credential_number as string | null,
        expiresOn: c.expires_on as string | null,
        status: c.status as string,
      }));
    rows.sort((a, b) => {
      const av = a.expiresOn ? daysUntil(a.expiresOn) : 99_999;
      const bv = b.expiresOn ? daysUntil(b.expiresOn) : 99_999;
      return av - bv;
    });
    return rows;
  }, [credentials]);

  const pending = credentials.filter((c) => c.status === "pending");

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["credentials"] });
    queryClient.invalidateQueries({ queryKey: ["clearance"] });
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-12">
      <p className="eyebrow">Notary portal</p>
      <h1 className="mt-2 text-4xl">Renewals</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Keep your commission and vault credentials current. File a fresh copy here before a
        record lapses and a registrar will extend it — registry access never has to drop.
      </p>

      <ExpiryNotices expiring={clearance?.expiring ?? []} className="mt-6" />

      <section className="mt-6 rounded-lg border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm">Commission of record</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {clearance?.commissionState ?? "State not stated"}
              {clearance?.commissionExpiresOn
                ? ` · expires ${clearance.commissionExpiresOn} (${expiryLabel(
                    daysUntil(clearance.commissionExpiresOn),
                  )})`
                : " · no expiry on record"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ExpiryBadge expiresOn={clearance?.commissionExpiresOn} kind="commission" />
            <Badge
              variant="outline"
              className={clearance?.isCertified ? "text-verdigris" : "text-muted-foreground"}
            >
              {clearance?.isCertified ? "certified" : "uncertified"}
            </Badge>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPrefill({ kind: "commission_certificate" })}
            >
              Renew commission
            </Button>
          </div>
        </div>
        {clearance && !clearance.cleared ? (
          <ul className="mt-3 space-y-1.5">
            {clearance.reasons.map((r) => (
              <li key={r} className="text-xs text-muted-foreground">
                — {CLEARANCE_MESSAGE[r]}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <div className="mt-10 grid gap-8 lg:grid-cols-[380px_1fr] lg:items-start">
        <section className="vault-panel p-7">
          <h2 className="text-2xl">File a renewal</h2>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            The renewed copy is fingerprinted in your browser and filed for registrar review.
            Your previous copy stays on record as history.
          </p>
          <div className="mt-6">
            <CredentialFiler
              prefill={prefill}
              submitLabel="File renewal"
              onFiled={refresh}
            />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl">Records on file</h2>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading your record…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing verified yet — file your commission certificate to begin.
            </p>
          ) : (
            <ul className="space-y-3">
              {items.map((item) => (
                <li key={item.id} className="vault-panel p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg">{item.label}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {item.authority ?? "Authority not stated"}
                        {item.number ? ` · ${item.number}` : ""}
                        {item.expiresOn
                          ? ` · expires ${item.expiresOn}`
                          : " · no expiry recorded"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <ExpiryBadge expiresOn={item.expiresOn} kind={item.kind} />
                      <Badge
                        variant="outline"
                        className={
                          item.status === "verified" ? "text-verdigris" : "text-destructive"
                        }
                      >
                        {item.status}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setPrefill({
                            kind: item.kind,
                            issuingAuthority: item.authority,
                            credentialNumber: item.number,
                          })
                        }
                      >
                        Renew
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {pending.length > 0 ? (
            <div className="rounded-lg border border-border bg-card p-5">
              <p className="text-sm">Awaiting registrar review</p>
              <ul className="mt-3 space-y-1.5">
                {pending.map((c: any) => (
                  <li key={c.id} className="text-xs text-muted-foreground">
                    — {CREDENTIAL_KIND_LABEL[c.kind] ?? c.kind} · {c.document_name}
                    {c.expires_on ? ` · new expiry ${c.expires_on}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </div>
      <section className="vault-panel mt-8 p-6">
        <VerificationHistory />
      </section>
    </main>
  );
}
