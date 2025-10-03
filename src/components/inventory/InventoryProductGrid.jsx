import React from 'react';
import { motion } from 'framer-motion';
import { Package, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const InventoryProductGrid = ({ items, onProductClick }) => {
  const getStockBadge = (available, total) => {
    const percentage = total > 0 ? (available / total) * 100 : 0;
    
    if (available === 0) {
      return { variant: 'destructive', label: 'نفذ', icon: AlertCircle };
    } else if (percentage < 20) {
      return { variant: 'destructive', label: 'منخفض جداً', icon: TrendingDown };
    } else if (percentage < 50) {
      return { variant: 'warning', label: 'منخفض', icon: TrendingDown };
    } else {
      return { variant: 'success', label: 'متوفر', icon: TrendingUp };
    }
  };

  // تجميع المنتجات حسب الاسم
  const groupedProducts = items.reduce((acc, item) => {
    if (!acc[item.product_id]) {
      acc[item.product_id] = {
        id: item.product_id,
        name: item.product_name,
        category: item.category_name,
        variants: [],
        totalAvailable: 0,
        totalQuantity: 0,
        totalReserved: 0
      };
    }
    
    acc[item.product_id].variants.push(item);
    acc[item.product_id].totalAvailable += Number(item.available_quantity || 0);
    acc[item.product_id].totalQuantity += Number(item.total_quantity || 0);
    acc[item.product_id].totalReserved += Number(item.reserved_quantity || 0);
    
    return acc;
  }, {});

  const products = Object.values(groupedProducts);

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-muted-foreground mb-2">لا توجد منتجات</h3>
        <p className="text-muted-foreground">جرب تغيير معايير البحث أو الفلترة</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
      {products.map((product, index) => {
        const stockInfo = getStockBadge(product.totalAvailable, product.totalQuantity);
        const StockIcon = stockInfo.icon;
        
        return (
          <motion.button
            key={product.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: index * 0.03 }}
            onClick={() => onProductClick(product)}
            className="glass-effect rounded-xl p-4 border border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:scale-105 text-right group"
          >
            {/* رأس البطاقة */}
            <div className="flex items-start justify-between mb-3">
              <Badge variant={stockInfo.variant} className="text-xs">
                <StockIcon className="w-3 h-3 ml-1" />
                {stockInfo.label}
              </Badge>
              <Package className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>

            {/* اسم المنتج */}
            <h3 className="font-semibold text-sm mb-1 line-clamp-2 text-foreground group-hover:text-primary transition-colors">
              {product.name}
            </h3>

            {/* التصنيف */}
            <p className="text-xs text-muted-foreground mb-3">
              {product.category}
            </p>

            {/* معلومات الكمية */}
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">المتاح:</span>
                <span className="font-semibold text-foreground">{product.totalAvailable}</span>
              </div>
              
              {product.totalReserved > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">محجوز:</span>
                  <span className="font-semibold text-amber-600">{product.totalReserved}</span>
                </div>
              )}
              
              <div className="flex justify-between items-center pt-1.5 border-t border-border/30">
                <span className="text-muted-foreground">الإجمالي:</span>
                <span className="font-bold text-foreground">{product.totalQuantity}</span>
              </div>
            </div>

            {/* عدد المتغيرات */}
            <div className="mt-3 pt-2 border-t border-border/30">
              <p className="text-xs text-muted-foreground text-center">
                {product.variants.length} متغير
              </p>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
};

export default InventoryProductGrid;
