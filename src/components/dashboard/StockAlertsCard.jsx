import React, { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Package, TrendingDown, Zap, ShieldAlert, AlertCircle } from 'lucide-react';
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

  useEffect(() => {
    if (!products || !settings || lowStockProducts.length === 0) return;

    lowStockProducts.forEach(variant => {
      const threshold = variant.lowStockThreshold || settings.lowStockThreshold || 5;
      const isCritical = variant.quantity <= Math.max(1, Math.floor(threshold / 2));
      
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
          user_id: null
        });

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
  
  const getStockLevel = (stock, minStock) => {
    const percentage = (stock / minStock) * 100;
    if (percentage <= 25) return {
      style: 'critical',
      icon: ShieldAlert,
      pulse: true,
      level: 'حرج',
      color: 'destructive'
    };
    if (percentage <= 60) return {
      style: 'warning',
      icon: AlertCircle,
      pulse: false,
      level: 'منخفض',
      color: 'orange'
    };
    return {
      style: 'low',
      icon: Package,
      pulse: false,
      level: 'تحذير',
      color: 'primary'
    };
  };

  return (
    <Card className="h-full border-border/40 shadow-sm bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-4 bg-gradient-to-r from-primary/5 to-accent/5 border-b border-border/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/15 to-primary/25 shadow-lg">
              <AlertTriangle className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-foreground">تنبيهات المخزون</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">مراقبة المنتجات المنخفضة</CardDescription>
            </div>
          </div>
          {lowStockProducts && lowStockProducts.length > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 border border-primary/30 rounded-full">
              <Zap className="w-3.5 h-3.5 text-primary" />
              <span className="text-sm font-bold text-primary">{lowStockProducts.length}</span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {lowStockProducts && lowStockProducts.length > 0 ? (
          <div className="space-y-0">
            {lowStockProducts.slice(0, 5).map((variant, index) => {
              const stockLevel = getStockLevel(variant.quantity, variant.lowStockThreshold);
              const StockIcon = stockLevel.icon;
              const isCritical = stockLevel.style === 'critical';
              const isWarning = stockLevel.style === 'warning';
              
              return (
                <motion.div
                  key={variant.id} 
                  className={cn(
                    "group relative p-3.5 border-b border-border/20 cursor-pointer transition-all duration-300",
                    "hover:bg-gradient-to-r hover:shadow-lg hover:shadow-primary/10 hover:scale-[1.01] hover:-translate-y-0.5",
                    isCritical && "bg-gradient-to-r from-red-500/8 to-red-600/8 hover:from-red-500/12 hover:to-red-600/12 border-red-300/30",
                    isWarning && "bg-gradient-to-r from-amber-500/8 to-amber-600/8 hover:from-amber-500/12 hover:to-amber-600/12 border-amber-300/30", 
                    !isCritical && !isWarning && "bg-gradient-to-r from-primary/5 to-accent/5 hover:from-primary/10 hover:to-accent/10",
                    stockLevel.pulse && "animate-pulse"
                  )}
                  onClick={() => handleLowStockProductClick(variant)}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ scale: 1.005 }}
                >
                  <div className="flex items-center gap-3">
                    {/* Product Image & Icon */}
                    <div className="relative flex-shrink-0">
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted/50 border border-border/30 shadow-sm">
                        <img 
                          src={variant.productImage || '/api/placeholder/40/40'} 
                          alt={variant.productName} 
                          className="w-full h-full object-cover" 
                        />
                      </div>
                      <div className="absolute -top-1 -right-1 p-0.5 rounded-full bg-background border border-border shadow-sm">
                        <StockIcon className={cn(
                          "w-3 h-3",
                          isCritical && "text-red-600",
                          isWarning && "text-amber-600",
                          !isCritical && !isWarning && "text-primary"
                        )} />
                      </div>
                    </div>

                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-medium text-sm text-foreground truncate pr-2">
                          {variant.productName}
                        </h4>
                        <div className="text-right flex-shrink-0">
                          <div className={cn(
                            "text-lg font-bold",
                            isCritical && "text-red-600",
                            isWarning && "text-amber-600",
                            !isCritical && !isWarning && "text-foreground"
                          )}>
                            {variant.quantity}
                          </div>
                          <div className="text-xs text-muted-foreground">قطعة</div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {variant.size} • {variant.color}
                          </span>
                          <span className={cn(
                            "text-xs px-1.5 py-0.5 rounded font-medium backdrop-blur-sm",
                            isCritical && "bg-red-500/10 text-red-700 border border-red-300/50",
                            isWarning && "bg-amber-500/10 text-amber-700 border border-amber-300/50",
                            !isCritical && !isWarning && "bg-primary/10 text-primary border border-primary/30"
                          )}>
                            {stockLevel.level}
                          </span>
                        </div>
                        
                        {/* Progress Bar */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">/{variant.lowStockThreshold}</span>
                          <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div 
                              className={cn(
                                "h-full transition-all duration-500 rounded-full",
                                isCritical && "bg-gradient-to-r from-red-500 to-red-600",
                                isWarning && "bg-gradient-to-r from-amber-500 to-amber-600",
                                !isCritical && !isWarning && "bg-gradient-to-r from-primary to-primary/80"
                              )}
                              style={{ 
                                width: `${Math.min(100, Math.max(5, (variant.quantity / variant.lowStockThreshold) * 100))}%` 
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Hover Effect Border */}
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r opacity-0 group-hover:opacity-100 transition-all duration-200" />
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
              <Package className="w-6 h-6 text-primary" />
            </div>
            <p className="text-primary font-medium text-sm">المخزون ممتاز</p>
            <p className="text-muted-foreground text-xs mt-0.5">جميع المنتجات متوفرة</p>
          </div>
        )}
        
        {lowStockProducts && lowStockProducts.length > 0 && (
          <div className="p-3 border-t border-border/30 bg-muted/20">
            <Button 
              variant="outline" 
              size="sm"
              className="w-full text-primary border-primary/30 hover:bg-primary/5 hover:border-primary/50 transition-all text-sm"
              onClick={handleViewAll}
            >
              <AlertTriangle className="w-3.5 h-3.5 ml-1.5" />
              عرض جميع التنبيهات
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StockAlertsCard;