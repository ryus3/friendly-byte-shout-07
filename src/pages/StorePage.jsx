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
  Share
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
  const { cart, addToCart } = useCart();
  const { theme, setTheme } = useTheme();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showQuickOrder, setShowQuickOrder] = useState(false);

  // Sample data for Shein-like interface
  const sheinCategories = [
    { id: 1, name: 'نسائي', image: '👗', color: 'bg-gradient-to-br from-pink-400 to-rose-500' },
    { id: 2, name: 'رجالي', image: '👔', color: 'bg-gradient-to-br from-blue-400 to-indigo-500' },
    { id: 3, name: 'أطفال', image: '🧸', color: 'bg-gradient-to-br from-yellow-400 to-orange-500' },
    { id: 4, name: 'أحذية', image: '👟', color: 'bg-gradient-to-br from-purple-400 to-violet-500' },
    { id: 5, name: 'إكسسوارات', image: '💍', color: 'bg-gradient-to-br from-emerald-400 to-teal-500' },
    { id: 6, name: 'حقائب', image: '👜', color: 'bg-gradient-to-br from-red-400 to-pink-500' },
    { id: 7, name: 'منزل ومطبخ', image: '🏠', color: 'bg-gradient-to-br from-amber-400 to-yellow-500' },
    { id: 8, name: 'رياضة وخارجي', image: '⚽', color: 'bg-gradient-to-br from-green-400 to-emerald-500' },
    { id: 9, name: 'جمال وصحة', image: '💄', color: 'bg-gradient-to-br from-rose-400 to-pink-500' },
    { id: 10, name: 'الملابس الداخلية', image: '🩱', color: 'bg-gradient-to-br from-purple-400 to-indigo-500' },
    { id: 11, name: 'مجوهرات', image: '💎', color: 'bg-gradient-to-br from-cyan-400 to-blue-500' },
    { id: 12, name: 'إلكترونيات', image: '📱', color: 'bg-gradient-to-br from-slate-400 to-gray-500' }
  ];

  const trendingCollections = [
    { id: 1, name: 'Premium Style', image: '👗', description: 'أناقة بلا حدود' },
    { id: 2, name: 'Ageless', image: '👔', description: 'خالدة الطراز' },
    { id: 3, name: 'Fave Stores', image: '⭐', description: 'متاجر مفضلة' },
    { id: 4, name: 'Date', image: '🌹', description: 'مناسبات خاصة' },
    { id: 5, name: 'Street', image: '🔥', description: 'موضة الشارع' }
  ];

  const sampleProducts = [
    { id: 1, name: 'فستان صيفي أنيق', price: 45000, originalPrice: 75000, discount: 40, rating: 4.8, reviews: 523, image: '👗', category: 'نسائي', trending: true },
    { id: 2, name: 'قميص رجالي كلاسيكي', price: 32000, originalPrice: 48000, discount: 33, rating: 4.6, reviews: 234, image: '👔', category: 'رجالي', newIn: true },
    { id: 3, name: 'حذاء رياضي عصري', price: 89000, originalPrice: 125000, discount: 29, rating: 4.9, reviews: 867, image: '👟', category: 'أحذية', flashSale: true },
    { id: 4, name: 'حقيبة يد أنيقة', price: 67000, originalPrice: 95000, discount: 29, rating: 4.7, reviews: 345, image: '👜', category: 'حقائب', trending: true },
    { id: 5, name: 'ساعة ذكية متطورة', price: 156000, originalPrice: 220000, discount: 29, rating: 4.8, reviews: 654, image: '⌚', category: 'إلكترونيات', newIn: true },
    { id: 6, name: 'نظارة شمسية كلاسيكية', price: 23000, originalPrice: 35000, discount: 34, rating: 4.5, reviews: 189, image: '🕶️', category: 'إكسسوارات', flashSale: true }
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
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>RYUS Store - أفضل متجر للأزياء العصرية</title>
        <meta name="description" content="اكتشف أحدث صيحات الموضة والأزياء العصرية في متجر RYUS. تسوق الآن واحصل على خصومات تصل إلى 70%" />
      </Helmet>

      {/* Shein-like Header */}
      <SheinHeader 
        cartItemsCount={cart.length} 
        onCartClick={() => setIsCartOpen(true)}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onMenuClick={() => setIsMenuOpen(true)}
      />

      {/* Main Navigation Bar */}
      <SheinNavigation />

      {/* Flash Sale Banner */}
      <FlashSaleBanner />

      {/* Trending Collections Row */}
      <TrendingCollectionsRow collections={trendingCollections} />

      {/* Categories Circle Grid */}
      <SheinCategoriesGrid categories={sheinCategories} />

      {/* Super Deals Section */}
      <SuperDealsSection products={sampleProducts} />

      {/* Product Recommendations */}
      <ProductRecommendations products={sampleProducts} />

      {/* Premium Cart Sidebar */}
      <PremiumCartSidebar
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        onQuickOrder={() => setShowQuickOrder(true)}
      />

      {/* Quick Order Modal */}
      <QuickOrderModal
        isOpen={showQuickOrder}
        onClose={() => setShowQuickOrder(false)}
        cart={cart}
      />

      {/* Mobile Menu */}
      <MobileMenu 
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        categories={sheinCategories}
      />

      {/* WhatsApp Button */}
      <WhatsAppButton />

      {/* Bottom Navigation for Mobile */}
      <MobileBottomNav />
    </div>
  );
};

// Shein-style Header
const SheinHeader = ({ cartItemsCount, onCartClick, searchQuery, setSearchQuery, onMenuClick }) => {
  return (
    <>
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 text-white py-2 text-center text-sm font-semibold">
        🎉 احصل على خصم 20% على طلبك الأول
      </div>

      {/* Main Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            
            {/* Left Icons */}
            <div className="flex items-center gap-2">
              <Heart className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              <Camera className="w-6 h-6 text-gray-600 dark:text-gray-400" />
            </div>

            {/* Center Search */}
            <div className="flex-1 max-w-md mx-4">
              <div className="relative">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="New Fall Fashion Women"
                  className="w-full bg-gray-100 dark:bg-gray-800 border-0 rounded-full py-2 px-4 pr-10 text-center"
                />
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
            </div>

            {/* Right Icons */}
            <div className="flex items-center gap-2">
              <Mail className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              <div className="relative">
                <ShoppingCart 
                  className="w-6 h-6 text-gray-600 dark:text-gray-400 cursor-pointer" 
                  onClick={onCartClick}
                />
                {cartItemsCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {cartItemsCount}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* SHEIN Brand */}
          <div className="text-center mt-2">
            <h1 className="text-2xl font-bold text-black dark:text-white tracking-wider">
              RYUS
            </h1>
          </div>
        </div>
      </header>
    </>
  );
};

// Main Navigation
const SheinNavigation = () => {
  const navItems = ['Home', 'Men', 'Kids', 'Curve', 'Women', 'All'];
  
  return (
    <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
      <div className="flex justify-center space-x-8 py-3">
        {navItems.map((item, index) => (
          <button
            key={item}
            className={`text-sm font-medium whitespace-nowrap px-2 py-1 ${
              index === navItems.length - 1 
                ? 'text-black dark:text-white border-b-2 border-black dark:border-white font-bold' 
                : 'text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white'
            }`}
          >
            {item}
          </button>
        ))}
      </div>
    </nav>
  );
};

// Flash Sale Banner
const FlashSaleBanner = () => {
  return (
    <div className="bg-gradient-to-r from-red-600 via-orange-500 to-yellow-500 text-white py-8 px-4 relative overflow-hidden">
      <motion.div
        animate={{ rotate: [0, 5, -5, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="text-center"
      >
        <div className="text-4xl font-bold mb-2">
          UP TO <span className="text-6xl">80%</span> OFF
        </div>
        <div className="text-2xl font-bold mb-4">
          End of season <span className="bg-yellow-400 text-red-600 px-2 py-1 rounded">SALE</span>
        </div>
        <Button className="bg-white text-red-600 hover:bg-gray-100 font-bold px-8 py-2 rounded border-2 border-white">
          SHOP NOW &gt;
        </Button>
      </motion.div>
      
      {/* Decorative elements */}
      <div className="absolute top-2 right-4 text-2xl">🔥</div>
      <div className="absolute bottom-2 left-4 text-2xl">⚡</div>
    </div>
  );
};

// Trending Collections Row
const TrendingCollectionsRow = ({ collections }) => {
  return (
    <div className="bg-white dark:bg-gray-900 py-4">
      <div className="flex justify-center space-x-4 overflow-x-auto px-4">
        {collections.map((collection) => (
          <motion.div
            key={collection.id}
            whileHover={{ scale: 1.05 }}
            className="flex-shrink-0 w-24 text-center"
          >
            <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-lg mx-auto mb-2 flex items-center justify-center text-2xl">
              {collection.image}
            </div>
            <div className="text-xs font-medium text-gray-800 dark:text-gray-200">
              {collection.name}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

// Categories Grid (Circle Style like Shein)
const SheinCategoriesGrid = ({ categories }) => {
  return (
    <div className="bg-white dark:bg-gray-900 p-4">
      <div className="grid grid-cols-3 gap-4">
        {categories.map((category) => (
          <motion.div
            key={category.id}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="text-center cursor-pointer"
          >
            <div className={`w-20 h-20 ${category.color} rounded-full mx-auto mb-2 flex items-center justify-center text-2xl shadow-lg`}>
              {category.image}
            </div>
            <div className="text-xs font-medium text-gray-800 dark:text-gray-200 leading-tight">
              {category.name}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

// Super Deals Section
const SuperDealsSection = ({ products }) => {
  return (
    <div className="bg-white dark:bg-gray-900 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="text-2xl">⚡</div>
          <span className="text-lg font-bold text-gray-800 dark:text-gray-200">Super Deals</span>
          <Badge className="bg-red-500 text-white text-xs">-16% 🔥</Badge>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-400" />
      </div>

      <div className="flex space-x-3 overflow-x-auto pb-4">
        {products.slice(0, 4).map((product) => (
          <ProductCard key={product.id} product={product} compact />
        ))}
      </div>
    </div>
  );
};

// Product Recommendations
const ProductRecommendations = ({ products }) => {
  const [activeTab, setActiveTab] = useState('Deals');
  const tabs = ['Deals', 'New In', 'For You'];

  return (
    <div className="bg-white dark:bg-gray-900 p-4">
      {/* Tabs */}
      <div className="flex justify-center mb-4">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-2 mx-1 rounded-full text-sm font-medium ${
              activeTab === tab
                ? 'bg-black text-white dark:bg-white dark:text-black'
                : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-2 gap-3">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
};

// Product Card Component
const ProductCard = ({ product, compact = false }) => {
  const [isFavorite, setIsFavorite] = useState(false);

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className={`bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-sm ${compact ? 'w-32' : ''}`}
    >
      <div className="relative">
        <div className={`${compact ? 'h-32' : 'h-48'} bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-4xl`}>
          {product.image}
        </div>
        
        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {product.flashSale && (
            <Badge className="bg-red-500 text-white text-xs px-1 py-0">Flash Sale</Badge>
          )}
          {product.newIn && (
            <Badge className="bg-green-500 text-white text-xs px-1 py-0">جديد</Badge>
          )}
          {product.trending && (
            <Badge className="bg-purple-500 text-white text-xs px-1 py-0">رائج</Badge>
          )}
        </div>

        {/* Favorite Button */}
        <button
          onClick={() => setIsFavorite(!isFavorite)}
          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center shadow-sm"
        >
          <Heart className={`w-4 h-4 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
        </button>

        {/* Discount Badge */}
        {product.discount > 0 && (
          <div className="absolute bottom-2 left-2 bg-red-500 text-white text-xs px-1 py-0.5 rounded">
            -{product.discount}%
          </div>
        )}
      </div>

      <div className={`p-2 ${compact ? 'p-1' : ''}`}>
        <div className={`text-gray-800 dark:text-gray-200 font-medium ${compact ? 'text-xs' : 'text-sm'} line-clamp-2 mb-1`}>
          {product.name}
        </div>
        
        <div className="flex items-center gap-1 mb-1">
          <span className={`text-red-500 font-bold ${compact ? 'text-xs' : 'text-sm'}`}>
            {(product?.price || 0).toLocaleString()} د.ع
          </span>
          {(product?.originalPrice || 0) > (product?.price || 0) && (
            <span className={`text-gray-400 line-through ${compact ? 'text-xs' : 'text-xs'}`}>
              {(product?.originalPrice || 0).toLocaleString()}
            </span>
          )}
        </div>

        {!compact && (
          <div className="flex items-center gap-1">
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`w-3 h-3 ${i < Math.floor(product.rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                />
              ))}
            </div>
            <span className="text-xs text-gray-500">({product.reviews}+)</span>
          </div>
        )}
      </div>
    </motion.div>
  );
};

// Premium Cart Sidebar
const PremiumCartSidebar = ({ isOpen, onClose, cart, onQuickOrder }) => {
  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

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
            className="fixed right-0 top-0 h-full w-80 bg-white dark:bg-gray-900 z-50 shadow-xl"
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">حقيبة التسوق</h2>
                <Button variant="ghost" size="sm" onClick={onClose}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {cart.length === 0 ? (
                <div className="text-center py-8">
                  <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">سلة التسوق فارغة</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {cart.map((item) => (
                    <div key={item.id} className="flex gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center">
                        <DefaultProductImage />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-medium">{item.name}</h3>
                        <p className="text-sm text-gray-500">{(item?.price || 0).toLocaleString()} د.ع</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Button variant="outline" size="sm">
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="text-sm">{item.quantity}</span>
                          <Button variant="outline" size="sm">
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex justify-between mb-4">
                  <span className="font-medium">المجموع:</span>
                  <span className="font-bold">{(total || 0).toLocaleString()} د.ع</span>
                </div>
                <Button onClick={onQuickOrder} className="w-full bg-black text-white hover:bg-gray-800">
                  أضف إلى عربة التسوق بنجاح
                </Button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// Quick Order Modal
const QuickOrderModal = ({ isOpen, onClose, cart }) => {
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    phone: '',
    city: '',
    address: '',
    notes: ''
  });

  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
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
      title: "تم إرسال الطلب",
      description: "سيتم التواصل معك قريباً لتأكيد الطلب",
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>تسجيل الدخول / الاشتراك</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="name">الاسم الكامل *</Label>
            <Input
              id="name"
              value={customerInfo.name}
              onChange={(e) => setCustomerInfo(prev => ({ ...prev, name: e.target.value }))}
              placeholder="أدخل اسمك الكامل"
              className="text-right"
            />
          </div>

          <div>
            <Label htmlFor="phone">رقم الهاتف *</Label>
            <Input
              id="phone"
              value={customerInfo.phone}
              onChange={(e) => setCustomerInfo(prev => ({ ...prev, phone: e.target.value }))}
              placeholder="07xxxxxxxx"
              className="text-right"
            />
          </div>

          <div>
            <Label htmlFor="city">المحافظة *</Label>
            <Select
              value={customerInfo.city}
              onValueChange={(value) => setCustomerInfo(prev => ({ ...prev, city: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="اختر المحافظة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="baghdad">بغداد</SelectItem>
                <SelectItem value="basra">البصرة</SelectItem>
                <SelectItem value="mosul">الموصل</SelectItem>
                <SelectItem value="erbil">أربيل</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="address">العنوان التفصيلي</Label>
            <Textarea
              id="address"
              value={customerInfo.address}
              onChange={(e) => setCustomerInfo(prev => ({ ...prev, address: e.target.value }))}
              placeholder="الحي، الشارع، رقم الدار..."
              className="text-right"
            />
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
            <h3 className="font-medium mb-2">ملخص الطلب</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>المجموع الفرعي:</span>
                <span>{(total || 0).toLocaleString()} د.ع</span>
              </div>
              <div className="flex justify-between">
                <span>رسوم التوصيل:</span>
                <span>{(deliveryFee || 0).toLocaleString()} د.ع</span>
              </div>
              <Separator />
              <div className="flex justify-between font-medium">
                <span>المجموع الكلي:</span>
                <span>{(grandTotal || 0).toLocaleString()} د.ع</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={onClose} variant="outline" className="flex-1">
              إلغاء
            </Button>
            <Button onClick={handleSubmit} className="flex-1 bg-black text-white hover:bg-gray-800">
              حساب / تسجيل
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Mobile Menu
const MobileMenu = ({ isOpen, onClose, categories }) => {
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-80">
        <div className="py-4">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold">القائمة</h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="space-y-4">
            {categories.map((category) => (
              <div key={category.id} className="flex items-center gap-3 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg cursor-pointer">
                <div className={`w-8 h-8 ${category.color} rounded-full flex items-center justify-center text-sm`}>
                  {category.image}
                </div>
                <span className="text-sm font-medium">{category.name}</span>
              </div>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

// WhatsApp Button
const WhatsAppButton = () => {
  return (
    <motion.a
      href="https://wa.me/9647801234567"
      target="_blank"
      rel="noopener noreferrer"
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      className="fixed bottom-20 left-4 w-14 h-14 bg-green-500 rounded-full flex items-center justify-center shadow-lg z-40"
    >
      <MessageCircle className="w-8 h-8 text-white" />
    </motion.a>
  );
};

// Mobile Bottom Navigation
const MobileBottomNav = () => {
  const navItems = [
    { icon: User, label: 'أنا', active: false },
    { icon: ShoppingBag, label: 'حقيبة التسوق', active: false },
    { icon: Sparkles, label: 'trends', active: true },
    { icon: Search, label: 'الفئات', active: false },
    { icon: Home, label: 'متجر', active: false }
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 z-40">
      <div className="flex items-center justify-around py-2">
        {navItems.map((item, index) => (
          <div key={index} className="flex flex-col items-center p-2">
            <div className={`p-2 rounded-full ${item.active ? 'bg-purple-100 dark:bg-purple-900' : ''}`}>
              <item.icon className={`w-5 h-5 ${item.active ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400'}`} />
            </div>
            <span className={`text-xs mt-1 ${item.active ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400'}`}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StorePage;