REVOKE EXECUTE ON FUNCTION public.has_role(UUID, UUID, public.app_role) FROM anon;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _owner_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = _user_id AND owner_id = _owner_id AND role = _role
    );
$$;