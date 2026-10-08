CREATE TABLE public.commission_verification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  state text NOT NULL,
  source text NOT NULL,
  result text NOT NULL,
  previous_result text,
  status_changed boolean NOT NULL DEFAULT false,
  commission_number text,
  registry_status text,
  registry_expires_on date,
  checked_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX commission_verification_log_user_idx ON public.commission_verification_log (user_id, checked_at DESC);
GRANT SELECT ON public.commission_verification_log TO authenticated;
GRANT ALL ON public.commission_verification_log TO service_role;
ALTER TABLE public.commission_verification_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY verification_log_select_own_or_registrar ON public.commission_verification_log
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'registrar') OR private.has_role(auth.uid(), 'admin'));