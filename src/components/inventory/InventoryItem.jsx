
import React from 'react';
import { Button } from '@/components/ui/button';
import { Edit } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useSalesStats } from '@/hooks/useSalesStats';

const InventoryItem = React.memo(({ variant, product, onEditStock }) => {
  const { getVariantSoldData } = useSalesStats();
  
  if (!variant) {
    return null; // Or a placeholder/error component
  }

  const stock = variant.quantity || 0;
  const reserved = variant.reserved_quantity || variant.reserved || 0;
  const available = stock - reserved;
  
  // لوق للتشخيص - يساعد في فهم سبب ظهور صفر
  console.log(`🔍 InventoryItem للمتغير ${variant.id}:`, {
    variantQuantity: variant.quantity,
    stock,
    reserved,
    available,
    size: variant.size,
    color: variant.color,
    hasInventoryObj: !!variant.inventory,
    inventoryQuantity: variant.inventory?.quantity
  });
  
  // استخدام النظام المركزي للحصول على الكمية المباعة
  const soldData = getVariantSoldData(variant.id);
  const sold = soldData.soldQuantity;

  const getStockStatus = () => {
    if (stock === 0) return { text: 'نافذ', color: 'bg-gray-500/20 text-gray-400' };
    if (available <= 0) return { text: 'محجوز بالكامل', color: 'bg-yellow-500/20 text-yellow-400' };
    if (variant.stockLevel === 'low') return { text: 'منخفض', color: 'bg-red-500/20 text-red-400' };
    if (variant.stockLevel === 'medium') return { text: 'متوسط', color: 'bg-orange-500/20 text-orange-400' };
    return { text: 'جيد', color: 'bg-green-500/20 text-green-400' };
  };

  const status = getStockStatus();

  return (
    <div
      className={cn(
        "grid grid-cols-11 items-center gap-1 md:gap-3 p-2 md:p-3 rounded-lg border transition-colors",
        "bg-card/50 border-border/60 hover:bg-accent/50 animate-fade-in"
      )}
    >
      {/* معلومات المنتج */}
      <div className="col-span-4 md:col-span-3 flex items-center gap-2 md:gap-3">
        {variant.image || product.images?.[0] ? (
          <img src={variant.image || product.images?.[0]} alt={product.name} className="w-8 h-8 md:w-10 md:h-10 rounded-md object-cover" />
        ) : (
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-md bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center">
            <svg className="w-4 h-4 md:w-5 md:h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
            </svg>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-xs md:text-sm truncate">{variant.size}</p>
          <p className="text-xs text-muted-foreground truncate">{variant.color}</p>
        </div>
      </div>
      
      {/* المخزون */}
      <div className="col-span-1 md:col-span-2 text-center">
        <p className="font-mono font-semibold text-sm md:text-base">{stock}</p>
      </div>
      
      {/* محجوز */}
      <div className="col-span-1 md:col-span-2 text-center">
        <p className="font-mono font-semibold text-sm md:text-base text-yellow-600">{reserved}</p>
      </div>
      
      {/* متاح */}
      <div className="col-span-2 md:col-span-2 text-center">
        <p className="font-mono font-semibold text-sm md:text-base text-green-600">{available}</p>
      </div>
      
      {/* مباع */}
      <div className="col-span-1 md:col-span-1 text-center">
        <p className="font-mono font-semibold text-sm md:text-base text-blue-600">{sold}</p>
      </div>
      
      {/* حالة المخزون */}
      <div className="col-span-2 md:col-span-1 text-center">
        <Badge className={cn("text-xs px-1 md:px-2 py-1", status.color)}>
          {status.text}
        </Badge>
      </div>
      
      {/* زر التعديل مخفي إذا لم تُمرر الوظيفة */}
      {onEditStock && (
        <div className="col-span-1 text-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEditStock(variant)}
            className="w-full md:w-auto"
          >
            <Edit className="h-3 w-3 md:h-4 md:w-4" />
          </Button>
        </div>
      )}
    </div>
  );
});

export default InventoryItem;
