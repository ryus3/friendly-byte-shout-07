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
  Share2
} from 'lucide-react';

import { useSuper } from '@/contexts/SuperProvider';
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

const StorePage = () => {
  const { products, categories, colors, sizes } = useSuper();
  const { cart, addToCart } = useCart();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [viewMode, setViewMode] = useState('grid');
  const [sortBy, setSortBy] = useState('featured');
  const [priceRange, setPriceRange] = useState({ min: 0, max: 1000000 });

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

    // فلترة حسب السعر
    filtered = filtered.filter(product => {
      const price = product.price || 0;
      return price >= priceRange.min && price <= priceRange.max;
    });

    // ترتيب المنتجات
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
        // ترتيب حسب الشعبية (يمكن تحسينه لاحقاً)
        filtered.sort(() => Math.random() - 0.5);
        break;
      default:
        // featured - ترتيب افتراضي
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

      {/* رأس الصفحة الاحترافي */}
      <PremiumHeader 
        cartItemsCount={cart.length} 
        onCartClick={() => setIsCartOpen(true)}
        favorites={favorites}
      />

      {/* البانر الرئيسي المبهر */}
      <PremiumHero />

      {/* شريط الثقة والضمان */}
      <TrustBadges />

      {/* المحتوى الرئيسي */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* شريط البحث والفلاتر المتقدم */}
        <SearchAndFilters 
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          sortBy={sortBy}
          setSortBy={setSortBy}
          viewMode={viewMode}
          setViewMode={setViewMode}
          categories={categories}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          priceRange={priceRange}
          setPriceRange={setPriceRange}
        />

        {/* النتائج والترتيب */}
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
        <ProductsDisplay 
          products={filteredProducts}
          viewMode={viewMode}
          favorites={favorites}
          onToggleFavorite={(id) => setFavorites(prev => 
            prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
          )}
          onProductClick={setSelectedProduct}
          onAddToCart={addToCart}
        />

        {/* اقتراحات إضافية */}
        {filteredProducts.length === 0 && (
          <EmptyState />
        )}
      </div>

      {/* سلة التسوق المتقدمة */}
      <PremiumCartSidebar
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
      />

      {/* تذييل الصفحة */}
      <PremiumFooter />
    </div>
  );
};

// رأس الصفحة الاحترافي
const PremiumHeader = ({ cartItemsCount, onCartClick, favorites }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <>
      {/* شريط علوي للعروض */}
      <div className="bg-gradient-to-r from-primary via-purple-600 to-pink-600 text-white py-2 px-4 text-center text-sm">
        <motion.div
          animate={{ x: [-20, 0, -20] }}
          transition={{ duration: 3, repeat: Infinity }}
          className="flex items-center justify-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          توصيل مجاني لجميع الطلبات فوق 100,000 د.ع
          <Sparkles className="w-4 h-4" />
        </motion.div>
      </div>

      {/* الرأس الرئيسي */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-xl border-b border-border/20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            
            {/* الشعار المتطور */}
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-4"
            >
              <div className="relative">
                <div className="w-12 h-12 bg-gradient-to-br from-primary via-purple-600 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <Crown className="w-7 h-7 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center">
                  <Sparkles className="w-2 h-2 text-yellow-800" />
                </div>
              </div>
              <div className="hidden md:block">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-primary via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  RYUS
                </h1>
                <p className="text-xs text-muted-foreground font-medium tracking-wide uppercase">
                  Premium Fashion
                </p>
              </div>
            </motion.div>

            {/* القائمة الرئيسية */}
            <nav className="hidden lg:flex items-center space-x-8 space-x-reverse">
              {[
                { label: 'الرئيسية', href: '#' },
                { label: 'رجالي', href: '#' },
                { label: 'نسائي', href: '#' },
                { label: 'أطفال', href: '#' },
                { label: 'إكسسوارات', href: '#' },
                { label: 'العروض', href: '#', badge: 'جديد' }
              ].map((item, index) => (
                <motion.a
                  key={item.label}
                  href={item.href}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="relative text-foreground hover:text-primary transition-colors duration-300 font-medium group"
                >
                  {item.label}
                  {item.badge && (
                    <Badge className="absolute -top-2 -left-2 bg-red-500 text-white text-xs px-1 py-0 h-4">
                      {item.badge}
                    </Badge>
                  )}
                  <span className="absolute inset-x-0 -bottom-1 h-0.5 bg-gradient-to-r from-primary to-purple-600 scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
                </motion.a>
              ))}
            </nav>

            {/* أيقونات التفاعل */}
            <div className="flex items-center gap-3">
              
              {/* البحث */}
              <Button
                variant="ghost"
                size="icon"
                className="hidden md:flex w-11 h-11 rounded-full hover:bg-accent/50 transition-all duration-300"
              >
                <Search className="w-5 h-5" />
              </Button>

              {/* حساب المستخدم */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-11 h-11 rounded-full hover:bg-accent/50 transition-all duration-300"
                  >
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
              <Button
                variant="ghost"
                size="icon"
                className="w-11 h-11 rounded-full hover:bg-accent/50 transition-all duration-300 relative"
              >
                <Heart className="w-5 h-5" />
                {favorites.length > 0 && (
                  <Badge className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center p-0">
                    {favorites.length}
                  </Badge>
                )}
              </Button>

              {/* سلة التسوق */}
              <Button
                onClick={onCartClick}
                variant="ghost"
                size="icon"
                className="w-11 h-11 rounded-full hover:bg-accent/50 transition-all duration-300 relative"
              >
                <ShoppingCart className="w-5 h-5" />
                {cartItemsCount > 0 && (
                  <Badge className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center p-0 animate-pulse">
                    {cartItemsCount}
                  </Badge>
                )}
              </Button>

              {/* قائمة الهاتف */}
              <Button
                onClick={() => setIsMenuOpen(true)}
                variant="ghost"
                size="icon"
                className="lg:hidden w-11 h-11 rounded-full"
              >
                <Menu className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>
    </>
  );
};

// البانر الرئيسي المبهر
const PremiumHero = () => {
  return (
    <section className="relative h-[80vh] min-h-[600px] flex items-center overflow-hidden">
      
      {/* خلفية متدرجة احترافية */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-pink-900" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
      </div>

      {/* عناصر ديكورية متحركة */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-white/20 rounded-full"
            animate={{
              x: [0, 100, 0],
              y: [0, -100, 0],
              opacity: [0.2, 0.8, 0.2],
              scale: [0.5, 1.5, 0.5],
            }}
            transition={{
              duration: 8 + i * 2,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.3
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
          
          {/* المحتوى النصي */}
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center lg:text-right space-y-8"
          >
            
            {/* شارة العلامة التجارية */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex justify-center lg:justify-start"
            >
              <Badge className="bg-white/10 backdrop-blur-md text-white border-white/20 px-6 py-3 rounded-full text-base font-medium">
                <Crown className="w-5 h-5 ml-2" />
                RYUS Premium Collection 2024
              </Badge>
            </motion.div>

            {/* العنوان الرئيسي المذهل */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="space-y-6"
            >
              <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold leading-tight text-white">
                <span className="block bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent">
                  أزياء راقية
                </span>
                <span className="block text-white/90">
                  تليق بتميزك
                </span>
              </h1>
              
              <p className="text-xl md:text-2xl text-white/80 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                اكتشف مجموعة RYUS الحصرية من الأزياء العالمية والإكسسوارات الفاخرة، 
                مصممة خصيصاً لتعكس شخصيتك المميزة
              </p>
            </motion.div>

            {/* إحصائيات مبهرة */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="grid grid-cols-3 gap-8 max-w-md mx-auto lg:mx-0"
            >
              {[
                { number: '50K+', label: 'عميل راضي' },
                { number: '500+', label: 'منتج حصري' },
                { number: '99%', label: 'معدل الرضا' }
              ].map((stat, index) => (
                <div key={index} className="text-center">
                  <div className="text-3xl font-bold text-white">{stat.number}</div>
                  <div className="text-sm text-white/70">{stat.label}</div>
                </div>
              ))}
            </motion.div>

            {/* أزرار العمل المتطورة */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
            >
              <Button 
                size="lg"
                className="bg-white text-black hover:bg-white/90 px-8 py-4 rounded-full shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-1 font-semibold text-lg"
              >
                <ShoppingCart className="w-6 h-6 ml-3" />
                تسوق الآن
                <ArrowRight className="w-6 h-6 mr-3" />
              </Button>
              
              <Button 
                variant="outline"
                size="lg"
                className="border-2 border-white/30 text-white hover:bg-white/10 px-8 py-4 rounded-full backdrop-blur-md transition-all duration-300 font-semibold text-lg"
              >
                <Eye className="w-6 h-6 ml-3" />
                استكشف المجموعة
              </Button>
            </motion.div>
          </motion.div>

          {/* العرض البصري المذهل */}
          <motion.div 
            initial={{ opacity: 0, x: 50, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="relative hidden lg:block"
          >
            <div className="relative max-w-lg mx-auto">
              
              {/* العنصر المركزي */}
              <div className="aspect-square bg-gradient-to-br from-white/10 to-white/5 rounded-full p-8 backdrop-blur-md border border-white/20">
                <div className="w-full h-full bg-gradient-to-br from-white/20 to-transparent rounded-full flex items-center justify-center relative overflow-hidden">
                  
                  {/* أيقونة مركزية */}
                  <motion.div
                    animate={{ 
                      rotate: [0, 10, -10, 0],
                      scale: [1, 1.1, 1]
                    }}
                    transition={{ 
                      duration: 8,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                    className="text-9xl opacity-20"
                  >
                    👗
                  </motion.div>
                  
                  {/* عناصر طافية متحركة */}
                  {[
                    { icon: Crown, position: '-top-8 -right-8', color: 'from-yellow-400 to-orange-500', delay: 0 },
                    { icon: Heart, position: '-bottom-8 -left-8', color: 'from-pink-400 to-red-500', delay: 1 },
                    { icon: Star, position: 'top-1/4 -left-12', color: 'from-blue-400 to-purple-500', delay: 2 },
                    { icon: Sparkles, position: 'bottom-1/4 -right-12', color: 'from-green-400 to-teal-500', delay: 3 }
                  ].map((item, index) => (
                    <motion.div
                      key={index}
                      className={`absolute ${item.position}`}
                      animate={{ 
                        y: [-20, 20, -20],
                        rotate: [0, 360, 0],
                        scale: [0.8, 1.2, 0.8]
                      }}
                      transition={{ 
                        duration: 6 + index,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: item.delay
                      }}
                    >
                      <div className={`w-16 h-16 bg-gradient-to-br ${item.color} rounded-2xl flex items-center justify-center shadow-xl backdrop-blur-md`}>
                        <item.icon className="w-8 h-8 text-white" />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* موجة في الأسفل */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg 
          viewBox="0 0 1200 120" 
          preserveAspectRatio="none" 
          className="w-full h-20 fill-current text-background"
        >
          <path d="M0,0V120H1200V0C1200,0,1075,120,600,120S0,0,0,0Z"/>
        </svg>
      </div>
    </section>
  );
};

// شريط الثقة والضمان
const TrustBadges = () => {
  const badges = [
    { icon: Truck, title: 'توصيل مجاني', desc: 'للطلبات فوق 100 ألف د.ع' },
    { icon: Shield, title: 'ضمان الجودة', desc: '30 يوم ضمان الإرجاع' },
    { icon: Award, title: 'جودة مضمونة', desc: 'منتجات أصلية 100%' },
    { icon: MessageCircle, title: 'دعم 24/7', desc: 'خدمة عملاء متميزة' }
  ];

  return (
    <section className="py-12 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {badges.map((badge, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="text-center space-y-3"
            >
              <div className="w-16 h-16 bg-gradient-to-br from-primary/20 to-purple-500/20 rounded-2xl flex items-center justify-center mx-auto">
                <badge.icon className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{badge.title}</h3>
                <p className="text-sm text-muted-foreground">{badge.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

// بحث وفلاتر متقدمة
const SearchAndFilters = ({ 
  searchQuery, setSearchQuery, sortBy, setSortBy, viewMode, setViewMode,
  categories, selectedCategory, setSelectedCategory, priceRange, setPriceRange 
}) => {
  return (
    <div className="space-y-6 mb-8">
      
      {/* شريط البحث الرئيسي */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
          <Input
            placeholder="ابحث عن منتجك المفضل..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-12 h-14 text-lg border-2 border-muted-foreground/20 focus:border-primary rounded-2xl bg-background/50 backdrop-blur-sm"
          />
        </div>
        
        <div className="flex gap-3">
          {/* ترتيب */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-14 px-6 rounded-2xl border-2 hover:border-primary/60">
                <SlidersHorizontal className="w-5 h-5 ml-2" />
                ترتيب
                <ChevronDown className="w-4 h-4 mr-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => setSortBy('featured')}>
                الأكثر شهرة
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('newest')}>
                الأحدث
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('price-low')}>
                السعر: من الأقل للأعلى
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('price-high')}>
                السعر: من الأعلى للأقل
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('popular')}>
                الأكثر مبيعاً
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* طريقة العرض */}
          <div className="flex rounded-2xl border-2 border-muted-foreground/20 overflow-hidden">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('grid')}
              className="h-14 w-14 rounded-none"
            >
              <Grid3X3 className="w-5 h-5" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('list')}
              className="h-14 w-14 rounded-none"
            >
              <List className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* فلاتر التصنيفات */}
      {categories && categories.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <Button
            variant={!selectedCategory ? "default" : "outline"}
            onClick={() => setSelectedCategory(null)}
            className="rounded-full px-6 py-2 border-2"
          >
            جميع التصنيفات
          </Button>
          {categories.map((category) => (
            <Button
              key={category.id}
              variant={selectedCategory?.id === category.id ? "default" : "outline"}
              onClick={() => setSelectedCategory(category)}
              className="rounded-full px-6 py-2 border-2"
            >
              {category.name}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
};

// عرض المنتجات المتطور
const ProductsDisplay = ({ products, viewMode, favorites, onToggleFavorite, onProductClick, onAddToCart }) => {
  if (viewMode === 'list') {
    return (
      <div className="space-y-4">
        {products.map((product, index) => (
          <ProductListItem
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
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
      <AnimatePresence>
        {products.map((product, index) => (
          <PremiumProductCard
            key={product.id}
            product={product}
            index={index}
            isFavorite={favorites.includes(product.id)}
            onToggleFavorite={onToggleFavorite}
            onProductClick={onProductClick}
            onAddToCart={onAddToCart}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

// كارت منتج احترافي
const PremiumProductCard = ({ product, index, isFavorite, onToggleFavorite, onProductClick, onAddToCart }) => {
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
      transition={{ duration: 0.4, delay: index * 0.1 }}
      whileHover={{ y: -12 }}
      className="group relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Card className="overflow-hidden border-0 bg-white shadow-lg hover:shadow-2xl transition-all duration-500 rounded-3xl">
        <div className="relative aspect-[3/4] overflow-hidden">
          
          {/* صورة المنتج */}
          <motion.div 
            className="w-full h-full cursor-pointer relative"
            onClick={() => onProductClick && onProductClick(product)}
            whileHover={{ scale: 1.1 }}
            transition={{ duration: 0.4 }}
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
            
            {/* تدرج للتحسين البصري */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </motion.div>

          {/* أيقونات التفاعل */}
          <div className="absolute top-4 left-4 flex flex-col gap-3">
            <motion.button
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: isHovered ? 1 : 0, scale: isHovered ? 1 : 0 }}
              transition={{ duration: 0.3 }}
              onClick={() => onToggleFavorite(product.id)}
              className={`w-12 h-12 rounded-2xl backdrop-blur-md border border-white/30 transition-all duration-300 flex items-center justify-center ${
                isFavorite 
                  ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' 
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              <Heart className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
            </motion.button>

            <motion.button
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: isHovered ? 1 : 0, scale: isHovered ? 1 : 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 text-white hover:bg-white/30 transition-all duration-300 flex items-center justify-center"
            >
              <Eye className="w-5 h-5" />
            </motion.button>

            <motion.button
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: isHovered ? 1 : 0, scale: isHovered ? 1 : 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 text-white hover:bg-white/30 transition-all duration-300 flex items-center justify-center"
            >
              <Share2 className="w-5 h-5" />
            </motion.button>
          </div>

          {/* شارات المنتج */}
          <div className="absolute top-4 right-4 flex flex-col gap-2">
            {hasDiscount && (
              <Badge className="bg-gradient-to-r from-red-500 to-pink-500 text-white font-bold px-3 py-1 rounded-xl shadow-lg">
                خصم {discountPercentage}%
              </Badge>
            )}
            {totalStock < 10 && totalStock > 0 && (
              <Badge className="bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold px-3 py-1 rounded-xl shadow-lg">
                قطع محدودة
              </Badge>
            )}
            {totalStock === 0 && (
              <Badge className="bg-gray-500 text-white font-bold px-3 py-1 rounded-xl shadow-lg">
                نفد المخزون
              </Badge>
            )}
          </div>

          {/* زر الإضافة السريعة */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: isHovered ? 1 : 0, y: isHovered ? 0 : 20 }}
            transition={{ duration: 0.4 }}
            className="absolute bottom-4 left-4 right-4"
          >
            <Button
              onClick={() => {
                if (product.variants?.[0]) {
                  onAddToCart(product, product.variants[0], 1);
                }
              }}
              disabled={totalStock === 0}
              className="w-full bg-gradient-to-r from-primary via-purple-600 to-pink-600 hover:from-primary/90 hover:via-purple-600/90 hover:to-pink-600/90 text-white font-semibold py-3 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300"
            >
              <ShoppingCart className="w-5 h-5 ml-2" />
              أضف للسلة
            </Button>
          </motion.div>
        </div>

        <CardContent className="p-6 space-y-4">
          {/* اسم المنتج */}
          <h3 
            className="font-bold text-xl line-clamp-2 cursor-pointer hover:text-primary transition-colors duration-300"
            onClick={() => onProductClick && onProductClick(product)}
          >
            {product.name}
          </h3>

          {/* الأسعار */}
          <div className="flex items-center gap-3">
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <span className="text-sm font-medium">4.8</span>
              <span className="text-sm text-muted-foreground">(124)</span>
            </div>
            <span className="text-sm text-muted-foreground font-medium">
              متوفر: {totalStock}
            </span>
          </div>

          {/* الألوان المتاحة */}
          {product.variants && (
            <div className="flex items-center gap-2">
              {[...new Set(product.variants.map(v => v.color))].slice(0, 4).map((color, idx) => (
                <div
                  key={idx}
                  className="w-8 h-8 rounded-full border-2 border-border shadow-sm"
                  style={{ backgroundColor: '#' + Math.floor(Math.random()*16777215).toString(16) }}
                  title={color}
                />
              ))}
              {[...new Set(product.variants.map(v => v.color))].length > 4 && (
                <span className="text-xs text-muted-foreground font-medium">+{[...new Set(product.variants.map(v => v.color))].length - 4}</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

// عنصر قائمة المنتج
const ProductListItem = ({ product, index, isFavorite, onToggleFavorite, onProductClick, onAddToCart }) => {
  const totalStock = product.variants?.reduce((sum, variant) => sum + (variant.quantity || 0), 0) || 0;
  const productPrice = product.price || 0;
  const discountPercentage = product.discount_percentage || 0;
  const hasDiscount = discountPercentage > 0;
  const finalPrice = hasDiscount 
    ? productPrice - (productPrice * discountPercentage / 100)
    : productPrice;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="flex gap-6 p-6 bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-border/20"
    >
      {/* صورة المنتج */}
      <div className="w-32 h-32 flex-shrink-0 rounded-xl overflow-hidden cursor-pointer" onClick={() => onProductClick && onProductClick(product)}>
        {product.images?.[0] ? (
          <img
            src={product.images[0]}
            alt={product.name}
            className="w-full h-full object-cover hover:scale-110 transition-transform duration-300"
          />
        ) : (
          <DefaultProductImage className="w-full h-full" alt={product.name} />
        )}
      </div>

      {/* تفاصيل المنتج */}
      <div className="flex-1 space-y-3">
        <div className="flex items-start justify-between">
          <h3 
            className="text-xl font-bold cursor-pointer hover:text-primary transition-colors"
            onClick={() => onProductClick && onProductClick(product)}
          >
            {product.name}
          </h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onToggleFavorite(product.id)}
            className={isFavorite ? 'text-red-500' : 'text-muted-foreground'}
          >
            <Heart className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            ))}
            <span className="text-sm text-muted-foreground">(124 تقييم)</span>
          </div>
          <span className="text-sm text-muted-foreground">متوفر: {totalStock}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold text-primary">
              {(finalPrice || 0).toLocaleString()} د.ع
            </span>
            {hasDiscount && productPrice > 0 && (
              <span className="text-lg text-muted-foreground line-through">
                {productPrice.toLocaleString()} د.ع
              </span>
            )}
          </div>

          <Button
            onClick={() => {
              if (product.variants?.[0]) {
                onAddToCart(product, product.variants[0], 1);
              }
            }}
            disabled={totalStock === 0}
            className="bg-gradient-to-r from-primary to-purple-600 text-white px-6 rounded-xl"
          >
            <ShoppingCart className="w-4 h-4 ml-2" />
            أضف للسلة
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

// حالة فارغة
const EmptyState = () => (
  <div className="text-center py-20">
    <div className="w-32 h-32 bg-muted/20 rounded-full flex items-center justify-center mx-auto mb-6">
      <Package className="w-16 h-16 text-muted-foreground" />
    </div>
    <h3 className="text-2xl font-bold mb-4">لا توجد منتجات</h3>
    <p className="text-muted-foreground mb-8 max-w-md mx-auto">
      لم نتمكن من العثور على منتجات تطابق معايير البحث الخاصة بك. جرب تعديل الفلاتر أو البحث بكلمات مختلفة.
    </p>
    <Button variant="outline" className="rounded-full px-8">
      مسح الفلاتر
    </Button>
  </div>
);

// سلة التسوق المتقدمة
const PremiumCartSidebar = ({ isOpen, onClose, cart }) => {
  const totalAmount = cart.reduce((sum, item) => sum + (item.total || 0), 0);
  const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 0), 0);

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="left" className="w-96 bg-white/95 backdrop-blur-xl border-r border-border/20">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-purple-600 rounded-xl flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">سلة التسوق</h2>
              <p className="text-sm text-muted-foreground">{totalItems} منتج</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {cart.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-center py-20">
            <div>
              <div className="w-24 h-24 bg-muted/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <ShoppingCart className="w-12 h-12 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">السلة فارغة</h3>
              <p className="text-muted-foreground mb-6">ابدأ بإضافة منتجاتك المفضلة</p>
              <Button onClick={onClose} className="rounded-full px-6">
                متابعة التسوق
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto space-y-4 mb-6">
              {cart.map((item) => (
                <div key={item.id} className="flex gap-4 p-4 bg-muted/10 rounded-2xl border border-border/20">
                  <div className="w-20 h-20 bg-muted/20 rounded-xl overflow-hidden flex-shrink-0">
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

                  <div className="flex-1 space-y-2">
                    <h4 className="font-semibold text-sm line-clamp-2">{item.productName}</h4>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{item.color}</span>
                      <span>•</span>
                      <span>{item.size}</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 border rounded-lg overflow-hidden">
                        <Button variant="ghost" size="icon" className="w-8 h-8">
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="w-10 text-center text-sm font-medium">{item.quantity}</span>
                        <Button variant="ghost" size="icon" className="w-8 h-8">
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-sm font-bold text-primary">
                          {(item.total || 0).toLocaleString()} د.ع
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-border/20 pt-6 space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>المجموع الفرعي:</span>
                  <span>{(totalAmount || 0).toLocaleString()} د.ع</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>التوصيل:</span>
                  <span className="text-green-600 font-medium">مجاني</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>المجموع الكلي:</span>
                  <span className="text-primary">{(totalAmount || 0).toLocaleString()} د.ع</span>
                </div>
              </div>

              <div className="space-y-3">
                <Button className="w-full bg-gradient-to-r from-primary via-purple-600 to-pink-600 text-white py-3 rounded-2xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300">
                  إتمام الطلب
                </Button>
                <Button variant="outline" onClick={onClose} className="w-full rounded-2xl py-3">
                  متابعة التسوق
                </Button>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

// تذييل الصفحة الاحترافي
const PremiumFooter = () => {
  return (
    <footer className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          
          {/* معلومات العلامة التجارية */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-primary via-purple-600 to-pink-600 rounded-2xl flex items-center justify-center">
                <Crown className="w-7 h-7 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold">RYUS</h3>
                <p className="text-sm text-white/70">Premium Fashion</p>
              </div>
            </div>
            <p className="text-white/80 leading-relaxed">
              RYUS هي علامتك التجارية المفضلة للأزياء الراقية والإكسسوارات العصرية. نقدم لك أفضل المنتجات بجودة استثنائية وأسعار مناسبة.
            </p>
            <div className="flex gap-4">
              {['facebook', 'instagram', 'twitter', 'youtube'].map((social, index) => (
                <div key={social} className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center hover:bg-white/20 transition-colors cursor-pointer">
                  <Globe className="w-5 h-5" />
                </div>
              ))}
            </div>
          </div>

          {/* روابط سريعة */}
          <div className="space-y-6">
            <h4 className="text-lg font-semibold">روابط سريعة</h4>
            <ul className="space-y-3">
              {['الرئيسية', 'المنتجات', 'العروض', 'من نحن', 'اتصل بنا'].map((link) => (
                <li key={link}>
                  <a href="#" className="text-white/70 hover:text-white transition-colors">
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* خدمة العملاء */}
          <div className="space-y-6">
            <h4 className="text-lg font-semibold">خدمة العملاء</h4>
            <ul className="space-y-3">
              {['طلباتي', 'إرجاع المنتجات', 'سياسة الخصوصية', 'الشروط والأحكام', 'الأسئلة الشائعة'].map((link) => (
                <li key={link}>
                  <a href="#" className="text-white/70 hover:text-white transition-colors">
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* معلومات التواصل */}
          <div className="space-y-6">
            <h4 className="text-lg font-semibold">تواصل معنا</h4>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                  <MessageCircle className="w-4 h-4" />
                </div>
                <span className="text-white/70">+964 770 123 4567</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                  <Globe className="w-4 h-4" />
                </div>
                <span className="text-white/70">info@ryusbrand.com</span>
              </div>
            </div>
          </div>
        </div>

        <Separator className="my-8 bg-white/20" />

        <div className="flex flex-col md:flex-row items-center justify-between text-sm text-white/60">
          <p>© 2024 RYUS Brand. جميع الحقوق محفوظة.</p>
          <p>تم التطوير بواسطة فريق RYUS التقني</p>
        </div>
      </div>
    </footer>
  );
};

export default StorePage;