-- ⚠️ حذف الدالة المحدثة والعودة للدالة القديمة + إضافة trigger جديد

-- 1️⃣ حذف الدالة الجديدة (التي كانت تشيك على order_id)
DROP FUNCTION IF EXISTS public.should_release_stock_for_order(text, text, text, uuid);

-- 2️⃣ التأكد من وجود الدالة القديمة (3 معاملات فقط)
CREATE OR REPLACE FUNCTION public.should_release_stock_for_order(
  p_status text, 
  p_delivery_status text DEFAULT NULL, 
  p_delivery_partner text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- للطلبات المحلية
  IF p_delivery_partner IS NULL OR p_delivery_partner = 'محلي' THEN
    RETURN p_status IN ('completed', 'delivered', 'returned_in_stock');
  END IF;

  -- لطلبات الوسيط - التحقق من الحالة الخاصة
  IF LOWER(p_delivery_partner) = 'alwaseet' THEN
    -- فقط الحالات 4 و 17 تحرر المخزون
    RETURN p_delivery_status::text IN ('4', '17');
  END IF;

  -- لشركات التوصيل الأخرى
  IF p_delivery_status IS NOT NULL THEN
    -- الحالات التي تحرر المخزون
    RETURN p_delivery_status ~* 'تسليم|مسلم|deliver|راجع.*المخزن|return.*stock|تم.*الارجاع.*التاجر';
  END IF;

  -- الحالة الافتراضية
  RETURN p_status IN ('completed', 'delivered', 'returned_in_stock');
END;
$function$;

-- 3️⃣ إنشاء trigger جديد لخصم المنتج الخارج تلقائياً في حالة 21
CREATE OR REPLACE FUNCTION public.auto_deduct_exchange_outgoing_on_status_21()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_outgoing_items jsonb;
  v_item jsonb;
  v_variant_id uuid;
  v_quantity integer;
BEGIN
  -- فقط للطلبات من نوع exchange عند الوصول لحالة 21
  IF NEW.delivery_status = '21' 
     AND COALESCE(OLD.delivery_status, '') != '21'
     AND NEW.order_type = 'exchange' THEN
    
    -- استخراج المنتجات الخارجة من الملاحظات
    -- نفترض أن البيانات مخزنة في حقل exchange_metadata أو notes
    -- إذا لم يكن هناك حقل محدد، سنستخدم order_items مع flag
    
    -- خصم المخزون للمنتجات الخارجة فقط
    FOR v_item IN 
      SELECT jsonb_array_elements(
        COALESCE(NEW.exchange_metadata->'outgoing_items', '[]'::jsonb)
      )
    LOOP
      v_variant_id := (v_item->>'variant_id')::uuid;
      v_quantity := (v_item->>'quantity')::integer;
      
      -- استدعاء RPC لخصم المخزون
      PERFORM update_variant_stock(
        v_variant_id,
        -v_quantity, -- خصم
        'استبدال - منتج خارج للطلب ' || NEW.order_number
      );
      
      RAISE NOTICE 'تم خصم % من المنتج % للطلب %', 
        v_quantity, v_variant_id, NEW.order_number;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 4️⃣ ربط الـ trigger بجدول orders
DROP TRIGGER IF EXISTS trigger_auto_deduct_exchange_outgoing ON orders;
CREATE TRIGGER trigger_auto_deduct_exchange_outgoing
  AFTER UPDATE OF delivery_status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_deduct_exchange_outgoing_on_status_21();

-- 5️⃣ إضافة حقل exchange_metadata إذا لم يكن موجوداً
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'exchange_metadata'
  ) THEN
    ALTER TABLE orders ADD COLUMN exchange_metadata jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;