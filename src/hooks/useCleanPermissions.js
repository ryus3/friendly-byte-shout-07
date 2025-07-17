import { useMemo } from 'react';
import useUnifiedPermissions from './useUnifiedPermissions';

/**
 * Hook نظيف لإدارة الصلاحيات - يحل محل جميع الأنظمة القديمة
 * يوفر واجهة موحدة وآمنة للتعامل مع الصلاحيات والأدوار
 */
export const useCleanPermissions = () => {
  const {
    user,
    userRoles,
    userPermissions,
    productPermissions,
    loading,
    isAdmin,
    isDepartmentManager,
    isSalesEmployee,
    isWarehouseEmployee,
    isCashier,
    hasRole,
    hasPermission,
    canViewAllData,
    canManageEmployees,
    canManageFinances,
    filterDataByUser,
    filterProductsByPermissions,
    getEmployeeStats
  } = useUnifiedPermissions();

  // الأدوار المُبسطة (لضمان التوافق)
  const userRole = useMemo(() => {
    if (isAdmin) return 'super_admin';
    if (isDepartmentManager) return 'department_manager';
    if (isWarehouseEmployee) return 'warehouse_employee';
    if (isCashier) return 'cashier';
    return 'sales_employee';
  }, [isAdmin, isDepartmentManager, isWarehouseEmployee, isCashier]);

  // الصلاحيات الأساسية
  const permissions = useMemo(() => ({
    // عرض البيانات
    canViewAllData,
    canViewAllOrders: canViewAllData || hasPermission('view_all_orders'),
    canViewAllProfits: canViewAllData || hasPermission('view_all_profits'),
    canViewDashboard: hasPermission('view_dashboard'),
    canViewReports: hasPermission('view_reports'),
    
    // إدارة الموظفين
    canManageEmployees,
    canManageUsers: hasPermission('manage_users'),
    canViewAllEmployees: hasPermission('view_all_employees'),
    
    // إدارة المنتجات
    canManageProducts: hasPermission('manage_products'),
    canManageInventory: hasPermission('manage_inventory'),
    canManagePurchases: hasPermission('manage_purchases'),
    
    // إدارة الطلبات
    canCreateOrders: hasPermission('create_orders'),
    canManageOrders: hasPermission('manage_orders'),
    canViewOrders: hasPermission('view_orders'),
    
    // إدارة الأرباح
    canViewProfits: hasPermission('view_profits'),
    canManageProfitSettlement: hasPermission('manage_profit_settlement'),
    canRequestProfitSettlement: hasPermission('request_profit_settlement'),
    
    // إدارة النظام
    canManageSettings: hasPermission('manage_settings'),
    canViewAccounting: hasPermission('view_accounting'),
    canManageFinances,
    
    // إدارة المساعد الذكي
    canUseAiAssistant: hasPermission('use_ai_assistant'),
    
    // صلاحيات متقدمة
    canAccessDeliveryPartners: user?.delivery_partner_access === true,
    canManageVariants: hasPermission('manage_variants'),
  }), [hasPermission, canViewAllData, canManageEmployees, canManageFinances, user?.delivery_partner_access]);

  // فلترة المتغيرات بناءً على الصلاحيات
  const variantFilters = useMemo(() => ({
    filterCategories: (categories) => {
      if (!categories) return [];
      if (isAdmin) return categories;
      
      const categoryPerm = productPermissions.category;
      if (!categoryPerm || categoryPerm.has_full_access) return categories;
      
      return categories.filter(cat => 
        categoryPerm.allowed_items.includes(cat.id)
      );
    },
    
    filterColors: (colors) => {
      if (!colors) return [];
      if (isAdmin) return colors;
      
      const colorPerm = productPermissions.color;
      if (!colorPerm || colorPerm.has_full_access) return colors;
      
      return colors.filter(color => 
        colorPerm.allowed_items.includes(color.id)
      );
    },
    
    filterSizes: (sizes) => {
      if (!sizes) return [];
      if (isAdmin) return sizes;
      
      const sizePerm = productPermissions.size;
      if (!sizePerm || sizePerm.has_full_access) return sizes;
      
      return sizes.filter(size => 
        sizePerm.allowed_items.includes(size.id)
      );
    },
    
    filterDepartments: (departments) => {
      if (!departments) return [];
      if (isAdmin) return departments;
      
      const departmentPerm = productPermissions.department;
      if (!departmentPerm || departmentPerm.has_full_access) return departments;
      
      return departments.filter(dept => 
        departmentPerm.allowed_items.includes(dept.id)
      );
    },
    
    filterProductTypes: (productTypes) => {
      if (!productTypes) return [];
      if (isAdmin) return productTypes;
      
      const productTypePerm = productPermissions.product_type;
      if (!productTypePerm || productTypePerm.has_full_access) return productTypes;
      
      return productTypes.filter(type => 
        productTypePerm.allowed_items.includes(type.id)
      );
    },
    
    filterSeasonsOccasions: (seasonsOccasions) => {
      if (!seasonsOccasions) return [];
      if (isAdmin) return seasonsOccasions;
      
      const seasonPerm = productPermissions.season_occasion;
      if (!seasonPerm || seasonPerm.has_full_access) return seasonsOccasions;
      
      return seasonsOccasions.filter(item => 
        seasonPerm.allowed_items.includes(item.id)
      );
    }
  }), [isAdmin, productPermissions]);

  // فلترة البيانات
  const dataFilters = useMemo(() => ({
    // فلترة الطلبات
    filterOrders: (orders) => {
      if (!orders) return [];
      if (canViewAllData) return orders;
      return orders.filter(order => {
        const createdBy = order.created_by;
        return createdBy === user?.id || createdBy === user?.user_id;
      });
    },
    
    // فلترة الأرباح
    filterProfits: (profits) => {
      if (!profits) return [];
      if (canViewAllData) return profits;
      return profits.filter(profit => {
        const employeeId = profit.employee_id;
        return employeeId === user?.id || employeeId === user?.user_id;
      });
    },
    
    // فلترة الإشعارات
    filterNotifications: (notifications) => {
      if (!notifications) return [];
      
      return notifications.filter(notification => {
        const notificationUserId = notification.user_id;
        if (notificationUserId === user?.user_id || notificationUserId === user?.id) {
          return true;
        }
        
        // الإشعارات العامة للمديرين
        if (notificationUserId === null) {
          return isAdmin || isDepartmentManager;
        }
        
        return false;
      });
    },
    
    // فلترة المنتجات
    filterProducts: filterProductsByPermissions
  }), [canViewAllData, user?.id, user?.user_id, isAdmin, isDepartmentManager, filterProductsByPermissions]);

  return {
    // بيانات المستخدم
    user,
    userRole,
    loading,
    
    // الأدوار
    isAdmin,
    isDepartmentManager,
    isSalesEmployee,
    isWarehouseEmployee,
    isCashier,
    hasRole,
    
    // الصلاحيات
    permissions,
    hasPermission,
    
    // فلترة البيانات
    ...dataFilters,
    
    // فلترة المتغيرات
    ...variantFilters,
    
    // بيانات متقدمة
    userRoles,
    userPermissions,
    productPermissions,
    getEmployeeStats
  };
};

export default useCleanPermissions;