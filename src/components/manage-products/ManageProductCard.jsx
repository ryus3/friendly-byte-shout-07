import React, { useMemo, useState } from 'react';
    import { Button } from '@/components/ui/button';
    import { Edit, Trash2, Printer, Hash, Eye, EyeOff } from 'lucide-react';
    import { Switch } from '@/components/ui/switch';
    import { motion } from 'framer-motion';
    import { useInventory } from '@/contexts/InventoryContext';
    import { toast } from '@/components/ui/use-toast';
    import { cn } from '@/lib/utils';
    
    const ManageProductCard = ({ product, onEdit, onDelete, onPrint }) => {
      const { settings, updateProduct } = useInventory();
      const [isVisible, setIsVisible] = useState(product.is_active !== false);
      const totalStock = useMemo(() => {
        if (!product.variants || product.variants.length === 0) return 0;
        return product.variants.reduce((sum, v) => {
          const quantity = parseInt(v.inventory?.[0]?.quantity) || parseInt(v.quantity) || 0;
          return sum + (isNaN(quantity) ? 0 : quantity);
        }, 0);
      }, [product.variants]);
    
      const getStockLevelClass = () => {
        if (!settings) return 'bg-gray-500/80 text-white';
        if (totalStock <= (settings.lowStockThreshold || 5)) return 'bg-red-500/80 text-white';
        if (totalStock <= (settings.mediumStockThreshold || 10)) return 'bg-yellow-500/80 text-white';
        return 'bg-green-500/80 text-white';
      };
    
      const price = useMemo(() => {
        const hasActiveDiscount = product.discountPrice && new Date(product.discountEndDate) > new Date();
        const p = hasActiveDiscount ? product.discountPrice : (product.base_price || product.price);
        return isNaN(parseFloat(p)) ? 0 : parseFloat(p);
      }, [product]);

  const handleVisibilityChange = async (checked) => {
    try {
      const supabase = await import('@/lib/customSupabaseClient').then(m => m.default);
      const { error } = await supabase
        .from('products')
        .update({ is_active: checked })
        .eq('id', product.id);
      
      if (error) throw error;
      
      setIsVisible(checked);
      toast({
        title: `تم ${checked ? 'تفعيل' : 'إلغاء تفعيل'} ظهور المنتج`,
        description: `"${product.name}" الآن ${checked ? 'مرئي' : 'مخفي'} للموظفين.`,
      });
      
      // إعادة تحميل البيانات
      if (updateProduct) updateProduct();
    } catch (error) {
      console.error('Error updating product visibility:', error);
      toast({ title: "خطأ", description: "حدث خطأ أثناء تحديث ظهور المنتج.", variant: "destructive" });
    }
  };

      return (
        <motion.div
          layout
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="group relative overflow-hidden rounded-xl border bg-card shadow-md transition-all duration-300 hover:shadow-lg hover:shadow-primary/10"
        >
          <div className="absolute top-2 right-2 z-10 flex flex-col gap-2 items-end">
            <div className={cn("text-xs font-bold text-white rounded-full px-2 py-1", getStockLevelClass())}>
              {totalStock} قطعة
            </div>
            {/* مؤشر الرؤية */}
            <div className={cn(
              "rounded-full p-1 backdrop-blur-sm border",
              isVisible ? "bg-green-500/80 text-white border-green-400" : "bg-red-500/80 text-white border-red-400"
            )}>
              {isVisible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            </div>
          </div>
          <div className="aspect-square w-full overflow-hidden relative" onClick={(e) => { e.stopPropagation(); onEdit(product); }}>
            <img
              src={product.image || product.images?.[0] || "/api/placeholder/300/300"}
              alt={product.name}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-4" onClick={(e) => { e.stopPropagation(); onEdit(product); }}>
            <div className="p-2 rounded" style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)' }}>
              <h3 className="font-bold text-white text-lg truncate">{product.name}</h3>
              <p className="text-sm font-semibold text-white">{(price || 0).toLocaleString()} د.ع</p>
              {product.barcode && (
                <div className="flex items-center gap-1 mt-1">
                  <Hash className="w-3 h-3 text-white/70" />
                   <span className="text-xs text-white/70 font-mono">QR: {product.barcode}</span>
                </div>
              )}
              {/* زر تبديل الرؤية */}
              <div className="flex items-center gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                <span className="text-xs text-white/80">مرئي</span>
                <Switch 
                  checked={isVisible} 
                  onCheckedChange={handleVisibilityChange}
                  size="sm"
                />
              </div>
            </div>
          </div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20">
              <Button size="icon" variant="outline" className="h-9 w-9 bg-background/70 backdrop-blur" onClick={(e) => { e.stopPropagation(); onPrint(product); }}>
                <Printer className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="outline" className="h-9 w-9 bg-background/70 backdrop-blur" onClick={(e) => { e.stopPropagation(); onEdit(product); }}>
                <Edit className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="destructive" className="h-9 w-9" onClick={(e) => { e.stopPropagation(); onDelete(product); }}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
        </motion.div>
      );
    };
    
    export default ManageProductCard;