ALTER TABLE public.user_roles ADD COLUMN internal_access_approved boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.user_roles.internal_access_approved IS 'Administrator-controlled internal access approval; self-registration never grants approval.';
UPDATE public.user_roles SET internal_access_approved = true;

CREATE OR REPLACE FUNCTION public.has_internal_access()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND internal_access_approved = true
      AND role IN ('admin'::public.app_role, 'user'::public.app_role)
  );
$$;
REVOKE ALL ON FUNCTION public.has_internal_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_internal_access() TO authenticated, service_role;

ALTER POLICY "Authenticated users can view clients" ON public.clients USING (public.has_internal_access());
ALTER POLICY "Authenticated users can insert clients" ON public.clients WITH CHECK (public.has_internal_access());
ALTER POLICY "Authenticated users can update clients" ON public.clients USING (public.has_internal_access()) WITH CHECK (public.has_internal_access());

ALTER POLICY "Authenticated users can view monthly_data" ON public.monthly_data USING (public.has_internal_access());
ALTER POLICY "Authenticated users can insert monthly_data" ON public.monthly_data WITH CHECK (public.has_internal_access());
ALTER POLICY "Authenticated users can update monthly_data" ON public.monthly_data USING (public.has_internal_access()) WITH CHECK (public.has_internal_access());

ALTER POLICY "Authenticated users can view profiles" ON public.profiles USING (auth.uid() = user_id OR public.has_internal_access());