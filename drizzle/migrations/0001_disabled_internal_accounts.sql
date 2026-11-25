ALTER TABLE public.user_roles ADD COLUMN account_disabled boolean NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION public.has_internal_access()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND internal_access_approved = true AND account_disabled = false AND role IN ('admin'::public.app_role, 'user'::public.app_role)); $$;
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role AND account_disabled = false); $$;