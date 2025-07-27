export const permissionsMap = [
  {
    category: 'pages',
    categoryLabel: 'صفحات التطبيق',
    permissions: [
      { id: 'view_dashboard', label: 'عرض لوحة التحكم' },
      { id: 'view_products_page', label: 'عرض صفحة المنتجات' },
      { id: 'view_orders_page', label: 'عرض صفحة الطلبات' },
      { id: 'view_inventory_page', label: 'عرض صفحة المخزون' },
      { id: 'view_purchases_page', label: 'عرض صفحة المشتريات' },
      { id: 'view_accounting_page', label: 'عرض صفحة المحاسبة' },
      { id: 'view_profits_page', label: 'عرض صفحة الأرباح' },
      { id: 'view_employees_page', label: 'عرض صفحة الموظفين' },
      { id: 'view_settings_page', label: 'عرض صفحة الإعدادات' },
      { id: 'view_notifications_page', label: 'عرض صفحة الإشعارات' },
      { id: 'view_manage_products_page', label: 'عرض صفحة إدارة المنتجات' },
      { id: 'view_add_product_page', label: 'عرض صفحة إضافة منتج' },
      { id: 'barcode_inventory_access', label: 'الوصول لجرد الباركود' },
      { id: 'quick_order_access', label: 'الوصول للطلب السريع' },
      { id: 'detailed_inventory_access', label: 'الوصول للجرد التفصيلي' }
    ]
  },
  {
    category: 'dashboard',
    categoryLabel: 'لوحة التحكم',
    permissions: [
      { id: 'view_statistics', label: 'عرض الإحصائيات' },
      { id: 'view_charts', label: 'عرض الرسوم البيانية' },
      { id: 'view_recent_activities', label: 'عرض الأنشطة الحديثة' },
      { id: 'view_alerts', label: 'عرض التنبيهات' },
      { id: 'view_stock_alerts', label: 'عرض تنبيهات المخزون' },
      { id: 'view_ai_orders', label: 'عرض الطلبات الذكية' },
      { id: 'view_pending_profits', label: 'عرض الأرباح المعلقة' }
    ]
  },
  {
    category: 'products',
    categoryLabel: 'المنتجات والمخزن',
    permissions: [
      { id: 'view_products', label: 'عرض المنتجات' },
      { id: 'view_inventory', label: 'عرض الجرد والمخزون' },
      { id: 'use_barcode_scanner', label: 'استخدام قارئ الباركود' },
      { id: 'manage_products', label: 'إدارة المنتجات (إضافة/تعديل/حذف)' },
      { id: 'add_products', label: 'إضافة منتجات جديدة' },
      { id: 'edit_products', label: 'تعديل المنتجات الموجودة' },
      { id: 'delete_products', label: 'حذف المنتجات' },
      { id: 'edit_product_quantities', label: 'تعديل كميات المخزون يدوياً' },
      { id: 'print_labels', label: 'طباعة الملصقات' },
      { id: 'export_inventory', label: 'تصدير المخزون' },
      { id: 'import_products', label: 'استيراد المنتجات' },
      { id: 'manage_categories', label: 'إدارة التصنيفات والمتغيرات' },
      { id: 'view_all_classifications', label: 'عرض جميع التصنيفات' },
      { id: 'view_all_categories', label: 'عرض جميع الفئات' },
      { id: 'view_all_sizes', label: 'عرض جميع الأحجام' },
      { id: 'view_all_colors', label: 'عرض جميع الألوان' },
      { id: 'view_all_departments', label: 'عرض جميع الأقسام' },
      { id: 'view_all_product_types', label: 'عرض جميع أنواع المنتجات' },
      { id: 'view_all_seasons_occasions', label: 'عرض جميع المواسم والمناسبات' },
      { id: 'view_archived_products', label: 'عرض المنتجات المؤرشفة' },
      { id: 'archive_products', label: 'أرشفة المنتجات' },
      { id: 'restore_products', label: 'استعادة المنتجات المؤرشفة' }
    ]
  },
  {
    category: 'orders',
    categoryLabel: 'الطلبات والمبيعات',
    permissions: [
      { id: 'view_orders', label: 'عرض الطلبات' },
      { id: 'view_own_orders', label: 'عرض طلباتي فقط' },
      { id: 'create_orders', label: 'إنشاء طلبات جديدة' },
      { id: 'edit_orders', label: 'تعديل الطلبات قيد التجهيز' },
      { id: 'cancel_orders', label: 'إلغاء/حذف الطلبات قيد التجهيز' },
      { id: 'view_all_orders', label: 'عرض جميع الطلبات (لكل الموظفين)' },
      { id: 'change_order_status', label: 'تغيير حالة الطلب يدوياً' },
      { id: 'view_sales_analytics', label: 'عرض تحليلات المبيعات' },
      { id: 'process_returns', label: 'معالجة المرتجعات' },
      { id: 'quick_order', label: 'الطلبات السريعة' },
      { id: 'checkout_orders', label: 'إتمام الطلبات' },
      { id: 'view_order_details', label: 'عرض تفاصيل الطلبات' },
      { id: 'print_invoices', label: 'طباعة الفواتير' },
      { id: 'print_receipts', label: 'طباعة الإيصالات' },
      { id: 'manage_delivery_partners', label: 'إدارة شركات التوصيل' },
      { id: 'assign_orders', label: 'تخصيص الطلبات للموظفين' },
      { id: 'mark_receipt_received', label: 'تأكيد استلام الفاتورة' },
      { id: 'apply_discounts', label: 'تطبيق خصومات' }
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
      { id: 'view_purchase_analytics', label: 'عرض تحليلات المشتريات' },
      { id: 'approve_purchases', label: 'الموافقة على المشتريات' },
      { id: 'print_purchase_orders', label: 'طباعة أوامر الشراء' }
    ]
  },
  {
    category: 'accounting',
    categoryLabel: 'المحاسبة والتقارير',
    permissions: [
      { id: 'view_accounting', label: 'عرض صفحة المحاسبة' },
      { id: 'view_financial_reports', label: 'عرض التقارير المالية' },
      { id: 'view_profit_summary', label: 'عرض ملخص الأرباح' },
      { id: 'view_own_profits', label: 'عرض أرباحي فقط' },
      { id: 'manage_expenses', label: 'إدارة المصروفات' },
      { id: 'view_pending_dues', label: 'عرض المستحقات المعلقة' },
      { id: 'settle_dues', label: 'تسوية المستحقات' },
      { id: 'manage_profit_settlement', label: 'إدارة تسوية الأرباح' },
      { id: 'export_reports', label: 'تصدير التقارير' },
      { id: 'view_profits', label: 'عرض الأرباح' },
      { id: 'view_profit_details', label: 'عرض تفاصيل الأرباح' },
      { id: 'generate_invoices', label: 'إنشاء الفواتير' },
      { id: 'view_revenue_charts', label: 'عرض مخططات الإيرادات' }
    ]
  },
  {
    category: 'employees',
    categoryLabel: 'إدارة الموظفين',
    permissions: [
      { id: 'view_employees', label: 'عرض الموظفين' },
      { id: 'manage_employees', label: 'إدارة الموظفين' },
      { id: 'manage_users', label: 'إدارة المستخدمين والموافقة' },
      { id: 'manage_employee_profits', label: 'إدارة أرباح الموظفين' },
      { id: 'view_employee_performance', label: 'عرض أداء الموظفين' },
      { id: 'update_permissions', label: 'تحديث الصلاحيات' },
      { id: 'employee_follow_up', label: 'متابعة الموظفين' },
      { id: 'edit_employee_details', label: 'تعديل بيانات الموظفين' },
      { id: 'approve_employee_registrations', label: 'الموافقة على تسجيل الموظفين' },
      { id: 'reject_employee_registrations', label: 'رفض تسجيل الموظفين' },
      { id: 'manage_employee_roles', label: 'إدارة أدوار الموظفين' }
    ]
  },
  {
    category: 'customers',
    categoryLabel: 'إدارة العملاء',
    permissions: [
      { id: 'view_customers', label: 'عرض العملاء' },
      { id: 'add_customers', label: 'إضافة عملاء جدد' },
      { id: 'edit_customers', label: 'تعديل بيانات العملاء' },
      { id: 'delete_customers', label: 'حذف العملاء' },
      { id: 'manage_all_customers', label: 'إدارة جميع العملاء (لكل الموظفين)' },
      { id: 'view_customer_history', label: 'عرض تاريخ العميل' },
      { id: 'export_customers', label: 'تصدير قائمة العملاء' }
    ]
  },
  {
    category: 'system',
    categoryLabel: 'إعدادات النظام',
    permissions: [
      { id: 'view_settings', label: 'عرض صفحة الإعدادات' },
      { id: 'manage_settings', label: 'إدارة إعدادات النظام' },
      { id: 'view_notifications', label: 'عرض الإشعارات' },
      { id: 'manage_notifications', label: 'إدارة الإشعارات' },
      { id: 'view_system_logs', label: 'عرض سجلات النظام' },
      { id: 'backup_restore', label: 'النسخ الاحتياطي والاستعادة' },
      { id: 'use_ai_assistant', label: 'استخدام مساعد الذكاء الاصطناعي' },
      { id: 'ai_features', label: 'استخدام ميزات الذكاء الاصطناعي' },
      { id: 'appearance_settings', label: 'إعدادات المظهر' },
      { id: 'security_settings', label: 'إعدادات الأمان' },
      { id: 'profile_settings', label: 'إعدادات الملف الشخصي' },
      { id: 'manage_default_customer_name', label: 'إدارة اسم الزبون الافتراضي' },
      { id: 'set_default_page', label: 'تعيين الصفحة الافتراضية' },
      { id: 'manage_variants', label: 'إدارة التصنيفات والمتغيرات' },
      { id: 'telegram_bot_settings', label: 'إعدادات بوت التليغرام' },
      { id: 'delivery_settings', label: 'إعدادات التوصيل' },
      { id: 'stock_notification_settings', label: 'إعدادات إشعارات المخزون' },
      { id: 'reports_settings', label: 'إعدادات التقارير' }
    ]
  },
];

// Default permissions for each role
export const defaultPermissions = {
  employee: [
    // صفحات التطبيق الأساسية
    'view_dashboard',
    'view_products_page', 
    'view_orders_page',
    'view_inventory_page',
    'view_profits_page',
    
    // المنتجات والمخزن
    'view_products',
    'view_inventory',
    'use_barcode_scanner',
    
    // الطلبات والمبيعات
    'view_orders',
    'view_own_orders',
    'create_orders',
    'edit_orders',        // إضافة صلاحية التعديل للموظفين
    'cancel_orders',      // إضافة صلاحية الحذف/الإلغاء للموظفين
    'checkout_orders',
    'view_order_details',
    'print_invoices',
    'print_receipts',
    
    // لوحة التحكم
    'view_statistics',
    'view_recent_activities',
    
    // الأرباح الخاصة
    'view_own_profits',
    'view_profits',
    
    // الذكاء الاصطناعي
    'use_ai_assistant',
    
    // إعدادات شخصية
    'profile_settings'
  ],
  
  warehouse: [
    // صفحات التطبيق
    'view_dashboard',
    'view_products_page',
    'view_inventory_page', 
    'view_purchases_page',
    'view_barcode_inventory_page',
    'view_manage_products_page',
    
    // المنتجات والمخزن
    'view_products',
    'view_inventory',
    'use_barcode_scanner',
    'edit_product_quantities',
    'add_products',
    'edit_products',
    'print_labels',
    'export_inventory',
    
    // المشتريات
    'view_purchases',
    'create_purchases',
    'edit_purchases',
    'view_suppliers',
    
    // العملاء
    'view_customers',
    'add_customers',
    'edit_customers',
    
    // لوحة التحكم
    'view_statistics',
    'view_charts',
    'view_recent_activities',
    'view_stock_alerts',
    
    // إعدادات شخصية
    'profile_settings'
  ],
  
  deputy: [
    // جميع صفحات التطبيق الرئيسية
    'view_dashboard',
    'view_products_page',
    'view_orders_page',
    'view_inventory_page',
    'view_purchases_page',
    'view_accounting_page',
    'view_profits_page',
    'view_manage_products_page',
    'view_quick_order_page',
    'view_barcode_inventory_page',
    'view_detailed_inventory_page',
    
    // المنتجات والمخزن
    'view_products',
    'view_inventory',
    'use_barcode_scanner',
    'manage_products',
    'add_products',
    'edit_products',
    'edit_product_quantities',
    'print_labels',
    'export_inventory',
    'view_all_categories',
    'view_all_colors',
    'view_all_sizes',
    'view_all_departments',
    
    // الطلبات والمبيعات
    'view_orders',
    'view_all_orders',
    'create_orders',
    'edit_orders',
    'quick_order',
    'checkout_orders',
    'view_order_details',
    'view_sales_analytics',
    'print_invoices',
    'print_receipts',
    'assign_orders',
    'mark_receipt_received',
    'apply_discounts',
    
    // المشتريات
    'view_purchases',
    'create_purchases',
    'edit_purchases',
    'view_suppliers',
    'manage_suppliers',
    'view_purchase_analytics',
    
    // المحاسبة والأرباح
    'view_accounting',
    'view_financial_reports',
    'view_profit_summary',
    'view_profits',
    'view_profit_details',
    'manage_expenses',
    'export_reports',
    
    // العملاء
    'view_customers',
    'add_customers',
    'edit_customers',
    'view_customer_history',
    
    // لوحة التحكم
    'view_statistics',
    'view_charts',
    'view_recent_activities',
    'view_alerts',
    'view_stock_alerts',
    'view_pending_profits',
    
    // إعدادات
    'manage_default_customer_name',
    'profile_settings'
  ],
  
  admin: [
    // جميع صفحات التطبيق
    'view_dashboard',
    'view_products_page',
    'view_orders_page', 
    'view_inventory_page',
    'view_purchases_page',
    'view_accounting_page',
    'view_profits_page',
    'view_employees_page',
    'view_settings_page',
    'view_notifications_page',
    'view_manage_products_page',
    'view_add_product_page',
    'view_barcode_inventory_page',
    'view_quick_order_page',
    'view_detailed_inventory_page',
    
    // لوحة التحكم - كامل
    'view_statistics',
    'view_charts',
    'view_recent_activities',
    'view_alerts',
    'view_stock_alerts',
    'view_ai_orders',
    'view_pending_profits',
    
    // المنتجات والمخزن - كامل
    'view_products',
    'view_inventory',
    'use_barcode_scanner',
    'manage_products',
    'add_products',
    'edit_products',
    'delete_products',
    'edit_product_quantities',
    'print_labels',
    'export_inventory',
    'import_products',
    'manage_categories',
    'view_all_classifications',
    'view_all_categories',
    'view_all_sizes',
    'view_all_colors',
    'view_all_departments',
    'view_all_product_types',
    'view_all_seasons_occasions',
    'view_archived_products',
    'archive_products',
    'restore_products',
    
    // الطلبات والمبيعات - كامل
    'view_orders',
    'view_own_orders',
    'view_all_orders',
    'create_orders',
    'edit_orders',
    'cancel_orders',
    'change_order_status',
    'view_sales_analytics',
    'process_returns',
    'quick_order',
    'checkout_orders',
    'view_order_details',
    'print_invoices',
    'print_receipts',
    'manage_delivery_partners',
    'assign_orders',
    'mark_receipt_received',
    'apply_discounts',
    
    // المشتريات - كامل
    'view_purchases',
    'create_purchases',
    'edit_purchases',
    'delete_purchases',
    'view_suppliers',
    'manage_suppliers',
    'view_purchase_analytics',
    'approve_purchases',
    'print_purchase_orders',
    
    // المحاسبة والتقارير - كامل
    'view_accounting',
    'view_financial_reports',
    'view_profit_summary',
    'view_own_profits',
    'manage_expenses',
    'view_pending_dues',
    'settle_dues',
    'manage_profit_settlement',
    'export_reports',
    'view_profits',
    'view_profit_details',
    'generate_invoices',
    'view_revenue_charts',
    
    // إدارة الموظفين - كامل
    'view_employees',
    'manage_employees',
    'manage_users',
    'manage_employee_profits',
    'view_employee_performance',
    'update_permissions',
    'employee_follow_up',
    'edit_employee_details',
    'approve_employee_registrations',
    'reject_employee_registrations',
    'manage_employee_roles',
    
    // إدارة العملاء - كامل
    'view_customers',
    'add_customers',
    'edit_customers',
    'delete_customers',
    'view_customer_history',
    'export_customers',
    
    // إعدادات النظام - كامل
    'view_settings',
    'manage_settings',
    'view_notifications',
    'manage_notifications',
    'view_system_logs',
    'backup_restore',
    'ai_features',
    'appearance_settings',
    'security_settings',
    'profile_settings',
    'manage_default_customer_name',
    'set_default_page',
    'manage_variants',
    'telegram_bot_settings',
    'delivery_settings',
    'stock_notification_settings',
    'reports_settings'
  ]
};