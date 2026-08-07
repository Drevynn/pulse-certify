import { useCallback, useSyncExternalStore } from "react";
import {
  CREDENTIAL_KINDS,
  EXPIRY_CRITICAL_DAYS,
  EXPIRY_WARNING_DAYS,
  type ExpiringItem,
  type ExpiryTone,
} from "./clearance";

export type ThresholdScope = "commission" | (typeof CREDENTIAL_KINDS)[number]["value"];

export type Threshold = { warning: number; critical: number };
export type ExpirySettings = Record<string, Threshold>;

export const THRESHOLD_SCOPES: { value: ThresholdScope; label: string }[] = [
  { value: "commission", label: "Commission of record" },
  ...CREDENTIAL_KINDS.map((k) => ({ value: k.value as ThresholdScope, label: k.label })),
];

export const MAX_THRESHOLD_DAYS = 365;

export const DEFAULT_EXPIRY_SETTINGS: ExpirySettings = Object.fromEntries(
  THRESHOLD_SCOPES.map((s) => [
    s.value,
    { warning: EXPIRY_WARNING_DAYS, critical: EXPIRY_CRITICAL_DAYS },
  ]),
);

const STORAGE_KEY = "pulseip.expiry-thresholds";

function clampDays(value: unknown, fallback: number): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(MAX_THRESHOLD_DAYS, Math.max(0, n));
}

function normalize(raw: unknown): ExpirySettings {
  const out: ExpirySettings = { ...DEFAULT_EXPIRY_SETTINGS };
  if (!raw || typeof raw !== "object") return out;
  for (const scope of THRESHOLD_SCOPES) {
    const entry = (raw as Record<string, unknown>)[scope.value];
    if (!entry || typeof entry !== "object") continue;
    const fallback = DEFAULT_EXPIRY_SETTINGS[scope.value]!;
    const warning = clampDays((entry as Threshold).warning, fallback.warning);
    const critical = Math.min(warning, clampDays((entry as Threshold).critical, fallback.critical));
    out[scope.value] = { warning, critical };
  }
  return out;
}

let cache: ExpirySettings = DEFAULT_EXPIRY_SETTINGS;
const listeners = new Set<() => void>();

function read(): ExpirySettings {
  if (typeof window === "undefined") return DEFAULT_EXPIRY_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return normalize(raw ? JSON.parse(raw) : null);
  } catch {
    return DEFAULT_EXPIRY_SETTINGS;
  }
}

if (typeof window !== "undefined") {
  cache = read();
  window.addEventListener("storage", (e) => {
    if (e.key !== STORAGE_KEY) return;
    cache = read();
    listeners.forEach((l) => l());
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function saveExpirySettings(next: ExpirySettings) {
  cache = normalize(next);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  }
  listeners.forEach((l) => l());
}

export function resetExpirySettings() {
  saveExpirySettings(DEFAULT_EXPIRY_SETTINGS);
}

/** Reactive access to the notary's configured renewal windows. */
export function useExpirySettings() {
  const settings = useSyncExternalStore(
    subscribe,
    () => cache,
    () => DEFAULT_EXPIRY_SETTINGS,
  );
  const save = useCallback((next: ExpirySettings) => saveExpirySettings(next), []);
  return { settings, save, reset: resetExpirySettings };
}

export function thresholdFor(settings: ExpirySettings, kind?: string | null): Threshold {
  return (
    (kind ? settings[kind] : undefined) ??
    DEFAULT_EXPIRY_SETTINGS[kind ?? "commission"] ?? {
      warning: EXPIRY_WARNING_DAYS,
      critical: EXPIRY_CRITICAL_DAYS,
    }
  );
}

/** Tone for a given scope using the configured thresholds. */
export function toneWithSettings(
  daysLeft: number,
  settings: ExpirySettings,
  kind?: string | null,
): ExpiryTone {
  const { warning, critical } = thresholdFor(settings, kind);
  if (daysLeft < 0) return "expired";
  if (daysLeft <= critical) return "critical";
  if (daysLeft <= warning) return "warning";
  return "ok";
}

/** Re-tone + filter server-supplied items against the configured thresholds. */
export function applyExpirySettings(
  items: ExpiringItem[],
  settings: ExpirySettings,
): ExpiringItem[] {
  return items
    .map((item) => ({ item, tone: toneWithSettings(item.daysLeft, settings, item.kind) }))
    .filter((e) => e.tone !== "ok")
    .map(({ item, tone }) => ({ ...item, tone: tone as ExpiringItem["tone"] }))
    .sort((a, b) => a.daysLeft - b.daysLeft);
}
