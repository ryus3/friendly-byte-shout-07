import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Flame, Zap } from 'lucide-react';

const TrendingProducts = ({ products, favorites, onToggleFavorite, onProductClick, onAddToCart }) => {
  if (!products || products.length === 0) return null;

  return (
    <motion.section 
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      className="py-16"
      id="trending"
    >
      <div className="text-center mb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex items-center justify-center gap-3 mb-4"
        >
          <Flame className="w-8 h-8 text-red-500 animate-pulse" />
          <h2 className="text-4xl font-bold bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 bg-clip-text text-transparent">
            الأكثر طلباً
          </h2>
          <TrendingUp className="w-8 h-8 text-green-500" />
        </motion.div>
        
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="text-lg text-muted-foreground max-w-2xl mx-auto"
        >
          المنتجات الأكثر مبيعاً واقبالاً من عملائنا الكرام
        </motion.p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {products.map((product, index) => (
          <TrendingProductCard
            key={product.id}
            product={product}
            index={index}
            isFavorite={favorites.includes(product.id)}
            onToggleFavorite={onToggleFavorite}
            onProductClick={onProductClick}
            onAddToCart={onAddToCart}
          />
        ))}
      </div>
    </motion.section>
  );
};

const TrendingProductCard = ({ product, index, isFavorite, onToggleFavorite, onProductClick, onAddToCart }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      whileHover={{ y: -10, scale: 1.02 }}
      className="group relative"
    >
      {/* شارة trending */}
      <div className="absolute -top-3 -right-3 z-10">
        <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
          <Zap className="w-3 h-3 inline ml-1" />
          رائج
        </div>
      </div>

      {/* محتوى الكارت */}
      <div className="product-card bg-gradient-to-br from-card/80 to-card/60 backdrop-blur-md border-2 border-red-500/20 hover:border-red-500/40 transition-all duration-500">
        {/* محتوى الكارت */}
      </div>
    </motion.div>
  );
};

export default TrendingProducts;