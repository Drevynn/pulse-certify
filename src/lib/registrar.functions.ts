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

    return { credentials: credentials ?? [], profiles: profiles ?? [] };
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
