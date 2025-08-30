import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Package, AlertTriangle, ShieldAlert, ArrowRight, X, Filter, TrendingDown, Eye, Activity, AlertCircle, GripHorizontal } from 'lucide-react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useInventory } from '@/contexts/SuperProvider';
import { cn } from '@/lib/utils';

const StockAlertsWindow = ({ open, onOpenChange }) => {
  const navigate = useNavigate();
  const { products, settings } = useInventory();
  const [selectedLevel, setSelectedLevel] = useState('all');
  const [dragY, setDragY] = useState(0);
  
  // حساب المنتجات المنخفضة باستخدام نفس منطق StockAlertsCard للبيانات الصحيحة
  const lowStockProducts = useMemo(() => {
    if (!products || !Array.isArray(products)) return [];
    
    const threshold = settings?.lowStockThreshold || 5;
    const lowStockItems = [];
    
    products.forEach(product => {
      if (product.variants && product.variants.length > 0) {
        // البحث عن المتغيرات منخفضة المخزون (أكبر من 0 وأقل من أو يساوي العتبة)
        const lowStockVariants = product.variants.filter(variant => {
          const variantQuantity = variant.quantity || 0;
          return variantQuantity > 0 && variantQuantity <= threshold;
        });
        
        // إضافة كل متغير منخفض كعنصر منفصل للعرض التفصيلي
        lowStockVariants.forEach(variant => {
          lowStockItems.push({
            id: variant.id,
            productId: product.id,
            variantId: variant.id,
            productName: product.name,
            quantity: variant.quantity || 0,
            lowStockThreshold: threshold,
            productImage: product.images?.[0], // الصورة الصحيحة من array
            sku: variant.sku || product.sku || variant.id,
            color: variant.color?.name || 'غير محدد',
            size: variant.size?.name || 'غير محدد',
            colorId: variant.color_id,
            sizeId: variant.size_id
          });
        });
      }
    });
    
    // ترتيب حسب أقل كمية
    return lowStockItems.sort((a, b) => a.quantity - b.quantity);
  }, [products, settings?.lowStockThreshold]);
  
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

  const handleDragEnd = (event, info) => {
    const threshold = 100;
    if (info.offset.y > threshold) {
      onOpenChange(false);
    }
    setDragY(0);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl h-[95vh] p-0 bg-gradient-to-br from-background via-background to-muted/30 overflow-hidden">
        <motion.div
          drag="y"
          dragConstraints={{ top: 0, bottom: 200 }}
          dragElastic={0.2}
          onDrag={(event, info) => setDragY(info.offset.y)}
          onDragEnd={handleDragEnd}
          style={{ y: dragY }}
          className="h-full flex flex-col"
        >
          {/* Drag Handle */}
          <div className="w-full py-2 flex justify-center bg-gradient-to-r from-primary/5 to-destructive/5">
            <motion.div 
              className="w-12 h-1 bg-muted-foreground/30 rounded-full cursor-grab active:cursor-grabbing"
              whileTap={{ scaleY: 2 }}
            />
          </div>
          
          <DialogHeader className="px-6 py-4 border-b bg-gradient-to-r from-primary/5 to-destructive/5 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <motion.div
                  className="p-2 rounded-full bg-destructive/10"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                >
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </motion.div>
                <div>
                  <DialogTitle className="text-xl font-bold text-right">
                    تنبيهات المخزون
                  </DialogTitle>
                  <p className="text-sm text-muted-foreground text-right">
                    {lowStockProducts.length} منتج يحتاج إلى إعادة تموين
                  </p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => onOpenChange(false)}
                className="h-8 w-8 p-0 hover:bg-destructive/10"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0">
          {/* Stats Cards - Sticky */}
          <div className="px-6 py-4 bg-background/95 backdrop-blur-sm border-b sticky top-0 z-10">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { 
                  label: 'الإجمالي', 
                  value: lowStockProducts.length, 
                  gradient: 'from-blue-400 via-blue-500 to-blue-600',
                  icon: Package,
                  filter: 'all',
                  shadow: 'shadow-blue-500/25'
                },
                { 
                  label: 'حرج', 
                  value: criticalCount, 
                  gradient: 'from-red-400 via-red-500 to-red-600',
                  icon: AlertCircle,
                  filter: 'critical',
                  shadow: 'shadow-red-500/25'
                },
                { 
                  label: 'منخفض', 
                  value: lowCount, 
                  gradient: 'from-emerald-400 via-emerald-500 to-emerald-600',
                  icon: TrendingDown,
                  filter: 'low',
                  shadow: 'shadow-emerald-500/25'
                },
                { 
                  label: 'تحذير', 
                  value: warningCount, 
                  gradient: 'from-purple-400 via-purple-500 to-purple-600',
                  icon: Activity,
                  filter: 'warning',
                  shadow: 'shadow-purple-500/25'
                }
              ].map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => setSelectedLevel(stat.filter)}
                  className={`
                    relative overflow-hidden rounded-2xl bg-gradient-to-br ${stat.gradient} p-4 cursor-pointer
                    shadow-xl ${stat.shadow} hover:shadow-2xl transition-all duration-300 transform hover:scale-105
                    ${selectedLevel === stat.filter ? 'ring-4 ring-white/20 scale-105' : ''}
                  `}
                >
                  {/* Multiple background circles for depth */}
                  <div className="absolute -top-8 -right-8 w-24 h-24 bg-white/10 rounded-full" />
                  <div className="absolute -top-4 -right-4 w-16 h-16 bg-white/15 rounded-full" />
                  <div className="absolute -bottom-8 -left-8 w-28 h-28 bg-white/5 rounded-full" />
                  <div className="absolute -bottom-4 -left-4 w-20 h-20 bg-white/8 rounded-full" />
                  
                  <div className="relative z-10">
                    <div className="flex items-center justify-between">
                      <div className="text-right flex-1">
                        <p className="text-white/90 text-sm font-semibold mb-1">{stat.label}</p>
                        <p className="text-white text-3xl font-bold leading-none">{stat.value}</p>
                      </div>
                      <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-3 ml-3">
                        <stat.icon className="h-7 w-7 text-white drop-shadow-sm" />
                      </div>
                    </div>
                  </div>
                  
                  {/* Shine effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 transform translate-x-[-100%] hover:translate-x-[100%] transition-transform duration-700" />
                </motion.div>
              ))}
            </div>
          </div>

          {/* Products List with ScrollArea */}
          <div className="flex-1 px-6 pb-6 min-h-0">
            <ScrollArea className="h-full">
              <div className="space-y-3 pr-4">
                <AnimatePresence mode="wait">
                  {filteredProducts.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-center py-12 text-muted-foreground"
                    >
                      <Package className="h-16 w-16 mx-auto mb-4 opacity-50" />
                      <p className="text-lg">لا توجد منتجات في هذه الفئة</p>
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
            </ScrollArea>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t bg-gradient-to-r from-muted/30 to-background flex-shrink-0">
          <div className="flex gap-3 justify-end">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="text-sm"
            >
              إغلاق
            </Button>
            <Button 
              onClick={handleViewInventory}
              className="text-sm bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
            >
              <Eye className="h-4 w-4 ml-2" />
              عرض المخزون التفصيلي
            </Button>
          </div>
        </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};

export default StockAlertsWindow;