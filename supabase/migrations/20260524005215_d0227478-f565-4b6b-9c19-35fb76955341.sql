UPDATE public.notifications
SET title = TRIM(REGEXP_REPLACE(title, '🤖', '', 'g'))
WHERE title LIKE '%🤖%';