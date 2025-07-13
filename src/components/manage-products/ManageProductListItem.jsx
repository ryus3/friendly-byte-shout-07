import React, { useState, useMemo } from 'react';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import ManageProductActions from './ManageProductActions';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { Star } from 'lucide-react';
import { useInventory } from '@/contexts/InventoryContext';
import { motion } from 'framer-motion';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

const ManageProductListItem = ({ product, isSelected, onSelect, onProductUpdate, onEdit }) => {
  const { updateProduct, settings } = useInventory();
  const [isVisible, setIsVisible] = useState(product.is_visible ?? true);

  const totalStock = useMemo(() => product.variants?.reduce((sum, v) => sum + (v.quantity || 0), 0) || 0, [product.variants]);
  const hasActiveDiscount = useMemo(() => product.discount_price && new Date(product.discount_end_date) > new Date(), [product.discount_price, product.discount_end_date]);

  const handleVisibilityChange = async (checked) => {
    setIsVisible(checked);
    const { success } = await updateProduct(product.id, { isVisible: checked });
    if (success) {
      toast({
        title: `تم ${checked ? 'تفعيل' : 'إلغاء تفعيل'} ظهور المنتج`,
        description: `"${product.name}" الآن ${checked ? 'مرئي' : 'مخفي'} للموظفين.`,
      });
      if (onProductUpdate) onProductUpdate();
    } else {
      setIsVisible(!checked);
      toast({ title: "خطأ", description: "فشل تحديث ظهور المنتج.", variant: "destructive" });
    }
  };

  const getStockLevelClass = () => {
    if (!settings) return 'text-gray-500';
    if (totalStock <= (settings.lowStockThreshold || 5)) return 'text-red-500';
    if (totalStock <= (settings.mediumStockThreshold || 10)) return 'text-yellow-500';
    return 'text-green-500';
  };

  const price = useMemo(() => {
    const p = hasActiveDiscount ? product.discount_price : product.price;
    return isNaN(parseFloat(p)) ? 0 : parseFloat(p);
  }, [product, hasActiveDiscount]);

  return (
    <motion.div
      layout
      className={cn(
        "bg-card rounded-xl p-3 border transition-all duration-300 group",
        "shadow-md shadow-black/5 dark:shadow-black/20",
        "hover:shadow-lg hover:shadow-primary/10 dark:hover:shadow-primary/15",
        isSelected && "ring-2 ring-primary border-primary"
      )}
    >
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Checkbox checked={isSelected} onCheckedChange={() => onSelect(product.id)} />
          <img src={product.images?.[0] || '/api/placeholder/150/150'} alt={product.name} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
          <div className="flex-1 min-w-0" onClick={() => onEdit(product)}>
            <div className="flex items-center gap-2 mb-1">
              {product.is_featured && <Star className="w-4 h-4 text-yellow-400 fill-yellow-400 flex-shrink-0" />}
              <p className="font-semibold text-foreground truncate">{product.name}</p>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className={cn("font-bold", getStockLevelClass())}>
                {(totalStock || 0).toLocaleString()} قطعة
              </span>
              <span className="font-bold text-primary">
                {(price || 0).toLocaleString()} د.ع
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">مرئي</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div onClick={(e) => e.stopPropagation()}>
                    <Switch id={`visibility-list-${product.id}`} checked={isVisible} onCheckedChange={handleVisibilityChange} />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isVisible ? 'إخفاء المنتج' : 'إظهار المنتج'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <ManageProductActions product={product} onProductUpdate={onProductUpdate} />
        </div>
      </div>
    </motion.div>
  );
};

export default ManageProductListItem;