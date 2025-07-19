import React, { useState, useMemo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import ManageProductActions from './ManageProductActions';
import { cn } from '@/lib/utils';
import { Star, Hash } from 'lucide-react';
import { useInventory } from '@/contexts/InventoryContext';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const ManageProductListItem = ({ product, isSelected, onSelect, onProductUpdate, refetchProducts }) => {
  const navigate = useNavigate();
  const { settings } = useInventory();

  const totalStock = useMemo(() => {
    if (!product.variants || product.variants.length === 0) return 0;
    return product.variants.reduce((sum, v) => {
      const quantity = parseInt(v.inventory?.[0]?.quantity) || parseInt(v.quantity) || 0;
      return sum + (isNaN(quantity) ? 0 : quantity);
    }, 0);
  }, [product.variants]);
  const hasActiveDiscount = useMemo(() => product.discount_price && new Date(product.discount_end_date) > new Date(), [product.discount_price, product.discount_end_date]);

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
      className={cn(
        "bg-card rounded-xl p-3 border transition-all duration-300 group",
        "shadow-lg shadow-black/10",
        "dark:shadow-lg dark:shadow-primary/20",
        "hover:shadow-xl hover:shadow-primary/20",
        "dark:hover:shadow-2xl dark:hover:shadow-primary/30",
        isSelected && "ring-2 ring-primary border-primary",
        product.is_active === false && "opacity-60 bg-muted/50" // إضافة تأثير بصري للمنتجات المخفية
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          <Checkbox checked={isSelected} onCheckedChange={() => onSelect(product.id)} />
          <div className="flex-1 min-w-0" onClick={handleEditProduct}>
            <div className="flex items-center gap-2 mb-1">
              {product.is_featured && <Star className="w-4 h-4 text-yellow-400 fill-yellow-400 flex-shrink-0" />}
              <p className="font-semibold text-foreground truncate">{product.name}</p>
              {/* إضافة شارة للمنتجات المخفية */}
              {product.is_active === false && (
                <span className="bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full dark:bg-red-900/20 dark:text-red-400">
                  مخفي
                </span>
              )}
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
              <div className="flex items-center gap-2 mt-1">
                <Hash className="w-3 h-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-mono">QR: {product.barcode}</span>
              </div>
            )}
            {product.is_active === false && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground font-medium">
                  هذا المنتج مخفي عن العملاء
                </span>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex-shrink-0">
          <ManageProductActions product={product} onProductUpdate={onProductUpdate} refetchProducts={refetchProducts} />
        </div>
      </div>
    </motion.div>
  );
};

export default ManageProductListItem;