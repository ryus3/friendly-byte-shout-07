import React, { useMemo } from 'react';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import ProductGrid from './ProductGrid';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, Eye, Package } from 'lucide-react';

const PermissionBasedProductGrid = ({ products, isLoading, ...otherProps }) => {
  const { isAdmin, filterProductsByPermissions } = useAuth();

  // فلترة المنتجات حسب صلاحيات المستخدم من UnifiedAuthContext
  const filteredProducts = useMemo(() => {
    if (!products || !Array.isArray(products)) return [];
    if (isAdmin) return products;
    
    // استخدام نظام الفلترة من UnifiedAuthContext
    return filterProductsByPermissions ? filterProductsByPermissions(products) : [];
  }, [products, isAdmin, filterProductsByPermissions]);

  // إذا لم يكن هناك منتجات مسموحة للموظف - عرض رسالة مختصرة
  if (!isAdmin && filteredProducts.length === 0 && !isLoading && products?.length > 0) {
    return (
      <div className="text-center py-8">
        <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-muted-foreground mb-2">لا توجد منتجات متاحة</h3>
        <p className="text-sm text-muted-foreground">
          تم تطبيق فلاتر الصلاحيات - راجع المدير لتحديث صلاحياتك
        </p>
      </div>
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