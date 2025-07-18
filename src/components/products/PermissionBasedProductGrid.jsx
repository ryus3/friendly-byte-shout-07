import React, { useMemo } from 'react';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import ProductGrid from './ProductGrid';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, Eye } from 'lucide-react';

const PermissionBasedProductGrid = ({ products, isLoading, ...otherProps }) => {
  const { isAdmin, filterProductsByPermissions } = useAuth();

  // فلترة المنتجات حسب صلاحيات المستخدم من UnifiedAuthContext
  const filteredProducts = useMemo(() => {
    console.log('PermissionBasedProductGrid - المنتجات الواردة:', products);
    console.log('PermissionBasedProductGrid - isAdmin:', isAdmin);
    console.log('PermissionBasedProductGrid - filterProductsByPermissions:', filterProductsByPermissions);
    
    if (!products || !Array.isArray(products)) {
      console.log('PermissionBasedProductGrid - لا توجد منتجات أو ليست مصفوفة');
      return [];
    }
    if (isAdmin) {
      console.log('PermissionBasedProductGrid - المستخدم مدير، إرجاع جميع المنتجات');
      return products;
    }
    
    // استخدام نظام الفلترة من UnifiedAuthContext
    const filtered = filterProductsByPermissions ? filterProductsByPermissions(products) : [];
    console.log('PermissionBasedProductGrid - المنتجات بعد الفلترة:', filtered);
    return filtered;
  }, [products, isAdmin, filterProductsByPermissions]);

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