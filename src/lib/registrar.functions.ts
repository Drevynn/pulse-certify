import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertRegistrar(context: any) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  const roles = (data ?? []).map((r: any) => r.role);
  if (!roles.includes("registrar") && !roles.includes("admin")) {
    throw new Error("Registrar authority required.");
  }
  return roles as string[];
}

export const getMyRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    return { roles: (data ?? []).map((r: any) => r.role as string) };
  });

export const listCredentialQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertRegistrar(context);
    const { data: credentials, error } = await context.supabase
      .from("notary_credentials")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const userIds = [...new Set((credentials ?? []).map((c) => c.user_id))];
    const { data: profiles } = userIds.length
      ? await context.supabase
          .from("profiles")
          .select("id, full_name, notary_id_number, is_certified, commission_state, commission_expires_on")
          .in("id", userIds)
      : { data: [] };

    const registry = await registryStatusForProfiles(context.supabase, profiles ?? []);

    return { credentials: credentials ?? [], profiles: profiles ?? [], registry };
  });

export type RegistryStatus = {
  state: string;
  totalInState: number;
  match: {
    commissionNumber: string;
    notaryName: string;
    status: string;
    expiresOn: string | null;
  } | null;
  confirmed: boolean;
};

/** Cross-check each profile's commission against the imported state registry. */
async function registryStatusForProfiles(
  supabase: any,
  profiles: any[],
): Promise<Record<string, RegistryStatus>> {
  const states = [...new Set(profiles.map((p) => p.commission_state?.trim()).filter(Boolean))];
  const result: Record<string, RegistryStatus> = {};
  if (states.length === 0) return result;

  const { data: rows } = await supabase
    .from("state_commission_registry")
    .select("state, commission_number, notary_name, status, expires_on")
    .in("state", states as string[]);
  const registry: any[] = rows ?? [];
  const today = new Date().toISOString().slice(0, 10);

  for (const p of profiles) {
    const state = p.commission_state?.trim();
    if (!state) continue;
    const inState = registry.filter((r) => r.state.toLowerCase() === state.toLowerCase());
    const name = (p.full_name ?? "").trim().toLowerCase();
    const match = inState.find((r) => {
      const regName = (r.notary_name ?? "").trim().toLowerCase();
      const nameMatches =
        name.length > 0 && (regName.includes(name) || name.includes(regName));
      const expiryMatches = p.commission_expires_on && r.expires_on === p.commission_expires_on;
      return nameMatches || expiryMatches;
    });
    result[p.id] = {
      state,
      totalInState: inState.length,
      match: match
        ? {
            commissionNumber: match.commission_number,
            notaryName: match.notary_name,
            status: match.status,
            expiresOn: match.expires_on,
          }
        : null,
      confirmed: Boolean(
        match && match.status === "active" && (!match.expires_on || match.expires_on >= today),
      ),
    };
  }
  return result;
}

const registryRowSchema = z.object({
  state: z.string().trim().min(2).max(80),
  commissionNumber: z.string().trim().min(1).max(80),
  notaryName: z.string().trim().min(1).max(200),
  status: z.enum(["active", "expired", "suspended", "revoked"]),
  expiresOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  source: z.string().trim().max(200).optional().nullable(),
});

export const importStateRegistry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ rows: z.array(registryRowSchema).min(1).max(2000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertRegistrar(context);
    const records = data.rows.map((r) => ({
      state: r.state,
      commission_number: r.commissionNumber,
      notary_name: r.notaryName,
      status: r.status,
      expires_on: r.expiresOn || null,
      source: r.source || null,
      synced_at: new Date().toISOString(),
    }));
    const { error } = await (context.supabase as any)
      .from("state_commission_registry")
      .upsert(records, { onConflict: "state,commission_number" });
    if (error) throw new Error(error.message);
    return { ok: true, imported: records.length };
  });

export const reviewCredential = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        decision: z.enum(["verified", "rejected"]),
        note: z.string().trim().max(600).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertRegistrar(context);
    const { error } = await context.supabase
      .from("notary_credentials")
      .update({ status: data.decision, review_note: data.note || null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setCommission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        notaryUserId: z.string().uuid(),
        isCertified: z.boolean(),
        commissionState: z.string().trim().max(80).optional().nullable(),
        commissionExpiresOn: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertRegistrar(context);
    const { error } = await context.supabase
      .from("profiles")
      .update({
        is_certified: data.isCertified,
        commission_state: data.commissionState || null,
        commission_expires_on: data.commissionExpiresOn || null,
      })
      .eq("id", data.notaryUserId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
