-- حذف النسخة القديمة المكسورة من extract_product_items_from_text
-- النسخة ذات معامل واحد فقط (p_input_text)
DROP FUNCTION IF EXISTS public.extract_product_items_from_text(text);

-- الاحتفاظ بالنسخة الصحيحة ذات المعاملين (input_text, p_employee_id)
-- لا حاجة لإعادة إنشائها لأنها موجودة بالفعل