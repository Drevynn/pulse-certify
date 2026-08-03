CREATE POLICY credentials_objects_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'notary-credentials'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR private.has_role(auth.uid(),'registrar')
      OR private.has_role(auth.uid(),'admin')
    )
  );

CREATE POLICY credentials_objects_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'notary-credentials'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY credentials_objects_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'notary-credentials'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );