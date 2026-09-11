CREATE TABLE public.state_commission_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state text NOT NULL,
  commission_number text NOT NULL,
  notary_name text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  expires_on date,
  source text,
  synced_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (state, commission_number)
);

GRANT SELECT ON public.state_commission_registry TO authenticated;
GRANT ALL ON public.state_commission_registry TO service_role;

ALTER TABLE public.state_commission_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read the state registry"
ON public.state_commission_registry
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Registrars can import state registry records"
ON public.state_commission_registry
FOR INSERT TO authenticated
WITH CHECK (private.has_role(auth.uid(), 'registrar') OR private.has_role(auth.uid(), 'admin'));

CREATE POLICY "Registrars can update state registry records"
ON public.state_commission_registry
FOR UPDATE TO authenticated
USING (private.has_role(auth.uid(), 'registrar') OR private.has_role(auth.uid(), 'admin'))
WITH CHECK (private.has_role(auth.uid(), 'registrar') OR private.has_role(auth.uid(), 'admin'));

CREATE POLICY "Registrars can delete state registry records"
ON public.state_commission_registry
FOR DELETE TO authenticated
USING (private.has_role(auth.uid(), 'registrar') OR private.has_role(auth.uid(), 'admin'));