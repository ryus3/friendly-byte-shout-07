import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Package, TriangleAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useInventory } from '@/contexts/InventoryContext';
import { usePermissions } from '@/hooks/usePermissions';
import StockAlertsWindow from './StockAlertsWindow';
import DefaultProductImage from '@/components/ui/default-product-image';

const StockAlertsCard = () => {
  const navigate = useNavigate();
  const { products, settings } = useInventory(); // المنتجات المفلترة تلقائياً
  const { canManageFinances, isAdmin } = usePermissions();
  const [alertsWindowOpen, setAlertsWindowOpen] = useState(false);
  
  // حساب المنتجات منخفضة المخزون - تجميع حسب المنتج وليس المتغيرات
  const lowStockProducts = React.useMemo(() => {
    if (!products || !Array.isArray(products)) return [];
    
    const threshold = settings?.lowStockThreshold || 5;
    const lowStockItems = [];
    
    products.forEach(product => {
      if (product.variants && product.variants.length > 0) {
        // حساب إجمالي الكمية للمنتج (جميع المتغيرات)
        const totalQuantity = product.variants.reduce((sum, variant) => sum + (variant.quantity || 0), 0);
        
        // إذا كان إجمالي المنتج أقل من الحد المطلوب
        if (totalQuantity <= threshold) {
          lowStockItems.push({
            id: product.id,
            productName: product.name,
            productImage: product.images?.[0],
            totalQuantity: totalQuantity,
            variants: product.variants
          });
        }
      }
    });
    
    return lowStockItems;
  }, [products, settings?.lowStockThreshold]);
  
  // إخفاء إعدادات المخزون عن موظفي المبيعات
  const canManageStockSettings = canManageFinances || isAdmin;

  const handleViewAll = () => {
    setAlertsWindowOpen(true);
  };
  
  const handleLowStockProductClick = (product) => {
    navigate(`/inventory?product=${product.id}`, {
      state: { 
        productId: product.id,
        highlight: true
      }
    });
  };

  return (
    <Card className="w-full border-border/40 shadow-sm bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-4 border-b border-border/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TriangleAlert className="w-5 h-5 text-amber-600" />
            <CardTitle className="text-lg font-semibold text-foreground">تنبيهات المخزون</CardTitle>
          </div>
          {lowStockProducts && lowStockProducts.length > 0 && (
            <div className="flex items-center justify-center w-8 h-8 bg-red-500 rounded-full text-white text-sm font-bold">
              {lowStockProducts.length}
            </div>
          )}
        </div>
        {lowStockProducts && lowStockProducts.length > 0 && (
          <p className="text-sm text-muted-foreground">المنتجات التي وصل مخزونها للحد الأدنى</p>
        )}
      </CardHeader>

      <CardContent className="p-4 space-y-3">
        {lowStockProducts && lowStockProducts.length > 0 ? (
          <>
            {lowStockProducts.slice(0, 5).map((product, index) => (
              <div
                key={product.id}
                className="flex items-center justify-between p-3 bg-card border border-border/50 rounded-lg cursor-pointer"
                onClick={() => handleLowStockProductClick(product)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted border border-border/30">
                    {product.productImage ? (
                      <img 
                        src={product.productImage} 
                        alt={product.productName} 
                        className="w-10 h-10 rounded-md object-cover"
                      />
                    ) : (
                      <DefaultProductImage className="w-10 h-10 rounded-md" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-medium text-sm text-foreground">
                      {product.productName}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {product.variants.length} متغيرات
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-center w-8 h-8 bg-red-500 rounded-full text-white text-sm font-bold">
                  {product.totalQuantity}
                </div>
              </div>
            ))}
            <Button 
              variant="outline" 
              size="sm"
              className="w-full mt-3"
              onClick={handleViewAll}
            >
              عرض كل التنبيهات
            </Button>
          </>
        ) : (
          <div className="text-center py-8">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
              <Package className="w-6 h-6 text-primary" />
            </div>
            <p className="text-primary font-medium text-sm">المخزون ممتاز</p>
            <p className="text-muted-foreground text-xs mt-0.5">جميع المنتجات متوفرة</p>
          </div>
        )}
      </CardContent>
      
      <StockAlertsWindow 
        open={alertsWindowOpen}
        onOpenChange={setAlertsWindowOpen}
        canManageSettings={canManageStockSettings}
      />
    </Card>
  );
};

export default StockAlertsCard;