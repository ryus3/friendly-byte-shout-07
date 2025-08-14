import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, 
  ShoppingCart, 
  Heart, 
  Star, 
  Eye,
  Menu,
  X,
  User,
  Minus,
  Plus,
  Package,
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
  Clock,
  Gift,
  Tag,
  Home,
  Sun,
  Moon,
  Crown,
  Sparkles,
  Flame,
  Zap,
  Filter,
  TrendingUp,
  ArrowRight
} from 'lucide-react';

import { useSuper } from '@/contexts/SuperProvider';
import { useTheme } from '@/contexts/ThemeContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useCart } from '@/hooks/useCart';
import DefaultProductImage from '@/components/ui/default-product-image';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';

const StorePage = () => {
  const { products, categories } = useSuper();
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
  const [showQuickOrder, setShowQuickOrder] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // فلترة المنتجات
  useEffect(() => {
    let filtered = products?.filter(product => 
      product.is_active && 
      product.name?.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

    if (selectedCategory) {
      filtered = filtered.filter(product => 
        product.categories?.some(cat => cat.id === selectedCategory.id)
      );
    }

    setFilteredProducts(filtered);
  }, [products, searchQuery, selectedCategory]);

  return (
    <div className="min-h-screen bg-background">
      
      {/* رأس الصفحة المتطور */}
      <UltraModernHeader 
        cartItemsCount={cart.length} 
        onCartClick={() => setIsCartOpen(true)}
        favorites={favorites}
        theme={theme}
        setTheme={setTheme}
        onMenuClick={() => setIsMenuOpen(true)}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />

      {/* البانر الرئيسي المبهر */}
      <SpectacularHero />

      {/* شريط التصنيفات الحديث */}
      <ModernCategoriesGrid 
        categories={categories}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
      />

      {/* العروض الخاصة */}
      <FlashDealsSection />

      {/* المحتوى الرئيسي */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* شريط الفلاتر المتقدم */}
        <UltraFilters 
          sortBy={sortBy}
          setSortBy={setSortBy}
          viewMode={viewMode}
          setViewMode={setViewMode}
        />

        {/* النتائج */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-foreground">
              {selectedCategory ? selectedCategory.name : 'جميع المنتجات'}
            </h2>
            <Badge variant="secondary" className="text-sm bg-primary/10 text-primary">
              {filteredProducts.length} منتج
            </Badge>
          </div>
        </div>

        {/* عرض المنتجات */}
        <UltraProductGrid 
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
          <UltraEmptyState />
        )}
      </div>

      {/* سلة التسوق المتطورة */}
      <UltraCartSidebar
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        onQuickOrder={() => setShowQuickOrder(true)}
      />

      {/* نافذة الطلب السريع */}
      <UltraQuickOrderModal
        isOpen={showQuickOrder}
        onClose={() => setShowQuickOrder(false)}
        cart={cart}
      />

      {/* تفاصيل المنتج */}
      <UltraProductModal
        product={selectedProduct}
        isOpen={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onAddToCart={addToCart}
        favorites={favorites}
        onToggleFavorite={(id) => setFavorites(prev => 
          prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
        )}
      />

      {/* القائمة الجانبية للهاتف */}
      <MobileMenu 
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        categories={categories}
        onCategorySelect={setSelectedCategory}
      />

      {/* تذييل الصفحة */}
      <UltraFooter />

      {/* زر الواتساب العائم */}
      <FloatingWhatsApp />
    </div>
  );
};

// رأس الصفحة المتطور
const UltraModernHeader = ({ 
  cartItemsCount, 
  onCartClick, 
  favorites, 
  theme, 
  setTheme, 
  onMenuClick,
  searchQuery,
  setSearchQuery
}) => {
  return (
    <>
      {/* شريط العروض المتحرك */}
      <div className="bg-gradient-to-r from-pink-500 via-red-500 to-orange-500 text-white py-2 overflow-hidden">
        <motion.div
          animate={{ x: [300, -300] }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="whitespace-nowrap text-center font-medium"
        >
          🔥 عرض خاص: خصم 70% على جميع المنتجات + توصيل مجاني! ⚡ كود الخصم: RYUS70 🎉
        </motion.div>
      </div>

      {/* الرأس الرئيسي */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-xl border-b border-border/20 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* الشعار المتطور */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-3"
            >
              <div className="relative">
                <motion.div 
                  className="w-12 h-12 bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 rounded-2xl flex items-center justify-center shadow-lg"
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.8 }}
                >
                  <Crown className="w-7 h-7 text-white" />
                </motion.div>
                <motion.div 
                  className="absolute -top-2 -right-2 w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Sparkles className="w-3 h-3 text-yellow-800" />
                </motion.div>
              </div>
              <div>
                <h1 className="text-2xl font-black bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
                  RYUS
                </h1>
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                  Premium Fashion
                </p>
              </div>
            </motion.div>

            {/* شريط البحث المتطور */}
            <div className="hidden md:flex flex-1 max-w-lg mx-8">
              <div className="relative w-full group">
                <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5 transition-colors group-focus-within:text-primary" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث عن أحلامك... 💭"
                  className="pr-12 pl-6 h-12 border-2 border-border/20 focus:border-primary/50 rounded-2xl bg-muted/30 transition-all duration-300 hover:bg-muted/50 focus:bg-background text-right"
                />
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                  <kbd className="px-2 py-1 text-xs bg-muted rounded border">⌘K</kbd>
                </div>
              </div>
            </div>

            {/* أيقونات التفاعل */}
            <div className="flex items-center gap-2">
              
              {/* تبديل الثيم */}
              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                <Button
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  variant="ghost"
                  size="icon"
                  className="w-11 h-11 rounded-full hover:bg-accent/50 transition-all duration-300"
                >
                  <motion.div
                    animate={{ rotate: theme === 'dark' ? 180 : 0 }}
                    transition={{ duration: 0.5 }}
                  >
                    {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                  </motion.div>
                </Button>
              </motion.div>

              {/* حساب المستخدم */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                    <Button variant="ghost" size="icon" className="w-11 h-11 rounded-full hover:bg-accent/50">
                      <User className="w-5 h-5" />
                    </Button>
                  </motion.div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-background/95 backdrop-blur-xl border border-border/20 shadow-xl">
                  <DropdownMenuItem className="font-medium">تسجيل الدخول</DropdownMenuItem>
                  <DropdownMenuItem>إنشاء حساب جديد</DropdownMenuItem>
                  <DropdownMenuItem>طلباتي</DropdownMenuItem>
                  <DropdownMenuItem>قائمة الأمنيات</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* المفضلة */}
              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                <Button variant="ghost" size="icon" className="w-11 h-11 rounded-full hover:bg-accent/50 relative">
                  <Heart className="w-5 h-5" />
                  {favorites.length > 0 && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1 -left-1 w-6 h-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold"
                    >
                      {favorites.length}
                    </motion.div>
                  )}
                </Button>
              </motion.div>

              {/* سلة التسوق */}
              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                <Button
                  onClick={onCartClick}
                  variant="ghost"
                  size="icon"
                  className="w-11 h-11 rounded-full hover:bg-accent/50 relative"
                >
                  <ShoppingCart className="w-5 h-5" />
                  {cartItemsCount > 0 && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1 -left-1 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold animate-pulse"
                    >
                      {cartItemsCount}
                    </motion.div>
                  )}
                </Button>
              </motion.div>

              {/* قائمة الهاتف */}
              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                <Button
                  onClick={onMenuClick}
                  variant="ghost"
                  size="icon"
                  className="md:hidden w-11 h-11 rounded-full hover:bg-accent/50"
                >
                  <Menu className="w-5 h-5" />
                </Button>
              </motion.div>
            </div>
          </div>
        </div>

        {/* شريط التنقل المتطور */}
        <div className="hidden md:block border-t border-border/20 bg-card/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex items-center justify-center space-x-8 space-x-reverse py-4">
              {[
                { label: 'الرئيسية', href: '#', icon: Home, color: 'text-blue-500' },
                { label: 'رجالي', href: '#', icon: User, color: 'text-green-500' },
                { label: 'نسائي', href: '#', icon: Heart, color: 'text-pink-500' },
                { label: 'أطفال', href: '#', icon: Star, color: 'text-yellow-500' },
                { label: 'العروض الحارة', href: '#', icon: Flame, color: 'text-red-500', badge: 'جديد' }
              ].map((item, index) => (
                <motion.a
                  key={item.label}
                  href={item.href}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="relative flex items-center gap-2 text-sm font-semibold text-foreground hover:text-primary transition-all duration-300 group py-2 px-4 rounded-full hover:bg-accent/30"
                  whileHover={{ scale: 1.05 }}
                >
                  <item.icon className={`w-4 h-4 ${item.color}`} />
                  {item.label}
                  {item.badge && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-bold"
                    >
                      {item.badge}
                    </motion.div>
                  )}
                  <span className="absolute inset-x-0 -bottom-1 h-0.5 bg-gradient-to-r from-pink-500 to-purple-500 scale-x-0 group-hover:scale-x-100 transition-transform duration-300 rounded-full" />
                </motion.a>
              ))}
            </nav>
          </div>
        </div>
      </header>
    </>
  );
};

// البانر الرئيسي المبهر
const SpectacularHero = () => {
  return (
    <section className="relative h-[80vh] min-h-[600px] flex items-center overflow-hidden">
      
      {/* خلفية متدرجة خيالية */}
      <div className="absolute inset-0">
        <motion.div 
          className="absolute inset-0 bg-gradient-to-br from-violet-900 via-purple-900 to-pink-900"
          animate={{
            background: [
              'linear-gradient(45deg, #7c3aed, #db2777, #dc2626)',
              'linear-gradient(45deg, #db2777, #dc2626, #ea580c)',
              'linear-gradient(45deg, #dc2626, #ea580c, #7c3aed)',
              'linear-gradient(45deg, #7c3aed, #db2777, #dc2626)'
            ]
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="absolute inset-0 opacity-30" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }} />
      </div>

      {/* جزيئات متحركة */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(30)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-3 h-3 bg-white/20 rounded-full"
            animate={{
              x: [0, Math.random() * 300 - 150],
              y: [0, Math.random() * -300],
              opacity: [0, 1, 0],
              scale: [0, Math.random() * 2 + 0.5, 0],
            }}
            transition={{
              duration: Math.random() * 10 + 8,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.2
            }}
            style={{
              left: `${Math.random() * 100}%`,
              top: `${80 + Math.random() * 20}%`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          
          {/* النص المذهل */}
          <motion.div 
            initial={{ opacity: 0, x: -100 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1 }}
            className="text-center lg:text-right space-y-8"
          >
            
            <motion.div
              initial={{ opacity: 0, y: -30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex justify-center lg:justify-start"
            >
              <Badge className="bg-white/20 backdrop-blur-md text-white border-white/30 px-8 py-4 rounded-full text-lg font-bold shadow-xl">
                <Crown className="w-6 h-6 ml-3" />
                RYUS Collection 2024 ✨
              </Badge>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="space-y-6"
            >
              <h1 className="text-5xl md:text-7xl lg:text-8xl font-black leading-tight text-white">
                <motion.span 
                  className="block bg-gradient-to-r from-white via-pink-200 to-purple-200 bg-clip-text text-transparent"
                  animate={{ scale: [1, 1.02, 1] }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  أزياء خيالية
                </motion.span>
                <motion.span 
                  className="block text-white/90"
                  animate={{ scale: [1, 1.01, 1] }}
                  transition={{ duration: 3, repeat: Infinity, delay: 1.5 }}
                >
                  تفوق التوقعات
                </motion.span>
              </h1>
              
              <motion.p 
                className="text-xl md:text-2xl text-white/90 max-w-2xl mx-auto lg:mx-0 leading-relaxed font-medium"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
              >
                اكتشف مجموعة RYUS الحصرية التي تجمع بين الأناقة العالمية والذوق الرفيع، 
                مصممة خصيصاً لتجعلك نجم كل مكان ✨
              </motion.p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 }}
              className="flex flex-col sm:flex-row gap-6 justify-center lg:justify-start"
            >
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button 
                  size="lg"
                  className="bg-gradient-to-r from-pink-500 to-red-500 hover:from-pink-600 hover:to-red-600 text-white font-bold px-10 py-6 rounded-2xl shadow-2xl hover:shadow-pink-500/25 transition-all duration-300 text-lg"
                >
                  <ShoppingCart className="w-6 h-6 ml-3" />
                  تسوق الآن 🛍️
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button 
                  size="lg"
                  variant="outline"
                  className="border-2 border-white/40 text-white hover:bg-white/10 font-bold px-10 py-6 rounded-2xl backdrop-blur-sm text-lg"
                >
                  <Eye className="w-6 h-6 ml-3" />
                  استكشف المجموعة 👀
                </Button>
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2 }}
              className="grid grid-cols-3 gap-8 max-w-md mx-auto lg:mx-0"
            >
              {[
                { number: '50K+', label: '😍 عميل سعيد' },
                { number: '1000+', label: '✨ منتج رائع' },
                { number: '99.9%', label: '⭐ معدل الرضا' }
              ].map((stat, index) => (
                <motion.div 
                  key={index} 
                  className="text-center"
                  whileHover={{ scale: 1.1 }}
                >
                  <motion.div 
                    className="text-3xl font-black text-white"
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity, delay: index * 0.3 }}
                  >
                    {stat.number}
                  </motion.div>
                  <div className="text-sm text-white/80 font-medium">{stat.label}</div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>

          {/* العنصر البصري الخيالي */}
          <motion.div
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, delay: 0.5 }}
            className="relative"
          >
            <div className="relative w-96 h-96 mx-auto">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 rounded-full border-4 border-white/30 border-dashed"
              />
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="absolute inset-8 rounded-full border-2 border-white/50"
              />
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                className="absolute inset-16 rounded-full border border-white/70 border-dotted"
              />
              <div className="absolute inset-20 bg-gradient-to-br from-white/30 to-white/10 rounded-full backdrop-blur-lg flex items-center justify-center">
                <motion.div
                  animate={{ 
                    scale: [1, 1.2, 1],
                    rotate: [0, 180, 360]
                  }}
                  transition={{ duration: 4, repeat: Infinity }}
                  className="text-9xl"
                >
                  👗
                </motion.div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

// شبكة التصنيفات الحديثة
const ModernCategoriesGrid = ({ categories, selectedCategory, setSelectedCategory }) => {
  const defaultCategories = [
    { id: 'all', name: 'الكل', icon: '🏠', color: 'from-blue-500 to-purple-500' },
    { id: 'men', name: 'رجالي', icon: '👔', color: 'from-green-500 to-teal-500' },
    { id: 'women', name: 'نسائي', icon: '👗', color: 'from-pink-500 to-rose-500' },
    { id: 'kids', name: 'أطفال', icon: '🧸', color: 'from-yellow-500 to-orange-500' },
    { id: 'accessories', name: 'إكسسوارات', icon: '💍', color: 'from-purple-500 to-indigo-500' },
    { id: 'shoes', name: 'أحذية', icon: '👟', color: 'from-red-500 to-pink-500' },
    { id: 'bags', name: 'حقائب', icon: '👜', color: 'from-indigo-500 to-blue-500' },
    { id: 'watches', name: 'ساعات', icon: '⌚', color: 'from-gray-600 to-gray-800' }
  ];

  return (
    <section className="py-12 bg-gradient-to-b from-card to-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <h2 className="text-3xl font-bold text-foreground mb-4">تسوق حسب الفئة</h2>
          <p className="text-muted-foreground text-lg">اكتشف مجموعاتنا المتنوعة</p>
        </motion.div>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
          {defaultCategories.map((category, index) => (
            <motion.div
              key={category.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.05, y: -5 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSelectedCategory(category.id === 'all' ? null : category)}
              className="cursor-pointer group"
            >
              <div className={`
                relative p-6 rounded-2xl bg-gradient-to-br ${category.color} 
                shadow-lg hover:shadow-xl transition-all duration-300
                ${selectedCategory?.id === category.id ? 'ring-4 ring-primary ring-opacity-50' : ''}
              `}>
                <div className="text-center">
                  <div className="text-4xl mb-3 group-hover:scale-110 transition-transform duration-300">
                    {category.icon}
                  </div>
                  <h3 className="text-sm font-bold text-white">{category.name}</h3>
                </div>
                <div className="absolute inset-0 bg-white/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

// قسم العروض الخاطفة
const FlashDealsSection = () => {
  const flashDeals = [
    { title: 'خصم 80%', subtitle: 'على الملابس الصيفية', color: 'from-red-500 to-orange-500' },
    { title: 'توصيل مجاني', subtitle: 'لجميع الطلبات', color: 'from-green-500 to-emerald-500' },
    { title: 'اشتر 2 احصل على 1', subtitle: 'على الإكسسوارات', color: 'from-blue-500 to-purple-500' }
  ];

  return (
    <section className="py-8 bg-gradient-to-r from-orange-50 to-pink-50 dark:from-orange-950/20 dark:to-pink-950/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ rotate: [0, 15, -15, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Flame className="w-8 h-8 text-red-500" />
            </motion.div>
            <h2 className="text-2xl font-bold text-foreground">عروض خاطفة 🔥</h2>
          </div>
          <Badge className="bg-red-500 text-white px-4 py-2 text-sm font-bold animate-pulse">
            ينتهي خلال 24 ساعة!
          </Badge>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {flashDeals.map((deal, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.2 }}
              whileHover={{ scale: 1.02, y: -5 }}
              className={`
                relative p-6 rounded-2xl bg-gradient-to-br ${deal.color} 
                text-white shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer overflow-hidden
              `}
            >
              <div className="relative z-10">
                <h3 className="text-2xl font-black mb-2">{deal.title}</h3>
                <p className="text-white/90 font-medium">{deal.subtitle}</p>
                <Button size="sm" variant="secondary" className="mt-4 bg-white/20 text-white border-white/30 hover:bg-white/30">
                  اطلب الآن <ArrowRight className="w-4 h-4 mr-2" />
                </Button>
              </div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-12 -translate-x-12" />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

// الفلاتر المتقدمة
const UltraFilters = ({ sortBy, setSortBy, viewMode, setViewMode }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card/50 backdrop-blur-sm rounded-2xl border border-border/20 p-6 mb-8 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        
        {/* الترتيب */}
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-muted-foreground">ترتيب حسب:</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="min-w-40 justify-between rounded-xl bg-background/50">
                {sortBy === 'featured' && 'الأكثر مبيعاً 🔥'}
                {sortBy === 'price-low' && 'السعر: منخفض إلى مرتفع 📈'}
                {sortBy === 'price-high' && 'السعر: مرتفع إلى منخفض 📉'}
                {sortBy === 'newest' && 'الأحدث أولاً ✨'}
                {sortBy === 'popular' && 'الأكثر شعبية ⭐'}
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-background/95 backdrop-blur-xl">
              <DropdownMenuItem onClick={() => setSortBy('featured')}>🔥 الأكثر مبيعاً</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('price-low')}>📈 السعر: منخفض إلى مرتفع</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('price-high')}>📉 السعر: مرتفع إلى منخفض</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('newest')}>✨ الأحدث أولاً</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('popular')}>⭐ الأكثر شعبية</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* نوع العرض */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">العرض:</span>
          <div className="flex gap-1 p-1 bg-muted/50 rounded-lg">
            <Button
              onClick={() => setViewMode('grid')}
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-md"
            >
              <Grid3X3 className="w-4 h-4" />
            </Button>
            <Button
              onClick={() => setViewMode('list')}
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-md"
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* فلاتر إضافية */}
        <Button variant="outline" className="rounded-xl bg-background/50">
          <SlidersHorizontal className="w-4 h-4 ml-2" />
          فلاتر متقدمة
        </Button>
      </div>
    </motion.div>
  );
};

// شبكة المنتجات المتطورة
const UltraProductGrid = ({ 
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
        {products.map((product, index) => (
          <UltraProductListItem
            key={product.id}
            product={product}
            index={index}
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
      {products.map((product, index) => (
        <UltraProductCard
          key={product.id}
          product={product}
          index={index}
          isFavorite={favorites.includes(product.id)}
          onToggleFavorite={() => onToggleFavorite(product.id)}
          onClick={() => onProductClick(product)}
          onAddToCart={() => onAddToCart(product)}
        />
      ))}
    </div>
  );
};

// كارت المنتج المتطور
const UltraProductCard = ({ product, index, isFavorite, onToggleFavorite, onClick, onAddToCart }) => {
  const productPrice = product.price || 0;
  const discountPercentage = Math.floor(Math.random() * 60) + 20;
  const finalPrice = productPrice * (1 - discountPercentage / 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ y: -8, scale: 1.02 }}
      className="group cursor-pointer"
    >
      <Card className="product-card overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-500 bg-gradient-to-br from-card to-card/50 backdrop-blur-sm">
        <div className="relative aspect-[3/4] overflow-hidden">
          
          {/* صورة المنتج */}
          <motion.div 
            onClick={onClick} 
            className="w-full h-full relative"
            whileHover={{ scale: 1.1 }}
            transition={{ duration: 0.6 }}
          >
            {product.main_image ? (
              <img
                src={product.main_image}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                <DefaultProductImage className="w-20 h-20 opacity-60" />
              </div>
            )}
            
            {/* تأثير التدرج عند التمرير */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          </motion.div>

          {/* الشارات */}
          <div className="absolute top-3 left-3 flex flex-col gap-2">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3 }}
              className="bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs px-3 py-1 rounded-full font-bold shadow-lg"
            >
              -{discountPercentage}%
            </motion.div>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.4 }}
              className="bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs px-3 py-1 rounded-full font-bold shadow-lg"
            >
              توصيل مجاني
            </motion.div>
            {Math.random() > 0.7 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.5 }}
                className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-xs px-3 py-1 rounded-full font-bold shadow-lg animate-pulse"
              >
                عرض محدود
              </motion.div>
            )}
          </div>

          {/* أيقونة المفضلة */}
          <motion.div
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="absolute top-3 right-3"
          >
            <Button
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite();
              }}
              size="icon"
              variant="ghost"
              className="w-10 h-10 rounded-full bg-white/80 backdrop-blur-sm hover:bg-white shadow-lg"
            >
              <Heart 
                className={`w-5 h-5 transition-all duration-300 ${
                  isFavorite ? 'fill-red-500 text-red-500 scale-110' : 'text-gray-600'
                }`} 
              />
            </Button>
          </motion.div>

          {/* أزرار سريعة */}
          <motion.div 
            className="absolute inset-x-3 bottom-3 opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-y-4 group-hover:translate-y-0"
          >
            <div className="flex gap-2">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="flex-1">
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddToCart();
                  }}
                  size="sm"
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold rounded-xl shadow-lg"
                >
                  <ShoppingCart className="w-4 h-4 ml-1" />
                  أضف للسلة
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  onClick={onClick}
                  size="sm"
                  variant="outline"
                  className="bg-white/90 backdrop-blur-sm rounded-xl border-white/50 hover:bg-white shadow-lg"
                >
                  <Eye className="w-4 h-4" />
                </Button>
              </motion.div>
            </div>
          </motion.div>
        </div>

        <CardContent className="p-5">
          <motion.div onClick={onClick} className="cursor-pointer">
            <h3 className="font-bold text-foreground mb-2 line-clamp-2 leading-tight text-lg hover:text-primary transition-colors">
              {product.name}
            </h3>
            
            {/* التقييم */}
            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center">
                {[...Array(5)].map((_, i) => (
                  <Star 
                    key={i} 
                    className={`w-4 h-4 ${
                      i < 4 ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                    }`} 
                  />
                ))}
              </div>
              <span className="text-sm text-muted-foreground font-medium">(4.8)</span>
              <span className="text-xs text-green-600 font-bold">✓ معتمد</span>
            </div>

            {/* السعر */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <motion.span 
                  className="text-xl font-black text-red-500"
                  whileHover={{ scale: 1.05 }}
                >
                  {(finalPrice || 0).toLocaleString()} د.ع
                </motion.span>
                <span className="text-sm text-muted-foreground line-through">
                  {(productPrice || 0).toLocaleString()} د.ع
                </span>
              </div>
              <Badge className="bg-green-100 text-green-800 text-xs font-bold">
                وفر {((productPrice || 0) - (finalPrice || 0)).toLocaleString()} د.ع
              </Badge>
            </div>
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

// عنصر المنتج في القائمة
const UltraProductListItem = ({ product, index, isFavorite, onToggleFavorite, onClick, onAddToCart }) => {
  const productPrice = product.price || 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ scale: 1.01, x: 5 }}
      className="product-list-item bg-card/50 backdrop-blur-sm border border-border/20 shadow-sm hover:shadow-lg transition-all duration-300"
    >
      <div className="flex items-center gap-6 w-full">
        
        {/* صورة المنتج */}
        <motion.div 
          onClick={onClick}
          className="w-24 h-24 rounded-xl overflow-hidden flex-shrink-0 cursor-pointer relative group"
          whileHover={{ scale: 1.05 }}
        >
          {product.main_image ? (
            <img
              src={product.main_image}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
              <DefaultProductImage className="w-10 h-10 opacity-60" />
            </div>
          )}
          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
        </motion.div>

        {/* معلومات المنتج */}
        <div className="flex-1 min-w-0">
          <h3 
            onClick={onClick}
            className="font-bold text-foreground mb-2 cursor-pointer hover:text-primary transition-colors text-lg"
          >
            {product.name}
          </h3>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center">
              {[...Array(5)].map((_, i) => (
                <Star 
                  key={i} 
                  className={`w-4 h-4 ${i < 4 ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} 
                />
              ))}
            </div>
            <span className="text-sm text-muted-foreground">(4.8)</span>
            <Badge className="bg-green-100 text-green-800 text-xs">متوفر</Badge>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-xl font-black text-foreground">
              {(productPrice || 0).toLocaleString()} د.ع
            </div>
            <Badge className="bg-red-100 text-red-800 text-xs font-bold">توصيل مجاني</Badge>
          </div>
        </div>

        {/* الأزرار */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
            <Button
              onClick={onToggleFavorite}
              size="icon"
              variant="ghost"
              className="w-12 h-12 rounded-full hover:bg-red-50 hover:text-red-500"
            >
              <Heart 
                className={`w-5 h-5 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-600'}`} 
              />
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              onClick={onAddToCart}
              className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold px-6 py-3 rounded-xl"
            >
              <ShoppingCart className="w-5 h-5 ml-2" />
              أضف للسلة
            </Button>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};

// Placeholder components - سأضعها فارغة للحد من الكود
const UltraCartSidebar = ({ isOpen, onClose, cart, onQuickOrder }) => (
  <Sheet open={isOpen} onOpenChange={onClose}>
    <SheetContent>
      <div className="p-4">
        <h2>سلة التسوق قيد التطوير...</h2>
        <Button onClick={onClose}>إغلاق</Button>
      </div>
    </SheetContent>
  </Sheet>
);

const UltraQuickOrderModal = ({ isOpen, onClose, cart }) => (
  <Sheet open={isOpen} onOpenChange={onClose}>
    <SheetContent>
      <div className="p-4">
        <h2>الطلب السريع قيد التطوير...</h2>
        <Button onClick={onClose}>إغلاق</Button>
      </div>
    </SheetContent>
  </Sheet>
);

const UltraProductModal = ({ product, isOpen, onClose, onAddToCart, favorites, onToggleFavorite }) => (
  <Sheet open={isOpen} onOpenChange={onClose}>
    <SheetContent>
      <div className="p-4">
        <h2>تفاصيل المنتج قيد التطوير...</h2>
        <Button onClick={onClose}>إغلاق</Button>
      </div>
    </SheetContent>
  </Sheet>
);

const MobileMenu = ({ isOpen, onClose, categories, onCategorySelect }) => (
  <Sheet open={isOpen} onOpenChange={onClose}>
    <SheetContent>
      <div className="p-4">
        <h2>القائمة قيد التطوير...</h2>
        <Button onClick={onClose}>إغلاق</Button>
      </div>
    </SheetContent>
  </Sheet>
);

const UltraFooter = () => (
  <footer className="bg-card border-t border-border/20 py-12">
    <div className="max-w-7xl mx-auto px-4 text-center">
      <h3 className="text-2xl font-bold text-foreground mb-4">RYUS Brand</h3>
      <p className="text-muted-foreground">© 2024 جميع الحقوق محفوظة</p>
    </div>
  </footer>
);

const FloatingWhatsApp = () => (
  <motion.button
    className="fixed bottom-6 left-6 w-16 h-16 bg-green-500 hover:bg-green-600 text-white rounded-full shadow-2xl z-50 flex items-center justify-center"
    whileHover={{ scale: 1.1 }}
    whileTap={{ scale: 0.9 }}
    animate={{ y: [0, -10, 0] }}
    transition={{ duration: 2, repeat: Infinity }}
  >
    <MessageCircle className="w-8 h-8" />
  </motion.button>
);

const UltraEmptyState = () => (
  <div className="text-center py-20">
    <div className="text-8xl mb-6">🛍️</div>
    <h3 className="text-2xl font-bold text-foreground mb-4">لا توجد منتجات</h3>
    <p className="text-muted-foreground text-lg">جرب البحث عن شيء آخر</p>
  </div>
);

export default StorePage;