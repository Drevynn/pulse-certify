CREATE OR REPLACE FUNCTION public.generate_notary_id()
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE candidate TEXT;
BEGIN
  LOOP
    candidate := 'PN-' || to_char(now(), 'YY') || '-' || upper(encode(extensions.gen_random_bytes(4), 'hex'));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE notary_id_number = candidate);
  END LOOP;
  RETURN candidate;
END; $function$;