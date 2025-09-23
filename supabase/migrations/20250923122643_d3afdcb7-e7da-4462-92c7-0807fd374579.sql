-- Force update telegram_chat_id to correct bigint value
DELETE FROM telegram_employee_codes WHERE employee_code = 'RYU559';

INSERT INTO telegram_employee_codes (
    employee_code, 
    telegram_chat_id, 
    user_id, 
    is_active, 
    linked_at
) VALUES (
    'RYU559', 
    499943724::bigint,
    '91484496-b887-44f7-9e5d-be9db5567604'::uuid,
    true,
    now()
);

-- Verify the final result
SELECT employee_code, telegram_chat_id, is_active 
FROM telegram_employee_codes 
WHERE employee_code = 'RYU559';