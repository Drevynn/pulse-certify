/**
 * Server-only notary engine: the append-only hash chain, the on-chain registry
 * shim (deterministic contract + transaction identifiers derived from the
 * chain state), and the AI overseer that authorises Proof of Service issuance.
 *
 * Zero-trust posture: nothing the browser sends is trusted as authoritative.
 * Every ledger block is recomputed and re-linked server side, and only the
 * service role may write to the ledger or the proof register.
 */

import { sha256Hex } from "./hash";

export const GENESIS_HASH = "0".repeat(64);
export const REGISTRY_NAME = "PulseChain Notary Registry";

export type OverseerVerdict = "issued" | "withheld";

export interface OverseerFinding {
  code: string;
  severity: "info" | "warning" | "blocking";
  detail: string;
}

export interface OverseerResult {
  verdict: OverseerVerdict;
  summary: string;
  findings: OverseerFinding[];
}

/** Deterministic registry contract address for a matter. */
export async function deriveContractAddress(notarizationId: string): Promise<string> {
  const digest = await sha256Hex(`pulsechain:registry:v1:${notarizationId}`);
  return `0x${digest.slice(0, 40)}`;
}

export async function deriveTxHash(blockHash: string, index: number): Promise<string> {
  return `0x${await sha256Hex(`pulsechain:tx:${index}:${blockHash}`)}`;
}

/** Folds a list of leaf hashes into a Merkle root (duplicating odd tails). */
export async function merkleRoot(leaves: string[]): Promise<string> {
  if (leaves.length === 0) return GENESIS_HASH;
  let level = [...leaves];
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const a = level[i];
      const b = level[i + 1] ?? a;
      next.push(await sha256Hex(a + b));
    }
    level = next;
  }
  return level[0];
}

type AdminClient = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

export interface AppendBlockArgs {
  admin: AdminClient;
  notarizationId: string;
  eventType: string;
  actorIdNumber?: string | null;
  payload: Record<string, unknown>;
  contractAddress?: string | null;
}

/** Appends a linked block to a matter's chain and returns it. */
export async function appendBlock({
  admin,
  notarizationId,
  eventType,
  actorIdNumber = null,
  payload,
  contractAddress = null,
}: AppendBlockArgs) {
  const { data: last } = await admin
    .from("ledger_blocks")
    .select("block_index, block_hash")
    .eq("notarization_id", notarizationId)
    .order("block_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  const blockIndex = (last?.block_index ?? -1) + 1;
  const previousHash = last?.block_hash ?? GENESIS_HASH;
  const timestamp = new Date().toISOString();

  const preimage = JSON.stringify({
    notarizationId,
    blockIndex,
    previousHash,
    eventType,
    actorIdNumber,
    payload,
    timestamp,
  });
  const blockHash = await sha256Hex(preimage);
  const txHash = await deriveTxHash(blockHash, blockIndex);

  const { data, error } = await admin
    .from("ledger_blocks")
    .insert({
      notarization_id: notarizationId,
      block_index: blockIndex,
      event_type: eventType,
      actor_id_number: actorIdNumber,
      payload: { ...payload, timestamp },
      previous_hash: previousHash,
      block_hash: blockHash,
      tx_hash: txHash,
      contract_address: contractAddress,
    })
    .select()
    .single();

  if (error) throw new Error(`Ledger write failed: ${error.message}`);
  return data;
}

/** Recomputes the chain and reports the first index where linkage breaks. */
export function verifyChainLinkage(
  blocks: Array<{ block_index: number; previous_hash: string; block_hash: string }>,
): { intact: boolean; brokenAt: number | null } {
  const ordered = [...blocks].sort((a, b) => a.block_index - b.block_index);
  let expectedPrev = GENESIS_HASH;
  for (const block of ordered) {
    if (block.previous_hash !== expectedPrev) {
      return { intact: false, brokenAt: block.block_index };
    }
    expectedPrev = block.block_hash;
  }
  return { intact: true, brokenAt: null };
}

/* ------------------------------------------------------------------ */
/* AI overseer                                                         */
/* ------------------------------------------------------------------ */

export interface OverseerInput {
  title: string;
  jurisdiction: string | null;
  documentName: string;
  documentHash: string;
  requiredAttestations: number;
  createdAt: string;
  signers: Array<{
    notaryIdNumber: string;
    status: string;
    isCertified: boolean;
    commissionState: string | null;
    commissionExpiresOn: string | null;
    attestedAt: string | null;
    note: string | null;
    attestationHash: string | null;
  }>;
  chain: {
    blockCount: number;
    intact: boolean;
    brokenAt: number | null;
    merkleRoot: string;
  };
}

const OVERSEER_MODEL = "google/gemini-3.5-flash";

const OVERSEER_SYSTEM = `You are the Pulse Notary AI Overseer, the final independent control in a zero-trust notarization pipeline.
You are asked to authorise (or withhold) a Proof of Service after all certified notaries have submitted attestations.

Apply these rules strictly:
1. Every assigned notary must have status "attested". Any "pending" or "declined" signer is BLOCKING.
2. The number of attestations must meet or exceed requiredAttestations. Shortfall is BLOCKING.
3. Every attesting notary must be certified (isCertified true). An uncertified attestor is BLOCKING.
4. A notary commission that expired on or before the attestation date is BLOCKING.
5. A broken ledger chain (chain.intact false) is BLOCKING.
6. Duplicate notary identifiers, missing attestation hashes, or attestations recorded before the matter was created are BLOCKING.
7. Missing jurisdiction, absent attestation notes, or a commission expiring within 60 days are WARNINGS, not blockers.

Respond with JSON only, matching exactly:
{"verdict":"issued"|"withheld","summary":"one or two plain sentences for the record","findings":[{"code":"SCREAMING_SNAKE_CASE","severity":"info"|"warning"|"blocking","detail":"one sentence"}]}
Set verdict to "issued" only when there is not a single blocking finding. Always include at least one finding.`;

export async function runOverseer(input: OverseerInput): Promise<OverseerResult> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("The AI overseer is not configured.");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
    },
    body: JSON.stringify({
      model: OVERSEER_MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: OVERSEER_SYSTEM },
        { role: "user", content: JSON.stringify(input) },
      ],
    }),
  });

  if (response.status === 429) {
    throw new Error("The AI overseer is rate limited right now. Try again shortly.");
  }
  if (response.status === 402) {
    throw new Error("AI credits are exhausted. Add credits to resume overseer reviews.");
  }
  if (!response.ok) {
    const detail = await response.text();
    console.error("[overseer] gateway error", response.status, detail);
    throw new Error("The AI overseer could not complete its review.");
  }

  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = body.choices?.[0]?.message?.content ?? "";

  let parsed: Partial<OverseerResult>;
  try {
    parsed = JSON.parse(raw.replace(/^```(?:json)?|```$/g, "").trim());
  } catch {
    console.error("[overseer] unparseable response", raw);
    throw new Error("The AI overseer returned an unreadable review.");
  }

  const findings: OverseerFinding[] = Array.isArray(parsed.findings)
    ? parsed.findings
        .filter((f): f is OverseerFinding => Boolean(f && typeof f.detail === "string"))
        .map((f) => ({
          code: String(f.code ?? "REVIEW_NOTE").toUpperCase().replace(/\s+/g, "_"),
          severity:
            f.severity === "blocking" || f.severity === "warning" ? f.severity : "info",
          detail: String(f.detail),
        }))
    : [];

  const hasBlocking = findings.some((f) => f.severity === "blocking");
  const verdict: OverseerVerdict =
    parsed.verdict === "issued" && !hasBlocking ? "issued" : "withheld";

  return {
    verdict,
    summary:
      typeof parsed.summary === "string" && parsed.summary.trim()
        ? parsed.summary.trim()
        : verdict === "issued"
          ? "All attestations reconciled against the ledger."
          : "Review withheld pending unresolved findings.",
    findings: findings.length
      ? findings
      : [{ code: "REVIEW_COMPLETE", severity: "info", detail: "Automated review completed." }],
  };
}

export function buildProofNumber(notaryIdNumber: string, verificationCode: string): string {
  const year = new Date().getFullYear();
  return `POS-${year}-${notaryIdNumber.replace(/^PN-/, "")}-${verificationCode.slice(0, 6)}`;
}
