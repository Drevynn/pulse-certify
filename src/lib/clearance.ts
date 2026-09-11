export type ClearanceReason =
  | "profile_missing"
  | "not_certified"
  | "commission_expired"
  | "commission_not_in_state_registry"
  | "no_verified_credential"
  | "credentials_expired";

/** Days before an expiry date at which the registry starts warning. */
export const EXPIRY_WARNING_DAYS = 60;
/** Days before expiry at which the warning escalates to critical. */
export const EXPIRY_CRITICAL_DAYS = 14;

export type ExpiryTone = "expired" | "critical" | "warning" | "ok";

export type ExpiringItem = {
  id: string;
  /** "commission" or a credential kind */
  kind: string;
  label: string;
  expiresOn: string;
  daysLeft: number;
  tone: Exclude<ExpiryTone, "ok">;
};

export type Clearance = {
  cleared: boolean;
  reasons: ClearanceReason[];
  isCertified: boolean;
  commissionState: string | null;
  commissionExpiresOn: string | null;
  /**
   * State-registry cross-check: "unavailable" when the state has not been
   * imported yet, "matched" when an active registry record confirms the
   * commission, "no_match" when the state registry holds records but none
   * confirm this notary.
   */
  registryCheck: "unavailable" | "matched" | "no_match";
  verifiedCredentials: number;
  pendingCredentials: number;
  rejectedCredentials: number;
  /** Commission + verified credential copies at or near their expiry date. */
  expiring: ExpiringItem[];
};

/** Whole days from today until `date` (negative once past). */
export function daysUntil(date: string, today = new Date()): number {
  const target = Date.parse(`${date}T00:00:00Z`);
  const base = Date.parse(`${today.toISOString().slice(0, 10)}T00:00:00Z`);
  return Math.round((target - base) / 86_400_000);
}

export function expiryTone(daysLeft: number): ExpiryTone {
  if (daysLeft < 0) return "expired";
  if (daysLeft <= EXPIRY_CRITICAL_DAYS) return "critical";
  if (daysLeft <= EXPIRY_WARNING_DAYS) return "warning";
  return "ok";
}

export function expiryLabel(daysLeft: number): string {
  if (daysLeft < 0) return `Expired ${Math.abs(daysLeft)}d ago`;
  if (daysLeft === 0) return "Expires today";
  return `Expires in ${daysLeft}d`;
}

export const EXPIRY_TONE_CLASS: Record<Exclude<ExpiryTone, "ok">, string> = {
  expired: "border-destructive/50 text-destructive",
  critical: "border-destructive/40 text-destructive",
  warning: "border-primary/50 text-primary",
};


export const CLEARANCE_MESSAGE: Record<ClearanceReason, string> = {
  profile_missing: "No notary profile is on record for this account.",
  not_certified: "Your commission has not been certified by a registrar yet.",
  commission_expired: "Your commission of record has expired.",
  commission_not_in_state_registry:
    "Your commission could not be confirmed against the state notary registry. File your current commission certificate or contact a registrar.",
  no_verified_credential:
    "No credential copy has been verified by a registrar. File a copy of your commission certificate.",
  credentials_expired: "Every credential copy on file has passed its expiry date.",
};

export const CREDENTIAL_KINDS = [
  { value: "commission_certificate", label: "Commission certificate" },
  { value: "government_id", label: "Government photo ID" },
  { value: "surety_bond", label: "Surety bond" },
  { value: "eo_insurance", label: "E&O insurance" },
  { value: "training_certificate", label: "Training certificate" },
  { value: "other", label: "Other" },
] as const;

export const CREDENTIAL_KIND_LABEL: Record<string, string> = Object.fromEntries(
  CREDENTIAL_KINDS.map((k) => [k.value, k.label]),
);

export function clearanceError(clearance: Clearance): string {
  return `Registry access withheld — ${clearance.reasons
    .map((r) => CLEARANCE_MESSAGE[r])
    .join(" ")}`;
}
