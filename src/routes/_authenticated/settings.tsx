import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_EXPIRY_SETTINGS,
  MAX_THRESHOLD_DAYS,
  THRESHOLD_SCOPES,
  useExpirySettings,
  type ExpirySettings,
} from "@/lib/expiry-settings";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Alert Settings — Pulse IP" },
      {
        name: "description",
        content:
          "Configure the warning and critical renewal windows for your commission and each credential type.",
      },
      { property: "og:title", content: "Alert Settings — Pulse IP" },
      {
        property: "og:description",
        content: "Tune expiry warning and critical thresholds per credential type.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage;
});

function SettingsPage() {
  const { settings, save, reset } = useExpirySettings();
  const [draft, setDraft] = useState<ExpirySettings>(settings);

  useEffect(() => setDraft(settings), [settings]);

  function set(scope: string, field: "warning" | "critical", value: string) {
    const n = Number(value);
    setDraft((d) => ({
      ...d,
      [scope]: { ...d[scope]!, [field]: Number.isFinite(n) ? n : 0 },
    }));
  }

  const invalid = THRESHOLD_SCOPES.some((s) => {
    const t = draft[s.value];
    return !t || t.critical > t.warning;
  });

  return (
    <main className="mx-auto max-w-4xl px-5 py-12">
      <p className="eyebrow">Renewal surveillance</p>
      <h1 className="mt-2 text-4xl">Alert settings</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Set how far ahead the registry warns you before a commission or credential copy lapses.
        The warning window opens the amber notice; the critical window escalates it to red.
        Thresholds apply to your badges, banners and session alerts on this device.
      </p>

      <form
        className="mt-8 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (invalid) {
            toast.error("Critical days cannot exceed warning days.");
            return;
          }
          save(draft);
          toast.success("Alert thresholds saved");
        }}
      >
        <div className="hidden gap-4 px-5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground sm:grid sm:grid-cols-[1fr_120px_120px]">
          <span>Scope</span>
          <span>Warning (days)</span>
          <span>Critical (days)</span>
        </div>

        {THRESHOLD_SCOPES.map((scope) => {
          const t = draft[scope.value] ?? DEFAULT_EXPIRY_SETTINGS[scope.value]!;
          const bad = t.critical > t.warning;
          return (
            <div
              key={scope.value}
              className="vault-panel grid gap-3 p-5 sm:grid-cols-[1fr_120px_120px] sm:items-center"
            >
              <div>
                <p className="text-sm">{scope.label}</p>
                {bad ? (
                  <p className="mt-1 text-[11px] text-destructive">
                    Critical must be at or below the warning window.
                  </p>
                ) : null}
              </div>
              <div className="space-y-1">
                <Label className="sm:hidden" htmlFor={`${scope.value}-warning`}>
                  Warning (days)
                </Label>
                <Input
                  id={`${scope.value}-warning`}
                  type="number"
                  min={0}
                  max={MAX_THRESHOLD_DAYS}
                  value={t.warning}
                  onChange={(e) => set(scope.value, "warning", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="sm:hidden" htmlFor={`${scope.value}-critical`}>
                  Critical (days)
                </Label>
                <Input
                  id={`${scope.value}-critical`}
                  type="number"
                  min={0}
                  max={MAX_THRESHOLD_DAYS}
                  value={t.critical}
                  onChange={(e) => set(scope.value, "critical", e.target.value)}
                />
              </div>
            </div>
          );
        })}

        <div className="flex flex-wrap gap-2 pt-2">
          <Button type="submit" disabled={invalid}>
            Save thresholds
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              reset();
              toast.success("Thresholds restored to registry defaults");
            }}
          >
            Restore defaults
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Defaults: 60 day warning, 14 day critical. Maximum {MAX_THRESHOLD_DAYS} days.
          Thresholds change alerting only — registry access still lapses on the expiry date
          itself.
        </p>
      </form>
    </main>
  );
}
