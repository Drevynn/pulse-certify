/**
 * The three standing mandates of the Pulse IP AI Overseer.
 * Browser-safe: shared by the server engine and the UI.
 */

export type OverseerMandate =
  | "signature_legality"
  | "request_clarity"
  | "credential_validity";

export type MandateVerdict = "cleared" | "flagged" | "failed";

export const OVERSEER_MANDATES: Array<{
  key: OverseerMandate;
  ordinal: string;
  label: string;
  charge: string;
}> = [
  {
    key: "signature_legality",
    ordinal: "I",
    label: "Legality of signature",
    charge:
      "Oversees that every notarial signature was lawfully executed, properly sequenced and cryptographically bound to the document digest.",
  },
  {
    key: "request_clarity",
    ordinal: "II",
    label: "Clarity of the clearance request",
    charge:
      "Oversees that the client's clearance request is complete and unambiguous, with no confusion as to which notary acts or in what capacity.",
  },
  {
    key: "credential_validity",
    ordinal: "III",
    label: "Validity of credentials",
    charge:
      "Double-checks the credentials of every notary so the finished contract and its signatures are valid at the moment of issuance.",
  },
];
