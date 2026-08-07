import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  EXPIRY_TONE_CLASS,
  daysUntil,
  expiryLabel,
  type Clearance,
  type ExpiringItem,
} from "@/lib/clearance";
import {
  applyExpirySettings,
  toneWithSettings,
  useExpirySettings,
} from "@/lib/expiry-settings";
import { cn } from "@/lib/utils";

/** Badge for a single dated credential / commission. Renders nothing when far from expiry. */
export function ExpiryBadge({
  expiresOn,
  kind = "commission",
  className,
}: {
  expiresOn?: string | null;
  /** "commission" or a credential kind — selects the configured threshold. */
  kind?: string;
  className?: string;
}) {
  const { settings } = useExpirySettings();
  if (!expiresOn) return null;
  const daysLeft = daysUntil(expiresOn);
  const tone = toneWithSettings(daysLeft, settings, kind);
  if (tone === "ok") return null;
  return (
    <Badge variant="outline" className={cn(EXPIRY_TONE_CLASS[tone], className)}>
      {expiryLabel(daysLeft)}
    </Badge>
  );
}

/** Compact roll-up badge, e.g. next to the Credentials nav item. */
export function ExpiryCountBadge({ expiring }: { expiring: ExpiringItem[] }) {
  const { settings } = useExpirySettings();
  const items = useMemo(() => applyExpirySettings(expiring, settings), [expiring, settings]);
  if (items.length === 0) return null;
  const worst = items[0]!;
  return (
    <span
      className={cn(
        "ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full border px-1 text-[10px] leading-none",
        EXPIRY_TONE_CLASS[worst.tone],
      )}
      title={`${worst.label} — ${expiryLabel(worst.daysLeft)}`}
    >
      {items.length}
    </span>
  );
}


/**
 * Raises a toast alert once per browser session for each credential or
 * commission that is expired or inside the renewal window.
 */
export function useExpiryAlerts(clearance?: Clearance | null) {
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    const items = clearance?.expiring ?? [];
    for (const item of items) {
      const key = `pulseip.expiry.${item.id}.${item.expiresOn}`;
      if (seen.current.has(key)) continue;
      seen.current.add(key);
      if (typeof window !== "undefined") {
        if (window.sessionStorage.getItem(key)) continue;
        window.sessionStorage.setItem(key, "1");
      }
      const body = `${item.label} · ${expiryLabel(item.daysLeft)} (${item.expiresOn})`;
      if (item.tone === "warning") {
        toast.warning("Credential renewal due", { description: body, duration: 8000 });
      } else {
        toast.error(
          item.tone === "expired" ? "Credential expired" : "Credential expiring imminently",
          { description: body, duration: 10000 },
        );
      }
    }
  }, [clearance]);
}

/** Standing banner listing everything expired or nearing expiry. */
export function ExpiryNotices({
  expiring,
  className,
}: {
  expiring: ExpiringItem[];
  className?: string;
}) {
  if (expiring.length === 0) return null;
  const critical = expiring.some((e) => e.tone !== "warning");
  return (
    <section
      className={cn(
        "rounded-lg border p-5",
        critical ? "border-destructive/40 bg-destructive/5" : "border-primary/40 bg-primary/5",
        className,
      )}
    >
      <p className="text-sm">
        {critical ? "Action required — credentials lapsed or lapsing" : "Renewals coming due"}
      </p>
      <ul className="mt-3 space-y-1.5">
        {expiring.map((item) => (
          <li key={`${item.id}-${item.expiresOn}`} className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">{item.label}</span>
            <Badge variant="outline" className={EXPIRY_TONE_CLASS[item.tone]}>
              {expiryLabel(item.daysLeft)}
            </Badge>
            <span className="font-mono text-[10px] text-muted-foreground">{item.expiresOn}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] text-muted-foreground">
        Registry access is withheld the moment a commission or every verified copy lapses. File
        a fresh copy in the credential vault before that date.
      </p>
    </section>
  );
}
