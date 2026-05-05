CREATE OR REPLACE FUNCTION public.prevent_non_admin_deactivate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.active IS DISTINCT FROM OLD.active AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can change client active status';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clients_prevent_non_admin_deactivate ON public.clients;
CREATE TRIGGER clients_prevent_non_admin_deactivate
BEFORE UPDATE ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.prevent_non_admin_deactivate();