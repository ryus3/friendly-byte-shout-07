import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, Printer, Hash } from 'lucide-react';
import { motion } from 'framer-motion';
import { useInventory } from '@/contexts/InventoryContext';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
    
const ManageProductCard = ({ product, onDelete, onPrint }) => {
  const navigate = useNavigate();
  const { settings } = useInventory();
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
  
  const handleEditProduct = () => {
    // الانتقال لصفحة إضافة المنتج مع بيانات المنتج للتعديل
    navigate('/add-product', { 
      state: { 
        editProduct: product,
        from: '/manage-products'
      } 
    });
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="group relative overflow-hidden rounded-xl border bg-card 
                 shadow-lg shadow-black/10 
                 dark:shadow-lg dark:shadow-primary/20
                 transition-all duration-300 
                 hover:shadow-xl hover:shadow-primary/20
                 dark:hover:shadow-2xl dark:hover:shadow-primary/30
                 hover:-translate-y-1"
    >
      <div className="absolute top-2 right-2 z-10 flex flex-col gap-2 items-end">
        <div className={cn("text-xs font-bold text-white rounded-full px-2 py-1", getStockLevelClass())}>
          {totalStock} قطعة
        </div>
        {/* إضافة شارة للمنتجات المخفية */}
        {product.is_active === false && (
          <div className="bg-red-500/90 text-white text-xs px-2 py-1 rounded-full">
            مخفي
          </div>
        )}
      </div>
      <div className="aspect-square w-full overflow-hidden relative" onClick={handleEditProduct}>
        <img
          src={product.image || product.images?.[0] || "/api/placeholder/300/300"}
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-4" onClick={handleEditProduct}>
        <div className="p-2 rounded" style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)' }}>
          <h3 className="font-bold text-white text-lg truncate">{product.name}</h3>
          <p className="text-sm font-semibold text-white">{(price || 0).toLocaleString()} د.ع</p>
          {product.barcode && (
            <div className="flex items-center gap-1 mt-1">
              <Hash className="w-3 h-3 text-white/70" />
               <span className="text-xs text-white/70 font-mono">QR: {product.barcode}</span>
            </div>
          )}
        </div>
      </div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20">
          <Button size="icon" variant="outline" className="h-9 w-9 bg-background/70 backdrop-blur" onClick={(e) => { e.stopPropagation(); onPrint(product); }}>
            <Printer className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="outline" className="h-9 w-9 bg-background/70 backdrop-blur" onClick={handleEditProduct}>
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