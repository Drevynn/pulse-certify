/**
 * End-to-end rehearsal of the Pulse IP pipeline with an in-memory backend:
 * sign-up -> registrar certification -> clearance -> matter filing ->
 * co-signer attestation -> AI overseer -> sealed Proof of Service.
 * No real notarization, state registry, or AI call is made.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, any>;
const db: Record<string, Row[]> = {};

function query(table: string) {
  const filters: Array<(r: Row) => boolean> = [];
  let order: { col: string; asc: boolean } | null = null;
  let limit = Infinity;
  let pendingInsert: Row[] | null = null;
  const rows = () => {
    let out = (db[table] ??= []).filter((r) => filters.every((f) => f(r)));
    if (order) {
      const { col, asc } = order;
      out = [...out].sort((a, b) => (a[col] > b[col] ? 1 : -1) * (asc ? 1 : -1));
    }
    return out.slice(0, limit);
  };
  const result = () => ({ data: pendingInsert ?? rows(), error: null });
  const b: any = {
    select: () => b,
    eq: (c: string, v: any) => (filters.push((r) => r[c] === v), b),
    ilike: (c: string, v: string) =>
      (filters.push((r) => String(r[c]).toLowerCase() === v.toLowerCase()), b),
    order: (col: string, o?: { ascending?: boolean }) =>
      ((order = { col, asc: o?.ascending !== false }), b),
    limit: (n: number) => ((limit = n), b),
    insert: (v: Row | Row[]) => {
      pendingInsert = (Array.isArray(v) ? v : [v]).map((r) => ({
        checked_at: new Date().toISOString(),
        ...r,
      }));
      (db[table] ??= []).push(...pendingInsert);
      return b;
    },
    upsert: (v: Row[]) => ((db[table] ??= []).push(...v), b),
    maybeSingle: async () => ({ data: result().data[0] ?? null, error: null }),
    single: async () => ({ data: result().data[0], error: null }),
    then: (res: any, rej: any) => Promise.resolve(result()).then(res, rej),
  };
  return b;
}
const fakeClient: any = { from: query };

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: fakeClient }));
vi.mock("./state-registry.server", () => ({ lookupLive: vi.fn(async () => null) }));

const { evaluateClearance } = await import("./clearance.server");
const {
  appendBlock,
  verifyChainLinkage,
  merkleRoot,
  deriveContractAddress,
  runOverseer,
  buildProofNumber,
} = await import("./notary.server");
const { sha256Hex } = await import("./hash");

const NOTARY = "u-notary";
const COSIGNER = "u-cosigner";
const FUTURE = "2099-01-01";

function signUp(id: string, name: string, idNumber: string) {
  db.profiles.push({
    id,
    full_name: name,
    notary_id_number: idNumber,
    is_certified: false,
    commission_state: "ZZ",
    commission_expires_on: null,
  });
}

function registrarCertify(id: string) {
  const p = db.profiles.find((r) => r.id === id)!;
  Object.assign(p, { is_certified: true, commission_expires_on: FUTURE });
  db.notary_credentials.push({
    id: `cred-${id}`,
    user_id: id,
    kind: "commission_certificate",
    status: "verified",
    expires_on: FUTURE,
  });
}

function mockOverseer(verdict: "issued" | "withheld", blocking = false) {
  const findings = ["signature_legality", "request_clarity", "credential_validity"].map((m) => ({
    mandate: m,
    code: blocking && m === "signature_legality" ? "SIGNER_PENDING" : "OK",
    severity: blocking && m === "signature_legality" ? "blocking" : "info",
    detail: "Test finding.",
  }));
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ verdict, summary: "Test.", findings }) } }],
        }),
      ),
    ),
  );
}

beforeEach(() => {
  for (const k of Object.keys(db)) delete db[k];
  db.profiles = [];
  db.notary_credentials = [];
  process.env.LOVABLE_API_KEY = "test";
});

describe("Pulse IP end-to-end flow", () => {
  it("blocks a freshly signed-up notary until a registrar certifies them", async () => {
    signUp(NOTARY, "Ada Test", "PN-26-000001");
    const before = await evaluateClearance(fakeClient, NOTARY);
    expect(before.cleared).toBe(false);
    expect(before.reasons).toEqual(["not_certified", "no_verified_credential"]);

    registrarCertify(NOTARY);
    const after = await evaluateClearance(fakeClient, NOTARY);
    expect(after.cleared).toBe(true);
  });

  it("files, signs, reviews and seals a matter into a Proof of Service", async () => {
    signUp(NOTARY, "Ada Test", "PN-26-000001");
    signUp(COSIGNER, "Bo Test", "PN-26-000002");
    registrarCertify(NOTARY);
    registrarCertify(COSIGNER);
    for (const id of [NOTARY, COSIGNER]) {
      expect((await evaluateClearance(fakeClient, id)).cleared).toBe(true);
    }

    // Filing
    const matterId = "matter-1";
    const documentHash = await sha256Hex("sample deed (test only)");
    const contract = await deriveContractAddress(matterId);
    expect(contract).toMatch(/^0x[0-9a-f]{40}$/);
    await appendBlock({ admin: fakeClient, notarizationId: matterId, eventType: "filed", actorIdNumber: "PN-26-000001", payload: { documentHash }, contractAddress: contract });

    // Signing
    const attestationHash = await sha256Hex(`${documentHash}:PN-26-000002`);
    await appendBlock({ admin: fakeClient, notarizationId: matterId, eventType: "attested", actorIdNumber: "PN-26-000002", payload: { attestationHash } });

    const chain = db.ledger_blocks.filter((b) => b.notarization_id === matterId);
    expect(chain).toHaveLength(2);
    expect(verifyChainLinkage(chain)).toEqual({ intact: true, brokenAt: null });
    const root = await merkleRoot(chain.map((b) => b.block_hash));
    expect(root).toMatch(/^[0-9a-f]{64}$/);

    // Overseer + issuance
    mockOverseer("issued");
    const review = await runOverseer({
      title: "Test deed",
      jurisdiction: "ZZ",
      matterReference: "T-1",
      documentName: "deed.pdf",
      documentHash,
      requiredAttestations: 1,
      createdAt: new Date().toISOString(),
      filingNotary: { notaryIdNumber: "PN-26-000001", fullName: "Ada Test", isCertified: true, commissionState: "ZZ", commissionExpiresOn: FUTURE },
      signers: [{ notaryIdNumber: "PN-26-000002", fullName: "Bo Test", status: "attested", isCertified: true, commissionState: "ZZ", commissionExpiresOn: FUTURE, attestedAt: new Date().toISOString(), note: "Witnessed", attestationHash, onPanelOf: matterId }],
      chain: { blockCount: 2, intact: true, brokenAt: null, merkleRoot: root },
    });
    expect(review.verdict).toBe("issued");
    expect(Object.values(review.mandates)).toEqual(["cleared", "cleared", "cleared"]);

    const proof = buildProofNumber("PN-26-000001", "abcdef123");
    expect(proof).toBe(`POS-${new Date().getFullYear()}-26-000001-abcdef`);
  });

  it("withholds the Proof of Service when the overseer finds a blocking issue", async () => {
    mockOverseer("issued", true);
    const review = await runOverseer({
      title: "Test", jurisdiction: "ZZ", matterReference: null, documentName: "d.pdf",
      documentHash: "0".repeat(64), requiredAttestations: 1, createdAt: new Date().toISOString(),
      filingNotary: { notaryIdNumber: "PN-26-000001", fullName: "Ada", isCertified: true, commissionState: "ZZ", commissionExpiresOn: FUTURE },
      signers: [], chain: { blockCount: 1, intact: true, brokenAt: null, merkleRoot: "0".repeat(64) },
    });
    expect(review.verdict).toBe("withheld");
    expect(review.mandates.signature_legality).toBe("failed");
  });

  it("detects a tampered ledger", () => {
    const blocks = [
      { block_index: 0, previous_hash: "0".repeat(64), block_hash: "a" },
      { block_index: 1, previous_hash: "forged", block_hash: "b" },
    ];
    expect(verifyChainLinkage(blocks)).toEqual({ intact: false, brokenAt: 1 });
  });
});
