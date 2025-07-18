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

    console.log('🔍 فلترة المنتجات:', {
      productsCount: products.length,
      isAdmin,
      user: usePermissionBasedData()?.user
    });

    // فلترة المنتجات حسب صلاحيات الموظف
    return products.filter(product => {
      console.log('🔍 فحص منتج:', product.name, {
        product_categories: product.product_categories,
        product_departments: product.product_departments,
        product_product_types: product.product_product_types,
        product_seasons_occasions: product.product_seasons_occasions
      });

      // فحص التصنيفات (categories) - إذا كان للمنتج تصنيفات
      if (product.product_categories && product.product_categories.length > 0) {
        const productCategories = product.product_categories.map(pc => pc.categories).filter(Boolean);
        const allowedCategories = filterCategoriesByPermission(productCategories);
        console.log('تصنيفات المنتج:', { productCategories, allowedCategories });
        if (allowedCategories.length === 0) return false; // المنتج له تصنيفات لكن المستخدم لا يملك صلاحية عليها
      }

      // فحص الأقسام (departments) - إذا كان للمنتج أقسام
      if (product.product_departments && product.product_departments.length > 0) {
        const productDepartments = product.product_departments.map(pd => pd.departments).filter(Boolean);
        const allowedDepartments = filterDepartmentsByPermission(productDepartments);
        console.log('أقسام المنتج:', { productDepartments, allowedDepartments });
        if (allowedDepartments.length === 0) return false; // المنتج له أقسام لكن المستخدم لا يملك صلاحية عليها
      }

      // فحص أنواع المنتجات (product_types) - إذا كان للمنتج أنواع
      if (product.product_product_types && product.product_product_types.length > 0) {
        const productTypes = product.product_product_types.map(ppt => ppt.product_types).filter(Boolean);
        const allowedProductTypes = filterProductTypesByPermission(productTypes);
        console.log('أنواع المنتج:', { productTypes, allowedProductTypes });
        if (allowedProductTypes.length === 0) return false; // المنتج له أنواع لكن المستخدم لا يملك صلاحية عليها
      }

      // فحص المواسم والمناسبات (seasons_occasions) - إذا كان للمنتج مواسم
      if (product.product_seasons_occasions && product.product_seasons_occasions.length > 0) {
        const seasonsOccasions = product.product_seasons_occasions.map(pso => pso.seasons_occasions).filter(Boolean);
        const allowedSeasonsOccasions = filterSeasonsOccasionsByPermission(seasonsOccasions);
        console.log('مواسم المنتج:', { seasonsOccasions, allowedSeasonsOccasions });
        if (allowedSeasonsOccasions.length === 0) return false; // المنتج له مواسم لكن المستخدم لا يملك صلاحية عليها
      }

      // إذا وصل إلى هنا، المنتج مسموح له
      console.log('✅ المنتج مسموح:', product.name);

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