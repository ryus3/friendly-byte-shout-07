export const permissionsMap = [
  {
    category: 'لوحة التحكم',
    categoryLabel: 'لوحة التحكم',
    permissions: [
      { id: 'view_dashboard', label: 'عرض لوحة التحكم' },
      { id: 'view_dashboard_stats', label: 'عرض الإحصائيات الرئيسية' },
      { id: 'view_dashboard_top_lists', label: 'عرض قوائم الأفضل' },
      { id: 'view_dashboard_stock_alerts', label: 'عرض تنبيهات المخزون' },
      { id: 'view_dashboard_recent_orders', label: 'عرض الطلبات الأخيرة' },
    ]
  },
  {
    category: 'الطلبات',
    categoryLabel: 'الطلبات',
    permissions: [
      { id: 'view_orders', label: 'عرض الطلبات الشخصية' },
      { id: 'view_all_orders', label: 'عرض جميع الطلبات (للمدير)' },
      { id: 'create_order', label: 'إنشاء طلبات' },
      { id: 'manage_orders', label: 'إدارة الطلبات (تحديث الحالة)' },
      { id: 'apply_order_discounts', label: 'تطبيق خصومات على الطلبات' },
      { id: 'print_invoices', label: 'طباعة فواتير الطلبات' },
    ]
  },
  {
    category: 'المنتجات والمخزون',
    categoryLabel: 'المنتجات والمخزون',
    permissions: [
      { id: 'view_products', label: 'عرض المنتجات' },
      { id: 'manage_products', label: 'إدارة المنتجات (إضافة/تعديل/حذف)' },
      { id: 'view_inventory', label: 'عرض الجرد والمخزون' },
      { id: 'edit_stock', label: 'تعديل كميات المخزون يدويًا' },
      { id: 'use_barcode_scanner', label: 'استخدام قارئ الباركود' },
      { id: 'manage_variants', label: 'إدارة المتغيرات (ألوان، مقاسات)' },
      { id: 'view_category_all', label: 'عرض جميع التصنيفات' },
      { id: 'view_category_clothes', label: 'عرض تصنيف الملابس' },
      { id: 'view_category_electronics', label: 'عرض تصنيف الإلكترونيات' },
      { id: 'view_category_accessories', label: 'عرض تصنيف الاكسسوارات' },
      { id: 'view_category_shoes', label: 'عرض تصنيف الأحذية' },
      { id: 'view_category_bags', label: 'عرض تصنيف الحقائب' },
    ]
  },
  {
    category: 'المشتريات',
    categoryLabel: 'المشتريات',
    permissions: [
      { id: 'view_purchases', label: 'عرض المشتريات' },
      { id: 'add_purchase', label: 'إضافة فواتير شراء' },
    ]
  },
  {
    category: 'الأرباح والتقارير',
    categoryLabel: 'الأرباح والتقارير',
    permissions: [
      { id: 'view_profits', label: 'عرض ملخص الأرباح' },
      { id: 'request_profit_settlement', label: 'طلب محاسبة الأرباح (للموظف)' },
      { id: 'view_accounting', label: 'عرض المركز المالي والتقارير المحاسبية' },
      { id: 'manage_employee_profits', label: 'إدارة ومحاسبة أرباح الموظفين' },
    ]
  },
  {
    category: 'الإدارة',
    categoryLabel: 'الإدارة',
    permissions: [
      { id: 'manage_users', label: 'إدارة الموظفين والصلاحيات' },
      { id: 'manage_profit_rules', label: 'إدارة قواعد أرباح الموظفين' },
    ]
  },
  {
    category: 'التصنيفات والمتغيرات',
    categoryLabel: 'التصنيفات والمتغيرات',
    permissions: [
      { id: 'view_category_mens_clothing', label: 'عرض ملابس رجالية' },
      { id: 'view_category_mens_clothing_summer', label: 'عرض ملابس رجالية صيفية' },
      { id: 'view_category_mens_clothing_winter', label: 'عرض ملابس رجالية شتوية' },
      { id: 'view_category_womens_clothing', label: 'عرض ملابس نسائية' },
      { id: 'view_category_womens_clothing_summer', label: 'عرض ملابس نسائية صيفية' },
      { id: 'view_category_womens_clothing_winter', label: 'عرض ملابس نسائية شتوية' },
      { id: 'view_category_kids_clothing', label: 'عرض ملابس أطفال' },
      { id: 'view_category_shoes', label: 'عرض الأحذية' },
      { id: 'view_category_bags', label: 'عرض الحقائب' },
      { id: 'view_category_accessories', label: 'عرض الاكسسوارات' },
      { id: 'view_category_electronics', label: 'عرض الإلكترونيات' },
      { id: 'view_category_general_items', label: 'عرض المواد العامة' },
    ]
  },
  {
    category: 'الإعدادات والميزات',
    categoryLabel: 'الإعدادات والميزات',
    permissions: [
      { id: 'view_settings', label: 'عرض صفحة الإعدادات' },
      { id: 'manage_app_settings', label: 'إدارة إعدادات التطبيق العامة' },
      { id: 'manage_delivery_company', label: 'إدارة ربط شركة التوصيل' },
      { id: 'manage_delivery_sync', label: 'إدارة المزامنة التلقائية للطلبات' },
      { id: 'use_ai_assistant', label: 'استخدام المساعد الذكي' },
      { id: 'use_telegram_bot', label: 'استخدام بوت التليغرام' },
      { id: 'manage_notifications', label: 'إدارة الإشعارات' },
      { id: 'manage_theme', label: 'إدارة التيم والألوان' },
      { id: 'manage_backup', label: 'إدارة النسخ الاحتياطي' },
      { id: 'view_security_settings', label: 'عرض إعدادات الأمان' },
      { id: 'manage_display_settings', label: 'إدارة إعدادات العرض' },
      { id: 'manage_developer_settings', label: 'إدارة إعدادات المطور والألوان' },
    ]
  }
];