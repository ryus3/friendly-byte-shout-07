import { useMemo } from 'react';
import usePermissionBasedData from './usePermissionBasedData';

/**
 * Hook موحد لفلترة المنتجات حسب صلاحيات المستخدم
 * يطبق الفلترة في كل أنحاء النظام
 */
export const useFilteredProducts = (products) => {
  const { 
    isAdmin, 
    filterCategoriesByPermission,
    filterDepartmentsByPermission,
    filterColorsByPermission,
    filterSizesByPermission,
    filterProductTypesByPermission,
    filterSeasonsOccasionsByPermission
  } = usePermissionBasedData();

  const filteredProducts = useMemo(() => {
    if (!products || !Array.isArray(products)) return [];
    
    // المديرون يرون كل المنتجات
    if (isAdmin) return products;

    // فلترة المنتجات حسب صلاحيات الموظف
    return products.filter(product => {
      let hasValidPermission = false;

      // فحص التصنيفات (categories)
      if (product.product_categories && product.product_categories.length > 0) {
        const productCategories = product.product_categories.map(pc => pc.categories).filter(Boolean);
        const allowedCategories = filterCategoriesByPermission(productCategories);
        if (allowedCategories.length > 0) hasValidPermission = true;
      }

      // فحص الأقسام (departments)
      if (product.product_departments && product.product_departments.length > 0) {
        const productDepartments = product.product_departments.map(pd => pd.departments).filter(Boolean);
        const allowedDepartments = filterDepartmentsByPermission(productDepartments);
        if (allowedDepartments.length > 0) hasValidPermission = true;
      }

      // فحص أنواع المنتجات (product_types)
      if (product.product_product_types && product.product_product_types.length > 0) {
        const productTypes = product.product_product_types.map(ppt => ppt.product_types).filter(Boolean);
        const allowedProductTypes = filterProductTypesByPermission(productTypes);
        if (allowedProductTypes.length > 0) hasValidPermission = true;
      }

      // فحص المواسم والمناسبات (seasons_occasions)
      if (product.product_seasons_occasions && product.product_seasons_occasions.length > 0) {
        const seasonsOccasions = product.product_seasons_occasions.map(pso => pso.seasons_occasions).filter(Boolean);
        const allowedSeasonsOccasions = filterSeasonsOccasionsByPermission(seasonsOccasions);
        if (allowedSeasonsOccasions.length > 0) hasValidPermission = true;
      }

      // إذا لم توجد أي صلاحيات صالحة، أخفي المنتج
      if (!hasValidPermission) return false;

      // فحص المتغيرات (variants) - فلترة حسب الألوان والأحجام
      if (product.variants && product.variants.length > 0) {
        const allowedVariants = product.variants.filter(variant => {
          let variantHasPermission = true;

          // فحص الألوان - إذا كان للمتغير لون محدد
          if (variant.color_id || variant.colors) {
            const variantColors = variant.colors ? [variant.colors] : [];
            if (variantColors.length > 0) {
              const allowedColors = filterColorsByPermission(variantColors);
              if (allowedColors.length === 0) variantHasPermission = false;
            }
          }

          // فحص الأحجام - إذا كان للمتغير حجم محدد
          if (variant.size_id || variant.sizes) {
            const variantSizes = variant.sizes ? [variant.sizes] : [];
            if (variantSizes.length > 0) {
              const allowedSizes = filterSizesByPermission(variantSizes);
              if (allowedSizes.length === 0) variantHasPermission = false;
            }
          }

          return variantHasPermission;
        });

        // إذا لم تكن هناك متغيرات مسموحة، أخفي المنتج
        if (allowedVariants.length === 0) return false;

        // فلترة المتغيرات في المنتج نفسه
        product.variants = allowedVariants;
        product.product_variants = allowedVariants;
      }

      return true;
    });
  }, [
    products, 
    isAdmin, 
    filterCategoriesByPermission,
    filterDepartmentsByPermission,
    filterColorsByPermission,
    filterSizesByPermission,
    filterProductTypesByPermission,
    filterSeasonsOccasionsByPermission
  ]);

  return filteredProducts;
};

/**
 * Hook لفلترة متغيرات منتج واحد
 */
export const useFilteredVariants = (variants) => {
  const { 
    isAdmin, 
    filterColorsByPermission,
    filterSizesByPermission
  } = usePermissionBasedData();

  const filteredVariants = useMemo(() => {
    if (!variants || !Array.isArray(variants)) return [];
    
    // المديرون يرون كل المتغيرات
    if (isAdmin) return variants;

    // فلترة المتغيرات حسب صلاحيات الموظف
    return variants.filter(variant => {
      // فحص الألوان
      if (variant.color_id || variant.colors) {
        const variantColors = variant.colors ? [variant.colors] : [];
        if (variantColors.length > 0) {
          const allowedColors = filterColorsByPermission(variantColors);
          if (allowedColors.length === 0) return false;
        }
      }

      // فحص الأحجام
      if (variant.size_id || variant.sizes) {
        const variantSizes = variant.sizes ? [variant.sizes] : [];
        if (variantSizes.length > 0) {
          const allowedSizes = filterSizesByPermission(variantSizes);
          if (allowedSizes.length === 0) return false;
        }
      }

      return true;
    });
  }, [variants, isAdmin, filterColorsByPermission, filterSizesByPermission]);

  return filteredVariants;
};

export default useFilteredProducts;