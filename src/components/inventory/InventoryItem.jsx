
import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Edit } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const InventoryItem = React.memo(({ variant, product, onEditStock }) => {
  if (!variant) {
    return null; // Or a placeholder/error component
  }

  const stock = variant.quantity || 0;
  const reserved = variant.reserved || 0;
  const available = stock - reserved;

  const getStockStatus = () => {
    if (stock === 0) return { text: 'نافذ', color: 'bg-red-500/20 text-red-400' };
    if (available <= 0) return { text: 'محجوز بالكامل', color: 'bg-yellow-500/20 text-yellow-400' };
    if (variant.stockLevel === 'low') return { text: 'منخفض', color: 'bg-red-500/20 text-red-400' };
    if (variant.stockLevel === 'medium') return { text: 'متوسط', color: 'bg-yellow-500/20 text-yellow-400' };
    return { text: 'جيد', color: 'bg-green-500/20 text-green-400' };
  };

  const status = getStockStatus();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="grid grid-cols-12 items-center gap-4 p-3 bg-card/50 rounded-lg border border-border/60 hover:bg-accent/50 transition-colors"
    >
      <div className="col-span-4 md:col-span-3 flex items-center gap-3">
        <img src={variant.image || product.images?.[0] || '/api/placeholder/150/150'} alt={product.name} className="w-10 h-10 rounded-md object-cover" />
        <div>
          <p className="font-semibold text-foreground text-sm">{variant.size}</p>
          <p className="text-xs text-muted-foreground">{variant.color}</p>
        </div>
      </div>
      <div className="col-span-2 md:col-span-2 text-center">
        <p className="font-mono font-semibold text-base">{stock}</p>
        <p className="text-xs text-muted-foreground">المخزون</p>
      </div>
      <div className="col-span-2 md:col-span-2 text-center">
        <p className="font-mono font-semibold text-base text-yellow-500">{reserved}</p>
        <p className="text-xs text-muted-foreground">محجوز</p>
      </div>
      <div className="col-span-2 md:col-span-2 text-center">
        <p className="font-mono font-semibold text-base text-green-500">{available}</p>
        <p className="text-xs text-muted-foreground">متاح</p>
      </div>
      <div className="col-span-2 md:col-span-2 text-center">
        <Badge className={cn("w-20 justify-center text-xs", status.color)}>{status.text}</Badge>
      </div>
      <div className="col-span-12 md:col-span-1 text-left">
        {onEditStock && (
          <Button variant="ghost" size="icon" onClick={onEditStock}>
            <Edit className="w-4 h-4" />
          </Button>
        )}
      </div>
    </motion.div>
  );
});

export default InventoryItem;
