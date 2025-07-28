import React, { useMemo } from 'react';
import { useAuth } from '@/contexts/UnifiedAuthContext';

/**
 * Hook موحد لفلترة المنتجات حسب صلاحيات المستخدم
 * يطبق الفلترة في كل أنحاء النظام
 */
export const useFilteredProducts = (products) => {

  const auth = useAuth();
  const { user, productPermissions, isAdmin } = auth || {};

  const filteredProducts = useMemo(() => {
    // التحقق من وجود Auth context أولاً
    if (!auth) {
      console.warn('useAuth context is null');
      return products || [];
    }
    
    if (!products || !Array.isArray(products)) return [];
    
    // المديرون يرون كل المنتجات (بما في ذلك غير النشطة)
    if (isAdmin) {
      return products;
    }

    // الموظفون يرون فقط المنتجات النشطة
    const activeProducts = products.filter(p => p.is_active !== false);

    // إذا لم تكن هناك صلاحيات محددة، عرض المنتجات النشطة فقط (للموظفين الجدد)
    if (!productPermissions || Object.keys(productPermissions).length === 0) {
      return activeProducts;
    }

    // فلترة المنتجات حسب صلاحيات الموظف بناءً على productPermissions من المنتجات النشطة فقط
    const filtered = activeProducts.filter(product => {
      // فحص التصنيفات (categories) - صارم
      const categoryPerm = productPermissions.category;
      if (categoryPerm && !categoryPerm.has_full_access) {
        // إذا لم يكن للمنتج تصنيفات، فهو مرفوض
        if (!product.product_categories || product.product_categories.length === 0) {
          return false;
        }
        
        // التحقق من وجود تصنيف مسموح
        const hasAllowedCategory = product.product_categories.some(pc => 
          categoryPerm.allowed_items.includes(pc.category_id)
        );
        if (!hasAllowedCategory) {
          return false;
        }
      }

      // فحص الأقسام (departments) - صارم
      const departmentPerm = productPermissions.department;
      if (departmentPerm && !departmentPerm.has_full_access) {
        // إذا لم يكن للمنتج أقسام، فهو مرفوض
        if (!product.product_departments || product.product_departments.length === 0) {
          return false;
        }
        
        // التحقق من وجود قسم مسموح
        const hasAllowedDepartment = product.product_departments.some(pd => 
          departmentPerm.allowed_items.includes(pd.department_id)
        );
        if (!hasAllowedDepartment) {
          return false;
        }
      }

      // فحص أنواع المنتجات (product_types) - صارم
      const productTypePerm = productPermissions.product_type;
      if (productTypePerm && !productTypePerm.has_full_access) {
        // إذا لم يكن للمنتج أنواع، فهو مرفوض
        if (!product.product_product_types || product.product_product_types.length === 0) {
          return false;
        }
        
        // التحقق من وجود نوع مسموح
        const hasAllowedProductType = product.product_product_types.some(ppt => 
          productTypePerm.allowed_items.includes(ppt.product_type_id)
        );
        if (!hasAllowedProductType) {
          return false;
        }
      }

      // فحص المواسم والمناسبات (seasons_occasions) - صارم
      const seasonPerm = productPermissions.season_occasion;
      if (seasonPerm && !seasonPerm.has_full_access) {
        // إذا لم يكن للمنتج مواسم، فهو مرفوض
        if (!product.product_seasons_occasions || product.product_seasons_occasions.length === 0) {
          return false;
        }
        
        // التحقق من وجود موسم مسموح
        const hasAllowedSeason = product.product_seasons_occasions.some(pso => 
          seasonPerm.allowed_items.includes(pso.season_occasion_id)
        );
        if (!hasAllowedSeason) {
          return false;
        }
      }

      return true;
    });
    
    return filtered;
  }, [products, isAdmin, productPermissions]);

  return filteredProducts;
};

/**
 * Hook لفلترة متغيرات منتج واحد
 */
export const useFilteredVariants = (variants) => {
  const auth = useAuth();
  const { isAdmin, productPermissions } = auth || {};

  const filteredVariants = useMemo(() => {
    // التحقق من وجود Auth context أولاً
    if (!auth) {
      console.warn('useAuth context is null in useFilteredVariants');
      return variants || [];
    }
    
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