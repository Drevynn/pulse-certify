-- 1. Credential self-certification guard
CREATE OR REPLACE FUNCTION public.guard_profile_credentials()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Privileged server-side paths (service role, triggers) have no auth.uid().
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF (NEW.is_certified IS DISTINCT FROM OLD.is_certified
      OR NEW.commission_state IS DISTINCT FROM OLD.commission_state
      OR NEW.commission_expires_on IS DISTINCT FROM OLD.commission_expires_on
      OR NEW.notary_id_number IS DISTINCT FROM OLD.notary_id_number)
     AND NOT (public.has_role(auth.uid(), 'registrar') OR public.has_role(auth.uid(), 'admin'))
  THEN
    RAISE EXCEPTION 'Commission credentials may only be set by a registrar';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_profile_credentials() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_profile_credentials ON public.profiles;
CREATE TRIGGER guard_profile_credentials
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_credentials();

-- 2. Restrict profile visibility to self + panel counterparties
CREATE OR REPLACE FUNCTION public.shares_panel(_viewer uuid, _subject uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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

REVOKE ALL ON FUNCTION public.shares_panel(uuid, uuid) FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS profiles_select_authenticated ON public.profiles;
CREATE POLICY profiles_select_self_or_panel ON public.profiles
FOR SELECT TO authenticated
USING (id = auth.uid() OR public.shares_panel(auth.uid(), id));

-- 3. Internal SECURITY DEFINER helpers are not directly callable by signed-in users
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_participant(uuid, uuid) FROM PUBLIC, anon, authenticated;