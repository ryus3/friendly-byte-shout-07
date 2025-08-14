import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Filter, 
  ShoppingCart, 
  Heart, 
  Star, 
  ArrowRight,
  TrendingUp,
  Sparkles,
  Crown,
  Eye
} from 'lucide-react';

import { useSuper } from '@/contexts/SuperProvider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useCart } from '@/hooks/useCart';
import DefaultProductImage from '@/components/ui/default-product-image';

import StoreHeader from '@/components/store/StoreHeader';
import StoreHero from '@/components/store/StoreHero';
import FeaturedProducts from '@/components/store/FeaturedProducts';
import ProductCategories from '@/components/store/ProductCategories';
import TrendingProducts from '@/components/store/TrendingProducts';
import ProductDetailsModal from '@/components/store/ProductDetailsModal';
import CartSidebar from '@/components/store/CartSidebar';
import QuickOrderModal from '@/components/store/QuickOrderModal';

const StorePage = () => {
  const { products, categories, colors, sizes } = useSuper();
  const { cart, addToCart } = useCart();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isQuickOrderOpen, setIsQuickOrderOpen] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);

  // فلترة المنتجات
  useEffect(() => {
    let filtered = products?.filter(product => 
      product.is_active && 
      product.name.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

    if (selectedCategory) {
      filtered = filtered.filter(product => 
        product.categories?.some(cat => cat.id === selectedCategory.id)
      );
    }

    setFilteredProducts(filtered);
  }, [products, searchQuery, selectedCategory]);

  // إضافة/إزالة من المفضلة
  const toggleFavorite = (productId) => {
    setFavorites(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  // المنتجات المميزة (حسب المبيعات والتقييمات)
  const featuredProducts = filteredProducts.slice(0, 8);
  
  // المنتجات الأكثر طلباً
  const trendingProducts = filteredProducts.slice(8, 16);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <Helmet>
        <title>متجر RYUS الإلكتروني - تسوق أحدث المنتجات</title>
        <meta name="description" content="اكتشف مجموعتنا الحصرية من أفضل المنتجات بأسعار مميزة وجودة عالية" />
        <meta name="keywords" content="متجر إلكتروني, تسوق أونلاين, منتجات عصرية, RYUS" />
      </Helmet>

      {/* رأس المتجر */}
      <StoreHeader 
        cartItemsCount={cart.length}
        onCartClick={() => setIsCartOpen(true)}
        onQuickOrderClick={() => setIsQuickOrderOpen(true)}
      />

      {/* القسم الرئيسي المبهر */}
      <StoreHero />

      {/* شريط البحث والفلاتر */}
      <div className="container mx-auto px-4 py-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row gap-4 mb-8"
        >
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <Input
              placeholder="ابحث عن منتجك المفضل..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-10 h-12 text-lg border-2 border-primary/20 focus:border-primary/60 rounded-xl"
            />
          </div>
          <Button 
            variant="outline" 
            className="h-12 px-6 border-2 border-primary/20 hover:border-primary/60 rounded-xl"
          >
            <Filter className="w-5 h-5 ml-2" />
            فلاتر
          </Button>
        </motion.div>

        {/* تصنيفات المنتجات */}
        <ProductCategories 
          categories={categories}
          selectedCategory={selectedCategory}
          onCategorySelect={setSelectedCategory}
        />

        {/* المنتجات المميزة */}
        <FeaturedProducts 
          products={featuredProducts}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
          onProductClick={setSelectedProduct}
          onAddToCart={addToCart}
        />

        {/* المنتجات الأكثر طلباً */}
        <TrendingProducts 
          products={trendingProducts}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
          onProductClick={setSelectedProduct}
          onAddToCart={addToCart}
        />

        {/* جميع المنتجات */}
        <motion.section 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-16"
        >
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
              جميع المنتجات
            </h2>
            <span className="text-muted-foreground">
              {filteredProducts.length} منتج
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <AnimatePresence>
              {filteredProducts.map((product, index) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  index={index}
                  isFavorite={favorites.includes(product.id)}
                  onToggleFavorite={toggleFavorite}
                  onProductClick={setSelectedProduct}
                  onAddToCart={addToCart}
                />
              ))}
            </AnimatePresence>
          </div>
        </motion.section>
      </div>

      {/* نافذة تفاصيل المنتج */}
      <ProductDetailsModal
        product={selectedProduct}
        isOpen={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onAddToCart={addToCart}
        colors={colors}
        sizes={sizes}
      />

      {/* سلة التسوق الجانبية */}
      <CartSidebar
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        onQuickOrder={() => {
          setIsCartOpen(false);
          setIsQuickOrderOpen(true);
        }}
      />

      {/* نافذة الطلب السريع */}
      <QuickOrderModal
        isOpen={isQuickOrderOpen}
        onClose={() => setIsQuickOrderOpen(false)}
        cart={cart}
      />
    </div>
  );
};

// مكون كارت المنتج
const ProductCard = ({ product, index, isFavorite, onToggleFavorite, onProductClick, onAddToCart }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  const totalStock = product.variants?.reduce((sum, variant) => sum + (variant.quantity || 0), 0) || 0;
  const hasDiscount = product.discount_percentage > 0;
  const finalPrice = hasDiscount 
    ? product.price - (product.price * product.discount_percentage / 100)
    : product.price;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      whileHover={{ y: -8 }}
      className="group relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Card className="overflow-hidden border-0 bg-card/60 backdrop-blur-sm shadow-lg hover:shadow-2xl hover:shadow-primary/20 transition-all duration-500 rounded-2xl">
        <div className="relative aspect-square overflow-hidden">
          {/* صورة المنتج */}
          <motion.div 
            className="w-full h-full cursor-pointer"
            onClick={() => onProductClick(product)}
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.3 }}
          >
            {product.images?.[0] ? (
              <img
                src={product.images[0]}
                alt={product.name}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <DefaultProductImage className="w-full h-full" alt={product.name} />
            )}
          </motion.div>

          {/* أيقونات التفاعل */}
          <div className="absolute top-3 left-3 flex flex-col gap-2">
            <motion.button
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: isHovered ? 1 : 0, scale: isHovered ? 1 : 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => onToggleFavorite(product.id)}
              className={`p-2 rounded-full backdrop-blur-md border border-white/20 transition-all duration-300 ${
                isFavorite 
                  ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' 
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
            </motion.button>

            <motion.button
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: isHovered ? 1 : 0, scale: isHovered ? 1 : 0 }}
              transition={{ duration: 0.2, delay: 0.1 }}
              onClick={() => onProductClick(product)}
              className="p-2 rounded-full bg-white/20 backdrop-blur-md border border-white/20 text-white hover:bg-white/30 transition-all duration-300"
            >
              <Eye className="w-4 h-4" />
            </motion.button>
          </div>

          {/* شارات المنتج */}
          <div className="absolute top-3 right-3 flex flex-col gap-2">
            {hasDiscount && (
              <Badge className="bg-red-500 text-white font-bold px-2 py-1 rounded-lg shadow-lg">
                خصم {product.discount_percentage}%
              </Badge>
            )}
            {totalStock < 10 && totalStock > 0 && (
              <Badge variant="destructive" className="font-bold rounded-lg shadow-lg">
                قطع محدودة
              </Badge>
            )}
            {totalStock === 0 && (
              <Badge variant="secondary" className="font-bold rounded-lg shadow-lg">
                نفد المخزون
              </Badge>
            )}
          </div>

          {/* زر الإضافة السريعة */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: isHovered ? 1 : 0, y: isHovered ? 0 : 20 }}
            transition={{ duration: 0.3 }}
            className="absolute bottom-3 left-3 right-3"
          >
            <Button
              onClick={() => {
                if (product.variants?.[0]) {
                  onAddToCart(product, product.variants[0], 1);
                }
              }}
              disabled={totalStock === 0}
              className="w-full bg-primary/90 backdrop-blur-md hover:bg-primary text-white font-semibold py-2 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
            >
              <ShoppingCart className="w-4 h-4 ml-2" />
              إضافة للسلة
            </Button>
          </motion.div>
        </div>

        <CardContent className="p-4">
          <div className="space-y-3">
            {/* اسم المنتج */}
            <h3 
              className="font-bold text-lg line-clamp-2 cursor-pointer hover:text-primary transition-colors duration-300"
              onClick={() => onProductClick(product)}
            >
              {product.name}
            </h3>

            {/* الأسعار */}
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-primary">
                {finalPrice.toLocaleString()} د.ع
              </span>
              {hasDiscount && (
                <span className="text-lg text-muted-foreground line-through">
                  {product.price.toLocaleString()} د.ع
                </span>
              )}
            </div>

            {/* الألوان المتاحة */}
            {product.variants && (
              <div className="flex items-center gap-1 overflow-x-auto">
                {[...new Set(product.variants.map(v => v.color))].slice(0, 5).map((color, idx) => (
                  <div
                    key={idx}
                    className="w-6 h-6 rounded-full border-2 border-border shrink-0"
                    style={{ backgroundColor: colors?.find(c => c.name === color)?.hex_code || '#gray' }}
                    title={color}
                  />
                ))}
                {[...new Set(product.variants.map(v => v.color))].length > 5 && (
                  <span className="text-xs text-muted-foreground">+المزيد</span>
                )}
              </div>
            )}

            {/* التقييم والمخزون */}
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                <span className="font-medium">4.8</span>
                <span className="text-muted-foreground">(124)</span>
              </div>
              <span className="text-muted-foreground">
                متوفر: {totalStock}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default StorePage;