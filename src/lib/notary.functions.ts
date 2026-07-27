import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const HexHash = z.string().regex(/^[0-9a-f]{64}$/, "Expected a SHA-256 hex digest");

const CreateInput = z.object({
  title: z.string().trim().min(3).max(160),
  matterReference: z.string().trim().max(80).optional().nullable(),
  jurisdiction: z.string().trim().max(80).optional().nullable(),
  documentName: z.string().trim().min(1).max(200),
  documentHash: HexHash,
  documentBytes: z.number().int().nonnegative().max(2_000_000_000),
  requiredAttestations: z.number().int().min(1).max(12),
  coSignerIdNumbers: z.array(z.string().trim().min(3).max(40)).max(11).default([]),
});

const AttestInput = z.object({
  notarizationId: z.string().uuid(),
  note: z.string().trim().max(600).optional().nullable(),
  decision: z.enum(["attested", "declined"]),
});

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("*")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        fullName: z.string().trim().min(2).max(120),
        commissionState: z.string().trim().max(80).optional().nullable(),
        commissionExpiresOn: z.string().trim().max(20).optional().nullable(),
        isCertified: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({
        full_name: data.fullName,
        commission_state: data.commissionState || null,
        commission_expires_on: data.commissionExpiresOn || null,
        is_certified: data.isCertified,
      })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listNotarizations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: matters, error } = await context.supabase
      .from("notarizations")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const ids = (matters ?? []).map((m) => m.id);
    if (ids.length === 0) return { matters: [], signers: [], proofs: [] };

    const [{ data: signers }, { data: proofs }] = await Promise.all([
      context.supabase
        .from("notarization_signers")
        .select("notarization_id, notary_user_id, notary_id_number, status")
        .in("notarization_id", ids),
      context.supabase
        .from("proofs_of_service")
        .select("notarization_id, proof_number, issued_at")
        .in("notarization_id", ids),
    ]);

    return {
      matters: matters ?? [],
      signers: signers ?? [],
      proofs: proofs ?? [],
      me: context.userId,
    };
  });

export const getNotarization = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: matter, error } = await context.supabase
      .from("notarizations")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!matter) throw new Error("Matter not found or not visible to you.");

    const [{ data: signers }, { data: blocks }, { data: proof }] = await Promise.all([
      context.supabase
        .from("notarization_signers")
        .select("*")
        .eq("notarization_id", data.id)
        .order("created_at", { ascending: true }),
      context.supabase
        .from("ledger_blocks")
        .select("*")
        .eq("notarization_id", data.id)
        .order("block_index", { ascending: true }),
      context.supabase
        .from("proofs_of_service")
        .select("*")
        .eq("notarization_id", data.id)
        .maybeSingle(),
    ]);

    const userIds = [...new Set((signers ?? []).map((s) => s.notary_user_id))];
    const { data: profiles } = userIds.length
      ? await context.supabase
          .from("profiles")
          .select("id, full_name, notary_id_number, is_certified, commission_state, commission_expires_on")
          .in("id", userIds)
      : { data: [] };

    const { verifyChainLinkage } = await import("./notary.server");
    const linkage = verifyChainLinkage(blocks ?? []);

    return {
      matter,
      signers: signers ?? [],
      blocks: blocks ?? [],
      proof: proof ?? null,
      profiles: profiles ?? [],
      linkage,
      me: context.userId,
    };
  });

export const createNotarization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateInput.parse(input))
  .handler(async ({ data, context }) => {
    const engine = await import("./notary.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: me, error: meError } = await context.supabase
      .from("profiles")
      .select("notary_id_number, is_certified")
      .eq("id", context.userId)
      .single();
    if (meError) throw new Error(meError.message);

    const requested = [...new Set(data.coSignerIdNumbers.map((c) => c.toUpperCase()))].filter(
      (c) => c !== me.notary_id_number,
    );

    const { data: coSigners } = requested.length
      ? await context.supabase
          .from("profiles")
          .select("id, notary_id_number")
          .in("notary_id_number", requested)
      : { data: [] };

    const found = new Set((coSigners ?? []).map((c) => c.notary_id_number));
    const unknown = requested.filter((r) => !found.has(r));
    if (unknown.length) {
      throw new Error(`Unknown notary identifier(s): ${unknown.join(", ")}`);
    }

    const totalSigners = 1 + (coSigners?.length ?? 0);
    const required = Math.min(data.requiredAttestations, totalSigners);

    const { data: matter, error } = await context.supabase
      .from("notarizations")
      .insert({
        created_by: context.userId,
        title: data.title,
        matter_reference: data.matterReference || null,
        jurisdiction: data.jurisdiction || null,
        document_name: data.documentName,
        document_hash: data.documentHash,
        document_bytes: data.documentBytes,
        required_attestations: required,
        status: "collecting",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    const contractAddress = await engine.deriveContractAddress(matter.id);
    await context.supabase
      .from("notarizations")
      .update({ contract_address: contractAddress })
      .eq("id", matter.id);

    const rows = [
      {
        notarization_id: matter.id,
        notary_user_id: context.userId,
        notary_id_number: me.notary_id_number,
      },
      ...(coSigners ?? []).map((c) => ({
        notarization_id: matter.id,
        notary_user_id: c.id,
        notary_id_number: c.notary_id_number,
      })),
    ];
    const { error: signerError } = await supabaseAdmin
      .from("notarization_signers")
      .insert(rows);
    if (signerError) throw new Error(signerError.message);

    await engine.appendBlock({
      admin: supabaseAdmin,
      notarizationId: matter.id,
      eventType: "MATTER_ANCHORED",
      actorIdNumber: me.notary_id_number,
      contractAddress,
      payload: {
        documentHash: data.documentHash,
        documentName: data.documentName,
        requiredAttestations: required,
        panel: rows.map((r) => r.notary_id_number),
        registry: engine.REGISTRY_NAME,
      },
    });

    return { id: matter.id, verificationCode: matter.verification_code };
  });

export const recordAttestation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AttestInput.parse(input))
  .handler(async ({ data, context }) => {
    const engine = await import("./notary.server");
    const { sha256Hex } = await import("./hash");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: signer, error } = await context.supabase
      .from("notarization_signers")
      .select("*")
      .eq("notarization_id", data.notarizationId)
      .eq("notary_user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!signer) throw new Error("You are not on the panel for this matter.");
    if (signer.status !== "pending") throw new Error("Your attestation is already recorded.");

    const { data: matter } = await context.supabase
      .from("notarizations")
      .select("document_hash, contract_address, status")
      .eq("id", data.notarizationId)
      .single();
    if (!matter) throw new Error("Matter not found.");
    if (matter.status === "sealed") throw new Error("This matter is already sealed.");

    const attestedAt = new Date().toISOString();
    const attestationHash = await sha256Hex(
      `${data.notarizationId}|${signer.notary_id_number}|${matter.document_hash}|${data.decision}|${attestedAt}`,
    );

    const { error: updateError } = await context.supabase
      .from("notarization_signers")
      .update({
        status: data.decision,
        attestation_hash: attestationHash,
        attestation_note: data.note || null,
        attested_at: attestedAt,
      })
      .eq("id", signer.id);
    if (updateError) throw new Error(updateError.message);

    await engine.appendBlock({
      admin: supabaseAdmin,
      notarizationId: data.notarizationId,
      eventType: data.decision === "attested" ? "ATTESTATION_RECORDED" : "ATTESTATION_DECLINED",
      actorIdNumber: signer.notary_id_number,
      contractAddress: matter.contract_address,
      payload: { attestationHash, note: data.note || null, attestedAt },
    });

    if (data.decision === "declined") {
      await supabaseAdmin
        .from("notarizations")
        .update({ status: "rejected" })
        .eq("id", data.notarizationId);
    }

    return { ok: true, attestationHash };
  });

export const runOverseerReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ notarizationId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const engine = await import("./notary.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: matter, error } = await context.supabase
      .from("notarizations")
      .select("*")
      .eq("id", data.notarizationId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!matter) throw new Error("Matter not found.");
    if (matter.created_by !== context.userId) {
      throw new Error("Only the filing notary can convene the overseer.");
    }
    if (matter.status === "sealed") throw new Error("A Proof of Service already exists.");

    const { data: signers } = await context.supabase
      .from("notarization_signers")
      .select("*")
      .eq("notarization_id", data.notarizationId);

    const list = signers ?? [];
    if (list.some((s) => s.status === "pending")) {
      throw new Error("The overseer convenes only once every panel notary has responded.");
    }

    const { data: profiles } = await context.supabase
      .from("profiles")
      .select("id, full_name, notary_id_number, is_certified, commission_state, commission_expires_on")
      .in("id", [...list.map((s) => s.notary_user_id), matter.created_by]);

    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
    const filerProfile = profileById.get(matter.created_by);

    const { data: blocks } = await context.supabase
      .from("ledger_blocks")
      .select("block_index, previous_hash, block_hash")
      .eq("notarization_id", data.notarizationId)
      .order("block_index", { ascending: true });

    const linkage = engine.verifyChainLinkage(blocks ?? []);
    const root = await engine.merkleRoot([
      matter.document_hash,
      ...list
        .filter((s) => s.attestation_hash)
        .map((s) => s.attestation_hash as string)
        .sort(),
    ]);

    const review = await engine.runOverseer({
      title: matter.title,
      jurisdiction: matter.jurisdiction,
      matterReference: matter.matter_reference,
      documentName: matter.document_name,
      documentHash: matter.document_hash,
      requiredAttestations: matter.required_attestations,
      createdAt: matter.created_at,
      filingNotary: {
        notaryIdNumber: filerProfile?.notary_id_number ?? "PN-UNKNOWN",
        fullName: filerProfile?.full_name ?? "Unknown",
        isCertified: Boolean(filerProfile?.is_certified),
        commissionState: filerProfile?.commission_state ?? null,
        commissionExpiresOn: filerProfile?.commission_expires_on ?? null,
      },
      signers: list.map((s) => {
        const p = profileById.get(s.notary_user_id);
        return {
          notaryIdNumber: s.notary_id_number,
          fullName: p?.full_name ?? "Unknown",
          status: s.status,
          isCertified: Boolean(p?.is_certified),
          commissionState: p?.commission_state ?? null,
          commissionExpiresOn: p?.commission_expires_on ?? null,
          attestedAt: s.attested_at,
          note: s.attestation_note,
          attestationHash: s.attestation_hash,
          onPanelOf: matter.id,
        };
      }),
      chain: {
        blockCount: (blocks ?? []).length,
        intact: linkage.intact,
        brokenAt: linkage.brokenAt,
        merkleRoot: root,
      },
    });


    if (review.verdict !== "issued") {
      await engine.appendBlock({
        admin: supabaseAdmin,
        notarizationId: data.notarizationId,
        eventType: "OVERSEER_WITHHELD",
        actorIdNumber: "AI-OVERSEER",
        contractAddress: matter.contract_address,
        payload: { summary: review.summary, findings: review.findings },
      });
      return { verdict: review.verdict, summary: review.summary, findings: review.findings };
    }

    const { data: filer } = await context.supabase
      .from("profiles")
      .select("notary_id_number")
      .eq("id", matter.created_by)
      .single();

    const issuingId = filer?.notary_id_number ?? "PN-UNKNOWN";
    const proofNumber = engine.buildProofNumber(issuingId, matter.verification_code);

    const sealBlock = await engine.appendBlock({
      admin: supabaseAdmin,
      notarizationId: data.notarizationId,
      eventType: "PROOF_OF_SERVICE_ISSUED",
      actorIdNumber: "AI-OVERSEER",
      contractAddress: matter.contract_address,
      payload: {
        proofNumber,
        issuingNotaryIdNumber: issuingId,
        merkleRoot: root,
        summary: review.summary,
      },
    });

    const { error: proofError } = await supabaseAdmin.from("proofs_of_service").insert({
      notarization_id: data.notarizationId,
      proof_number: proofNumber,
      issuing_notary_id_number: issuingId,
      overseer_verdict: review.verdict,
      overseer_summary: review.summary,
      overseer_findings: review.findings as unknown as import("@/integrations/supabase/types").Json,
      merkle_root: root,
      tx_hash: sealBlock.tx_hash,
    });
    if (proofError) throw new Error(proofError.message);

    await supabaseAdmin
      .from("notarizations")
      .update({ status: "sealed", sealed_at: new Date().toISOString() })
      .eq("id", data.notarizationId);

    return {
      verdict: review.verdict,
      summary: review.summary,
      findings: review.findings,
      proofNumber,
    };
  });

/**
 * Public registry lookup. Deliberately unauthenticated and deliberately
 * minimal: it confirms a seal without disclosing parties, titles or documents.
 */
export const verifyByCode = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ code: z.string().trim().min(4).max(24) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const code = data.code.toUpperCase().replace(/[^0-9A-Z]/g, "");

    const { data: matter } = await supabaseAdmin
      .from("notarizations")
      .select(
        "id, status, document_hash, chain_name, contract_address, verification_code, created_at, sealed_at, required_attestations",
      )
      .eq("verification_code", code)
      .maybeSingle();

    if (!matter) return { found: false as const };

    const [{ data: proof }, { count }] = await Promise.all([
      supabaseAdmin
        .from("proofs_of_service")
        .select("proof_number, issuing_notary_id_number, merkle_root, tx_hash, issued_at")
        .eq("notarization_id", matter.id)
        .maybeSingle(),
      supabaseAdmin
        .from("notarization_signers")
        .select("id", { count: "exact", head: true })
        .eq("notarization_id", matter.id)
        .eq("status", "attested"),
    ]);

    return {
      found: true as const,
      status: matter.status,
      documentHash: matter.document_hash,
      chainName: matter.chain_name,
      contractAddress: matter.contract_address,
      verificationCode: matter.verification_code,
      anchoredAt: matter.created_at,
      sealedAt: matter.sealed_at,
      requiredAttestations: matter.required_attestations,
      attestationCount: count ?? 0,
      proof: proof ?? null,
    };
  });
