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
  Eye,
  Menu,
  X,
  User,
  Bell,
  Minus,
  Plus,
  Package,
  Zap,
  Flame
} from 'lucide-react';

import { useSuper } from '@/contexts/SuperProvider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useCart } from '@/hooks/useCart';
import DefaultProductImage from '@/components/ui/default-product-image';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

const StorePage = () => {
  const { products, categories, colors, sizes } = useSuper();
  const { cart, addToCart } = useCart();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <Helmet>
        <title>متجر RYUS الإلكتروني - تسوق أحدث المنتجات</title>
        <meta name="description" content="اكتشف مجموعتنا الحصرية من أفضل المنتجات بأسعار مميزة وجودة عالية" />
        <meta name="keywords" content="متجر إلكتروني, تسوق أونلاين, منتجات عصرية, RYUS" />
      </Helmet>

      {/* رأس المتجر */}
      <StoreHeader cartItemsCount={cart.length} onCartClick={() => setIsCartOpen(true)} />

      {/* القسم الرئيسي المبهر */}
      <StoreHero />

      {/* المحتوى الرئيسي */}
      <div className="container mx-auto px-4 py-8">
        {/* شريط البحث */}
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
                  onAddToCart={addToCart}
                />
              ))}
            </AnimatePresence>
          </div>

          {filteredProducts.length === 0 && (
            <div className="text-center py-16">
              <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">لا توجد منتجات</h3>
              <p className="text-muted-foreground">جرب البحث بكلمات مختلفة أو تصفح التصنيفات</p>
            </div>
          )}
        </motion.section>
      </div>

      {/* سلة التسوق الجانبية */}
      <CartSidebar
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
      />
    </div>
  );
};

// رأس المتجر المبسط
const StoreHeader = ({ cartItemsCount = 0, onCartClick }) => {
  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16 md:h-20">
          
          {/* الشعار */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <div className="w-10 h-10 bg-gradient-to-br from-primary via-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg">
              <Crown className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
                RYUS
              </h1>
              <p className="text-xs text-muted-foreground -mt-1">
                متجرك العصري
              </p>
            </div>
          </motion.div>

          {/* أيقونات التفاعل */}
          <div className="flex items-center gap-2">
            {/* المفضلة */}
            <Button
              variant="ghost"
              size="icon" 
              className="w-10 h-10 rounded-full hover:bg-accent relative"
            >
              <Heart className="w-5 h-5" />
              <Badge className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center p-0">
                3
              </Badge>
            </Button>

            {/* الإشعارات */}
            <Button
              variant="ghost"
              size="icon"
              className="w-10 h-10 rounded-full hover:bg-accent relative"
            >
              <Bell className="w-5 h-5" />
              <div className="absolute -top-1 -left-1 w-3 h-3 bg-primary rounded-full animate-pulse" />
            </Button>

            {/* سلة التسوق */}
            <Button
              onClick={onCartClick}
              variant="ghost"
              size="icon"
              className="w-10 h-10 rounded-full hover:bg-accent relative"
            >
              <ShoppingCart className="w-5 h-5" />
              {cartItemsCount > 0 && (
                <Badge className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center p-0">
                  {cartItemsCount}
                </Badge>
              )}
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

// القسم الرئيسي المبهر
const StoreHero = () => {
  return (
    <section className="relative min-h-[80vh] flex items-center overflow-hidden">
      
      {/* خلفية متدرجة مبهرة */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-purple-500/5 to-pink-500/5" />
      
      {/* عناصر خلفية متحركة */}
      <div className="absolute inset-0 overflow-hidden">
        {/* دوائر متحركة */}
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-4 h-4 bg-gradient-to-r from-primary/20 to-purple-500/20 rounded-full"
            animate={{
              x: [0, 100, 0],
              y: [0, -100, 0],
              scale: [1, 1.5, 1],
            }}
            transition={{
              duration: 8 + i * 2,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.5
            }}
            style={{
              left: `${10 + i * 12}%`,
              top: `${20 + (i % 3) * 30}%`,
            }}
          />
        ))}
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          
          {/* المحتوى النصي */}
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center lg:text-right space-y-8"
          >
            
            {/* شارة ترحيبية */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex justify-center lg:justify-start"
            >
              <Badge className="bg-gradient-to-r from-primary/20 to-purple-500/20 text-primary border-0 px-6 py-2 rounded-full text-sm font-medium">
                <Crown className="w-4 h-4 ml-2" />
                مرحباً بك في متجر RYUS
              </Badge>
            </motion.div>

            {/* العنوان الرئيسي */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="space-y-4"
            >
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold leading-tight">
                <span className="bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
                  تسوق بأناقة
                </span>
                <br />
                <span className="text-foreground">
                  واستمتع بالتميز
                </span>
              </h1>
              
              <p className="text-xl text-muted-foreground max-w-lg mx-auto lg:mx-0 leading-relaxed">
                اكتشف مجموعتنا الحصرية من أفضل المنتجات العصرية بجودة استثنائية وأسعار مناسبة
              </p>
            </motion.div>

            {/* أزرار العمل */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
            >
              <Button 
                size="lg"
                className="bg-gradient-to-r from-primary via-purple-500 to-pink-500 text-white px-8 py-4 rounded-full shadow-lg hover:shadow-xl hover:shadow-primary/30 transition-all duration-500 transform hover:-translate-y-1"
              >
                <ShoppingCart className="w-5 h-5 ml-2" />
                تسوق الآن
                <ArrowRight className="w-5 h-5 mr-2" />
              </Button>
              
              <Button 
                variant="outline"
                size="lg"
                className="px-8 py-4 rounded-full border-2 border-primary/30 hover:border-primary/60 transition-all duration-300"
              >
                <Heart className="w-5 h-5 ml-2" />
                المنتجات المميزة
              </Button>
            </motion.div>
          </motion.div>

          {/* الصورة التفاعلية */}
          <motion.div 
            initial={{ opacity: 0, x: 50, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="relative"
          >
            <div className="relative max-w-lg mx-auto">
              
              {/* صورة رئيسية */}
              <div className="aspect-square bg-gradient-to-br from-primary/20 via-purple-500/20 to-pink-500/20 rounded-3xl p-8 backdrop-blur-sm border border-white/20">
                <div className="w-full h-full bg-gradient-to-br from-primary/10 to-purple-500/10 rounded-2xl flex items-center justify-center">
                  <motion.div
                    animate={{ 
                      rotate: [0, 5, -5, 0],
                      scale: [1, 1.05, 1]
                    }}
                    transition={{ 
                      duration: 6,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                    className="text-8xl"
                  >
                    🛍️
                  </motion.div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

// تصنيفات المنتجات
const ProductCategories = ({ categories, selectedCategory, onCategorySelect }) => {
  if (!categories || categories.length === 0) return null;

  return (
    <motion.section 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-12"
    >
      <div className="flex items-center gap-3 mb-6">
        <Package className="w-6 h-6 text-primary" />
        <h3 className="text-xl font-bold text-foreground">تصفح حسب التصنيف</h3>
      </div>

      <div className="flex flex-wrap gap-3">
        {/* زر الكل */}
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Button
            variant={!selectedCategory ? "default" : "outline"}
            onClick={() => onCategorySelect(null)}
            className={`rounded-full px-6 py-2 transition-all duration-300 ${
              !selectedCategory 
                ? 'bg-gradient-to-r from-primary to-purple-500 text-white shadow-lg hover:shadow-xl' 
                : 'border-2 border-primary/30 hover:border-primary/60'
            }`}
          >
            <Package className="w-4 h-4 ml-2" />
            جميع المنتجات
          </Button>
        </motion.div>

        {categories.map((category, index) => (
          <motion.div
            key={category.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Button
              variant={selectedCategory?.id === category.id ? "default" : "outline"}
              onClick={() => onCategorySelect(category)}
              className={`rounded-full px-6 py-2 transition-all duration-300 ${
                selectedCategory?.id === category.id
                  ? 'bg-gradient-to-r from-primary to-purple-500 text-white shadow-lg hover:shadow-xl' 
                  : 'border-2 border-primary/30 hover:border-primary/60'
              }`}
            >
              {category.name}
            </Button>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
};

// مكون كارت المنتج
const ProductCard = ({ product, index, isFavorite, onToggleFavorite, onAddToCart }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  const totalStock = product.variants?.reduce((sum, variant) => sum + (variant.quantity || 0), 0) || 0;
  const productPrice = product.price || 0;
  const discountPercentage = product.discount_percentage || 0;
  const hasDiscount = discountPercentage > 0;
  const finalPrice = hasDiscount 
    ? productPrice - (productPrice * discountPercentage / 100)
    : productPrice;

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
            <h3 className="font-bold text-lg line-clamp-2 cursor-pointer hover:text-primary transition-colors duration-300">
              {product.name}
            </h3>

            {/* الأسعار */}
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-primary">
                {(finalPrice || 0).toLocaleString()} د.ع
              </span>
              {hasDiscount && productPrice > 0 && (
                <span className="text-lg text-muted-foreground line-through">
                  {productPrice.toLocaleString()} د.ع
                </span>
              )}
            </div>

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

// سلة التسوق الجانبية
const CartSidebar = ({ isOpen, onClose, cart }) => {
  const totalAmount = cart.reduce((sum, item) => sum + (item.total || 0), 0);
  const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 0), 0);

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="left" className="w-96 bg-background/95 backdrop-blur-xl">
        <div className="flex items-center gap-2 mb-6">
          <ShoppingCart className="w-5 h-5" />
          <h2 className="text-lg font-bold">سلة التسوق ({totalItems} منتج)</h2>
        </div>

        <div className="flex flex-col h-full">
          {cart.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-center">
              <div>
                <ShoppingCart className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">السلة فارغة</h3>
                <p className="text-muted-foreground">ابدأ بإضافة منتجاتك المفضلة</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto space-y-4">
                {cart.map((item) => (
                  <div key={item.id} className="flex gap-3 p-3 bg-card rounded-lg border">
                    <div className="w-16 h-16 bg-muted rounded-lg overflow-hidden">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.productName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <DefaultProductImage className="w-full h-full" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{item.productName}</h4>
                      <p className="text-xs text-muted-foreground">
                        {item.color} • {item.size} • {item.quantity}
                      </p>
                      <p className="text-sm font-bold text-primary">
                        {(item.total || 0).toLocaleString()} د.ع
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t pt-4 space-y-4">
                <div className="flex justify-between text-lg font-bold">
                  <span>المجموع:</span>
                  <span className="text-primary">{(totalAmount || 0).toLocaleString()} د.ع</span>
                </div>
                <Button className="w-full bg-gradient-to-r from-primary to-purple-500 text-white">
                  إتمام الطلب
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default StorePage;