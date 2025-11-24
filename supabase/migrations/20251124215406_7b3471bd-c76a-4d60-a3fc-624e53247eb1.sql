-- تفعيل صلاحية المتجر للموظف الأول
UPDATE profiles 
SET has_storefront_access = true, 
    can_upload_custom_images = true
WHERE user_id = '91484496-b887-44f7-9e5d-be9db5567604';

-- إنشاء إعدادات المتجر التجريبي
INSERT INTO employee_storefront_settings (
  employee_id,
  slug,
  theme_name,
  primary_color,
  secondary_color,
  accent_color,
  font_family,
  logo_url,
  banner_url,
  meta_title,
  meta_description,
  is_active
) VALUES (
  '91484496-b887-44f7-9e5d-be9db5567604',
  'demo-store',
  'modern',
  '#FF6B6B',
  '#4ECDC4',
  '#FFE66D',
  'Cairo',
  NULL,
  NULL,
  'متجر RYUS التجريبي - أزياء عصرية بأسعار منافسة',
  'اكتشف أحدث صيحات الموضة في متجر RYUS. ملابس رياضية، كاجوال، وأناقة عصرية بجودة عالية وأسعار تنافسية. شحن سريع لجميع أنحاء العراق.',
  true
);

-- إضافة بانر رئيسي (Hero)
INSERT INTO employee_banners (
  employee_id,
  banner_position,
  banner_title,
  banner_subtitle,
  banner_image,
  banner_link,
  display_order,
  is_active
) VALUES (
  '91484496-b887-44f7-9e5d-be9db5567604',
  'hero',
  'عروض حصرية - خصم حتى 50%',
  'اطلب الآن واحصل على أفضل الأسعار',
  'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200',
  '/storefront/demo-store/products',
  1,
  true
);

-- إضافة بانر جانبي
INSERT INTO employee_banners (
  employee_id,
  banner_position,
  banner_title,
  banner_subtitle,
  banner_image,
  display_order,
  is_active
) VALUES (
  '91484496-b887-44f7-9e5d-be9db5567604',
  'sidebar',
  'شحن مجاني',
  'للطلبات فوق 50,000 د.ع',
  'https://images.unsplash.com/photo-1558769132-cb1aea3c8b6d?w=600',
  1,
  true
);

-- إنشاء عرض ترويجي: خصم 20%
INSERT INTO employee_promotions (
  employee_id,
  promotion_name,
  promotion_type,
  discount_value,
  start_date,
  end_date,
  is_active,
  promotion_code
) VALUES (
  '91484496-b887-44f7-9e5d-be9db5567604',
  'خصم 20% على جميع المنتجات',
  'percentage',
  20,
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '30 days',
  true,
  'SAVE20'
);

-- إنشاء عرض: اشتري 2 واحصل على 1 مجاناً
INSERT INTO employee_promotions (
  employee_id,
  promotion_name,
  promotion_type,
  discount_value,
  start_date,
  end_date,
  is_active
) VALUES (
  '91484496-b887-44f7-9e5d-be9db5567604',
  'اشتري 2 واحصل على 1 مجاناً',
  'buy_x_get_y',
  0,
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '30 days',
  true
);

-- إضافة أوصاف مخصصة للمنتجات المميزة
INSERT INTO employee_product_descriptions (
  employee_id,
  product_id,
  custom_description,
  is_featured,
  display_order
) VALUES
  (
    '91484496-b887-44f7-9e5d-be9db5567604',
    '44b956b4-4324-472a-bd08-22a2f8bba146',
    'تيشيرت برشلونة الأصلي - جودة عالية، قماش مريح يناسب جميع الأوقات. تصميم عصري بألوان نادي برشلونة الشهير.',
    true,
    1
  ),
  (
    '91484496-b887-44f7-9e5d-be9db5567604',
    'fba13e37-70aa-4969-8cc8-1dd94890d132',
    'تيشيرت إيطالي فاخر - قماش قطن 100% بتصميم أنيق يناسب الإطلالات الكاجوال والرسمية. راحة لا مثيل لها.',
    true,
    2
  ),
  (
    '91484496-b887-44f7-9e5d-be9db5567604',
    '9856b274-afec-4579-89b1-d9273df3070c',
    'تيشيرت الأرجنتين الشتوي - دافئ ومريح، مثالي للأجواء الباردة. قماش سميك بجودة عالية يدوم طويلاً.',
    true,
    3
  ),
  (
    '91484496-b887-44f7-9e5d-be9db5567604',
    '388791c1-b83a-42cd-89b4-70dc942f5613',
    'سوت مايسترو - طقم كامل بتصميم احترافي، مثالي للمناسبات الخاصة والاجتماعات. أناقة وفخامة بسعر منافس.',
    true,
    4
  ),
  (
    '91484496-b887-44f7-9e5d-be9db5567604',
    '116ed0b0-72b1-4186-a5ba-09e319a9aee0',
    'سوت شيك - تصميم عصري يجمع بين الأناقة والراحة. مناسب للعمل والمناسبات اليومية. جودة استثنائية بسعر رائع.',
    true,
    5
  );