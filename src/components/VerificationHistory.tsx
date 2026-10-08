import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listVerificationHistory } from "@/lib/verification-log.functions";
import { Badge } from "@/components/ui/badge";

const RESULT_LABEL: Record<string, string> = {
  matched: "Confirmed",
  no_match: "Not confirmed",
  unavailable: "No state source",
};

function sourceLabel(s: string) {
  if (s.startsWith("live:")) {
    try {
      return `Live · ${new URL(s.slice(5)).hostname}`;
    } catch {
      return "Live feed";
    }
  }
  return s;
}

export function VerificationHistory({ userId }: { userId?: string }) {
  const fetchLog = useServerFn(listVerificationHistory);
  const [changesOnly, setChangesOnly] = useState(false);
  const { data = [], isLoading } = useQuery({
    queryKey: ["verification-log", userId ?? "me"],
    queryFn: () => fetchLog({ data: { userId } }),
  });
  const rows = changesOnly ? data.filter((r: any) => r.status_changed) : data;

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm">Commission verification history</p>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={changesOnly}
            onChange={(e) => setChangesOnly(e.target.checked)}
          />
          Status changes only
        </label>
      </div>
      {isLoading ? (
        <p className="mt-3 text-xs text-muted-foreground">Loading history…</p>
      ) : rows.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">No verifications recorded yet.</p>
      ) : (
        <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto">
          {rows.map((r: any) => (
            <li key={r.id} className="rounded-md border border-border p-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono">{new Date(r.checked_at).toLocaleString()}</span>
                <div className="flex items-center gap-2">
                  {r.status_changed && (
                    <Badge variant="outline" className="text-primary">
                      Changed from {RESULT_LABEL[r.previous_result] ?? r.previous_result}
                    </Badge>
                  )}
                  <Badge
                    variant="outline"
                    className={r.result === "matched" ? "text-verdigris" : r.result === "no_match" ? "text-destructive" : ""}
                  >
                    {RESULT_LABEL[r.result] ?? r.result}
                  </Badge>
                </div>
              </div>
              <p className="mt-1 text-muted-foreground">
                {r.state} · {sourceLabel(r.source)}
                {r.commission_number ? ` · #${r.commission_number}` : ""}
                {r.registry_status ? ` · ${r.registry_status}` : ""}
                {r.registry_expires_on ? ` · exp ${r.registry_expires_on}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
