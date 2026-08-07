import type { SupabaseClient } from "@supabase/supabase-js";
import type { Clearance, ClearanceReason, ExpiringItem } from "./clearance";
import { CREDENTIAL_KIND_LABEL, daysUntil, expiryTone } from "./clearance";



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
      .select("is_certified, commission_state, commission_expires_on")
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

  const reasons: ClearanceReason[] = [];
  if (!profile) reasons.push("profile_missing");
  else {
    if (!profile.is_certified) reasons.push("not_certified");
    if (profile.commission_expires_on && profile.commission_expires_on < today) {
      reasons.push("commission_expired");
    }
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
    verifiedCredentials: liveVerified.length,
    pendingCredentials: rows.filter((r) => r.status === "pending").length,
    rejectedCredentials: rows.filter((r) => r.status === "rejected").length,
    expiring,
  };

}
