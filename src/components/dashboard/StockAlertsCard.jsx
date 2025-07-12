import React, { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Package, TrendingDown, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useInventory } from '@/contexts/InventoryContext';
import { useNotifications } from '@/contexts/NotificationsContext';
import { toast } from '@/components/ui/use-toast';

const StockAlertsCard = () => {
  const navigate = useNavigate();
  const { getLowStockProducts, settings, products } = useInventory();
  const { addNotification } = useNotifications();
  const lowStockProducts = getLowStockProducts(settings?.lowStockThreshold || 5);

  // مراقبة المخزون المنخفض وإرسال إشعارات تلقائية
  useEffect(() => {
    if (!products || !settings || lowStockProducts.length === 0) return;

    // فحص وإرسال إشعارات للمنتجات المنخفضة الجديدة
    lowStockProducts.forEach(variant => {
      const threshold = variant.lowStockThreshold || settings.lowStockThreshold || 5;
      const isCritical = variant.quantity <= Math.max(1, Math.floor(threshold / 2));
      
      // إشعار تلقائي للمخزون المنخفض
      if (variant.quantity > 0 && variant.quantity <= threshold) {
        addNotification({
          type: 'low_stock_alert',
          title: isCritical ? '🚨 تنبيه حرج: نفاد المخزون قريباً' : '⚠️ تنبيه: مخزون منخفض',
          message: `المنتج "${variant.productName}" (${variant.color} - ${variant.size}) متبقي ${variant.quantity} قطعة فقط`,
          icon: 'AlertTriangle',
          color: isCritical ? 'red' : 'orange',
          link: `/inventory?stockFilter=low&highlight=${variant.sku}`,
          data: {
            productId: variant.productId,
            variantId: variant.id,
            productName: variant.productName,
            variantDetails: `${variant.color} - ${variant.size}`,
            currentStock: variant.quantity,
            threshold: threshold,
            sku: variant.sku
          },
          autoDelete: false,
          user_id: null // إرسال لجميع المديرين
        });

        // توست فوري للحالات الحرجة
        if (isCritical) {
          toast({
            title: "🚨 تنبيه حرج",
            description: `${variant.productName} (${variant.color} - ${variant.size}) متبقي ${variant.quantity} قطعة فقط!`,
            variant: "destructive",
            duration: 10000,
          });
        }
      }
    });
  }, [lowStockProducts, products, settings, addNotification]);

  const handleViewAll = () => {
    navigate('/inventory?stockFilter=low');
  };
  
  const handleLowStockProductClick = (variant) => {
    navigate(`/manage-products?highlight=${variant.sku}`, {
      state: { productId: variant.product_id, variantId: variant.id }
    });
  };
  
  const getStockLevelColor = (stock, minStock) => {
    const percentage = (stock / minStock) * 100;
    if (percentage <= 25) return {
      className: 'bg-gradient-to-r from-red-50 to-rose-50 border-red-200 text-red-700 shadow-lg',
      icon: AlertTriangle,
      pulse: true
    };
    if (percentage <= 60) return {
      className: 'bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200 text-orange-700 shadow-md',
      icon: TrendingDown,
      pulse: false
    };
    return {
      className: 'bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200 text-yellow-700 shadow-sm',
      icon: Package,
      pulse: false
    };
  };

  const getUrgencyLevel = (stock, threshold) => {
    const percentage = (stock / threshold) * 100;
    if (percentage <= 25) return { level: 'حرج', color: 'text-red-600', bgColor: 'bg-red-100' };
    if (percentage <= 60) return { level: 'منخفض', color: 'text-orange-600', bgColor: 'bg-orange-100' };
    return { level: 'تحذير', color: 'text-yellow-600', bgColor: 'bg-yellow-100' };
  };

  return (
    <Card className="h-full overflow-hidden shadow-lg border-border/50">
      <CardHeader className="bg-gradient-to-l from-orange-50/50 to-red-50/50 border-b border-border/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/20">
              <AlertTriangle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <CardTitle className="text-xl text-foreground">تنبيهات المخزون</CardTitle>
              <CardDescription className="text-sm">مراقبة المنتجات المنخفضة المخزون</CardDescription>
            </div>
          </div>
          {lowStockProducts && lowStockProducts.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1 bg-orange-100 dark:bg-orange-900/30 rounded-full">
              <Zap className="w-4 h-4 text-orange-600" />
              <span className="text-sm font-bold text-orange-700 dark:text-orange-300">
                {lowStockProducts.length}
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {lowStockProducts && lowStockProducts.length > 0 ? (
          <div className="max-h-80 overflow-y-auto">
            {lowStockProducts.map((variant, index) => {
              const stockLevel = getStockLevelColor(variant.quantity, variant.lowStockThreshold);
              const urgency = getUrgencyLevel(variant.quantity, variant.lowStockThreshold);
              const StockIcon = stockLevel.icon;
              
              return (
                <motion.div
                  key={variant.id} 
                  className={cn(
                    "p-4 border-b border-border/20 cursor-pointer transition-all hover:shadow-md",
                    stockLevel.className,
                    stockLevel.pulse && "animate-pulse"
                  )}
                  onClick={() => handleLowStockProductClick(variant)}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ scale: 1.02 }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="relative">
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted border border-border/20">
                          <img 
                            src={variant.productImage || '/api/placeholder/48/48'} 
                            alt={variant.productName} 
                            className="w-full h-full object-cover" 
                          />
                        </div>
                        <div className="absolute -top-1 -right-1">
                          <StockIcon className="w-4 h-4 text-current" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm text-foreground truncate">
                          {variant.productName}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {variant.size} - {variant.color}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", urgency.bgColor, urgency.color)}>
                            {urgency.level}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            حد أدنى: {variant.lowStockThreshold}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-current">
                        {variant.quantity}
                      </div>
                      <div className="text-xs text-muted-foreground">قطعة</div>
                      <div className="w-8 h-1 bg-current/20 rounded-full mt-1">
                        <div 
                          className="h-full bg-current rounded-full transition-all duration-500"
                          style={{ 
                            width: `${Math.min(100, (variant.quantity / variant.lowStockThreshold) * 100)}%` 
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
              <Package className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-green-600 dark:text-green-400 font-semibold">المخزون في حالة ممتازة</p>
            <p className="text-muted-foreground text-sm mt-1">جميع المنتجات متوفرة بكميات كافية</p>
          </div>
        )}
        {lowStockProducts && lowStockProducts.length > 0 && (
          <div className="p-4 border-t border-border/30 bg-muted/20">
            <Button 
              variant="outline" 
              className="w-full text-orange-600 border-orange-200 hover:bg-orange-50 hover:border-orange-300 transition-all"
              onClick={handleViewAll}
            >
              <AlertTriangle className="w-4 h-4 ml-2" />
              عرض جميع التنبيهات في المخزون
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StockAlertsCard;