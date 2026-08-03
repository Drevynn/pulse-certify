import type { SupabaseClient } from "@supabase/supabase-js";

export type ClearanceReason =
  | "profile_missing"
  | "not_certified"
  | "commission_expired"
  | "no_verified_credential"
  | "credentials_expired";

export type Clearance = {
  cleared: boolean;
  reasons: ClearanceReason[];
  isCertified: boolean;
  commissionState: string | null;
  commissionExpiresOn: string | null;
  verifiedCredentials: number;
  pendingCredentials: number;
  rejectedCredentials: number;
};

export const CLEARANCE_MESSAGE: Record<ClearanceReason, string> = {
  profile_missing: "No notary profile is on record for this account.",
  not_certified: "Your commission has not been certified by a registrar yet.",
  commission_expired: "Your commission of record has expired.",
  no_verified_credential:
    "No credential copy has been verified by a registrar. File a copy of your commission certificate.",
  credentials_expired: "Every credential copy on file has passed its expiry date.",
};

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
    supabase.from("notary_credentials").select("status, expires_on").eq("user_id", userId),
  ]);

  const rows = credentials ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const verified = rows.filter((r: any) => r.status === "verified");
  const liveVerified = verified.filter((r: any) => !r.expires_on || r.expires_on >= today);

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

  return {
    cleared: reasons.length === 0,
    reasons,
    isCertified: Boolean(profile?.is_certified),
    commissionState: profile?.commission_state ?? null,
    commissionExpiresOn: profile?.commission_expires_on ?? null,
    verifiedCredentials: liveVerified.length,
    pendingCredentials: rows.filter((r: any) => r.status === "pending").length,
    rejectedCredentials: rows.filter((r: any) => r.status === "rejected").length,
  };
}

export function clearanceError(clearance: Clearance): string {
  return `Registry access withheld — ${clearance.reasons
    .map((r) => CLEARANCE_MESSAGE[r])
    .join(" ")}`;
}
