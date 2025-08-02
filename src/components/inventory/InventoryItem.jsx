
import React from 'react';
import { Button } from '@/components/ui/button';
import { Edit } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const InventoryItem = React.memo(({ variant, product, onEditStock }) => {
  if (!variant) {
    return null; // Or a placeholder/error component
  }

  const stock = variant.quantity || 0;
  const reserved = variant.reserved_quantity || variant.reserved || 0;
  const available = stock - reserved;
  const sold = variant.sold_quantity || 0;

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
        "grid grid-cols-12 items-center gap-1 md:gap-3 p-2 md:p-3 rounded-lg border transition-colors",
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
          <h3 className="font-semibold text-xs md:text-sm truncate">{product.name}</h3>
          <p className="text-xs text-muted-foreground truncate">{variant.size}</p>
          <p className="text-xs text-muted-foreground truncate">{variant.color}</p>
        </div>
      </div>
      
      {/* العناوين للهاتف فقط */}
      <div className="col-span-12 md:hidden grid grid-cols-5 gap-1 mt-2 mb-1 px-1">
        <div className="text-center">
          <p className="text-xs text-muted-foreground font-semibold">المخزون</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground font-semibold">محجوز</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground font-semibold">متاح</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground font-semibold">مباع</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground font-semibold">الحالة</p>
        </div>
      </div>
      
      {/* الأرقام للهاتف */}
      <div className="col-span-12 md:hidden grid grid-cols-5 gap-1 px-1">
        <div className="text-center">
          <p className="font-mono font-semibold text-sm">{stock}</p>
        </div>
        <div className="text-center">
          <p className="font-mono font-semibold text-sm text-yellow-600">{reserved}</p>
        </div>
        <div className="text-center">
          <p className="font-mono font-semibold text-sm text-green-600">{available}</p>
        </div>
        <div className="text-center">
          <p className="font-mono font-semibold text-sm text-blue-600">{sold}</p>
        </div>
        <div className="text-center">
          <Badge className={cn("text-xs px-1 py-0.5", status.color)}>
            {status.text}
          </Badge>
        </div>
      </div>
      
      {/* للحاسوب - المخزون */}
      <div className="hidden md:block col-span-2 text-center">
        <p className="font-mono font-semibold text-base">{stock}</p>
        <p className="text-xs text-muted-foreground">المخزون</p>
      </div>
      
      {/* للحاسوب - محجوز */}
      <div className="hidden md:block col-span-2 text-center">
        <p className="font-mono font-semibold text-base text-yellow-600">{reserved}</p>
        <p className="text-xs text-muted-foreground">محجوز</p>
      </div>
      
      {/* للحاسوب - متاح */}
      <div className="hidden md:block col-span-2 text-center">
        <p className="font-mono font-semibold text-base text-green-600">{available}</p>
        <p className="text-xs text-muted-foreground">متاح</p>
      </div>
      
      {/* للحاسوب - مباع */}
      <div className="hidden md:block col-span-2 text-center">
        <p className="font-mono font-semibold text-base text-blue-600">{sold}</p>
        <p className="text-xs text-muted-foreground">مباع</p>
      </div>
      
      {/* للحاسوب - حالة المخزون */}
      <div className="hidden md:block col-span-1 text-center">
        <Badge className={cn("w-full max-w-20 justify-center text-xs px-2 py-1", status.color)}>
          {status.text}
        </Badge>
      </div>
      
      {/* زر التعديل */}
      <div className="col-span-12 md:col-span-1 text-center mt-2 md:mt-0">
        {onEditStock && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEditStock(variant)}
            className="w-full md:w-auto"
          >
            <Edit className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">تعديل</span>
          </Button>
        )}
      </div>
    </div>
  );
});

export default InventoryItem;
