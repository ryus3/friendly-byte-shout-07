-- 1) صفّر عداد partner_missed_count لكل الطلبات (إزالة آثار سياسة الحذف القديمة)
UPDATE public.orders SET partner_missed_count = 0
WHERE partner_missed_count IS NOT NULL AND partner_missed_count > 0;

-- 2) أعد تشغيل الربط لإسقاط أي روابط ممكنة بعد تحديثات اليوم
SELECT * FROM public.link_invoice_orders_to_orders();