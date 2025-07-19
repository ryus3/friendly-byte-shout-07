import React, { useState, useMemo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import ManageProductActions from './ManageProductActions';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { Star, Hash, Eye, EyeOff } from 'lucide-react';
import { useInventory } from '@/contexts/InventoryContext';
import { motion } from 'framer-motion';
import Barcode from 'react-barcode';

const ManageProductListItem = ({ product, isSelected, onSelect, onProductUpdate, onEdit }) => {
  const { updateProduct, settings } = useInventory();
  const [isVisible, setIsVisible] = useState(product.is_active !== false); // افتراضياً true إلا إذا كانت false صراحة

  const totalStock = useMemo(() => {
    if (!product.variants || product.variants.length === 0) return 0;
    return product.variants.reduce((sum, v) => {
      const quantity = parseInt(v.inventory?.[0]?.quantity) || parseInt(v.quantity) || 0;
      return sum + (isNaN(quantity) ? 0 : quantity);
    }, 0);
  }, [product.variants]);
  const hasActiveDiscount = useMemo(() => product.discount_price && new Date(product.discount_end_date) > new Date(), [product.discount_price, product.discount_end_date]);

  const handleVisibilityChange = async (checked) => {
    setIsVisible(checked);
    try {
      const supabase = await import('@/lib/customSupabaseClient').then(m => m.default);
      const { error } = await supabase
        .from('products')
        .update({ is_active: checked })
        .eq('id', product.id);
      
      if (error) throw error;
      
      toast({
        title: `تم ${checked ? 'إظهار' : 'إخفاء'} المنتج`,
        description: `"${product.name}" الآن ${checked ? 'مرئي' : 'مخفي'} للموظفين في صفحة المنتجات.`,
      });
      
      // تحديث البيانات في الذاكرة
      if (updateProduct) {
        updateProduct(product.id, { is_active: checked });
      }
      if (onProductUpdate) onProductUpdate();
    } catch (error) {
      console.error('Error updating product visibility:', error);
      setIsVisible(!checked);
      toast({ title: "خطأ", description: "حدث خطأ أثناء تحديث ظهور المنتج.", variant: "destructive" });
    }
  };

  const getStockLevelClass = () => {
    if (!settings) return 'text-gray-500';
    if (totalStock <= (settings.lowStockThreshold || 5)) return 'text-red-500';
    if (totalStock <= (settings.mediumStockThreshold || 10)) return 'text-yellow-500';
    return 'text-green-500';
  };

  const price = useMemo(() => {
    const p = hasActiveDiscount ? product.discount_price : (product.base_price || product.price);
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
            {product.barcode && (
              <div className="flex items-center gap-2 mt-2">
                <Hash className="w-3 h-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-mono">QR: {product.barcode}</span>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleVisibilityChange(!isVisible);
              }}
              className={cn(
                "group flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300 border-2",
                "hover:scale-110 active:scale-95 shadow-md",
                isVisible 
                  ? "bg-green-50 border-green-300 text-green-600 hover:bg-green-100 dark:bg-green-900/20 dark:border-green-600 dark:text-green-400" 
                  : "bg-red-50 border-red-300 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:border-red-600 dark:text-red-400"
              )}
              title={isVisible ? 'إخفاء المنتج' : 'إظهار المنتج'}
            >
              {isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground font-medium">
                {isVisible ? 'مرئي' : 'مخفي'}
              </span>
            </div>
          </div>
          <ManageProductActions product={product} onProductUpdate={onProductUpdate} />
        </div>
      </div>
    </motion.div>
  );
};

export default ManageProductListItem;