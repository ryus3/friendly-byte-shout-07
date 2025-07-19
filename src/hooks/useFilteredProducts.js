import React, { useMemo } from 'react';
import { useAuth } from '@/contexts/UnifiedAuthContext';

/**
 * Hook موحد لفلترة المنتجات حسب صلاحيات المستخدم
 * يطبق الفلترة في كل أنحاء النظام
 */
export const useFilteredProducts = (products) => {
  // التحقق من وجود React أولاً
  if (!React || !React.useMemo) {
    console.warn('React context is not available');
    return products || [];
  }

  const auth = useAuth();
  
  // التحقق من وجود Auth context أولاً
  if (!auth) {
    console.warn('useAuth context is null');
    return products || [];
  }
  
  const { user, productPermissions, isAdmin } = auth;
  
  // إضافة تسجيل للتشخيص
  console.log('🔍 useFilteredProducts Debug:', {
    products: products?.length || 0,
    user: user?.full_name,
    isAdmin,
    productPermissions,
    hasPermissions: !!productPermissions && Object.keys(productPermissions).length > 0
  });

  const filteredProducts = useMemo(() => {
    if (!products || !Array.isArray(products)) return [];
    
    console.log('🔍 فلترة المنتجات:', {
      totalProducts: products.length,
      isAdmin,
      productPermissions: Object.keys(productPermissions || {}).length
    });
    
    // المديرون يرون كل المنتجات (بما في ذلك غير النشطة)
    if (isAdmin) {
      console.log('✅ المدير - عرض جميع المنتجات');
      return products;
    }

    // الموظفون يرون فقط المنتجات النشطة
    const activeProducts = products.filter(p => p.is_active !== false);

    // إذا لم تكن هناك صلاحيات محددة، عرض المنتجات النشطة فقط (للموظفين الجدد)
    if (!productPermissions || Object.keys(productPermissions).length === 0) {
      console.log('⚠️ لا توجد صلاحيات محددة - عرض المنتجات النشطة فقط');
      return activeProducts;
    }

    // فلترة المنتجات حسب صلاحيات الموظف بناءً على productPermissions من المنتجات النشطة فقط
    const filtered = activeProducts.filter(product => {
      // فحص التصنيفات (categories) - صارم
      const categoryPerm = productPermissions.category;
      if (categoryPerm && !categoryPerm.has_full_access) {
        // إذا لم يكن للمنتج تصنيفات، فهو مرفوض
        if (!product.product_categories || product.product_categories.length === 0) {
          console.log('❌ منتج مرفوض - لا يحتوي على تصنيفات:', product.name);
          return false;
        }
        
        // التحقق من وجود تصنيف مسموح
        const hasAllowedCategory = product.product_categories.some(pc => 
          categoryPerm.allowed_items.includes(pc.category_id)
        );
        if (!hasAllowedCategory) {
          console.log('❌ منتج مرفوض بسبب التصنيف:', product.name);
          return false;
        }
      }

      // فحص الأقسام (departments) - صارم
      const departmentPerm = productPermissions.department;
      if (departmentPerm && !departmentPerm.has_full_access) {
        // إذا لم يكن للمنتج أقسام، فهو مرفوض
        if (!product.product_departments || product.product_departments.length === 0) {
          console.log('❌ منتج مرفوض - لا يحتوي على أقسام:', product.name);
          return false;
        }
        
        // التحقق من وجود قسم مسموح
        const hasAllowedDepartment = product.product_departments.some(pd => 
          departmentPerm.allowed_items.includes(pd.department_id)
        );
        if (!hasAllowedDepartment) {
          console.log('❌ منتج مرفوض بسبب القسم:', product.name);
          return false;
        }
      }

      // فحص أنواع المنتجات (product_types) - صارم
      const productTypePerm = productPermissions.product_type;
      if (productTypePerm && !productTypePerm.has_full_access) {
        // إذا لم يكن للمنتج أنواع، فهو مرفوض
        if (!product.product_product_types || product.product_product_types.length === 0) {
          console.log('❌ منتج مرفوض - لا يحتوي على أنواع منتجات:', product.name);
          return false;
        }
        
        // التحقق من وجود نوع مسموح
        const hasAllowedProductType = product.product_product_types.some(ppt => 
          productTypePerm.allowed_items.includes(ppt.product_type_id)
        );
        if (!hasAllowedProductType) {
          console.log('❌ منتج مرفوض بسبب نوع المنتج:', product.name);
          return false;
        }
      }

      // فحص المواسم والمناسبات (seasons_occasions) - صارم
      const seasonPerm = productPermissions.season_occasion;
      if (seasonPerm && !seasonPerm.has_full_access) {
        // إذا لم يكن للمنتج مواسم، فهو مرفوض
        if (!product.product_seasons_occasions || product.product_seasons_occasions.length === 0) {
          console.log('❌ منتج مرفوض - لا يحتوي على مواسم:', product.name);
          return false;
        }
        
        // التحقق من وجود موسم مسموح
        const hasAllowedSeason = product.product_seasons_occasions.some(pso => 
          seasonPerm.allowed_items.includes(pso.season_occasion_id)
        );
        if (!hasAllowedSeason) {
          console.log('❌ منتج مرفوض بسبب الموسم:', product.name);
          return false;
        }
      }

      console.log('✅ منتج مقبول:', product.name);
      return true;
    });
    
    console.log('🔍 نتيجة الفلترة:', {
      originalCount: products.length,
      filteredCount: filtered.length,
      difference: products.length - filtered.length,
      permissionTypes: Object.keys(productPermissions || {})
    });
    
    return filtered;
  }, [products, isAdmin, productPermissions]);

  return filteredProducts;
};

/**
 * Hook لفلترة متغيرات منتج واحد
 */
export const useFilteredVariants = (variants) => {
  // التحقق من وجود React أولاً
  if (!React || !React.useMemo) {
    console.warn('React context is not available in useFilteredVariants');
    return variants || [];
  }

  const auth = useAuth();
  
  // التحقق من وجود Auth context أولاً
  if (!auth) {
    console.warn('useAuth context is null in useFilteredVariants');
    return variants || [];
  }
  
  const { isAdmin, productPermissions } = auth;

  const filteredVariants = useMemo(() => {
    if (!variants || !Array.isArray(variants)) return [];
    
    // المديرون يرون كل المتغيرات
    if (isAdmin) return variants;

    // إذا لم تكن هناك صلاحيات محددة، عرض جميع المتغيرات
    if (!productPermissions || Object.keys(productPermissions).length === 0) {
      return variants;
    }

    // فلترة المتغيرات حسب صلاحيات الموظف
    return variants.filter(variant => {
      // فحص الألوان
      const colorPerm = productPermissions.color;
      if (colorPerm && !colorPerm.has_full_access && variant.color_id) {
        if (!colorPerm.allowed_items.includes(variant.color_id)) {
          return false;
        }
      }

      // فحص الأحجام
      const sizePerm = productPermissions.size;
      if (sizePerm && !sizePerm.has_full_access && variant.size_id) {
        if (!sizePerm.allowed_items.includes(variant.size_id)) {
          return false;
        }
      }

      return true;
    });
  }, [variants, isAdmin, productPermissions]);

  return filteredVariants;
};

export default useFilteredProducts;