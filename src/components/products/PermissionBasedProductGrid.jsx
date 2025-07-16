import React, { useMemo } from 'react';
import usePermissionBasedData from '@/hooks/usePermissionBasedData';
import ProductGrid from './ProductGrid';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, Eye } from 'lucide-react';

const PermissionBasedProductGrid = ({ products, isLoading, ...otherProps }) => {
  const {
    isAdmin,
    filterProductsByPermissions,
    filterCategoriesByPermission,
    filterColorsByPermission,
    filterSizesByPermission,
    filterDepartmentsByPermission,
    filterProductTypesByPermission,
    filterSeasonsOccasionsByPermission
  } = usePermissionBasedData();

  // فلترة المنتجات حسب صلاحيات المستخدم
  const filteredProducts = useMemo(() => {
    if (!products || !Array.isArray(products)) return [];
    
    if (isAdmin) return products;
    
    // تطبيق فلترة تفصيلية للموظفين
    return products.filter(product => {
      // فحص صلاحيات التصنيفات
      if (product.category_id) {
        const allowedCategories = filterCategoriesByPermission([{ id: product.category_id }]);
        if (allowedCategories.length === 0) return false;
      }
      
      // فحص صلاحيات الأقسام من خلال product_departments
      if (product.departments && product.departments.length > 0) {
        const allowedDepartments = filterDepartmentsByPermission(product.departments);
        if (allowedDepartments.length === 0) return false;
      }
      
      // فحص صلاحيات التصنيفات المتعددة من خلال product_categories
      if (product.categories && product.categories.length > 0) {
        const allowedCategories = filterCategoriesByPermission(product.categories);
        if (allowedCategories.length === 0) return false;
      }
      
      // فحص صلاحيات أنواع المنتجات
      if (product.product_types && product.product_types.length > 0) {
        const allowedProductTypes = filterProductTypesByPermission(product.product_types);
        if (allowedProductTypes.length === 0) return false;
      }
      
      // فحص صلاحيات المواسم والمناسبات
      if (product.seasons_occasions && product.seasons_occasions.length > 0) {
        const allowedSeasonsOccasions = filterSeasonsOccasionsByPermission(product.seasons_occasions);
        if (allowedSeasonsOccasions.length === 0) return false;
      }
      
      // فحص صلاحيات الألوان والأحجام من خلال المتغيرات
      if (product.variants && product.variants.length > 0) {
        const allowedVariants = product.variants.filter(variant => {
          // فحص اللون
          if (variant.color_id) {
            const allowedColors = filterColorsByPermission([{ id: variant.color_id }]);
            if (allowedColors.length === 0) return false;
          }
          
          // فحص الحجم
          if (variant.size_id) {
            const allowedSizes = filterSizesByPermission([{ id: variant.size_id }]);
            if (allowedSizes.length === 0) return false;
          }
          
          return true;
        });
        
        // إذا لم تبقى متغيرات مسموحة، لا تعرض المنتج
        if (allowedVariants.length === 0) return false;
      }
      
      return true;
    });
  }, [
    products, 
    isAdmin, 
    filterCategoriesByPermission, 
    filterDepartmentsByPermission, 
    filterProductTypesByPermission, 
    filterSeasonsOccasionsByPermission,
    filterColorsByPermission,
    filterSizesByPermission
  ]);

  // إذا لم يكن هناك منتجات مسموحة للموظف
  if (!isAdmin && filteredProducts.length === 0 && !isLoading) {
    return (
      <Card className="w-full max-w-md mx-auto mt-8">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Lock className="w-12 h-12 text-muted-foreground" />
          </div>
          <CardTitle className="text-muted-foreground">
            لا توجد منتجات متاحة
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-sm text-muted-foreground mb-4">
            لا تملك الصلاحيات اللازمة لعرض المنتجات في هذا القسم
          </p>
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Eye className="w-4 h-4" />
            <span>يرجى مراجعة المدير لإعطائك الصلاحيات المناسبة</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <ProductGrid 
      products={filteredProducts} 
      isLoading={isLoading}
      {...otherProps}
    />
  );
};

export default PermissionBasedProductGrid;