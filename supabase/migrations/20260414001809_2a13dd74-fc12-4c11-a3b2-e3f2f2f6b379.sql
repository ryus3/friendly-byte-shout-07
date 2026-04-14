-- حذف حركتي المصروف التجريبي (5000 دينار) وإرجاعه
-- المصروف الأصلي
DELETE FROM cash_movements WHERE id = 'df94e549-6a23-4a8e-add9-b3bfce5c5682';
-- إرجاع المصروف المحذوف
DELETE FROM cash_movements WHERE id = 'c54bf0d1-5e9e-48ec-bcb4-24b13ce1d25e';

-- تصحيح رصيد القاصة (الحركتان متعاكستان 5000 خروج + 5000 دخول = صافي 0، لا تأثير على الرصيد)
