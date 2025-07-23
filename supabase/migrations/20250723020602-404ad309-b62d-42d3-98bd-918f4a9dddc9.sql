-- إعادة إنشاء المصاريف الصحيحة لفاتورة رقم 1
-- تكلفة المنتجات: 29000 د.ع
-- تكلفة الشحن: 1000 د.ع  
-- تكاليف التحويل: 1000 د.ع

-- الحصول على معرف القاصة الرئيسية ومعرف المستخدم
DO $$
DECLARE
    main_cash_id UUID;
    admin_user_id UUID;
BEGIN
    -- الحصول على معرف القاصة الرئيسية
    SELECT id INTO main_cash_id FROM public.cash_sources WHERE name = 'القاصة الرئيسية';
    
    -- الحصول على معرف المدير
    SELECT user_id INTO admin_user_id FROM public.profiles WHERE is_active = true LIMIT 1;
    
    -- 1. إنشاء مصروف شراء المنتجات
    INSERT INTO public.expenses (
        description,
        amount,
        category,
        expense_type,
        receipt_number,
        vendor_name,
        status,
        created_by,
        approved_by,
        approved_at
    ) VALUES (
        'شراء منتجات - فاتورة رقم 1 من تجريبي',
        29000,
        'inventory',
        'purchase',
        '1',
        'تجريبي',
        'approved',
        admin_user_id,
        admin_user_id,
        now()
    );
    
    -- 2. إنشاء مصروف تكلفة الشحن
    INSERT INTO public.expenses (
        description,
        amount,
        category,
        expense_type,
        receipt_number,
        vendor_name,
        status,
        created_by,
        approved_by,
        approved_at
    ) VALUES (
        'تكلفة شحن - فاتورة رقم 1',
        1000,
        'shipping',
        'shipping',
        '1-SHIP',
        'تجريبي',
        'approved',
        admin_user_id,
        admin_user_id,
        now()
    );
    
    -- 3. إنشاء مصروف تكاليف التحويل
    INSERT INTO public.expenses (
        description,
        amount,
        category,
        expense_type,
        receipt_number,
        vendor_name,
        status,
        created_by,
        approved_by,
        approved_at
    ) VALUES (
        'تكاليف تحويل - فاتورة رقم 1',
        1000,
        'transfer',
        'transfer',
        '1-TRANSFER',
        'تجريبي',
        'approved',
        admin_user_id,
        admin_user_id,
        now()
    );
    
    -- 4. خصم المبلغ الإجمالي من القاصة الرئيسية (31000)
    PERFORM public.update_cash_source_balance(
        main_cash_id,
        31000,
        'out',
        'purchase',
        '1fb6944a-e887-4ed2-9e21-0f4e7bbcaa27'::uuid,
        'شراء منتجات - فاتورة رقم 1 (إجمالي: 31000)',
        admin_user_id
    );
    
    RAISE NOTICE 'تم إنشاء المصاريف الصحيحة وخصم المبلغ من القاصة الرئيسية';
END $$;