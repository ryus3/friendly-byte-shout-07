import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ProductCard from './ProductCard';
import { Package } from 'lucide-react';
import ProductVariantDialog from './ProductVariantDialog';

const ProductGrid = React.memo(({ products, onProductSelect, onCreateOrder }) => {
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
        <AnimatePresence>
          {products.map((product, index) => (
            <motion.div
              key={product.id}
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
            >
              <ProductCard
                product={product}
                onSelect={() => onProductSelect(product)}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {products.length === 0 && (
        <div className="text-center py-12 col-span-full">
          <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-muted-foreground mb-2">لا توجد منتجات</h3>
          <p className="text-muted-foreground">جرب تغيير معايير البحث أو الفلترة</p>
        </div>
      )}
    </>
  );
});

export default ProductGrid;