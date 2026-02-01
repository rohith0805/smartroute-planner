-- Enable leaked password protection via auth config
-- This requires updating auth.config, which is done via Supabase dashboard or API
-- Setting password requirements via SQL is not directly supported
-- The fix must be applied through Supabase Auth settings

-- However, we can ensure all functions have proper search_path set
-- Check if there are any other functions without search_path

SELECT proname, prosrc 
FROM pg_proc 
WHERE pronamespace = 'public'::regnamespace 
AND NOT prosecdef;