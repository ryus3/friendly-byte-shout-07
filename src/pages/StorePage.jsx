import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Search,
  Heart,
  ShoppingCart,
  Menu,
  Star,
  Filter,
  SlidersHorizontal,
  TrendingUp,
  Flame,
  Gift,
  Zap,
  Sparkles,
  Plus,
  Minus,
  X,
  MessageCircle,
  User,
  MapPin,
  Phone,
  Camera,
  Mail,
  Bell,
  ChevronRight,
  Home,
  Grid3X3,
  ChevronDown,
  ShoppingBag,
  Percent,
  Truck,
  Clock,
  Tag,
  Globe,
  Eye,
  Share,
  Crown,
  Gem,
  Shirt,
  Watch,
  Smartphone,
  Palette,
  Sun,
  Moon
} from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { useCart } from '@/hooks/useCart';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useSuper } from '@/contexts/SuperProvider';
import { useTheme } from '@/contexts/ThemeContext';
import DefaultProductImage from '@/components/ui/default-product-image';

const StorePage = () => {
  const { products, categories } = useSuper();
  const { cart = [], addToCart } = useCart();
  const { theme, setTheme } = useTheme();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showQuickOrder, setShowQuickOrder] = useState(false);

  // بيانات التصنيفات العربية الاحترافية
  const arabicCategories = [
    { id: 1, name: 'أزياء نسائية', icon: Crown, color: 'from-pink-500 to-rose-500', bgColor: 'bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20' },
    { id: 2, name: 'أزياء رجالية', icon: Shirt, color: 'from-blue-500 to-indigo-500', bgColor: 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20' },
    { id: 3, name: 'أزياء الأطفال', icon: Heart, color: 'from-yellow-500 to-orange-500', bgColor: 'bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20' },
    { id: 4, name: 'الأحذية', icon: Gem, color: 'from-purple-500 to-violet-500', bgColor: 'bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20' },
    { id: 5, name: 'الإكسسوارات', icon: Sparkles, color: 'from-emerald-500 to-teal-500', bgColor: 'bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20' },
    { id: 6, name: 'الحقائب', icon: ShoppingBag, color: 'from-red-500 to-pink-500', bgColor: 'bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20' },
    { id: 7, name: 'الساعات', icon: Watch, color: 'from-amber-500 to-yellow-500', bgColor: 'bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20' },
    { id: 8, name: 'الإلكترونيات', icon: Smartphone, color: 'from-gray-500 to-slate-500', bgColor: 'bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-900/20 dark:to-slate-900/20' },
    { id: 9, name: 'الجمال والعناية', icon: Palette, color: 'from-rose-500 to-pink-500', bgColor: 'bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-900/20 dark:to-pink-900/20' }
  ];

  const trendingCollections = [
    { id: 1, name: 'الأسلوب الراقي', icon: Crown, description: 'مجموعة أنيقة ومميزة' },
    { id: 2, name: 'العصرية الخالدة', icon: Gem, description: 'قطع كلاسيكية لا تنتهي صلاحيتها' },
    { id: 3, name: 'المتاجر المفضلة', icon: Star, description: 'أفضل التصميمات المنتقاة' },
    { id: 4, name: 'المناسبات الخاصة', icon: Heart, description: 'إطلالات مناسبات استثنائية' },
    { id: 5, name: 'موضة الشارع', icon: TrendingUp, description: 'آخر صيحات الموضة العالمية' }
  ];

  const sampleProducts = [
    {
      id: 1,
      name: 'فستان سهرة أنيق بتطريز راقي',
      price: 125000,
      originalPrice: 195000,
      discount: 36,
      rating: 4.9,
      reviews: 847,
      image: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400&h=400&fit=crop&crop=center',
      category: 'أزياء نسائية',
      trending: true,
      isNew: false
    },
    {
      id: 2,
      name: 'قميص رجالي قطني فاخر',
      price: 85000,
      originalPrice: 125000,
      discount: 32,
      rating: 4.7,
      reviews: 523,
      image: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=400&h=400&fit=crop&crop=center',
      category: 'أزياء رجالية',
      newIn: true,
      isNew: true
    },
    {
      id: 3,
      name: 'حذاء رياضي عصري متطور',
      price: 145000,
      originalPrice: 210000,
      discount: 31,
      rating: 4.8,
      reviews: 1203,
      image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=400&fit=crop&crop=center',
      category: 'الأحذية',
      flashSale: true,
      isNew: false
    },
    {
      id: 4,
      name: 'حقيبة يد جلدية أنيقة',
      price: 165000,
      originalPrice: 245000,
      discount: 33,
      rating: 4.6,
      reviews: 674,
      image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=400&fit=crop&crop=center',
      category: 'الحقائب',
      trending: true,
      isNew: false
    },
    {
      id: 5,
      name: 'ساعة ذكية متطورة',
      price: 285000,
      originalPrice: 385000,
      discount: 26,
      rating: 4.9,
      reviews: 1456,
      image: 'https://images.unsplash.com/photo-1434493789847-2f02dc6ca35d?w=400&h=400&fit=crop&crop=center',
      category: 'الإلكترونيات',
      newIn: true,
      isNew: true
    },
    {
      id: 6,
      name: 'نظارة شمسية كلاسيكية',
      price: 95000,
      originalPrice: 145000,
      discount: 34,
      rating: 4.5,
      reviews: 389,
      image: 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=400&h=400&fit=crop&crop=center',
      category: 'الإكسسوارات',
      flashSale: true,
      isNew: false
    }
  ];

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
    <div className="min-h-screen bg-background font-arabic">
      <Helmet>
        <title>RYUS | متجر الأزياء العصرية - أحدث صيحات الموضة</title>
        <meta name="description" content="اكتشف أحدث صيحات الموضة والأزياء العصرية في متجر RYUS. تسوق الآن واحصل على خصومات مذهلة تصل إلى 80% على جميع المنتجات" />
        <meta name="keywords" content="أزياء، موضة، ملابس، متجر، تسوق، خصومات، RYUS" />
      </Helmet>

      {/* الهيدر العربي الاحترافي */}
      <ArabicHeader 
        cartItemsCount={(cart || []).length} 
        onCartClick={() => setIsCartOpen(true)}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onMenuClick={() => setIsMenuOpen(true)}
        theme={theme}
        setTheme={setTheme}
      />

      {/* شريط التنقل الرئيسي */}
      <MainNavigation />

      {/* بانر التخفيضات الفلاش */}
      <FlashSaleBanner />

      {/* مجموعات الترندات */}
      <TrendingSection collections={trendingCollections} />

      {/* شبكة التصنيفات العربية */}
      <ArabicCategoriesGrid categories={arabicCategories} />

      {/* قسم العروض الخاصة */}
      <SpecialDealsSection products={sampleProducts} />

      {/* توصيات المنتجات */}
      <ProductRecommendations products={sampleProducts} />

      {/* سلة التسوق الاحترافية */}
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

      {/* القائمة الجانبية للهاتف */}
      <MobileMenu 
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        categories={arabicCategories}
      />

      {/* زر الواتساب */}
      <WhatsAppButton />

      {/* التنقل السفلي للهاتف */}
      <MobileBottomNav />
    </div>
  );
};

// الهيدر العربي الاحترافي
const ArabicHeader = ({ cartItemsCount, onCartClick, searchQuery, setSearchQuery, onMenuClick, theme, setTheme }) => {
  return (
    <>
      {/* البانر العلوي */}
      <div className="bg-gradient-to-r from-primary via-primary/90 to-primary/80 text-primary-foreground py-3 text-center">
        <motion.div
          animate={{ opacity: [1, 0.7, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="text-sm font-medium font-arabic"
        >
          🎉 عرض خاص: خصم 25% على طلبك الأول + شحن مجاني للطلبات فوق 100 ألف دينار
        </motion.div>
      </div>

      {/* الهيدر الرئيسي */}
      <header className="bg-card border-b border-border/20 sticky top-0 z-50 backdrop-blur-lg">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            
            {/* الأيقونات اليسرى */}
            <div className="flex items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="p-2 rounded-full hover:bg-accent/50 transition-colors"
              >
                <Heart className="w-5 h-5 text-muted-foreground hover:text-primary" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="p-2 rounded-full hover:bg-accent/50 transition-colors"
              >
                <Camera className="w-5 h-5 text-muted-foreground hover:text-primary" />
              </motion.button>
            </div>

            {/* البحث الوسطي */}
            <div className="flex-1 max-w-lg mx-6">
              <div className="relative">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث عن منتجاتك المفضلة..."
                  className="w-full bg-muted/50 border-0 rounded-2xl py-3 px-5 pr-12 text-center font-arabic placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary/20"
                />
                <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              </div>
            </div>

            {/* الأيقونات اليمنى */}
            <div className="flex items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-2 rounded-full hover:bg-accent/50 transition-colors"
              >
                {theme === 'dark' ? (
                  <Sun className="w-5 h-5 text-muted-foreground hover:text-primary" />
                ) : (
                  <Moon className="w-5 h-5 text-muted-foreground hover:text-primary" />
                )}
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="p-2 rounded-full hover:bg-accent/50 transition-colors"
              >
                <Bell className="w-5 h-5 text-muted-foreground hover:text-primary" />
              </motion.button>
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="relative"
              >
                <button
                  onClick={onCartClick}
                  className="p-2 rounded-full hover:bg-accent/50 transition-colors"
                >
                  <ShoppingCart className="w-5 h-5 text-muted-foreground hover:text-primary" />
                  {cartItemsCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
                      {cartItemsCount}
                    </span>
                  )}
                </button>
              </motion.div>
            </div>
          </div>

          {/* اسم العلامة التجارية */}
          <div className="text-center mt-4">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl font-bold font-brand bg-gradient-to-r from-primary via-primary/80 to-primary bg-clip-text text-transparent tracking-wider"
            >
              RYUS
            </motion.h1>
            <p className="text-xs text-muted-foreground mt-1 font-arabic">متجر الأزياء العصرية</p>
          </div>
        </div>
      </header>
    </>
  );
};

// التنقل الرئيسي
const MainNavigation = () => {
  const navItems = [
    { name: 'الرئيسية', active: true },
    { name: 'نسائي', active: false },
    { name: 'رجالي', active: false },
    { name: 'أطفال', active: false },
    { name: 'اكسسوارات', active: false },
    { name: 'العروض', active: false }
  ];
  
  return (
    <nav className="bg-card border-b border-border/10 overflow-x-auto">
      <div className="flex justify-center space-x-reverse space-x-8 py-4 px-4">
        {navItems.map((item, index) => (
          <motion.button
            key={item.name}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`text-sm font-medium whitespace-nowrap px-4 py-2 rounded-lg transition-all duration-300 ${
              item.active 
                ? 'bg-primary text-primary-foreground shadow-lg' 
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
            }`}
          >
            {item.name}
          </motion.button>
        ))}
      </div>
    </nav>
  );
};

// بانر التخفيضات الفلاش
const FlashSaleBanner = () => {
  return (
    <div className="bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 text-white py-12 px-4 relative overflow-hidden">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center relative z-10"
      >
        <motion.div
          animate={{ rotate: [0, 3, -3, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="text-5xl font-bold mb-4 font-brand"
        >
          خصم يصل إلى <span className="text-7xl">80%</span>
        </motion.div>
        <div className="text-2xl font-bold mb-6 font-arabic">
          تصفية نهاية الموسم <span className="bg-yellow-400 text-red-600 px-4 py-2 rounded-xl">تخفيضات هائلة</span>
        </div>
        <Button className="bg-white text-red-600 hover:bg-gray-100 font-bold px-8 py-3 rounded-2xl text-lg font-arabic shadow-lg">
          تسوق الآن ← 
        </Button>
      </motion.div>
      
      {/* عناصر زخرفية */}
      <div className="absolute top-4 right-8 text-4xl animate-bounce">🔥</div>
      <div className="absolute bottom-4 left-8 text-4xl animate-pulse">⚡</div>
      <div className="absolute top-1/2 right-1/4 text-3xl animate-spin" style={{ animationDuration: '3s' }}>✨</div>
    </div>
  );
};

// قسم الترندات
const TrendingSection = ({ collections }) => {
  return (
    <div className="bg-card py-6">
      <div className="px-4">
        <h2 className="text-xl font-bold text-center mb-6 font-arabic">المجموعات الرائجة</h2>
        <div className="flex justify-center space-x-reverse space-x-6 overflow-x-auto pb-4">
          {collections.map((collection) => (
            <motion.div
              key={collection.id}
              whileHover={{ scale: 1.05, y: -5 }}
              whileTap={{ scale: 0.95 }}
              className="flex-shrink-0 w-28 text-center cursor-pointer"
            >
              <div className="w-20 h-20 bg-gradient-to-br from-primary/20 to-primary/10 rounded-2xl mx-auto mb-3 flex items-center justify-center border border-primary/20 shadow-lg">
                <collection.icon className="w-8 h-8 text-primary" />
              </div>
              <div className="text-xs font-medium text-foreground font-arabic mb-1">
                {collection.name}
              </div>
              <div className="text-xs text-muted-foreground font-arabic">
                {collection.description}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

// شبكة التصنيفات العربية
const ArabicCategoriesGrid = ({ categories }) => {
  return (
    <div className="bg-muted/30 p-6">
      <h2 className="text-2xl font-bold text-center mb-8 font-arabic">تسوق حسب الفئة</h2>
      <div className="grid grid-cols-3 gap-6">
        {categories.map((category) => (
          <motion.div
            key={category.id}
            whileHover={{ scale: 1.05, y: -5 }}
            whileTap={{ scale: 0.95 }}
            className="text-center cursor-pointer group"
          >
            <div className={`w-24 h-24 ${category.bgColor} rounded-3xl mx-auto mb-4 flex items-center justify-center shadow-lg border border-border/20 group-hover:shadow-xl transition-all duration-300`}>
              <category.icon className={`w-10 h-10 bg-gradient-to-r ${category.color} bg-clip-text text-transparent`} />
            </div>
            <div className="text-sm font-medium text-foreground font-arabic group-hover:text-primary transition-colors">
              {category.name}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

// قسم العروض الخاصة
const SpecialDealsSection = ({ products }) => {
  return (
    <div className="bg-card p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="text-3xl">⚡</div>
          <span className="text-xl font-bold text-foreground font-arabic">عروض خاصة</span>
          <Badge className="bg-red-500 text-white text-sm font-arabic">خصم 40% 🔥</Badge>
        </div>
        <ChevronRight className="w-5 h-5 text-muted-foreground" />
      </div>

      <div className="flex space-x-reverse space-x-4 overflow-x-auto pb-4">
        {products.slice(0, 4).map((product) => (
          <ProductCard key={product.id} product={product} compact />
        ))}
      </div>
    </div>
  );
};

// توصيات المنتجات
const ProductRecommendations = ({ products }) => {
  const [activeTab, setActiveTab] = useState('العروض');
  const tabs = ['العروض', 'الجديد', 'لك'];

  return (
    <div className="bg-muted/20 p-6">
      {/* التبويبات */}
      <div className="flex justify-center mb-8">
        {tabs.map((tab) => (
          <motion.button
            key={tab}
            onClick={() => setActiveTab(tab)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`px-8 py-3 mx-2 rounded-2xl text-sm font-medium transition-all duration-300 font-arabic ${
              activeTab === tab
                ? 'bg-primary text-primary-foreground shadow-lg'
                : 'bg-card text-muted-foreground hover:text-foreground hover:bg-accent/50'
            }`}
          >
            {tab}
          </motion.button>
        ))}
      </div>

      {/* شبكة المنتجات */}
      <div className="grid grid-cols-2 gap-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
};

// كارت المنتج
const ProductCard = ({ product, compact = false }) => {
  const [isFavorite, setIsFavorite] = useState(false);

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -5 }}
      whileTap={{ scale: 0.98 }}
      className={`bg-card rounded-2xl overflow-hidden shadow-lg border border-border/20 hover:shadow-xl transition-all duration-300 ${compact ? 'w-40' : ''}`}
    >
      <div className="relative">
        <img 
          src={product.image} 
          alt={product.name}
          className={`${compact ? 'h-40' : 'h-56'} w-full object-cover`}
        />
        
        {/* الشارات */}
        <div className="absolute top-3 left-3 flex flex-col gap-2">
          {product.flashSale && (
            <Badge className="bg-red-500 text-white text-xs px-2 py-1 font-arabic">فلاش سيل</Badge>
          )}
          {product.newIn && (
            <Badge className="bg-green-500 text-white text-xs px-2 py-1 font-arabic">جديد</Badge>
          )}
          {product.trending && (
            <Badge className="bg-purple-500 text-white text-xs px-2 py-1 font-arabic">رائج</Badge>
          )}
        </div>

        {/* زر المفضلة */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsFavorite(!isFavorite)}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-card/90 backdrop-blur-sm flex items-center justify-center shadow-md border border-border/20"
        >
          <Heart className={`w-4 h-4 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`} />
        </motion.button>

        {/* شارة الخصم */}
        {product.discount > 0 && (
          <div className="absolute bottom-3 left-3 bg-red-500 text-white text-xs px-2 py-1 rounded-lg font-arabic">
            -{product.discount}%
          </div>
        )}
      </div>

      <div className={`p-4 ${compact ? 'p-3' : ''}`}>
        <div className={`text-foreground font-medium ${compact ? 'text-sm' : 'text-base'} line-clamp-2 mb-2 font-arabic`}>
          {product.name}
        </div>
        
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-primary font-bold ${compact ? 'text-sm' : 'text-lg'} font-arabic`}>
            {(product?.price || 0).toLocaleString()} د.ع
          </span>
          {(product?.originalPrice || 0) > (product?.price || 0) && (
            <span className={`text-muted-foreground line-through ${compact ? 'text-xs' : 'text-sm'} font-arabic`}>
              {(product?.originalPrice || 0).toLocaleString()}
            </span>
          )}
        </div>

        {!compact && (
          <div className="flex items-center gap-2">
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`w-3 h-3 ${i < Math.floor(product.rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                />
              ))}
            </div>
            <span className="text-xs text-muted-foreground font-arabic">({(product?.reviews || 0).toLocaleString()}+)</span>
          </div>
        )}
      </div>
    </motion.div>
  );
};

// سلة التسوق الاحترافية
const PremiumCartSidebar = ({ isOpen, onClose, cart, onQuickOrder }) => {
  const total = (cart || []).reduce((sum, item) => sum + ((item?.price || 0) * (item?.quantity || 1)), 0);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-50"
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            className="fixed right-0 top-0 h-full w-96 bg-card z-50 shadow-2xl"
          >
            <div className="p-6 border-b border-border/20">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold font-arabic">سلة التسوق</h2>
                <Button variant="ghost" size="sm" onClick={onClose}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {(cart || []).length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingBag className="w-20 h-20 text-muted-foreground/50 mx-auto mb-4" />
                  <p className="text-muted-foreground font-arabic">سلة التسوق فارغة</p>
                  <p className="text-sm text-muted-foreground font-arabic mt-2">اكتشف منتجاتنا الرائعة وأضفها هنا</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(cart || []).map((item) => (
                    <motion.div 
                      key={item.id} 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex gap-4 p-4 bg-muted/30 rounded-2xl border border-border/20"
                    >
                      <div className="w-20 h-20 bg-muted rounded-xl flex items-center justify-center overflow-hidden">
                        <DefaultProductImage />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-medium font-arabic mb-1">{item?.name || 'منتج'}</h3>
                        <p className="text-sm text-primary font-bold font-arabic">{(item?.price || 0).toLocaleString()} د.ع</p>
                        <div className="flex items-center gap-3 mt-3">
                          <Button variant="outline" size="sm" className="w-8 h-8 rounded-full p-0">
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="text-sm font-medium">{item?.quantity || 1}</span>
                          <Button variant="outline" size="sm" className="w-8 h-8 rounded-full p-0">
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {(cart || []).length > 0 && (
              <div className="p-6 border-t border-border/20 bg-muted/20">
                <div className="flex justify-between mb-6">
                  <span className="font-medium font-arabic">المجموع:</span>
                  <span className="font-bold text-lg text-primary font-arabic">{(total || 0).toLocaleString()} د.ع</span>
                </div>
                <Button onClick={onQuickOrder} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 py-3 rounded-2xl font-arabic">
                  إتمام الطلب
                </Button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// نافذة الطلب السريع
const QuickOrderModal = ({ isOpen, onClose, cart }) => {
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    phone: '',
    city: '',
    address: '',
    notes: ''
  });

  const total = (cart || []).reduce((sum, item) => sum + ((item?.price || 0) * (item?.quantity || 1)), 0);
  const deliveryFee = 5000;
  const grandTotal = total + deliveryFee;

  const handleSubmit = () => {
    if (!customerInfo.name || !customerInfo.phone || !customerInfo.city) {
      toast({
        title: "خطأ",
        description: "يرجى ملء جميع الحقول المطلوبة",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "تم إرسال الطلب بنجاح",
      description: "سيتم التواصل معك قريباً لتأكيد الطلب",
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold font-arabic">إتمام الطلب</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <Label htmlFor="name" className="font-arabic">الاسم الكامل *</Label>
            <Input
              id="name"
              value={customerInfo.name}
              onChange={(e) => setCustomerInfo(prev => ({ ...prev, name: e.target.value }))}
              placeholder="أدخل اسمك الكامل"
              className="text-right font-arabic mt-2"
            />
          </div>

          <div>
            <Label htmlFor="phone" className="font-arabic">رقم الهاتف *</Label>
            <Input
              id="phone"
              value={customerInfo.phone}
              onChange={(e) => setCustomerInfo(prev => ({ ...prev, phone: e.target.value }))}
              placeholder="07xxxxxxxx"
              className="text-right font-arabic mt-2"
            />
          </div>

          <div>
            <Label htmlFor="city" className="font-arabic">المحافظة *</Label>
            <Select
              value={customerInfo.city}
              onValueChange={(value) => setCustomerInfo(prev => ({ ...prev, city: value }))}
            >
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="اختر المحافظة" className="font-arabic" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="baghdad" className="font-arabic">بغداد</SelectItem>
                <SelectItem value="basra" className="font-arabic">البصرة</SelectItem>
                <SelectItem value="mosul" className="font-arabic">الموصل</SelectItem>
                <SelectItem value="erbil" className="font-arabic">أربيل</SelectItem>
                <SelectItem value="najaf" className="font-arabic">النجف</SelectItem>
                <SelectItem value="karbala" className="font-arabic">كربلاء</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="address" className="font-arabic">العنوان التفصيلي</Label>
            <Textarea
              id="address"
              value={customerInfo.address}
              onChange={(e) => setCustomerInfo(prev => ({ ...prev, address: e.target.value }))}
              placeholder="الحي، الشارع، رقم الدار..."
              className="text-right font-arabic mt-2"
            />
          </div>

          <div className="bg-muted/50 p-4 rounded-2xl">
            <h3 className="font-medium mb-3 font-arabic">ملخص الطلب</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between font-arabic">
                <span>المجموع الفرعي:</span>
                <span>{(total || 0).toLocaleString()} د.ع</span>
              </div>
              <div className="flex justify-between font-arabic">
                <span>رسوم التوصيل:</span>
                <span>{(deliveryFee || 0).toLocaleString()} د.ع</span>
              </div>
              <Separator />
              <div className="flex justify-between font-medium text-lg font-arabic">
                <span>المجموع الكلي:</span>
                <span className="text-primary">{(grandTotal || 0).toLocaleString()} د.ع</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={onClose} variant="outline" className="flex-1 font-arabic">
              إلغاء
            </Button>
            <Button onClick={handleSubmit} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 font-arabic">
              تأكيد الطلب
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// القائمة الجانبية للهاتف
const MobileMenu = ({ isOpen, onClose, categories }) => {
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-80">
        <div className="py-6">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold font-arabic">القائمة الرئيسية</h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="space-y-3">
            {categories.map((category) => (
              <motion.div 
                key={category.id} 
                whileHover={{ x: 5 }}
                className="flex items-center gap-4 p-3 hover:bg-accent/50 rounded-xl cursor-pointer transition-colors"
              >
                <div className={`w-10 h-10 ${category.bgColor} rounded-xl flex items-center justify-center`}>
                  <category.icon className={`w-5 h-5 bg-gradient-to-r ${category.color} bg-clip-text text-transparent`} />
                </div>
                <span className="text-sm font-medium font-arabic">{category.name}</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground mr-auto" />
              </motion.div>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

// زر الواتساب
const WhatsAppButton = () => {
  return (
    <motion.a
      href="https://wa.me/9647801234567"
      target="_blank"
      rel="noopener noreferrer"
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      className="fixed bottom-24 left-6 w-16 h-16 bg-green-500 rounded-full flex items-center justify-center shadow-lg z-40 hover:shadow-xl transition-shadow"
    >
      <MessageCircle className="w-8 h-8 text-white" />
    </motion.a>
  );
};

// التنقل السفلي للهاتف
const MobileBottomNav = () => {
  const navItems = [
    { icon: User, label: 'الحساب', active: false },
    { icon: ShoppingBag, label: 'السلة', active: false },
    { icon: Sparkles, label: 'الرائج', active: true },
    { icon: Search, label: 'البحث', active: false },
    { icon: Home, label: 'الرئيسية', active: false }
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border/20 z-40">
      <div className="flex items-center justify-around py-3">
        {navItems.map((item, index) => (
          <motion.div 
            key={index} 
            whileTap={{ scale: 0.95 }}
            className="flex flex-col items-center p-2"
          >
            <div className={`p-2 rounded-xl transition-colors ${item.active ? 'bg-primary/20' : ''}`}>
              <item.icon className={`w-5 h-5 ${item.active ? 'text-primary' : 'text-muted-foreground'}`} />
            </div>
            <span className={`text-xs mt-1 font-arabic ${item.active ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
              {item.label}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default StorePage;