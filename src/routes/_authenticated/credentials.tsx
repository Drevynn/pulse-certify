import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  fileCredential,
  getCredentialFileLink,
  listMyCredentials,
  withdrawCredential,
} from "@/lib/credentials.functions";
import { CLEARANCE_MESSAGE, CREDENTIAL_KINDS, CREDENTIAL_KIND_LABEL } from "@/lib/clearance";
import { ExpiryBadge, ExpiryNotices } from "@/components/ExpiryAlerts";

import { hashFile } from "@/lib/hash";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/credentials")({
  head: () => ({
    meta: [
      { title: "Credential Vault — Pulse IP" },
      {
        name: "description",
        content:
          "File copies of your commission, identity and bonding credentials. Registry access opens once a registrar verifies them.",
      },
      { property: "og:title", content: "Credential Vault — Pulse IP" },
      {
        property: "og:description",
        content: "Retained credential copies and registrar verification status.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CredentialVault,
});

const STATUS_TONE: Record<string, string> = {
  pending: "text-muted-foreground",
  verified: "text-verdigris",
  rejected: "text-destructive",
};

function CredentialVault() {
  const queryClient = useQueryClient();
  const fetchList = useServerFn(listMyCredentials);
  const submitCredential = useServerFn(fileCredential);
  const withdraw = useServerFn(withdrawCredential);
  const openLink = useServerFn(getCredentialFileLink);

  const { data, isLoading } = useQuery({
    queryKey: ["credentials"],
    queryFn: () => fetchList(),
  });

  const fileInput = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<string>("commission_certificate");
  const [authority, setAuthority] = useState("");
  const [number, setNumber] = useState("");
  const [issuedOn, setIssuedOn] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [digest, setDigest] = useState<string | null>(null);
  const [hashing, setHashing] = useState(false);

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

  const submit = useMutation({
    mutationFn: async () => {
      if (!file || !digest) throw new Error("Attach a credential copy first.");
      const { data: session } = await supabase.auth.getUser();
      const uid = session.user?.id;
      if (!uid) throw new Error("Session expired — sign in again.");

      const safeName = file.name.replace(/[^A-Za-z0-9._-]+/g, "-").slice(-120);
      const path = `${uid}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("notary-credentials")
        .upload(path, file, { upsert: false, contentType: file.type || undefined });
      if (uploadError) throw new Error(uploadError.message);

      return submitCredential({
        data: {
          kind: kind as never,
          documentName: file.name,
          storagePath: path,
          fileHash: digest,
          fileBytes: file.size,
          issuingAuthority: authority.trim() || null,
          credentialNumber: number.trim() || null,
          issuedOn: issuedOn || null,
          expiresOn: expiresOn || null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Credential filed", {
        description: "A registrar will verify the copy before registry access opens.",
      });
      setAuthority("");
      setNumber("");
      setIssuedOn("");
      setExpiresOn("");
      setFile(null);
      setDigest(null);
      if (fileInput.current) fileInput.current.value = "";
      queryClient.invalidateQueries({ queryKey: ["credentials"] });
      queryClient.invalidateQueries({ queryKey: ["clearance"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => withdraw({ data: { id } }),
    onSuccess: () => {
      toast.success("Credential withdrawn");
      queryClient.invalidateQueries({ queryKey: ["credentials"] });
      queryClient.invalidateQueries({ queryKey: ["clearance"] });
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

  const credentials = data?.credentials ?? [];
  const clearance = data?.clearance;

  return (
    <main className="mx-auto max-w-6xl px-5 py-12">
      <p className="eyebrow">Zero-trust admission</p>
      <h1 className="mt-2 text-4xl">Credential vault</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Every credential is checked before the registry is placed in a notary's hands. Copies
        you file here are retained with the software as the evidentiary record behind the
        overseer's credential mandate, and are readable only by you and the registrar.
      </p>

      <section
        className={`mt-8 rounded-lg border p-5 ${
          clearance?.cleared ? "border-verdigris/40 bg-verdigris/5" : "border-border bg-card"
        }`}
      >
        <p className="text-sm">
          Registry access ·{" "}
          <span className={clearance?.cleared ? "text-verdigris" : "text-muted-foreground"}>
            {clearance?.cleared ? "Cleared" : "Withheld"}
          </span>
        </p>
        {clearance && !clearance.cleared ? (
          <ul className="mt-3 space-y-1.5">
            {clearance.reasons.map((r) => (
              <li key={r} className="text-xs text-muted-foreground">
                — {CLEARANCE_MESSAGE[r]}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            Certified commission and {clearance?.verifiedCredentials ?? 0} verified credential
            copy(ies) on record.
          </p>
        )}
      </section>

      <ExpiryNotices expiring={clearance?.expiring ?? []} className="mt-4" />


      <div className="mt-10 grid gap-8 lg:grid-cols-[380px_1fr] lg:items-start">
        <section className="vault-panel p-7">
          <h2 className="text-2xl">File a credential copy</h2>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            The copy is fingerprinted in your browser and stored in the private vault. The
            fingerprint is retained so any later substitution is detectable.
          </p>

          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label>Credential type</Label>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CREDENTIAL_KINDS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>
                      {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="authority">Issuing authority</Label>
              <Input
                id="authority"
                value={authority}
                onChange={(e) => setAuthority(e.target.value)}
                placeholder="New York Department of State"
                maxLength={120}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="number">Credential number</Label>
              <Input
                id="number"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="01AB1234567"
                maxLength={80}
                className="font-mono text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="issued">Issued</Label>
                <Input
                  id="issued"
                  type="date"
                  value={issuedOn}
                  onChange={(e) => setIssuedOn(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="expires">Expires</Label>
                <Input
                  id="expires"
                  type="date"
                  value={expiresOn}
                  onChange={(e) => setExpiresOn(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cred">Credential copy</Label>
              <Input
                id="cred"
                type="file"
                ref={fileInput}
                accept="application/pdf,image/*"
                onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                required
              />
              {hashing ? (
                <p className="font-mono text-[11px] text-muted-foreground">Fingerprinting…</p>
              ) : null}
              {digest ? (
                <p className="break-all font-mono text-[11px] text-verdigris">{digest}</p>
              ) : null}
            </div>

            <Button type="submit" className="w-full" disabled={submit.isPending || hashing}>
              {submit.isPending ? "Filing…" : "File for verification"}
            </Button>
          </form>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl">Retained copies</h2>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Opening the vault…</p>
          ) : credentials.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing on file yet. File your commission certificate to begin admission.
            </p>
          ) : (
            <ul className="space-y-3">
              {credentials.map((c: any) => (
                <li key={c.id} className="vault-panel p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg">{CREDENTIAL_KIND_LABEL[c.kind] ?? c.kind}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{c.document_name}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {c.issuing_authority ?? "Authority not stated"}
                        {c.credential_number ? ` · ${c.credential_number}` : ""}
                        {c.expires_on ? ` · expires ${c.expires_on}` : ""}
                      </p>
                      <p className="mt-2 break-all font-mono text-[10px] text-muted-foreground">
                        {c.file_hash}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <ExpiryBadge expiresOn={c.expires_on} kind={c.kind} />
                      <Badge variant="outline" className={STATUS_TONE[c.status]}>
                        {c.status}
                      </Badge>
                    </div>

                  </div>
                  {c.review_note ? (
                    <p className="mt-3 border-l-2 border-border pl-3 text-xs text-muted-foreground">
                      Registrar: {c.review_note}
                    </p>
                  ) : null}
                  <div className="mt-4 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => view(c.id)}>
                      View copy
                    </Button>
                    {c.status === "pending" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={remove.isPending}
                        onClick={() => remove.mutate(c.id)}
                      >
                        Withdraw
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
