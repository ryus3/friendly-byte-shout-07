import React from 'react';
import { motion } from 'framer-motion';
import { Star, Sparkles, Crown, TrendingUp } from 'lucide-react';

const FeaturedProducts = ({ products, favorites, onToggleFavorite, onProductClick, onAddToCart }) => {
  if (!products || products.length === 0) return null;

  return (
    <motion.section 
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      className="py-16"
      id="featured"
    >
      <div className="text-center mb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex items-center justify-center gap-3 mb-4"
        >
          <Crown className="w-8 h-8 text-primary" />
          <h2 className="text-4xl font-bold bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
            المنتجات المميزة
          </h2>
          <Sparkles className="w-8 h-8 text-primary animate-pulse" />
        </motion.div>
        
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="text-lg text-muted-foreground max-w-2xl mx-auto"
        >
          مجموعة منتقاة بعناية من أفضل منتجاتنا الحصرية والأكثر تميزاً
        </motion.p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {products.map((product, index) => (
          <FeaturedProductCard
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

const FeaturedProductCard = ({ product, index, isFavorite, onToggleFavorite, onProductClick, onAddToCart }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      whileHover={{ y: -10, scale: 1.02 }}
      className="group relative"
    >
      {/* شارة مميز */}
      <div className="absolute -top-3 -right-3 z-10">
        <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg animate-pulse">
          <Star className="w-3 h-3 inline ml-1" />
          مميز
        </div>
      </div>

      {/* باقي محتوى الكارت يتم إعادة استخدامه من ProductCard */}
      <div className="product-card bg-gradient-to-br from-card/80 to-card/60 backdrop-blur-md border-2 border-primary/20 hover:border-primary/40 transition-all duration-500">
        {/* محتوى الكارت */}
      </div>
    </motion.div>
  );
};

export default FeaturedProducts;