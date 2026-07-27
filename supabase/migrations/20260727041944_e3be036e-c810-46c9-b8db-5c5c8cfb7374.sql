-- roles
CREATE TYPE public.app_role AS ENUM ('notary', 'registrar', 'admin');
CREATE TYPE public.notarization_status AS ENUM ('draft', 'collecting', 'sealed', 'rejected');
CREATE TYPE public.signer_status AS ENUM ('pending', 'attested', 'declined');

-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  notary_id_number TEXT NOT NULL UNIQUE,
  commission_state TEXT,
  commission_expires_on DATE,
  is_certified BOOLEAN NOT NULL DEFAULT false,
  public_key_fingerprint TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- notary id generator: PN-<yy>-<8 hex>
CREATE OR REPLACE FUNCTION public.generate_notary_id()
RETURNS TEXT LANGUAGE plpgsql VOLATILE SET search_path = public AS $$
DECLARE candidate TEXT;
BEGIN
  LOOP
    candidate := 'PN-' || to_char(now(), 'YY') || '-' || upper(encode(gen_random_bytes(4), 'hex'));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE notary_id_number = candidate);
  END LOOP;
  RETURN candidate;
END; $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, notary_id_number, commission_state)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', ''),
    public.generate_notary_id(),
    NEW.raw_user_meta_data ->> 'commission_state'
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'notary') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- notarizations
CREATE TABLE public.notarizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  matter_reference TEXT,
  document_name TEXT NOT NULL,
  document_hash TEXT NOT NULL,
  document_bytes BIGINT,
  jurisdiction TEXT,
  required_attestations INT NOT NULL DEFAULT 1,
  status public.notarization_status NOT NULL DEFAULT 'collecting',
  contract_address TEXT,
  chain_name TEXT NOT NULL DEFAULT 'PulseChain Notary Registry',
  verification_code TEXT NOT NULL UNIQUE DEFAULT upper(encode(gen_random_bytes(6), 'hex')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sealed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notarizations TO authenticated;
GRANT ALL ON public.notarizations TO service_role;
ALTER TABLE public.notarizations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.notarization_signers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notarization_id UUID NOT NULL REFERENCES public.notarizations(id) ON DELETE CASCADE,
  notary_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notary_id_number TEXT NOT NULL,
  status public.signer_status NOT NULL DEFAULT 'pending',
  attestation_hash TEXT,
  attestation_note TEXT,
  attested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (notarization_id, notary_user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notarization_signers TO authenticated;
GRANT ALL ON public.notarization_signers TO service_role;
ALTER TABLE public.notarization_signers ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_participant(_notarization_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.notarizations n WHERE n.id = _notarization_id AND n.created_by = _user_id)
      OR EXISTS (SELECT 1 FROM public.notarization_signers s WHERE s.notarization_id = _notarization_id AND s.notary_user_id = _user_id)
$$;

CREATE POLICY "notarizations_select_participant" ON public.notarizations FOR SELECT TO authenticated
  USING (public.is_participant(id, auth.uid()));
CREATE POLICY "notarizations_insert_own" ON public.notarizations FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "notarizations_update_own" ON public.notarizations FOR UPDATE TO authenticated
  USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
CREATE POLICY "notarizations_delete_own" ON public.notarizations FOR DELETE TO authenticated
  USING (created_by = auth.uid() AND status <> 'sealed');

CREATE POLICY "signers_select_participant" ON public.notarization_signers FOR SELECT TO authenticated
  USING (public.is_participant(notarization_id, auth.uid()));
CREATE POLICY "signers_insert_owner" ON public.notarization_signers FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.notarizations n WHERE n.id = notarization_id AND n.created_by = auth.uid()));
CREATE POLICY "signers_update_self" ON public.notarization_signers FOR UPDATE TO authenticated
  USING (notary_user_id = auth.uid()) WITH CHECK (notary_user_id = auth.uid());
CREATE POLICY "signers_delete_owner" ON public.notarization_signers FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.notarizations n WHERE n.id = notarization_id AND n.created_by = auth.uid()));

CREATE TRIGGER notarizations_touch BEFORE UPDATE ON public.notarizations
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ledger
CREATE TABLE public.ledger_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notarization_id UUID NOT NULL REFERENCES public.notarizations(id) ON DELETE CASCADE,
  block_index INT NOT NULL,
  event_type TEXT NOT NULL,
  actor_id_number TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  previous_hash TEXT NOT NULL,
  block_hash TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  contract_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (notarization_id, block_index)
);
GRANT SELECT ON public.ledger_blocks TO authenticated;
GRANT ALL ON public.ledger_blocks TO service_role;
ALTER TABLE public.ledger_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ledger_select_participant" ON public.ledger_blocks FOR SELECT TO authenticated
  USING (public.is_participant(notarization_id, auth.uid()));

-- proofs of service
CREATE TABLE public.proofs_of_service (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notarization_id UUID NOT NULL UNIQUE REFERENCES public.notarizations(id) ON DELETE CASCADE,
  proof_number TEXT NOT NULL UNIQUE,
  issuing_notary_id_number TEXT NOT NULL,
  overseer_verdict TEXT NOT NULL,
  overseer_summary TEXT NOT NULL,
  overseer_findings JSONB NOT NULL DEFAULT '[]'::jsonb,
  merkle_root TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.proofs_of_service TO authenticated;
GRANT ALL ON public.proofs_of_service TO service_role;
ALTER TABLE public.proofs_of_service ENABLE ROW LEVEL SECURITY;
CREATE POLICY "proofs_select_participant" ON public.proofs_of_service FOR SELECT TO authenticated
  USING (public.is_participant(notarization_id, auth.uid()));

CREATE INDEX idx_signers_user ON public.notarization_signers(notary_user_id);
CREATE INDEX idx_ledger_notarization ON public.ledger_blocks(notarization_id, block_index);