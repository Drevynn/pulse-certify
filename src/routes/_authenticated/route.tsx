import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { getMyProfile } from "@/lib/notary.functions";
import { getMyRoles } from "@/lib/registrar.functions";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const fetchProfile = useServerFn(getMyProfile);
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: () => fetchProfile(),
  });

  const fetchRoles = useServerFn(getMyRoles);
  const { data: roleData } = useQuery({ queryKey: ["roles"], queryFn: () => fetchRoles() });
  const isRegistrar = (roleData?.roles ?? []).some((r) => r === "registrar" || r === "admin");

  return (
    <AppShell notaryIdNumber={profile?.notary_id_number} isRegistrar={isRegistrar}>
      <Outlet />
    </AppShell>
  );
}
