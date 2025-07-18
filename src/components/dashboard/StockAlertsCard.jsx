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
  const { getLowStockProducts, settings } = useInventory();
  const { canManageFinances, isAdmin } = usePermissions();
  const [alertsWindowOpen, setAlertsWindowOpen] = useState(false);
  
  // استخدام المنتجات المفلترة من السياق (InventoryContext يطبق الفلترة تلقائياً)
  const lowStockProducts = getLowStockProducts(settings?.lowStockThreshold || 5);
  
  // إخفاء إعدادات المخزون عن موظفي المبيعات
  const canManageStockSettings = canManageFinances || isAdmin;

  const handleViewAll = () => {
    setAlertsWindowOpen(true);
  };
  
  const handleLowStockProductClick = (variant) => {
    navigate(`/inventory?product=${variant.product_id}&variant=${variant.id}`, {
      state: { 
        productId: variant.product_id, 
        variantId: variant.id,
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
            {lowStockProducts.slice(0, 5).map((variant, index) => (
              <div
                key={variant.id}
                className="flex items-center justify-between p-3 bg-card border border-border/50 rounded-lg cursor-pointer"
                onClick={() => handleLowStockProductClick(variant)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted border border-border/30">
                    {variant.productImage ? (
                      <img 
                        src={variant.productImage} 
                        alt={variant.productName} 
                        className="w-10 h-10 rounded-md object-cover"
                      />
                    ) : (
                      <DefaultProductImage className="w-10 h-10 rounded-md" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-medium text-sm text-foreground">
                      {variant.productName}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {variant.size} - {variant.color}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-center w-8 h-8 bg-red-500 rounded-full text-white text-sm font-bold">
                  {variant.quantity}
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