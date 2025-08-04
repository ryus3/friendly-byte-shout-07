-- تحديث رصيد القاصة الرئيسية لتطابق النظام الموحد
DO $$
DECLARE
    main_cash_id UUID;
    calculated_balance NUMERIC;
BEGIN
    -- الحصول على معرف القاصة الرئيسية
    SELECT id INTO main_cash_id 
    FROM cash_sources 
    WHERE name = 'القاصة الرئيسية' AND is_active = true;
    
    IF main_cash_id IS NOT NULL THEN
        -- حساب الرصيد من النظام الموحد
        SELECT final_balance INTO calculated_balance
        FROM calculate_enhanced_main_cash_balance();
        
        -- تحديث الرصيد في جدول القاصة
        UPDATE cash_sources 
        SET 
            current_balance = calculated_balance,
            updated_at = now()
        WHERE id = main_cash_id;
        
        RAISE NOTICE 'تم تحديث رصيد القاصة الرئيسية من % إلى %', 
            (SELECT current_balance FROM cash_sources WHERE id = main_cash_id),
            calculated_balance;
    END IF;
END $$;