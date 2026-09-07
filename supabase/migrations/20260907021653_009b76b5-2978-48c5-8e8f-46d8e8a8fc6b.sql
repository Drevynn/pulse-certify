-- Restrict notarizations updates to user-editable columns only
REVOKE UPDATE ON public.notarizations FROM authenticated;
GRANT UPDATE (title, matter_reference, jurisdiction) ON public.notarizations TO authenticated;

-- Restrict signer updates to the free-text note only
REVOKE UPDATE ON public.notarization_signers FROM authenticated;
GRANT UPDATE (attestation_note) ON public.notarization_signers TO authenticated;

-- Explicit owner-scoped update rule for the private credentials bucket
DROP POLICY IF EXISTS "credentials_objects_update_own" ON storage.objects;
CREATE POLICY "credentials_objects_update_own"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'notary-credentials' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'notary-credentials' AND (storage.foldername(name))[1] = auth.uid()::text);