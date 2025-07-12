import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useInventory } from '@/contexts/InventoryContext';

const StockAlertsCard = () => {
  const navigate = useNavigate();
  const { getLowStockProducts } = useInventory();
  const lowStockProducts = getLowStockProducts(5);

  const handleViewAll = () => {
    navigate('/inventory?stockFilter=low');
  };
  
  const handleLowStockProductClick = (variant) => {
    navigate(`/inventory?stockFilter=low&highlight=${variant.sku}`);
  };
  
  const getStockLevelColor = (stock, minStock) => {
    const percentage = (stock / minStock) * 100;
    if (percentage <= 25) return 'bg-red-500/10 text-red-400';
    if (percentage <= 60) return 'bg-orange-500/10 text-orange-400';
    return 'bg-yellow-500/10 text-yellow-400';
  };

  return (
    <Card className="h-full">
      <CardHeader>
          <div className="flex items-center gap-3"><AlertTriangle className="w-6 h-6 text-orange-400" /><CardTitle className="text-xl">تنبيهات المخزون</CardTitle></div>
          <CardDescription>المنتجات التي وصل مخزونها للحد الأدنى</CardDescription>
      </CardHeader>
      <CardContent>
        {lowStockProducts && lowStockProducts.length > 0 ? (
          <ul className="space-y-3">
            {lowStockProducts.map(variant => (
              <motion.li 
                key={variant.id} 
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors",
                  getStockLevelColor(variant.quantity, variant.lowStockThreshold)
                )}
                onClick={() => handleLowStockProductClick(variant)}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-md bg-muted flex-shrink-0">
                    <img src={variant.productImage} alt={variant.productName} className="w-full h-full object-cover rounded-md" />
                  </div>
                  <div>
                    <span className="font-medium text-foreground">{variant.productName}</span>
                    <p className="text-xs text-muted-foreground">{variant.size} - {variant.color}</p>
                  </div>
                </div>
                <div className="text-center">
                  <span className="font-bold text-lg">{variant.quantity}</span>
                  <p className="text-xs">قطعة</p>
                </div>
              </motion.li>
            ))}
          </ul>
        ) : (
          <div className="text-center py-8">
            <AlertTriangle className="w-12 h-12 text-green-400 mx-auto mb-3" />
            <p className="text-green-400 font-medium">المخزون في حالة جيدة</p>
            <p className="text-muted-foreground text-sm">لا توجد تنبيهات مخزون</p>
          </div>
        )}
        {lowStockProducts && lowStockProducts.length > 0 && (
          <Button variant="link" className="mt-4 w-full text-yellow-500" onClick={handleViewAll}>
            عرض كل التنبيهات
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default StockAlertsCard;