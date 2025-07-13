import React, { useMemo } from 'react';
    import { Button } from '@/components/ui/button';
    import { Edit, Trash2, Printer } from 'lucide-react';
    import { motion } from 'framer-motion';
    import { useInventory } from '@/contexts/InventoryContext';
    import { cn } from '@/lib/utils';
    
    const ManageProductCard = ({ product, onEdit, onDelete, onPrint }) => {
      const { settings } = useInventory();
      const totalStock = useMemo(() => product.variants?.reduce((sum, v) => sum + (v.quantity || 0), 0) || 0, [product.variants]);
    
      const getStockLevelClass = () => {
        if (!settings) return 'bg-gray-500/80 text-white';
        if (totalStock <= (settings.lowStockThreshold || 5)) return 'bg-red-500/80 text-white';
        if (totalStock <= (settings.mediumStockThreshold || 10)) return 'bg-yellow-500/80 text-white';
        return 'bg-green-500/80 text-white';
      };
    
      const price = useMemo(() => {
        const hasActiveDiscount = product.discountPrice && new Date(product.discountEndDate) > new Date();
        const p = hasActiveDiscount ? product.discountPrice : product.price;
        return isNaN(parseFloat(p)) ? 0 : parseFloat(p);
      }, [product]);

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