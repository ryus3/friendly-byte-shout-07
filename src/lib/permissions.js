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
    category: 'الإعدادات والميزات',
    categoryLabel: 'الإعدادات والميزات',
    permissions: [
      { id: 'view_settings', label: 'عرض صفحة الإعدادات' },
      { id: 'manage_app_settings', label: 'إدارة إعدادات التطبيق العامة' },
      { id: 'manage_delivery_company', label: 'إدارة ربط شركة التوصيل' },
      { id: 'manage_delivery_sync', label: 'إدارة المزامنة التلقائية للطلبات' },
      { id: 'use_ai_assistant', label: 'استخدام المساعد الذكي' },
    ]
  }
];