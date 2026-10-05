CREATE OR REPLACE FUNCTION public.check_user_exists(identifier TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    exists_bool BOOLEAN;
BEGIN
    -- Check if it's an email and exists in auth.users
    SELECT EXISTS (
        SELECT 1 FROM auth.users WHERE email = identifier
    ) INTO exists_bool;
    
    IF exists_bool THEN
        RETURN TRUE;
    END IF;
    
    -- Check if it's a username and exists in profiles
    SELECT EXISTS (
        SELECT 1 FROM public.profiles WHERE username = identifier
    ) INTO exists_bool;
    
    RETURN exists_bool;
END;
$$;

-- Grant access to the anon role so it can be called from the login screen
GRANT EXECUTE ON FUNCTION public.check_user_exists(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.check_user_exists(TEXT) TO authenticated;
