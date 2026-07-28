CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION private.is_participant(_notarization_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.notarizations n WHERE n.id = _notarization_id AND n.created_by = _user_id)
      OR EXISTS (SELECT 1 FROM public.notarization_signers s WHERE s.notarization_id = _notarization_id AND s.notary_user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION private.shares_panel(_viewer uuid, _subject uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.notarization_signers a
    JOIN public.notarization_signers b ON b.notarization_id = a.notarization_id
    WHERE a.notary_user_id = _viewer AND b.notary_user_id = _subject
  ) OR EXISTS (
    SELECT 1 FROM public.notarizations n
    JOIN public.notarization_signers s ON s.notarization_id = n.id
    WHERE n.created_by = _viewer AND s.notary_user_id = _subject
  ) OR EXISTS (
    SELECT 1 FROM public.notarizations n
    JOIN public.notarization_signers s ON s.notarization_id = n.id
    WHERE s.notary_user_id = _viewer AND n.created_by = _subject
  );
$$;

GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_participant(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.shares_panel(uuid, uuid) TO authenticated, service_role;

-- Repoint policies at the private helpers
DROP POLICY IF EXISTS profiles_select_self_or_panel ON public.profiles;
CREATE POLICY profiles_select_self_or_panel ON public.profiles
FOR SELECT TO authenticated
USING (id = auth.uid() OR private.shares_panel(auth.uid(), id));

DROP POLICY IF EXISTS notarizations_select_participant ON public.notarizations;
CREATE POLICY notarizations_select_participant ON public.notarizations
FOR SELECT TO authenticated USING (private.is_participant(id, auth.uid()));

DROP POLICY IF EXISTS signers_select_participant ON public.notarization_signers;
CREATE POLICY signers_select_participant ON public.notarization_signers
FOR SELECT TO authenticated USING (private.is_participant(notarization_id, auth.uid()));

DROP POLICY IF EXISTS ledger_select_participant ON public.ledger_blocks;
CREATE POLICY ledger_select_participant ON public.ledger_blocks
FOR SELECT TO authenticated USING (private.is_participant(notarization_id, auth.uid()));

DROP POLICY IF EXISTS proofs_select_participant ON public.proofs_of_service;
CREATE POLICY proofs_select_participant ON public.proofs_of_service
FOR SELECT TO authenticated USING (private.is_participant(notarization_id, auth.uid()));

-- Credential guard now uses the private helper
CREATE OR REPLACE FUNCTION public.guard_profile_credentials()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF (NEW.is_certified IS DISTINCT FROM OLD.is_certified
      OR NEW.commission_state IS DISTINCT FROM OLD.commission_state
      OR NEW.commission_expires_on IS DISTINCT FROM OLD.commission_expires_on
      OR NEW.notary_id_number IS DISTINCT FROM OLD.notary_id_number)
     AND NOT (private.has_role(auth.uid(), 'registrar') OR private.has_role(auth.uid(), 'admin'))
  THEN
    RAISE EXCEPTION 'Commission credentials may only be set by a registrar';
  END IF;
  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS public.shares_panel(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_participant(uuid, uuid);
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);