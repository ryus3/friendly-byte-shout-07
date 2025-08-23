-- إصلاح جميع الدوال التي تحتاج search_path
-- البحث عن الدوال وإصلاحها
DO $$
DECLARE
    func_record RECORD;
    alter_statement TEXT;
BEGIN
    -- البحث عن جميع الدوال التي تحتاج إصلاح search_path
    FOR func_record IN 
        SELECT DISTINCT p.proname as function_name, 
               pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' 
        AND p.proname NOT LIKE 'pg_%'
        AND p.proname NOT LIKE '%_validate_%'
        AND NOT EXISTS (
            SELECT 1 FROM pg_proc p2 
            WHERE p2.oid = p.oid 
            AND pg_get_function_arguments(p2.oid) LIKE '%search_path%'
        )
    LOOP
        BEGIN
            alter_statement := format('ALTER FUNCTION public.%I(%s) SET search_path TO ''public'', ''pg_temp''', 
                                    func_record.function_name, 
                                    func_record.args);
            EXECUTE alter_statement;
            RAISE NOTICE 'Fixed search_path for function: %', func_record.function_name;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'Could not fix search_path for function: % - %', func_record.function_name, SQLERRM;
        END;
    END LOOP;
END $$;