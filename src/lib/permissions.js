export const permissionsMap = [
  {
    category: 'products',
    categoryLabel: 'المنتجات والمخزن',
    permissions: [
      { id: 'view_products', label: 'عرض المنتجات' },
      { id: 'view_inventory', label: 'عرض الجرد والمخزون' },
      { id: 'use_barcode_scanner', label: 'استخدام قارئ الباركود' },
      { id: 'manage_products', label: 'إدارة المنتجات (إضافة/تعديل/حذف)' },
      { id: 'edit_product_quantities', label: 'تعديل كميات المخزون يدوياً' },
      { id: 'manage_categories', label: 'إدارة التصنيفات والمتغيرات' },
      { id: 'view_all_classifications', label: 'عرض جميع التصنيفات' },
      { id: 'view_all_categories', label: 'عرض جميع الفئات' },
      { id: 'view_all_sizes', label: 'عرض جميع الأحجام' },
      { id: 'view_all_colors', label: 'عرض جميع الألوان' },
      { id: 'print_labels', label: 'طباعة الملصقات' },
      { id: 'export_inventory', label: 'تصدير المخزون' },
      { id: 'import_products', label: 'استيراد المنتجات' }
    ]
  },
  {
    category: 'orders',
    categoryLabel: 'الطلبات والمبيعات',
    permissions: [
      { id: 'view_orders', label: 'عرض الطلبات' },
      { id: 'create_orders', label: 'إنشاء طلبات جديدة' },
      { id: 'edit_orders', label: 'تعديل الطلبات' },
      { id: 'cancel_orders', label: 'إلغاء الطلبات' },
      { id: 'view_sales_analytics', label: 'عرض تحليلات المبيعات' },
      { id: 'process_returns', label: 'معالجة المرتجعات' },
      { id: 'quick_order', label: 'الطلبات السريعة' },
      { id: 'checkout_orders', label: 'إتمام الطلبات' },
      { id: 'view_order_details', label: 'عرض تفاصيل الطلبات' },
      { id: 'print_invoices', label: 'طباعة الفواتير' }
    ]
  },
  {
    category: 'purchases',
    categoryLabel: 'المشتريات والموردين',
    permissions: [
      { id: 'view_purchases', label: 'عرض المشتريات' },
      { id: 'create_purchases', label: 'إنشاء مشتريات جديدة' },
      { id: 'edit_purchases', label: 'تعديل المشتريات' },
      { id: 'delete_purchases', label: 'حذف المشتريات' },
      { id: 'view_suppliers', label: 'عرض الموردين' },
      { id: 'manage_suppliers', label: 'إدارة الموردين' },
      { id: 'view_purchase_analytics', label: 'عرض تحليلات المشتريات' }
    ]
  },
  {
    category: 'accounting',
    categoryLabel: 'المحاسبة والتقارير',
    permissions: [
      { id: 'view_financial_reports', label: 'عرض التقارير المالية' },
      { id: 'view_profit_summary', label: 'عرض ملخص الأرباح' },
      { id: 'manage_expenses', label: 'إدارة المصروفات' },
      { id: 'view_pending_dues', label: 'عرض المستحقات المعلقة' },
      { id: 'settle_dues', label: 'تسوية المستحقات' },
      { id: 'export_reports', label: 'تصدير التقارير' },
      { id: 'profit_settlement', label: 'تسوية الأرباح' },
      { id: 'settlement_invoices', label: 'فواتير التسوية' },
      { id: 'view_profits', label: 'عرض الأرباح' }
    ]
  },
  {
    category: 'employees',
    categoryLabel: 'إدارة الموظفين',
    permissions: [
      { id: 'view_employees', label: 'عرض الموظفين' },
      { id: 'manage_employees', label: 'إدارة الموظفين' },
      { id: 'manage_employee_profits', label: 'إدارة أرباح الموظفين' },
      { id: 'view_employee_performance', label: 'عرض أداء الموظفين' },
      { id: 'update_permissions', label: 'تحديث الصلاحيات' },
      { id: 'employee_follow_up', label: 'متابعة الموظفين' },
      { id: 'edit_employee_details', label: 'تعديل بيانات الموظفين' }
    ]
  },
  {
    category: 'system',
    categoryLabel: 'إعدادات النظام',
    permissions: [
      { id: 'manage_settings', label: 'إدارة إعدادات النظام' },
      { id: 'view_notifications', label: 'عرض الإشعارات' },
      { id: 'manage_notifications', label: 'إدارة الإشعارات' },
      { id: 'view_system_logs', label: 'عرض سجلات النظام' },
      { id: 'backup_restore', label: 'النسخ الاحتياطي والاستعادة' },
      { id: 'ai_features', label: 'استخدام ميزات الذكاء الاصطناعي' },
      { id: 'appearance_settings', label: 'إعدادات المظهر' },
      { id: 'security_settings', label: 'إعدادات الأمان' },
      { id: 'profile_settings', label: 'إعدادات الملف الشخصي' }
    ]
  },
  {
    category: 'dashboard',
    categoryLabel: 'لوحة التحكم',
    permissions: [
      { id: 'view_dashboard', label: 'عرض لوحة التحكم' },
      { id: 'view_statistics', label: 'عرض الإحصائيات' },
      { id: 'view_charts', label: 'عرض الرسوم البيانية' },
      { id: 'view_recent_activities', label: 'عرض الأنشطة الحديثة' },
      { id: 'view_alerts', label: 'عرض التنبيهات' },
      { id: 'manage_ai_orders', label: 'إدارة طلبات الذكاء الاصطناعي' }
    ]
  }
];