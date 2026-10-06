/**
 * Live state notary registry feeds. Queries official state open-data portals
 * (Socrata SODA API) at clearance time and caches confirmed records in
 * state_commission_registry, so commissions validate automatically.
 */
export type LiveRecord = {
  state: string;
  commission_number: string;
  notary_name: string;
  status: "active" | "expired";
  expires_on: string | null;
  source: string;
};

type Feed = {
  url: string;
  nameWhere: (lastUpper: string) => string;
  map: (r: any) => { number: string; name: string; expires: string | null };
};

const iso = (v?: string | null) => (v ? v.slice(0, 10) : null);
const mdy = (v?: string | null) => {
  const m = v?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[1]}-${m[2]}` : null;
};
const like = (field: string, v: string) => `upper(${field}) like '%${v}%'`;

const FEEDS: Record<string, Feed> = {
  NY: {
    url: "https://data.ny.gov/resource/rwbv-mz6z.json",
    nameWhere: (l) => like("commission_holder_name", l),
    map: (r) => ({ number: r.commission_number_uid, name: r.commission_holder_name, expires: iso(r.term_expiration_date) }),
  },
  TX: {
    url: "https://data.texas.gov/resource/gmd3-bnrd.json",
    nameWhere: (l) => like("last_name", l),
    map: (r) => ({ number: r.notary_id, name: `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim(), expires: mdy(r.expire_date) }),
  },
  CO: {
    url: "https://data.colorado.gov/resource/k4uv-yvnk.json",
    nameWhere: (l) => like("lastname", l),
    map: (r) => ({ number: r.notaryid, name: [r.firstname, r.middlename, r.lastname].filter(Boolean).join(" "), expires: iso(r.commissionexpire) }),
  },
  OR: {
    url: "https://data.oregon.gov/resource/m934-wp3t.json",
    nameWhere: (l) => like("name_as_shown_on_your_notary", l),
    map: (r) => ({ number: r.notary_commission_number, name: r.name_as_shown_on_your_notary, expires: iso(r.notary_commission_expiration) }),
  },
  DE: {
    url: "https://data.delaware.gov/resource/q8dr-mj6p.json",
    nameWhere: (l) => like("full_name", l),
    map: (r) => ({ number: r.commission_number, name: r.full_name, expires: iso(r.expiration) }),
  },
};

const ALIASES: Record<string, string> = {
  "NEW YORK": "NY", TEXAS: "TX", COLORADO: "CO", OREGON: "OR", DELAWARE: "DE",
};

export function feedCode(state?: string | null): string | null {
  const s = (state ?? "").trim().toUpperCase();
  if (FEEDS[s]) return s;
  return ALIASES[s] ?? null;
}

export const LIVE_FEED_STATES = Object.keys(FEEDS);

/** Look up a notary by name in the live state feed. Returns null if no feed. */
export async function lookupLive(state: string, fullName: string): Promise<LiveRecord[] | null> {
  const code = feedCode(state);
  if (!code) return null;
  const feed = FEEDS[code]!;
  const parts = fullName.toUpperCase().replace(/[^A-Z\s'-]/g, "").trim().split(/\s+/);
  const last = parts[parts.length - 1];
  if (!last) return [];
  const first = parts[0]!;
  const params = new URLSearchParams({
    $where: feed.nameWhere(last.replace(/'/g, "''")),
    $limit: "200",
  });
  const res = await fetch(`${feed.url}?${params}`, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`State feed ${code} returned ${res.status}`);
  const rows: any[] = await res.json();
  const today = new Date().toISOString().slice(0, 10);
  return rows
    .map(feed.map)
    .filter((r) => r.number && r.name && r.name.toUpperCase().includes(first))
    .map((r) => ({
      state: state.trim(),
      commission_number: String(r.number),
      notary_name: r.name,
      status: r.expires && r.expires < today ? "expired" : "active",
      expires_on: r.expires,
      source: `live:${feed.url}`,
    }));
}
