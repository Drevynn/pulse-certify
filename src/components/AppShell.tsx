import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ExpiryCountBadge } from "@/components/ExpiryAlerts";
import type { ExpiringItem } from "@/lib/clearance";
import { cn } from "@/lib/utils";


const NAV = [
  { to: "/dashboard", label: "Registry" },
  { to: "/credentials", label: "Credentials" },
  { to: "/settings", label: "Alerts" },
  { to: "/verify", label: "Public lookup" },
];


export function AppShell({
  children,
  notaryIdNumber,
  isRegistrar,
  expiring = [],
}: {
  children: React.ReactNode;
  notaryIdNumber?: string | null;
  isRegistrar?: boolean;
  expiring?: ExpiringItem[];
}) {
  const nav = isRegistrar ? [...NAV, { to: "/registrar", label: "Registrar" }] : NAV;

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="no-print sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5">
          <Link to="/" className="flex items-center gap-2.5">
            <PulseGlyph />
            <span className="font-display text-lg leading-none tracking-tight">
              Pulse<span className="text-primary">IP</span>
            </span>
          </Link>

          <nav className="ml-2 hidden items-center gap-1 sm:flex">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground",
                  pathname.startsWith(item.to) && "bg-secondary text-foreground",
                )}
              >
                {item.label}
                {item.to === "/credentials" ? <ExpiryCountBadge expiring={expiring} /> : null}

              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {notaryIdNumber ? (
              <span className="hidden font-mono text-[11px] tracking-[0.14em] text-primary md:inline">
                {notaryIdNumber}
              </span>
            ) : null}
            <Button variant="outline" size="sm" onClick={signOut}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}

export function PulseGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-7 w-7", className)} aria-hidden="true">
      <circle cx="16" cy="16" r="14" fill="none" stroke="var(--brass-dim)" strokeWidth="1.2" />
      <circle cx="16" cy="16" r="11" fill="none" stroke="var(--brass)" strokeWidth="0.6" opacity="0.7" />
      <path
        d="M5 16h5l2.5-6 3.5 12 3-7 2 3h6"
        fill="none"
        stroke="var(--verdigris)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
