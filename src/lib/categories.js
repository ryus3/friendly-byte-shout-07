export const categories = {
  mens_clothing: {
    label: 'ملابس رجالية',
    permission: 'view_mens_clothing',
    subCategories: {
      summer: { 
        label: 'صيفية', 
        permission: 'view_mens_clothing_summer',
        types: [
          { id: 'shirt', label: 'قميص' },
          { id: 'tshirt', label: 'تي شيرت' },
          { id: 'pants', label: 'بنطرون' },
          { id: 'shorts', label: 'شورت' },
        ]
      },
      winter: { 
        label: 'شتوية', 
        permission: 'view_mens_clothing_winter',
        types: [
          { id: 'jacket', label: 'جاكيت' },
          { id: 'sweater', label: 'سترة' },
          { id: 'hoodie', label: 'هودي' },
        ]
      },
    }
  },
  womens_clothing: {
    label: 'ملابس نسائية',
    permission: 'view_womens_clothing',
    subCategories: {
      summer: { 
        label: 'صيفية', 
        permission: 'view_womens_clothing_summer',
        types: [
          { id: 'dress', label: 'فستان' },
          { id: 'skirt', label: 'تنورة' },
          { id: 'blouse', label: 'بلوزة' },
        ]
      },
      winter: { 
        label: 'شتوية', 
        permission: 'view_womens_clothing_winter',
        types: [
          { id: 'coat', label: 'معطف' },
          { id: 'cardigan', label: 'كارديغان' },
        ]
      },
    }
  },
  general_items: {
    label: 'مواد عامة',
    permission: 'view_general_items',
    subCategories: {}
  },
};

export const generatePermissionsMap = () => {
  const basicPermissions = [
    { id: 'view_dashboard', label: 'عرض لوحة التحكم' },
    { id: 'create_orders', label: 'إنشاء طلبات' },
    { id: 'view_orders', label: 'عرض الطلبات' },
    { id: 'view_products', label: 'عرض كل المنتجات' },
    { id: 'add_products', label: 'إدارة المنتجات' },
    { id: 'view_inventory', label: 'عرض الجرد' },
    { id: 'view_purchases', label: 'عرض المشتريات' },
    { id: 'manage_users', label: 'إدارة الموظفين' },
    { id: 'manage_app_settings', label: 'إدارة إعدادات التطبيق' },
    { id: 'apply_order_discounts', label: 'تطبيق خصومات على الطلبات' },
  ];

  const categoryPermissions = [];
  for (const mainCatId in categories) {
    const mainCat = categories[mainCatId];
    categoryPermissions.push({ id: mainCat.permission, label: `عرض قسم ${mainCat.label}` });
    if (mainCat.subCategories) {
      for (const subCatId in mainCat.subCategories) {
        const subCat = mainCat.subCategories[subCatId];
        categoryPermissions.push({ id: subCat.permission, label: `عرض ${mainCat.label} - ${subCat.label}` });
      }
    }
  }

  return [...basicPermissions, ...categoryPermissions];
};

export const permissionsMap = generatePermissionsMap();