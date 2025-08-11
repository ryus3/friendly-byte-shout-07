-- 1) Normalize telegram_code to uppercase in employee_telegram_codes
UPDATE public.employee_telegram_codes
SET telegram_code = UPPER(telegram_code)
WHERE telegram_code IS NOT NULL AND telegram_code <> UPPER(telegram_code);

-- 2) Backfill employee_telegram_codes from legacy telegram_employee_codes when missing
INSERT INTO public.employee_telegram_codes (
  user_id,
  telegram_code,
  is_active,
  telegram_chat_id,
  linked_at,
  created_at,
  updated_at
)
SELECT 
  t.user_id,
  UPPER(t.employee_code) AS telegram_code,
  COALESCE(t.is_active, true) AS is_active,
  t.telegram_chat_id,
  t.linked_at,
  COALESCE(t.created_at, now()),
  now()
FROM public.telegram_employee_codes t
WHERE t.employee_code IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.employee_telegram_codes e WHERE e.user_id = t.user_id
  );

-- 3) If record exists but telegram_code is empty, update it from legacy table
UPDATE public.employee_telegram_codes e
SET telegram_code = UPPER(t.employee_code),
    updated_at = now()
FROM public.telegram_employee_codes t
WHERE e.user_id = t.user_id
  AND (e.telegram_code IS NULL OR e.telegram_code = '');

-- 4) Remove duplicates in employee_telegram_codes by user_id (keep the latest by id)
DELETE FROM public.employee_telegram_codes a
USING public.employee_telegram_codes b
WHERE a.user_id = b.user_id
  AND a.id < b.id;

-- 5) Ensure unique index on user_id
CREATE UNIQUE INDEX IF NOT EXISTS employee_telegram_codes_user_id_key
ON public.employee_telegram_codes(user_id);

-- 6) Try to create unique index on telegram_code (skip if duplicates exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' AND indexname = 'employee_telegram_codes_telegram_code_key'
  ) THEN
    BEGIN
      CREATE UNIQUE INDEX employee_telegram_codes_telegram_code_key
      ON public.employee_telegram_codes(telegram_code);
    EXCEPTION WHEN unique_violation THEN
      RAISE NOTICE 'Skipped unique index on telegram_code due to duplicates';
    END;
  END IF;
END $$;

-- 7) Create trigger to auto-generate telegram_code for new users if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger trg
    JOIN pg_class cls ON cls.oid = trg.tgrelid
    JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace
    WHERE trg.tgname = 'on_auth_user_created_create_telegram_code'
      AND nsp.nspname = 'auth'
      AND cls.relname = 'users'
  ) THEN
    CREATE TRIGGER on_auth_user_created_create_telegram_code
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.create_telegram_code_on_user_signup();
  END IF;
END $$;