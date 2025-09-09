-- Harden functions by setting an explicit search_path (linter: 0011_function_search_path_mutable)
ALTER FUNCTION public.get_unique_employees_count_with_settlements() SET search_path TO public, pg_temp;
ALTER FUNCTION public.set_updated_at_timestamp() SET search_path TO public, pg_temp;
ALTER FUNCTION public.update_sync_cron_trigger() SET search_path TO public, pg_temp;