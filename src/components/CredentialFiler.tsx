import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { fileCredential } from "@/lib/credentials.functions";
import { CREDENTIAL_KINDS } from "@/lib/clearance";
import { hashFile } from "@/lib/hash";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type FilerPrefill = {
  kind?: string;
  issuingAuthority?: string | null;
  credentialNumber?: string | null;
  expiresOn?: string | null;
};

/**
 * Shared credential filing form. Used by the vault and by the renewal portal,
 * where it is pre-filled from the lapsing item so a renewal is a one-file act.
 */
export function CredentialFiler({
  prefill,
  submitLabel = "File for verification",
  lockKind = false,
  onFiled,
}: {
  prefill?: FilerPrefill;
  submitLabel?: string;
  lockKind?: boolean;
  onFiled?: () => void;
}) {
  const submitCredential = useServerFn(fileCredential);
  const fileInput = useRef<HTMLInputElement>(null);

  const [kind, setKind] = useState(prefill?.kind ?? "commission_certificate");
  const [authority, setAuthority] = useState(prefill?.issuingAuthority ?? "");
  const [number, setNumber] = useState(prefill?.credentialNumber ?? "");
  const [issuedOn, setIssuedOn] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [digest, setDigest] = useState<string | null>(null);
  const [hashing, setHashing] = useState(false);

  useEffect(() => {
    setKind(prefill?.kind ?? "commission_certificate");
    setAuthority(prefill?.issuingAuthority ?? "");
    setNumber(prefill?.credentialNumber ?? "");
  }, [prefill?.kind, prefill?.issuingAuthority, prefill?.credentialNumber]);

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
      toast.success("Renewal filed", {
        description: "A registrar will verify the fresh copy and extend your record.",
      });
      setIssuedOn("");
      setExpiresOn("");
      setFile(null);
      setDigest(null);
      if (fileInput.current) fileInput.current.value = "";
      onFiled?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit.mutate();
      }}
    >
      <div className="space-y-1.5">
        <Label>Credential type</Label>
        <Select value={kind} onValueChange={setKind} disabled={lockKind}>
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
        <Label htmlFor="rn-authority">Issuing authority</Label>
        <Input
          id="rn-authority"
          value={authority}
          onChange={(e) => setAuthority(e.target.value)}
          placeholder="New York Department of State"
          maxLength={120}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="rn-number">Credential number</Label>
        <Input
          id="rn-number"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="01AB1234567"
          maxLength={80}
          className="font-mono text-xs"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="rn-issued">New issue date</Label>
          <Input
            id="rn-issued"
            type="date"
            value={issuedOn}
            onChange={(e) => setIssuedOn(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rn-expires">New expiry date</Label>
          <Input
            id="rn-expires"
            type="date"
            value={expiresOn}
            onChange={(e) => setExpiresOn(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="rn-file">Renewed copy</Label>
        <Input
          id="rn-file"
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
        {submit.isPending ? "Filing…" : submitLabel}
      </Button>
    </form>
  );
}
