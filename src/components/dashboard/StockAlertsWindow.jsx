import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Package, AlertTriangle, ShieldAlert, ArrowRight, X, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useInventory } from '@/contexts/InventoryContext';
import { cn } from '@/lib/utils';

const StockAlertsWindow = ({ open, onOpenChange }) => {
  const navigate = useNavigate();
  const { getLowStockProducts, settings, products } = useInventory();
  const [selectedLevel, setSelectedLevel] = useState('all');
  
  // استخدام المنتجات المفلترة من السياق (InventoryContext يطبق الفلترة تلقائياً)
  const lowStockProducts = getLowStockProducts(settings?.lowStockThreshold || 5);
  
  const getStockLevel = (stock, minStock) => {
    const percentage = (stock / minStock) * 100;
    if (percentage <= 25) return {
      style: 'critical',
      icon: ShieldAlert,
      level: 'حرج',
      color: 'red'
    };
    if (percentage <= 60) return {
      style: 'warning', 
      icon: AlertTriangle,
      level: 'منخفض',
      color: 'orange'
    };
    return {
      style: 'low',
      icon: Package,
      level: 'تحذير',
      color: 'blue'
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
    navigate(`/inventory?stockFilter=low&highlight=${variant.sku}`);
    onOpenChange(false);
  };

  const handleViewInventory = () => {
    navigate('/inventory?stockFilter=low');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-red-500/20 to-orange-500/20">
                <Package className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold">تنبيهات المخزون</h2>
                <p className="text-sm text-muted-foreground">
                  مراقبة المنتجات المنخفضة والحرجة
                </p>
              </div>
            </div>
            <Badge variant="destructive" className="text-lg px-3 py-1">
              {lowStockProducts.length} منتج
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Filter Buttons */}
          <div className="flex gap-2 p-1 bg-muted rounded-lg">
            <Button
              variant={selectedLevel === 'all' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSelectedLevel('all')}
              className="flex-1"
            >
              <Filter className="w-4 h-4 mr-2" />
              الكل ({lowStockProducts.length})
            </Button>
            <Button
              variant={selectedLevel === 'critical' ? 'destructive' : 'ghost'}
              size="sm"
              onClick={() => setSelectedLevel('critical')}
              className="flex-1"
            >
              <ShieldAlert className="w-4 h-4 mr-2" />
              حرج ({criticalCount})
            </Button>
            <Button
              variant={selectedLevel === 'warning' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSelectedLevel('warning')}
              className="flex-1 bg-orange-100 hover:bg-orange-200 text-orange-800"
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              منخفض ({warningCount})
            </Button>
            <Button
              variant={selectedLevel === 'low' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSelectedLevel('low')}
              className="flex-1 bg-blue-100 hover:bg-blue-200 text-blue-800"
            >
              <Package className="w-4 h-4 mr-2" />
              تحذير ({lowCount})
            </Button>
          </div>

          {/* Products List */}
          <div className="max-h-96 overflow-y-auto space-y-2 px-1">
            <AnimatePresence>
              {filteredProducts.map((variant, index) => {
                const stockLevel = getStockLevel(variant.quantity, variant.lowStockThreshold);
                const StockIcon = stockLevel.icon;
                const isCritical = stockLevel.style === 'critical';
                const isWarning = stockLevel.style === 'warning';
                
                return (
                  <motion.div
                    key={variant.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card 
                      className={cn(
                        "cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02]",
                        isCritical && "border-red-200 bg-gradient-to-r from-red-50 to-red-100",
                        isWarning && "border-orange-200 bg-gradient-to-r from-orange-50 to-orange-100",
                        !isCritical && !isWarning && "border-blue-200 bg-gradient-to-r from-blue-50 to-blue-100"
                      )}
                      onClick={() => handleProductClick(variant)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {/* Product Image */}
                            <div className="w-12 h-12 rounded-lg overflow-hidden bg-white border shadow-sm">
                              {variant.productImage ? (
                                <img 
                                  src={variant.productImage} 
                                  alt={variant.productName}
                                  className="w-12 h-12 rounded-md object-cover"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-md bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center">
                                  <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              )}
                            </div>
                            
                            {/* Product Info */}
                            <div>
                              <h3 className="font-semibold text-foreground">
                                {variant.productName}
                              </h3>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-sm text-muted-foreground">
                                  {variant.size} • {variant.color}
                                </span>
                                <Badge 
                                  variant="secondary"
                                  className={cn(
                                    "text-xs",
                                    isCritical && "bg-red-100 text-red-800",
                                    isWarning && "bg-orange-100 text-orange-800",
                                    !isCritical && !isWarning && "bg-blue-100 text-blue-800"
                                  )}
                                >
                                  {stockLevel.level}
                                </Badge>
                              </div>
                            </div>
                          </div>

                          {/* Stock Info */}
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className={cn(
                                "text-2xl font-bold",
                                isCritical && "text-red-600",
                                isWarning && "text-orange-600",
                                !isCritical && !isWarning && "text-blue-600"
                              )}>
                                {variant.quantity}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                من {variant.lowStockThreshold}
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <StockIcon className={cn(
                                "w-5 h-5",
                                isCritical && "text-red-600",
                                isWarning && "text-orange-600",
                                !isCritical && !isWarning && "text-blue-600"
                              )} />
                              <ArrowRight className="w-4 h-4 text-muted-foreground" />
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              <X className="w-4 h-4 mr-2" />
              إغلاق
            </Button>
            <Button 
              onClick={handleViewInventory}
              className="flex-1"
            >
              <Package className="w-4 h-4 mr-2" />
              عرض الجرد التفصيلي
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StockAlertsWindow;