import type { SupabaseClient } from "@supabase/supabase-js";
import type { Clearance, ClearanceReason, ExpiringItem } from "./clearance";
import { CREDENTIAL_KIND_LABEL, daysUntil, expiryTone } from "./clearance";
import { lookupLive } from "./state-registry.server";

/** Append-only audit of every commission verification; flags result changes. */
async function logVerification(
  userId: string,
  state: string,
  source: string,
  result: string,
  match: any,
) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prev } = await (supabaseAdmin as any)
      .from("commission_verification_log")
      .select("result")
      .eq("user_id", userId)
      .order("checked_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    await (supabaseAdmin as any).from("commission_verification_log").insert({
      user_id: userId,
      state,
      source,
      result,
      previous_result: prev?.result ?? null,
      status_changed: Boolean(prev && prev.result !== result),
      commission_number: match?.commission_number ?? null,
      registry_status: match?.status ?? null,
      registry_expires_on: match?.expires_on ?? null,
    });
  } catch (e) {
    console.error("verification log failed", e);
  }
}



/**
 * Zero-trust clearance gate. A notary may only operate the registry once a
 * registrar has certified the commission AND at least one unexpired credential
 * copy is verified and retained in the credential vault. Mirrors
 * private.is_cleared_notary() in the database, which enforces the same rule at
 * the row level.
 */
export async function evaluateClearance(
  supabase: SupabaseClient<any, any, any>,
  userId: string,
): Promise<Clearance> {
  const [{ data: profile }, { data: credentials }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, is_certified, commission_state, commission_expires_on")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("notary_credentials")
      .select("id, kind, status, expires_on")
      .eq("user_id", userId),
  ]);

  const rows: any[] = credentials ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const verified = rows.filter((r) => r.status === "verified");
  const liveVerified = verified.filter((r) => !r.expires_on || r.expires_on >= today);

  // Cross-check the commission against the imported state registry. When the
  // state has not been imported yet the check is inert ("unavailable"); once
  // records exist for the state, an unconfirmed commission blocks clearance.
  let registryCheck: Clearance["registryCheck"] = "unavailable";
  let source = "none";
  let matchRow: any = null;
  if (profile?.commission_state && profile.full_name) {
    // Pull fresh records from the live state feed (if one exists) and cache them.
    try {
      const live = await lookupLive(profile.commission_state, profile.full_name);
      if (live) source = live[0]?.source ?? `live:${profile.commission_state}`;
      if (live && live.length > 0) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await (supabaseAdmin as any)
          .from("state_commission_registry")
          .upsert(
            live.map((r) => ({ ...r, synced_at: new Date().toISOString() })),
            { onConflict: "state,commission_number" },
          );
      } else if (live && live.length === 0) {
        // Live feed answered and the notary is absent: treat as unconfirmed.
        registryCheck = "no_match";
      }
    } catch (e) {
      source = "live feed error";
      console.error("live registry lookup failed", e);
    }
  }
  if (profile?.commission_state && registryCheck === "unavailable") {
    const { data: registryRows } = await (supabase as any)
      .from("state_commission_registry")
      .select("commission_number, notary_name, status, expires_on, source")
      .ilike("state", profile.commission_state.trim());
    const registry: any[] = registryRows ?? [];
    if (registry.length > 0) {
      const name = (profile.full_name ?? "").trim().toLowerCase();
      const match = registry.find((r) => {
        const regName = (r.notary_name ?? "").trim().toLowerCase();
        const nameMatches =
          name.length > 0 && (regName.includes(name) || name.includes(regName));
        const expiryMatches =
          profile.commission_expires_on && r.expires_on === profile.commission_expires_on;
        return nameMatches || expiryMatches;
      });
      matchRow = match ?? null;
      if (source === "none") source = match?.source ?? "registry cache";
      const confirmed =
        match && match.status === "active" && (!match.expires_on || match.expires_on >= today);
      registryCheck = confirmed ? "matched" : "no_match";
    }
  }

  if (profile?.commission_state) {
    await logVerification(userId, profile.commission_state, source, registryCheck, matchRow);
  }

  const reasons: ClearanceReason[] = [];
  if (!profile) reasons.push("profile_missing");
  else {
    if (!profile.is_certified) reasons.push("not_certified");
    if (profile.commission_expires_on && profile.commission_expires_on < today) {
      reasons.push("commission_expired");
    }
    if (registryCheck === "no_match") reasons.push("commission_not_in_state_registry");
  }
  if (verified.length === 0) reasons.push("no_verified_credential");
  else if (liveVerified.length === 0) reasons.push("credentials_expired");

  // Anything expired or inside the widest configurable window (365d) is
  // surfaced; the UI re-tones and filters against the notary's own thresholds.
  const expiring: ExpiringItem[] = [];
  const consider = (id: string, kind: string, label: string, expiresOn?: string | null) => {
    if (!expiresOn) return;
    const daysLeft = daysUntil(expiresOn);
    if (daysLeft > 365) return;
    const tone = expiryTone(daysLeft);
    expiring.push({ id, kind, label, expiresOn, daysLeft, tone: tone === "ok" ? "warning" : tone });
  };


  consider("commission", "commission", "Commission of record", profile?.commission_expires_on);
  for (const row of verified) {
    consider(
      row.id,
      row.kind,
      CREDENTIAL_KIND_LABEL[row.kind] ?? row.kind,
      row.expires_on,
    );
  }
  expiring.sort((a, b) => a.daysLeft - b.daysLeft);

  return {
    cleared: reasons.length === 0,
    reasons,
    isCertified: Boolean(profile?.is_certified),
    commissionState: profile?.commission_state ?? null,
    commissionExpiresOn: profile?.commission_expires_on ?? null,
    registryCheck,
    verifiedCredentials: liveVerified.length,
    pendingCredentials: rows.filter((r) => r.status === "pending").length,
    rejectedCredentials: rows.filter((r) => r.status === "rejected").length,
    expiring,
  };

}
