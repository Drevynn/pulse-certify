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
