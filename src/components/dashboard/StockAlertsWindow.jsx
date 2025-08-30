import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Package, AlertTriangle, ShieldAlert, ArrowRight, X, Filter, TrendingDown, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useSuper } from '@/contexts/SuperProvider';
import { cn } from '@/lib/utils';

const StockAlertsWindow = ({ open, onOpenChange }) => {
  const navigate = useNavigate();
  const { inventory = [], products = [] } = useSuper();
  const [selectedLevel, setSelectedLevel] = useState('all');
  
  // حساب المنتجات المنخفضة باستخدام البيانات الحقيقية من SuperProvider
  const lowStockProducts = useMemo(() => {
    return inventory.filter(item => {
      const product = products.find(p => p.id === item.product_id);
      if (!product) return false;
      
      const threshold = item.min_stock || 5;
      return item.quantity <= threshold;
    }).map(item => {
      const product = products.find(p => p.id === item.product_id);
      return {
        id: item.id,
        productId: item.product_id,
        variantId: item.variant_id,
        productName: product?.name || 'منتج غير معروف',
        quantity: item.quantity || 0,
        lowStockThreshold: item.min_stock || 5,
        productImage: product?.image_url,
        sku: product?.sku || item.id,
        color: 'افتراضي',
        size: 'افتراضي'
      };
    });
  }, [inventory, products]);
  
  const getStockLevel = (stock, minStock) => {
    if (stock === 0) return {
      style: 'critical',
      icon: ShieldAlert,
      level: 'نفد',
      color: 'hsl(var(--destructive))',
      bgColor: 'hsl(var(--destructive) / 0.1)',
      borderColor: 'hsl(var(--destructive) / 0.3)'
    };
    
    const ratio = stock / Math.max(minStock, 1);
    if (ratio <= 0.5) return {
      style: 'critical',
      icon: ShieldAlert,
      level: 'حرج',
      color: 'hsl(var(--destructive))',
      bgColor: 'hsl(var(--destructive) / 0.1)', 
      borderColor: 'hsl(var(--destructive) / 0.3)'
    };
    
    if (ratio <= 1) return {
      style: 'warning',
      icon: AlertTriangle,
      level: 'منخفض',
      color: 'hsl(var(--warning))',
      bgColor: 'hsl(var(--warning) / 0.1)',
      borderColor: 'hsl(var(--warning) / 0.3)'
    };
    
    return {
      style: 'low',
      icon: TrendingDown,
      level: 'تحذير',
      color: 'hsl(var(--primary))',
      bgColor: 'hsl(var(--primary) / 0.1)',
      borderColor: 'hsl(var(--primary) / 0.3)'
    };
  };

  const filteredProducts = lowStockProducts.filter(variant => {
    if (selectedLevel === 'all') return true;
    const stockLevel = getStockLevel(variant.quantity, variant.lowStockThreshold);
    return stockLevel.style === selectedLevel;
  });

  const criticalCount = lowStockProducts.filter(v => getStockLevel(v.quantity, v.lowStockThreshold).style === 'critical').length;
  const warningCount = lowStockProducts.filter(v => getStockLevel(v.quantity, v.lowStockThreshold).style === 'warning').length;
  const lowCount = lowStockProducts.filter(v => getStockLevel(v.quantity, v.lowStockThreshold).style === 'low').length;

  const handleProductClick = (variant) => {
    navigate(`/inventory?highlight=${variant.productId}`);
    onOpenChange(false);
  };

  const handleViewInventory = () => {
    navigate('/inventory');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-2xl lg:max-w-4xl max-h-[90vh] sm:max-h-[85vh] overflow-hidden p-0">
        <DialogHeader className="px-4 py-6 sm:px-6 border-b bg-gradient-to-r from-background to-muted/30">
          <DialogTitle className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <motion.div 
                className="p-3 rounded-xl bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 shadow-lg"
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
              >
                <ShieldAlert className="w-6 h-6 text-primary" />
              </motion.div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                  تنبيهات المخزون
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  مراقبة المنتجات المنخفضة والحرجة
                </p>
              </div>
            </div>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <Badge 
                variant="secondary" 
                className="text-base sm:text-lg px-4 py-2 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg"
              >
                {lowStockProducts.length} منتج
              </Badge>
            </motion.div>
          </DialogTitle>
        </DialogHeader>

        <div className="p-4 sm:p-6 space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="p-3 text-center border-0 bg-gradient-to-br from-primary/10 to-primary/5 hover:shadow-md transition-all cursor-pointer"
                    onClick={() => setSelectedLevel('all')}>
                <div className="text-2xl font-bold text-primary">{lowStockProducts.length}</div>
                <div className="text-xs text-muted-foreground">إجمالي</div>
              </Card>
            </motion.div>
            
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="p-3 text-center border-0 bg-gradient-to-br from-destructive/10 to-destructive/5 hover:shadow-md transition-all cursor-pointer"
                    onClick={() => setSelectedLevel('critical')}>
                <div className="text-2xl font-bold text-destructive">{criticalCount}</div>
                <div className="text-xs text-muted-foreground">حرج</div>
              </Card>
            </motion.div>
            
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="p-3 text-center border-0 bg-gradient-to-br from-warning/10 to-warning/5 hover:shadow-md transition-all cursor-pointer"
                    onClick={() => setSelectedLevel('warning')}>
                <div className="text-2xl font-bold text-warning">{warningCount}</div>
                <div className="text-xs text-muted-foreground">منخفض</div>
              </Card>
            </motion.div>
            
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="p-3 text-center border-0 bg-gradient-to-br from-accent/20 to-accent/10 hover:shadow-md transition-all cursor-pointer"
                    onClick={() => setSelectedLevel('low')}>
                <div className="text-2xl font-bold text-accent-foreground">{lowCount}</div>
                <div className="text-xs text-muted-foreground">تحذير</div>
              </Card>
            </motion.div>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'all', label: 'الكل', count: lowStockProducts.length, icon: Filter },
              { key: 'critical', label: 'حرج', count: criticalCount, icon: ShieldAlert },
              { key: 'warning', label: 'منخفض', count: warningCount, icon: AlertTriangle },
              { key: 'low', label: 'تحذير', count: lowCount, icon: TrendingDown }
            ].map(({ key, label, count, icon: Icon }) => (
              <motion.div key={key} whileTap={{ scale: 0.95 }}>
                <Button
                  variant={selectedLevel === key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedLevel(key)}
                  className={cn(
                    "rounded-full px-4 py-2 text-xs font-medium transition-all",
                    selectedLevel === key 
                      ? "bg-primary text-primary-foreground shadow-lg" 
                      : "hover:bg-muted/50"
                  )}
                >
                  <Icon className="w-3 h-3 mr-1" />
                  {label} ({count})
                </Button>
              </motion.div>
            ))}
          </div>

          {/* Products List */}
          <div className="max-h-[50vh] sm:max-h-96 overflow-y-auto space-y-3">
            <AnimatePresence mode="popLayout">
              {filteredProducts.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center py-12"
                >
                  <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                    <Package className="w-10 h-10 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    لا توجد منتجات منخفضة
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    جميع المنتجات في المستوى المناسب من المخزون
                  </p>
                </motion.div>
              ) : (
                filteredProducts.map((variant, index) => {
                  const stockLevel = getStockLevel(variant.quantity, variant.lowStockThreshold);
                  const StockIcon = stockLevel.icon;
                  
                  return (
                    <motion.div
                      key={variant.id}
                      layout
                      initial={{ opacity: 0, y: 20, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -20, scale: 0.95 }}
                      transition={{ 
                        delay: Math.min(index * 0.03, 0.3),
                        type: "spring",
                        stiffness: 400,
                        damping: 25
                      }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Card 
                        className="cursor-pointer transition-all duration-300 hover:shadow-xl border-0 bg-gradient-to-r from-background to-muted/20 backdrop-blur-sm group"
                        style={{
                          borderLeft: `4px solid ${stockLevel.color}`,
                          backgroundColor: stockLevel.bgColor
                        }}
                        onClick={() => handleProductClick(variant)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              {/* Product Image */}
                              <div className="w-14 h-14 rounded-xl overflow-hidden bg-background border-2 shadow-lg flex-shrink-0 group-hover:scale-105 transition-transform">
                                {variant.productImage ? (
                                  <img 
                                    src={variant.productImage} 
                                    alt={variant.productName}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                                    <Package className="w-6 h-6 text-muted-foreground" />
                                  </div>
                                )}
                              </div>
                              
                              {/* Product Info */}
                              <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-foreground truncate text-sm sm:text-base">
                                  {variant.productName}
                                </h3>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge 
                                    variant="outline"
                                    className="text-xs font-medium"
                                    style={{ 
                                      color: stockLevel.color,
                                      borderColor: stockLevel.color
                                    }}
                                  >
                                    {stockLevel.level}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground hidden sm:inline">
                                    {variant.size} • {variant.color}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Stock Info */}
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <div className="text-right">
                                <div 
                                  className="text-xl sm:text-2xl font-bold"
                                  style={{ color: stockLevel.color }}
                                >
                                  {variant.quantity}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  من {variant.lowStockThreshold}
                                </div>
                              </div>
                              
                              <div className="flex flex-col items-center gap-1">
                                <StockIcon 
                                  className="w-5 h-5 group-hover:scale-110 transition-transform"
                                  style={{ color: stockLevel.color }}
                                />
                                <Eye className="w-3 h-3 text-muted-foreground opacity-60" />
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-border/50">
            <motion.div className="flex-1" whileTap={{ scale: 0.98 }}>
              <Button 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                className="w-full h-12 rounded-xl font-medium bg-background/50 hover:bg-muted/50 border-border/30"
              >
                <X className="w-4 h-4 mr-2" />
                إغلاق
              </Button>
            </motion.div>
            <motion.div className="flex-1" whileTap={{ scale: 0.98 }}>
              <Button 
                onClick={handleViewInventory}
                className="w-full h-12 rounded-xl font-medium bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg"
              >
                <Package className="w-4 h-4 mr-2" />
                عرض الجرد التفصيلي
              </Button>
            </motion.div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StockAlertsWindow;