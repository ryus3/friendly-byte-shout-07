import React, { useState, useEffect } from 'react';
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
  const { products, settings, refetchProducts } = useInventory(); // المنتجات المفلترة تلقائياً
  const { canManageFinances, isAdmin } = usePermissions();
  const [alertsWindowOpen, setAlertsWindowOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // الاستماع لأحداث التحديث
  useEffect(() => {
    const handleRefresh = async () => {
      setIsRefreshing(true);
      try {
        if (refetchProducts) {
          await refetchProducts();
        }
      } catch (error) {
        console.error('خطأ في تحديث بيانات المخزون:', error);
      } finally {
        setIsRefreshing(false);
      }
    };

    window.addEventListener('refresh-inventory', handleRefresh);
    window.addEventListener('refresh-data', handleRefresh);
    window.addEventListener('refresh-dashboard', handleRefresh);
    
    return () => {
      window.removeEventListener('refresh-inventory', handleRefresh);
      window.removeEventListener('refresh-data', handleRefresh);
      window.removeEventListener('refresh-dashboard', handleRefresh);
    };
  }, [refetchProducts]);
  
  // حساب المتغيرات منخفضة المخزون - عرض المتغيرات الفردية وليس المنتج كاملاً
  const lowStockProducts = React.useMemo(() => {
    if (!products || !Array.isArray(products)) return [];
    
    const threshold = settings?.lowStockThreshold || 5;
    const lowStockItems = [];
    
    products.forEach(product => {
      if (product.variants && product.variants.length > 0) {
        // البحث عن المتغيرات منخفضة المخزون
        const lowStockVariants = product.variants.filter(variant => {
          const variantQuantity = variant.quantity || 0;
          return variantQuantity <= threshold;
        });
        
        // إذا كان هناك متغيرات منخفضة، إضافة المنتج مع تفاصيل المتغيرات المنخفضة
        if (lowStockVariants.length > 0) {
          lowStockItems.push({
            id: product.id,
            productName: product.name,
            productImage: product.images?.[0],
            lowStockVariants: lowStockVariants,
            totalLowStockQuantity: lowStockVariants.reduce((sum, variant) => sum + (variant.quantity || 0), 0),
            lowStockVariantsCount: lowStockVariants.length,
            allVariantsCount: product.variants.length
          });
        }
      }
    });
    
    // ترتيب حسب أقل كمية
    return lowStockItems.sort((a, b) => a.totalLowStockQuantity - b.totalLowStockQuantity);
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
    <Card className={cn(
      "w-full border-border/40 shadow-sm bg-card/50 backdrop-blur-sm transition-all duration-300",
      isRefreshing && "animate-pulse"
    )}>
      <CardHeader className="pb-4 border-b border-border/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TriangleAlert className={cn(
              "w-5 h-5 text-amber-600 transition-all duration-300",
              isRefreshing && "animate-spin"
            )} />
            <CardTitle className="text-lg font-semibold text-foreground">
              تنبيهات المخزون
              {isRefreshing && (
                <span className="text-xs text-muted-foreground ml-2">(جاري التحديث...)</span>
              )}
            </CardTitle>
          </div>
          {lowStockProducts && lowStockProducts.length > 0 && (
            <div className="flex items-center justify-center w-8 h-8 bg-red-500 rounded-full text-white text-sm font-bold animate-pulse">
              {lowStockProducts.length}
            </div>
          )}
        </div>
        {lowStockProducts && lowStockProducts.length > 0 && (
          <p className="text-sm text-muted-foreground">المتغيرات التي وصل مخزونها للحد الأدنى ≤ {settings?.lowStockThreshold || 5}</p>
        )}
      </CardHeader>

      <CardContent className="p-4 space-y-3">
        {lowStockProducts && lowStockProducts.length > 0 ? (
          <>
            {lowStockProducts.slice(0, 5).map((product, index) => (
              <div
                key={product.id}
                className="flex items-center justify-between p-3 bg-card border border-border/50 rounded-lg cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => handleLowStockProductClick(product)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted border border-border/30">
                    {product.productImage ? (
                      <img 
                        src={product.productImage} 
                        alt={product.productName} 
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                    ) : (
                      <DefaultProductImage className="w-12 h-12 rounded-lg" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-sm text-foreground line-clamp-1">
                      {product.productName}
                    </h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {product.lowStockVariantsCount} من {product.allVariantsCount} متغيرات منخفضة
                      </span>
                      <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-0.5 rounded-full">
                        ≤ {settings?.lowStockThreshold || 5}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center justify-center w-8 h-8 bg-red-500 rounded-full text-white text-sm font-bold">
                    {product.totalLowStockQuantity}
                  </div>
                  <span className="text-xs text-muted-foreground">إجمالي</span>
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
            <p className="text-primary font-medium text-sm">مخزون ممتاز ✅</p>
            <p className="text-muted-foreground text-xs mt-0.5">
              {isRefreshing ? "جاري فحص المخزون..." : "جميع المتغيرات فوق الحد الأدنى"}
            </p>
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