CREATE TYPE public.credential_kind AS ENUM ('commission_certificate','government_id','surety_bond','eo_insurance','training_certificate','other');
CREATE TYPE public.credential_status AS ENUM ('pending','verified','rejected');

CREATE TABLE public.notary_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind public.credential_kind NOT NULL,
  document_name text NOT NULL,
  storage_path text NOT NULL,
  file_hash text NOT NULL,
  file_bytes bigint,
  issuing_authority text,
  credential_number text,
  issued_on date,
  expires_on date,
  status public.credential_status NOT NULL DEFAULT 'pending',
  review_note text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notary_credentials_user_idx ON public.notary_credentials(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notary_credentials TO authenticated;
GRANT ALL ON public.notary_credentials TO service_role;

ALTER TABLE public.notary_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY credentials_select_own_or_registrar ON public.notary_credentials
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(),'registrar') OR private.has_role(auth.uid(),'admin'));

CREATE POLICY credentials_insert_own ON public.notary_credentials
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending');

CREATE POLICY credentials_delete_own_pending ON public.notary_credentials
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND status = 'pending');

CREATE POLICY credentials_update_registrar ON public.notary_credentials
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(),'registrar') OR private.has_role(auth.uid(),'admin'))
  WITH CHECK (private.has_role(auth.uid(),'registrar') OR private.has_role(auth.uid(),'admin'));

CREATE TRIGGER notary_credentials_touch BEFORE UPDATE ON public.notary_credentials
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.stamp_credential_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.reviewed_by := auth.uid();
    NEW.reviewed_at := now();
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER notary_credentials_review BEFORE UPDATE ON public.notary_credentials
  FOR EACH ROW EXECUTE FUNCTION public.stamp_credential_review();

CREATE OR REPLACE FUNCTION private.is_cleared_notary(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _user_id
      AND p.is_certified
      AND (p.commission_expires_on IS NULL OR p.commission_expires_on >= current_date)
  ) AND EXISTS (
    SELECT 1 FROM public.notary_credentials c
    WHERE c.user_id = _user_id
      AND c.status = 'verified'
      AND (c.expires_on IS NULL OR c.expires_on >= current_date)
  );
$$;

REVOKE ALL ON FUNCTION private.is_cleared_notary(uuid) FROM public, anon, authenticated;

DROP POLICY notarizations_insert_own ON public.notarizations;
CREATE POLICY notarizations_insert_own ON public.notarizations
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND private.is_cleared_notary(auth.uid()));

DROP POLICY signers_insert_owner ON public.notarization_signers;
CREATE POLICY signers_insert_owner ON public.notarization_signers
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.notarizations n WHERE n.id = notarization_id AND n.created_by = auth.uid())
    AND private.is_cleared_notary(notary_user_id)
  );

DROP POLICY signers_update_self ON public.notarization_signers;
CREATE POLICY signers_update_self ON public.notarization_signers
  FOR UPDATE TO authenticated
  USING (notary_user_id = auth.uid())
  WITH CHECK (notary_user_id = auth.uid() AND private.is_cleared_notary(auth.uid()));