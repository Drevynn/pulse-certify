CREATE POLICY profiles_select_registrar ON public.profiles
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(),'registrar') OR private.has_role(auth.uid(),'admin'));

CREATE POLICY profiles_update_registrar ON public.profiles
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(),'registrar') OR private.has_role(auth.uid(),'admin'))
  WITH CHECK (private.has_role(auth.uid(),'registrar') OR private.has_role(auth.uid(),'admin'));