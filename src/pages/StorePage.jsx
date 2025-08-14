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
  Flame,
  ChevronDown,
  Grid3X3,
  List,
  SlidersHorizontal,
  Globe,
  Truck,
  Shield,
  Award,
  MessageCircle,
  Share2,
  Phone,
  MapPin,
  Clock,
  Gift,
  Tag,
  Home,
  ChevronRight,
  Sun,
  Moon
} from 'lucide-react';

import { useSuper } from '@/contexts/SuperProvider';
import { useTheme } from '@/contexts/ThemeContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useCart } from '@/hooks/useCart';
import DefaultProductImage from '@/components/ui/default-product-image';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const StorePage = () => {
  const { products, categories, colors, sizes } = useSuper();
  const { cart, addToCart } = useCart();
  const { theme, setTheme } = useTheme();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [viewMode, setViewMode] = useState('grid');
  const [sortBy, setSortBy] = useState('featured');
  const [priceRange, setPriceRange] = useState({ min: 0, max: 1000000 });
  const [showQuickOrder, setShowQuickOrder] = useState(false);

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

    filtered = filtered.filter(product => {
      const price = product.price || 0;
      return price >= priceRange.min && price <= priceRange.max;
    });

    switch (sortBy) {
      case 'price-low':
        filtered.sort((a, b) => (a.price || 0) - (b.price || 0));
        break;
      case 'price-high':
        filtered.sort((a, b) => (b.price || 0) - (a.price || 0));
        break;
      case 'newest':
        filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        break;
      case 'popular':
        filtered.sort(() => Math.random() - 0.5);
        break;
      default:
        break;
    }

    setFilteredProducts(filtered);
  }, [products, searchQuery, selectedCategory, priceRange, sortBy]);

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>RYUS Brand - Premium Fashion Store | تسوق الأزياء الراقية</title>
        <meta name="description" content="اكتشف مجموعة RYUS الحصرية من الأزياء الراقية والإكسسوارات العصرية. تسوق بثقة مع ضمان الجودة والتوصيل المجاني." />
        <meta name="keywords" content="RYUS, أزياء راقية, تسوق إلكتروني, ملابس عصرية, إكسسوارات, الموضة" />
        <meta property="og:title" content="RYUS Brand - Premium Fashion Store" />
        <meta property="og:description" content="اكتشف مجموعة RYUS الحصرية من الأزياء الراقية" />
        <meta property="og:type" content="website" />
        <link rel="canonical" href="https://ryusbrand.com" />
      </Helmet>

      {/* رأس الصفحة المتطور */}
      <SheinStyleHeader 
        cartItemsCount={cart.length} 
        onCartClick={() => setIsCartOpen(true)}
        favorites={favorites}
        theme={theme}
        setTheme={setTheme}
      />

      {/* البانر الرئيسي المذهل */}
      <AmazingHero />

      {/* شريط التصنيفات */}
      <CategoriesBar 
        categories={categories}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
      />

      {/* المحتوى الرئيسي */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* شريط البحث والفلاتر */}
        <AdvancedFilters 
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          sortBy={sortBy}
          setSortBy={setSortBy}
          viewMode={viewMode}
          setViewMode={setViewMode}
          priceRange={priceRange}
          setPriceRange={setPriceRange}
        />

        {/* النتائج */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-foreground">
              {selectedCategory ? selectedCategory.name : 'جميع المنتجات'}
            </h2>
            <Badge variant="secondary" className="text-sm">
              {filteredProducts.length} منتج
            </Badge>
          </div>
        </div>

        {/* عرض المنتجات */}
        <SheinStyleProductGrid 
          products={filteredProducts}
          viewMode={viewMode}
          favorites={favorites}
          onToggleFavorite={(id) => setFavorites(prev => 
            prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
          )}
          onProductClick={setSelectedProduct}
          onAddToCart={addToCart}
        />

        {filteredProducts.length === 0 && (
          <EmptyState />
        )}
      </div>

      {/* سلة التسوق المتطورة */}
      <PremiumCartSidebar
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        onQuickOrder={() => setShowQuickOrder(true)}
      />

      {/* نافذة الطلب السريع */}
      <QuickOrderModal
        isOpen={showQuickOrder}
        onClose={() => setShowQuickOrder(false)}
        cart={cart}
      />

      {/* تفاصيل المنتج */}
      <ProductDetailsModal
        product={selectedProduct}
        isOpen={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onAddToCart={addToCart}
        favorites={favorites}
        onToggleFavorite={(id) => setFavorites(prev => 
          prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
        )}
      />

      {/* تذييل الصفحة */}
      <AmazingFooter />

      {/* زر الواتساب العائم */}
      <WhatsAppButton />
    </div>
  );
};

// رأس الصفحة بنمط Shein
const SheinStyleHeader = ({ cartItemsCount, onCartClick, favorites, theme, setTheme }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <>
      {/* شريط علوي للعروض */}
      <div className="bg-gradient-to-r from-red-500 via-pink-500 to-purple-500 text-white py-2 px-4 text-center text-sm">
        <motion.div
          animate={{ x: [-30, 0, -30] }}
          transition={{ duration: 4, repeat: Infinity }}
          className="flex items-center justify-center gap-2"
        >
          <Gift className="w-4 h-4" />
          خصم 50% على جميع المنتجات - عرض محدود!
          <Gift className="w-4 h-4" />
        </motion.div>
      </div>

      {/* الرأس الرئيسي */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-xl border-b border-border/20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* الشعار */}
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3"
            >
              <div className="relative">
                <div className="w-10 h-10 bg-gradient-to-br from-red-500 via-pink-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg">
                  <Crown className="w-6 h-6 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full">
                  <Sparkles className="w-2 h-2 text-yellow-800 absolute top-0.5 left-0.5" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-red-500 via-pink-500 to-purple-500 bg-clip-text text-transparent">
                  RYUS
                </h1>
                <p className="text-xs text-muted-foreground font-medium">
                  Premium Fashion
                </p>
              </div>
            </motion.div>

            {/* شريط البحث */}
            <div className="hidden md:flex flex-1 max-w-md mx-8">
              <div className="relative w-full">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                <Input
                  placeholder="ابحث عن المنتجات..."
                  className="pr-10 border-2 border-border/20 focus:border-primary/50 rounded-full bg-muted/30"
                />
              </div>
            </div>

            {/* أيقونات التفاعل */}
            <div className="flex items-center gap-2">
              
              {/* تبديل الثيم */}
              <Button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                variant="ghost"
                size="icon"
                className="w-10 h-10 rounded-full hover:bg-accent/50"
              >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </Button>

              {/* حساب المستخدم */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="w-10 h-10 rounded-full">
                    <User className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem>تسجيل الدخول</DropdownMenuItem>
                  <DropdownMenuItem>إنشاء حساب</DropdownMenuItem>
                  <DropdownMenuItem>طلباتي</DropdownMenuItem>
                  <DropdownMenuItem>المفضلة</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* المفضلة */}
              <Button variant="ghost" size="icon" className="w-10 h-10 rounded-full relative">
                <Heart className="w-5 h-5" />
                {favorites.length > 0 && (
                  <Badge className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs p-0">
                    {favorites.length}
                  </Badge>
                )}
              </Button>

              {/* سلة التسوق */}
              <Button
                onClick={onCartClick}
                variant="ghost"
                size="icon"
                className="w-10 h-10 rounded-full relative"
              >
                <ShoppingCart className="w-5 h-5" />
                {cartItemsCount > 0 && (
                  <Badge className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-primary text-white text-xs p-0 animate-pulse">
                    {cartItemsCount}
                  </Badge>
                )}
              </Button>

              {/* قائمة الهاتف */}
              <Button
                onClick={() => setIsMenuOpen(true)}
                variant="ghost"
                size="icon"
                className="md:hidden w-10 h-10 rounded-full"
              >
                <Menu className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* شريط التنقل */}
        <div className="hidden md:block border-t border-border/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex items-center justify-center space-x-8 space-x-reverse py-3">
              {[
                { label: 'الرئيسية', href: '#', icon: Home },
                { label: 'رجالي', href: '#', icon: User },
                { label: 'نسائي', href: '#', icon: User },
                { label: 'أطفال', href: '#', icon: User },
                { label: 'العروض', href: '#', icon: Tag, badge: 'جديد' }
              ].map((item, index) => (
                <motion.a
                  key={item.label}
                  href={item.href}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="relative flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors duration-300 group"
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                  {item.badge && (
                    <Badge className="bg-red-500 text-white text-xs px-1 py-0 h-4">
                      {item.badge}
                    </Badge>
                  )}
                  <span className="absolute inset-x-0 -bottom-3 h-0.5 bg-gradient-to-r from-red-500 to-purple-500 scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
                </motion.a>
              ))}
            </nav>
          </div>
        </div>
      </header>
    </>
  );
};

// البانر الرئيسي المذهل
const AmazingHero = () => {
  return (
    <section className="relative h-[70vh] min-h-[500px] flex items-center overflow-hidden">
      
      {/* خلفية متدرجة */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-pink-900 to-red-900 dark:from-purple-950 dark:via-pink-950 dark:to-red-950" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
      </div>

      {/* عناصر ديكورية */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(15)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-white/20 rounded-full"
            animate={{
              x: [0, Math.random() * 200, 0],
              y: [0, Math.random() * -200, 0],
              opacity: [0.2, 0.8, 0.2],
              scale: [0.5, 1.2, 0.5],
            }}
            transition={{
              duration: 6 + i,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.4
            }}
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center lg:text-right space-y-8"
          >
            
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex justify-center lg:justify-start"
            >
              <Badge className="bg-white/10 backdrop-blur-md text-white border-white/20 px-6 py-3 rounded-full text-base font-medium">
                <Sparkles className="w-5 h-5 ml-2" />
                RYUS Collection 2024
              </Badge>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="space-y-6"
            >
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold leading-tight text-white">
                <span className="block bg-gradient-to-r from-white via-pink-200 to-purple-200 bg-clip-text text-transparent">
                  أزياء عالمية
                </span>
                <span className="block text-white/90">
                  بلمسة عربية
                </span>
              </h1>
              
              <p className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                اكتشف مجموعة RYUS الحصرية من الأزياء العالمية، مصممة خصيصاً لتعكس أناقتك وشخصيتك المميزة
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
            >
              <Button 
                size="lg"
                className="bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white font-bold px-8 py-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <ShoppingCart className="w-5 h-5 ml-2" />
                تسوق الآن
              </Button>
              <Button 
                size="lg"
                variant="outline"
                className="border-white/30 text-white hover:bg-white/10 font-bold px-8 py-4 rounded-full backdrop-blur-sm"
              >
                <Eye className="w-5 h-5 ml-2" />
                استكشف المجموعة
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="grid grid-cols-3 gap-6 max-w-sm mx-auto lg:mx-0"
            >
              {[
                { number: '10K+', label: 'عميل سعيد' },
                { number: '500+', label: 'منتج مميز' },
                { number: '98%', label: 'معدل الرضا' }
              ].map((stat, index) => (
                <div key={index} className="text-center">
                  <div className="text-2xl font-bold text-white">{stat.number}</div>
                  <div className="text-sm text-white/70">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="relative"
          >
            <div className="relative w-96 h-96 mx-auto">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 rounded-full border-2 border-white/20 border-dashed"
              />
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                className="absolute inset-4 rounded-full border border-white/30"
              />
              <div className="absolute inset-8 bg-gradient-to-br from-white/20 to-white/5 rounded-full backdrop-blur-sm flex items-center justify-center">
                <div className="text-8xl">👗</div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

// شريط التصنيفات
const CategoriesBar = ({ categories, selectedCategory, setSelectedCategory }) => {
  return (
    <div className="bg-card border-b border-border/20 py-4">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4 overflow-x-auto scrollbar-hide">
          <Button
            onClick={() => setSelectedCategory(null)}
            variant={!selectedCategory ? "default" : "ghost"}
            className="whitespace-nowrap rounded-full"
          >
            جميع الفئات
          </Button>
          {categories?.map((category) => (
            <Button
              key={category.id}
              onClick={() => setSelectedCategory(category)}
              variant={selectedCategory?.id === category.id ? "default" : "ghost"}
              className="whitespace-nowrap rounded-full"
            >
              {category.name}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};

// الفلاتر المتقدمة
const AdvancedFilters = ({ 
  searchQuery, 
  setSearchQuery, 
  sortBy, 
  setSortBy, 
  viewMode, 
  setViewMode,
  priceRange,
  setPriceRange
}) => {
  return (
    <div className="bg-card rounded-xl border border-border/20 p-6 mb-8 shadow-sm">
      <div className="grid lg:grid-cols-4 gap-6">
        
        {/* البحث */}
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-2 block">البحث</label>
          <div className="relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث عن المنتجات..."
              className="pr-10"
            />
          </div>
        </div>

        {/* الترتيب */}
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-2 block">ترتيب حسب</label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                {sortBy === 'featured' && 'مميز'}
                {sortBy === 'price-low' && 'السعر: منخفض إلى مرتفع'}
                {sortBy === 'price-high' && 'السعر: مرتفع إلى منخفض'}
                {sortBy === 'newest' && 'الأحدث'}
                {sortBy === 'popular' && 'الأكثر شعبية'}
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => setSortBy('featured')}>مميز</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('price-low')}>السعر: منخفض إلى مرتفع</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('price-high')}>السعر: مرتفع إلى منخفض</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('newest')}>الأحدث</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('popular')}>الأكثر شعبية</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* نوع العرض */}
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-2 block">نوع العرض</label>
          <div className="flex gap-2">
            <Button
              onClick={() => setViewMode('grid')}
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="sm"
              className="flex-1"
            >
              <Grid3X3 className="w-4 h-4" />
            </Button>
            <Button
              onClick={() => setViewMode('list')}
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              className="flex-1"
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* الفلاتر */}
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-2 block">فلاتر متقدمة</label>
          <Button variant="outline" className="w-full">
            <SlidersHorizontal className="w-4 h-4 ml-2" />
            المزيد من الفلاتر
          </Button>
        </div>
      </div>
    </div>
  );
};

// شبكة المنتجات بنمط Shein
const SheinStyleProductGrid = ({ 
  products, 
  viewMode, 
  favorites, 
  onToggleFavorite, 
  onProductClick, 
  onAddToCart 
}) => {
  if (viewMode === 'list') {
    return (
      <div className="space-y-4">
        {products.map((product) => (
          <ProductListItem
            key={product.id}
            product={product}
            isFavorite={favorites.includes(product.id)}
            onToggleFavorite={() => onToggleFavorite(product.id)}
            onClick={() => onProductClick(product)}
            onAddToCart={() => onAddToCart(product)}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {products.map((product) => (
        <SheinProductCard
          key={product.id}
          product={product}
          isFavorite={favorites.includes(product.id)}
          onToggleFavorite={() => onToggleFavorite(product.id)}
          onClick={() => onProductClick(product)}
          onAddToCart={() => onAddToCart(product)}
        />
      ))}
    </div>
  );
};

// كارت المنتج بنمط Shein
const SheinProductCard = ({ product, isFavorite, onToggleFavorite, onClick, onAddToCart }) => {
  const productPrice = product.price || 0;
  const discountPercentage = Math.floor(Math.random() * 50) + 10; // خصم عشوائي للعرض
  const finalPrice = productPrice * (1 - discountPercentage / 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5 }}
      className="group cursor-pointer"
    >
      <Card className="product-card overflow-hidden">
        <div className="relative aspect-[3/4] overflow-hidden">
          
          {/* صورة المنتج */}
          <div onClick={onClick} className="w-full h-full">
            {product.main_image ? (
              <img
                src={product.main_image}
                alt={product.name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-muted">
                <DefaultProductImage className="w-20 h-20" />
              </div>
            )}
          </div>

          {/* الشارات */}
          <div className="absolute top-3 left-3 flex flex-col gap-2">
            {discountPercentage > 0 && (
              <Badge className="bg-red-500 text-white text-xs px-2 py-1">
                -{discountPercentage}%
              </Badge>
            )}
            <Badge className="bg-green-500 text-white text-xs px-2 py-1">
              توصيل مجاني
            </Badge>
          </div>

          {/* أيقونة المفضلة */}
          <Button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            size="icon"
            variant="ghost"
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm hover:bg-white"
          >
            <Heart 
              className={`w-4 h-4 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-600'}`} 
            />
          </Button>

          {/* أزرار سريعة عند التمرير */}
          <div className="absolute inset-x-3 bottom-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="flex gap-2">
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  onAddToCart();
                }}
                size="sm"
                className="flex-1 bg-black/80 text-white hover:bg-black rounded-full"
              >
                <ShoppingCart className="w-4 h-4 ml-1" />
                إضافة
              </Button>
              <Button
                onClick={onClick}
                size="sm"
                variant="outline"
                className="bg-white/80 backdrop-blur-sm rounded-full"
              >
                <Eye className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        <CardContent className="p-4">
          <div onClick={onClick}>
            <h3 className="font-medium text-sm text-foreground mb-2 line-clamp-2 leading-tight">
              {product.name}
            </h3>
            
            {/* التقييم */}
            <div className="flex items-center gap-2 mb-2">
              <div className="flex items-center">
                {[...Array(5)].map((_, i) => (
                  <Star 
                    key={i} 
                    className={`w-3 h-3 ${i < 4 ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} 
                  />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">(128)</span>
            </div>

            {/* السعر */}
            <div className="flex items-center gap-2">
              {discountPercentage > 0 ? (
                <>
                  <span className="text-lg font-bold text-red-500">
                    {finalPrice.toLocaleString()} د.ع
                  </span>
                  <span className="text-sm text-muted-foreground line-through">
                    {productPrice.toLocaleString()} د.ع
                  </span>
                </>
              ) : (
                <span className="text-lg font-bold text-foreground">
                  {productPrice.toLocaleString()} د.ع
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

// عنصر المنتج في القائمة
const ProductListItem = ({ product, isFavorite, onToggleFavorite, onClick, onAddToCart }) => {
  const productPrice = product.price || 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="product-list-item"
    >
      <div className="flex items-center gap-4 w-full">
        
        {/* صورة المنتج */}
        <div 
          onClick={onClick}
          className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer"
        >
          {product.main_image ? (
            <img
              src={product.main_image}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted">
              <DefaultProductImage className="w-8 h-8" />
            </div>
          )}
        </div>

        {/* معلومات المنتج */}
        <div className="flex-1 min-w-0">
          <h3 
            onClick={onClick}
            className="font-medium text-foreground mb-1 cursor-pointer hover:text-primary transition-colors"
          >
            {product.name}
          </h3>
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center">
              {[...Array(5)].map((_, i) => (
                <Star 
                  key={i} 
                  className={`w-3 h-3 ${i < 4 ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} 
                />
              ))}
            </div>
            <span className="text-xs text-muted-foreground">(64)</span>
          </div>
          <div className="text-lg font-bold text-foreground">
            {productPrice.toLocaleString()} د.ع
          </div>
        </div>

        {/* الأزرار */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            onClick={onToggleFavorite}
            size="icon"
            variant="ghost"
            className="w-10 h-10"
          >
            <Heart 
              className={`w-5 h-5 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-600'}`} 
            />
          </Button>
          <Button
            onClick={onAddToCart}
            size="sm"
            className="bg-primary text-primary-foreground"
          >
            <ShoppingCart className="w-4 h-4 ml-1" />
            إضافة
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

// سلة التسوق المتطورة
const PremiumCartSidebar = ({ isOpen, onClose, cart, onQuickOrder }) => {
  const totalAmount = cart.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="left" className="w-full sm:w-96 p-0">
        <div className="flex flex-col h-full">
          
          {/* رأس السلة */}
          <div className="p-6 border-b border-border/20">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">سلة التسوق</h2>
              <Button onClick={onClose} size="icon" variant="ghost">
                <X className="w-5 h-5" />
              </Button>
            </div>
            {totalItems > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                {totalItems} عنصر في السلة
              </p>
            )}
          </div>

          {/* محتوى السلة */}
          <div className="flex-1 overflow-auto p-6">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <ShoppingCart className="w-16 h-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">السلة فارغة</h3>
                <p className="text-muted-foreground mb-4">اضافة بعض المنتجات لبدء التسوق</p>
                <Button onClick={onClose}>
                  تابع التسوق
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {cart.map((item) => (
                  <CartItem key={`${item.id}-${item.selectedVariant?.id || 'default'}`} item={item} />
                ))}
              </div>
            )}
          </div>

          {/* تذييل السلة */}
          {cart.length > 0 && (
            <div className="p-6 border-t border-border/20 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">المجموع الفرعي:</span>
                <span className="font-medium">{totalAmount.toLocaleString()} د.ع</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">التوصيل:</span>
                <span className="font-medium text-green-600">مجاني</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold">المجموع الكلي:</span>
                <span className="text-lg font-bold text-primary">{totalAmount.toLocaleString()} د.ع</span>
              </div>
              
              <div className="space-y-3">
                <Button 
                  onClick={onQuickOrder}
                  className="w-full bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white font-bold py-3"
                >
                  <Package className="w-5 h-5 ml-2" />
                  إتمام الطلب
                </Button>
                <Button 
                  onClick={onClose}
                  variant="outline" 
                  className="w-full"
                >
                  متابعة التسوق
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

// عنصر في السلة
const CartItem = ({ item }) => {
  const itemTotal = (item.price || 0) * item.quantity;

  return (
    <div className="flex items-center gap-4 p-4 bg-card rounded-lg border border-border/20">
      
      {/* صورة المنتج */}
      <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
        {item.main_image ? (
          <img
            src={item.main_image}
            alt={item.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <DefaultProductImage className="w-8 h-8" />
          </div>
        )}
      </div>

      {/* معلومات المنتج */}
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-sm text-foreground mb-1 line-clamp-2">
          {item.name}
        </h4>
        <p className="text-xs text-muted-foreground mb-2">
          {(item.price || 0).toLocaleString()} د.ع × {item.quantity}
        </p>
        
        {/* أزرار الكمية */}
        <div className="flex items-center gap-2">
          <Button size="icon" variant="outline" className="w-8 h-8">
            <Minus className="w-3 h-3" />
          </Button>
          <span className="text-sm font-medium w-8 text-center">{item.quantity}</span>
          <Button size="icon" variant="outline" className="w-8 h-8">
            <Plus className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* السعر الإجمالي */}
      <div className="text-sm font-bold text-foreground">
        {itemTotal.toLocaleString()} د.ع
      </div>
    </div>
  );
};

// نافذة الطلب السريع
const QuickOrderModal = ({ isOpen, onClose, cart }) => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    city: '',
    address: '',
    notes: '',
    paymentMethod: 'cash'
  });

  const totalAmount = cart.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmitOrder = () => {
    if (!formData.name || !formData.phone || !formData.city || !formData.address) {
      alert('يرجى ملء جميع الحقول المطلوبة');
      return;
    }
    
    alert('تم إرسال طلبك بنجاح! سنتواصل معك قريباً');
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="left" className="w-full sm:w-96 p-0">
        <div className="flex flex-col h-full">
          
          <div className="p-6 border-b border-border/20">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">إتمام الطلب</h2>
              <Button onClick={onClose} size="icon" variant="ghost">
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-6 space-y-6">
            
            {/* معلومات العميل */}
            <div>
              <h3 className="text-lg font-semibold mb-4">معلومات العميل</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">
                    الاسم الكامل *
                  </label>
                  <Input
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="أدخل اسمك الكامل"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">
                    رقم الهاتف *
                  </label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    placeholder="07xxxxxxxx"
                    type="tel"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">
                    المحافظة *
                  </label>
                  <Input
                    value={formData.city}
                    onChange={(e) => handleInputChange('city', e.target.value)}
                    placeholder="اختر المحافظة"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">
                    العنوان التفصيلي *
                  </label>
                  <Input
                    value={formData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    placeholder="الحي، الشارع، رقم البيت"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">
                    ملاحظات إضافية
                  </label>
                  <Input
                    value={formData.notes}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                    placeholder="أي ملاحظات خاصة..."
                  />
                </div>
              </div>
            </div>

            {/* ملخص الطلب */}
            <div>
              <h3 className="text-lg font-semibold mb-4">ملخص الطلب</h3>
              <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span>عدد القطع:</span>
                  <span>{totalItems} قطعة</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>المجموع الفرعي:</span>
                  <span>{totalAmount.toLocaleString()} د.ع</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>رسوم التوصيل:</span>
                  <span className="text-green-600">مجاني</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold">
                  <span>المجموع الكلي:</span>
                  <span className="text-primary">{totalAmount.toLocaleString()} د.ع</span>
                </div>
              </div>
            </div>

            {/* طريقة الدفع */}
            <div>
              <h3 className="text-lg font-semibold mb-4">طريقة الدفع</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-3 border border-border/20 rounded-lg cursor-pointer hover:bg-accent/50">
                  <input 
                    type="radio" 
                    checked={formData.paymentMethod === 'cash'}
                    onChange={() => handleInputChange('paymentMethod', 'cash')}
                    className="text-primary"
                  />
                  <div className="flex-1">
                    <div className="font-medium">الدفع عند الاستلام</div>
                    <div className="text-sm text-muted-foreground">ادفع نقداً عند وصول الطلب</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 border-t border-border/20">
            <Button 
              onClick={handleSubmitOrder}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold py-3"
            >
              <Package className="w-5 h-5 ml-2" />
              تأكيد الطلب
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

// نافذة تفاصيل المنتج
const ProductDetailsModal = ({ 
  product, 
  isOpen, 
  onClose, 
  onAddToCart, 
  favorites, 
  onToggleFavorite 
}) => {
  if (!product) return null;

  const isFavorite = favorites.includes(product.id);
  const productPrice = product.price || 0;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[90vh]">
        <div className="flex flex-col h-full">
          
          <div className="flex items-center justify-between p-6 border-b border-border/20">
            <h2 className="text-xl font-bold">تفاصيل المنتج</h2>
            <Button onClick={onClose} size="icon" variant="ghost">
              <X className="w-5 h-5" />
            </Button>
          </div>

          <div className="flex-1 overflow-auto">
            <div className="grid lg:grid-cols-2 gap-8 p-6">
              
              {/* صور المنتج */}
              <div className="space-y-4">
                <div className="aspect-square rounded-xl overflow-hidden bg-muted">
                  {product.main_image ? (
                    <img
                      src={product.main_image}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <DefaultProductImage className="w-24 h-24" />
                    </div>
                  )}
                </div>
              </div>

              {/* معلومات المنتج */}
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-bold text-foreground mb-2">{product.name}</h1>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star 
                          key={i} 
                          className={`w-4 h-4 ${i < 4 ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} 
                        />
                      ))}
                    </div>
                    <span className="text-sm text-muted-foreground">(89 تقييم)</span>
                  </div>
                </div>

                <div className="text-3xl font-bold text-primary">
                  {productPrice.toLocaleString()} د.ع
                </div>

                <div>
                  <h3 className="font-semibold mb-2">الوصف</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {product.description || 'منتج عالي الجودة مصنوع من أفضل المواد المتوفرة. يتميز بالراحة والأناقة معاً، مناسب لجميع المناسبات.'}
                  </p>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold">المواصفات</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">المادة:</span>
                      <span>قطن 100%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">المنشأ:</span>
                      <span>تركيا</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">الضمان:</span>
                      <span>سنة واحدة</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">التوصيل:</span>
                      <span>2-5 أيام</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button
                    onClick={() => onAddToCart(product)}
                    className="flex-1 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white font-bold py-3"
                  >
                    <ShoppingCart className="w-5 h-5 ml-2" />
                    أضف إلى السلة
                  </Button>
                  <Button
                    onClick={() => onToggleFavorite(product.id)}
                    variant="outline"
                    size="icon"
                    className="w-12 h-12"
                  >
                    <Heart 
                      className={`w-5 h-5 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-600'}`} 
                    />
                  </Button>
                  <Button variant="outline" size="icon" className="w-12 h-12">
                    <Share2 className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

// حالة فارغة
const EmptyState = () => {
  return (
    <div className="text-center py-16">
      <div className="w-32 h-32 mx-auto mb-6 bg-muted rounded-full flex items-center justify-center">
        <Package className="w-16 h-16 text-muted-foreground" />
      </div>
      <h3 className="text-xl font-semibold text-foreground mb-2">لا توجد منتجات</h3>
      <p className="text-muted-foreground mb-6">جرب تغيير معايير البحث أو تصفح الفئات المختلفة</p>
      <Button>
        <Home className="w-5 h-5 ml-2" />
        العودة للرئيسية
      </Button>
    </div>
  );
};

// تذييل الصفحة المذهل
const AmazingFooter = () => {
  return (
    <footer className="bg-card border-t border-border/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          
          {/* معلومات الشركة */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-red-500 via-pink-500 to-purple-500 rounded-xl flex items-center justify-center">
                <Crown className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold bg-gradient-to-r from-red-500 via-pink-500 to-purple-500 bg-clip-text text-transparent">
                RYUS
              </h3>
            </div>
            <p className="text-muted-foreground mb-4 leading-relaxed">
              نجلب لك أحدث صيحات الموضة العالمية بجودة عالية وأسعار منافسة
            </p>
            <div className="flex gap-2">
              <Button size="icon" variant="outline" className="w-10 h-10">
                <Globe className="w-5 h-5" />
              </Button>
              <Button size="icon" variant="outline" className="w-10 h-10">
                <MessageCircle className="w-5 h-5" />
              </Button>
              <Button size="icon" variant="outline" className="w-10 h-10">
                <Phone className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* روابط سريعة */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">روابط سريعة</h4>
            <div className="space-y-2">
              {['عن RYUS', 'سياسة الإرجاع', 'الشحن والتوصيل', 'اتصل بنا'].map((link) => (
                <a key={link} href="#" className="block text-muted-foreground hover:text-primary transition-colors">
                  {link}
                </a>
              ))}
            </div>
          </div>

          {/* خدمة العملاء */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">خدمة العملاء</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="w-4 h-4" />
                <span>07XX XXX XXXX</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <MessageCircle className="w-4 h-4" />
                <span>واتساب 24/7</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>9:00 ص - 11:00 م</span>
              </div>
            </div>
          </div>

          {/* الضمانات */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">ضماناتنا</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Truck className="w-4 h-4" />
                <span>توصيل مجاني</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Shield className="w-4 h-4" />
                <span>ضمان الجودة</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Award className="w-4 h-4" />
                <span>إرجاع مجاني</span>
              </div>
            </div>
          </div>
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-muted-foreground text-sm">
            © 2024 RYUS Brand. جميع الحقوق محفوظة.
          </p>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-primary transition-colors">سياسة الخصوصية</a>
            <a href="#" className="hover:text-primary transition-colors">الشروط والأحكام</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

// زر الواتساب العائم
const WhatsAppButton = () => {
  const handleWhatsApp = () => {
    const phoneNumber = "964XXXXXXXXX"; // رقم الواتساب
    const message = "مرحبا، أريد الاستفسار عن منتجاتكم";
    const url = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  return (
    <motion.button
      onClick={handleWhatsApp}
      className="fixed bottom-6 left-6 w-14 h-14 bg-green-500 hover:bg-green-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center z-50"
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      animate={{ 
        y: [0, -5, 0],
      }}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut"
      }}
    >
      <MessageCircle className="w-7 h-7" />
    </motion.button>
  );
};

export default StorePage;