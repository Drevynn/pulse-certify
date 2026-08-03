import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const HexHash = z.string().regex(/^[0-9a-f]{64}$/, "Expected a SHA-256 hex digest");

const FileCredentialInput = z.object({
  kind: z.enum([
    "commission_certificate",
    "government_id",
    "surety_bond",
    "eo_insurance",
    "training_certificate",
    "other",
  ]),
  documentName: z.string().trim().min(1).max(200),
  storagePath: z.string().trim().min(1).max(400),
  fileHash: HexHash,
  fileBytes: z.number().int().nonnegative().max(52_428_800),
  issuingAuthority: z.string().trim().max(120).optional().nullable(),
  credentialNumber: z.string().trim().max(80).optional().nullable(),
  issuedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  expiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

export const getMyClearance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { evaluateClearance } = await import("./clearance.server");
    return evaluateClearance(context.supabase, context.userId);
  });

export const listMyCredentials = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { evaluateClearance } = await import("./clearance.server");
    const { data, error } = await context.supabase
      .from("notary_credentials")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const clearance = await evaluateClearance(context.supabase, context.userId);
    return { credentials: data ?? [], clearance };
  });

export const fileCredential = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => FileCredentialInput.parse(input))
  .handler(async ({ data, context }) => {
    // The uploaded object must live under the caller's own folder; storage RLS
    // enforces the same prefix rule on the write itself.
    if (!data.storagePath.startsWith(`${context.userId}/`)) {
      throw new Error("Credential file is not stored under your own vault folder.");
    }
    const { error } = await context.supabase.from("notary_credentials").insert({
      user_id: context.userId,
      kind: data.kind,
      document_name: data.documentName,
      storage_path: data.storagePath,
      file_hash: data.fileHash,
      file_bytes: data.fileBytes,
      issuing_authority: data.issuingAuthority || null,
      credential_number: data.credentialNumber || null,
      issued_on: data.issuedOn || null,
      expires_on: data.expiresOn || null,
      status: "pending",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const withdrawCredential = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("notary_credentials")
      .select("storage_path, status")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!row) throw new Error("Credential not found.");
    if (row.status !== "pending") {
      throw new Error("Reviewed credentials are retained on record and cannot be withdrawn.");
    }
    const { error } = await context.supabase
      .from("notary_credentials")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await context.supabase.storage.from("notary-credentials").remove([row.storage_path]);
    return { ok: true };
  });

export const getCredentialFileLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    // RLS on notary_credentials limits this read to the owner or a registrar.
    const { data: row } = await context.supabase
      .from("notary_credentials")
      .select("storage_path")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) throw new Error("Credential not found.");
    const { data: signed, error } = await context.supabase.storage
      .from("notary-credentials")
      .createSignedUrl(row.storage_path, 60);
    if (error || !signed) throw new Error(error?.message ?? "Could not open that file.");
    return { url: signed.signedUrl };
  });
