import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Bot, Home, Search, Menu, User, Settings, Package, DollarSign } from 'lucide-react';
import { useInventory } from '@/contexts/InventoryContext';
import CartDialog from '@/components/orders/CartDialog';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { useUnifiedPermissionsSystem as usePermissions } from '@/hooks/useUnifiedPermissionsSystem.jsx';
import { useAiChat } from '@/contexts/AiChatContext';
import { cn } from '@/lib/utils';
import QuickOrderDialog from '@/components/quick-order/QuickOrderDialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import SimpleQRScanner from '@/components/shared/SimpleQRScanner';

const NavButton = React.forwardRef(({ onClick, icon: Icon, label, className, badgeCount, isActive, ...props }, ref) => (
  <motion.button
    ref={ref}
    onClick={onClick}
    whileTap={{ scale: 0.95 }}
    className={cn(
      "relative flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary transition-all duration-300 flex-1 h-14 rounded-lg",
      isActive && "text-primary bg-primary/5 shadow-sm",
      className
    )}
    {...props}
  >
    <div className="relative">
      <Icon className={cn("w-5 h-5 transition-all duration-200", isActive && "scale-110")} />
      {badgeCount > 0 && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-1 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center border border-background"
        >
          {badgeCount > 9 ? '9+' : badgeCount}
        </motion.span>
      )}
    </div>
    <span className={cn("text-xs font-medium transition-all duration-200", isActive && "font-bold text-xs")}>{label}</span>
  </motion.button>
));

NavButton.displayName = "NavButton";

const MenuSheet = ({ children, open, onOpenChange }) => (
  <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetTrigger asChild>
      {children}
    </SheetTrigger>
    <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl">
      <SheetHeader className="text-right">
        <SheetTitle className="text-xl font-bold text-right">القائمة الرئيسية</SheetTitle>
      </SheetHeader>
      <MenuContent onClose={() => onOpenChange(false)} />
    </SheetContent>
  </Sheet>
);

const MenuContent = ({ onClose }) => {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { path: '/', icon: Home, label: 'لوحة التحكم', permission: 'view_dashboard', color: 'text-blue-500' },
    { path: '/products', icon: Package, label: 'المنتجات', permission: 'view_products', color: 'text-orange-500' },
    { path: '/my-orders', icon: ShoppingCart, label: 'طلباتي', permission: 'view_orders', color: 'text-green-500' },
    { path: '/profits-management', icon: DollarSign, label: 'أرباحي', permission: 'view_profits', color: 'text-emerald-500' },
    { path: '/settings', icon: Settings, label: 'الاعدادات', permission: 'view_settings', color: 'text-gray-500' }
  ];

  const visibleMenuItems = menuItems; // عرض جميع العناصر بدون فحص الصلاحيات

  const handleNavigation = (path) => {
    navigate(path);
    onClose();
  };

  return (
    <div className="grid grid-cols-2 gap-4 mt-6">
      {visibleMenuItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path;
        
        return (
          <motion.div
            key={item.path}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
              "p-4 rounded-xl border border-border/50 bg-gradient-to-br from-background to-secondary/30 cursor-pointer transition-all duration-200",
              isActive && "border-primary/50 bg-gradient-to-br from-primary/5 to-primary/10"
            )}
            onClick={() => handleNavigation(item.path)}
          >
            <div className="flex flex-col items-center gap-3">
              <div className={cn(
                "p-3 rounded-full transition-colors duration-200",
                isActive ? "bg-primary/20" : "bg-secondary/50"
              )}>
                <Icon className={cn("w-6 h-6", isActive ? "text-primary" : item.color)} />
              </div>
              <span className={cn("font-medium text-sm", isActive && "text-primary")}>{item.label}</span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

const SearchSheet = ({ children, open, onOpenChange }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isQRCodeOpen, setIsQRCodeOpen] = useState(false);
  const { products } = useInventory(); // المنتجات مفلترة تلقائياً حسب الصلاحيات
  const navigate = useNavigate();

  const filteredProducts = React.useMemo(() => {
    if (!products || !Array.isArray(products)) return [];
    return products.filter(product =>
      product?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product?.description?.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 6);
  }, [products, searchQuery]);

  const handleSearch = () => {
    if (searchQuery.trim()) {
      navigate('/products', { 
        state: { searchTerm: searchQuery.trim() }
      });
      onOpenChange(false);
      setSearchQuery('');
    } else {
      navigate('/products');
      onOpenChange(false);
    }
  };

  const handleQRCodeScan = (qrCode) => {
    // التأكد من وجود البيانات قبل البحث
    if (!products || !Array.isArray(products)) {
      toast({
        title: "❌ خطأ في البيانات",
        description: "لا يمكن البحث في المنتجات حالياً",
        variant: "destructive"
      });
      return;
    }

    try {
      // محاولة تحليل QR code كـ JSON
      const qrData = JSON.parse(qrCode);
      if (qrData.type === 'product') {
        // QR code ذكي
        const foundProduct = products.find(product => {
          if (product.id === qrData.product_id) return true;
          if (qrData.variant_id && product.variants.some(v => v.id === qrData.variant_id)) return true;
          return false;
        });
        
        if (foundProduct) {
          navigate('/products', { 
            state: { selectedProduct: foundProduct, searchTerm: qrData.product_name }
          });
          toast({
            title: "✅ تم العثور على المنتج!",
            description: `المنتج: ${qrData.product_name} - ${qrData.color} - ${qrData.size}`,
          });
        } else {
          toast({
            title: "❌ QR code غير معروف",
            description: `QR Code: ${qrData.id}`,
            variant: "destructive"
          });
        }
      } else {
        throw new Error('QR code غير صالح');
      }
    } catch (error) {
      // QR code عادي أو خطأ في التحليل
      const foundProduct = products.find(product => {
        if (!product) return false;
        
        // البحث في QR codes المتغيرات
        if (product.variants && Array.isArray(product.variants)) {
          const hasVariantQRCode = product.variants.some(variant => 
            variant && variant.barcode === qrCode
          );
          if (hasVariantQRCode) return true;
        }
        
        // البحث في QR code المنتج الرئيسي
        return product.barcode === qrCode;
      });
      
      if (foundProduct) {
        navigate('/products', { 
          state: { selectedProduct: foundProduct, searchTerm: qrCode }
        });
        toast({
          title: "✅ تم العثور على المنتج!",
          description: foundProduct?.name || "منتج غير معروف",
        });
      } else {
        toast({
          title: "❌ QR code غير معروف",
          description: `QR Code: ${qrCode}`,
          variant: "destructive"
        });
      }
    }
    
    setIsQRCodeOpen(false);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        {children}
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl">
        <SheetHeader className="text-right">
          <SheetTitle className="text-xl font-bold text-right">البحث في المنتجات</SheetTitle>
        </SheetHeader>
        
        <div className="mt-6 space-y-4">
          <div className="flex gap-2">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث عن منتج..."
              className="flex-1"
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => setIsQRCodeOpen(true)}
              className="shrink-0 bg-gradient-to-r from-blue-500 via-blue-600 to-purple-600 hover:from-blue-600 hover:via-blue-700 hover:to-purple-700 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl"
              title="مسح QR Code"
            >
              <div className="w-5 h-5">
                <svg viewBox="0 0 24 24" fill="currentColor" className="text-white">
                  <path d="M3 11h8V3H3v8zm2-6h4v4H5V5zm8-2v8h8V3h-8zm6 6h-4V5h4v4zM3 21h8v-8H3v8zm2-6h4v4H5v-4z"/>
                  <path d="M13 13h1.5v1.5H13V13zm0 3h1.5v1.5H13V16zm3 0h1.5v1.5H16V16zm1.5-3H19v1.5h-1.5V13zm0 3H19v1.5h-1.5V16zm3-3H22v1.5h-1.5V13z"/>
                </svg>
              </div>
            </Button>
            <Button onClick={handleSearch}>بحث</Button>
          </div>

          {searchQuery && (
            <div className="space-y-2">
              <h3 className="font-medium text-sm text-muted-foreground">نتائج البحث:</h3>
              {filteredProducts.length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                   {filteredProducts.map((product) => (
                     product?.id ? (
                       <div
                         key={product.id}
                         className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-secondary/30 cursor-pointer transition-colors"
                         onClick={() => {
                           navigate('/products', { 
                             state: { selectedProduct: product }
                           });
                           onOpenChange(false);
                           setSearchQuery('');
                         }}
                       >
                         <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                           <Package className="w-6 h-6 text-primary" />
                         </div>
                         <div className="flex-1">
                           <p className="font-medium text-sm">{product?.name || "منتج غير معروف"}</p>
                           <p className="text-xs text-muted-foreground">{product?.price?.toLocaleString() || "0"} د.ع</p>
                         </div>
                       </div>
                     ) : null
                   ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">لم يتم العثور على نتائج</p>
              )}
            </div>
          )}
        </div>
      </SheetContent>
      <SimpleQRScanner
        open={isQRCodeOpen}
        onOpenChange={setIsQRCodeOpen}
        onScanSuccess={handleQRCodeScan}
        title="🔍 قارئ الباركود الذكي"
      />
    </Sheet>
  );
};

const BottomNav = () => {
  const { cart } = useInventory();
  const { user } = useAuth();
  const { setAiChatOpen, canUseAiChat } = useAiChat();
  const navigate = useNavigate();
  const location = useLocation();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isQuickOrderOpen, setIsQuickOrderOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  
  const itemCount = (cart || []).reduce((sum, item) => sum + (item?.quantity || 0), 0);

  const handleHomeClick = () => {
    navigate(user?.default_page || '/');
  };

  const handleCheckout = () => {
    setIsCartOpen(false);
    setIsQuickOrderOpen(true);
  };

  const handleAiChat = () => {
    if (canUseAiChat) {
      setAiChatOpen(true);
    } else {
      toast({
        title: "غير متاح",
        description: "المساعد الذكي غير متاح حالياً",
        variant: "destructive"
      });
    }
  };

  return (
    <>
      <motion.div
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        exit={{ y: 100 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed bottom-0 right-0 left-0 bg-card/95 backdrop-blur-xl border-t border-border/50 z-40 md:hidden shadow-2xl"
      >
        <div className="flex justify-around items-center h-16 px-3 relative">
          {/* القائمة */}
          <NavButton 
            onClick={() => {
              // إشارة لفتح الـ sidebar في Layout.jsx
              const event = new CustomEvent('toggle-sidebar');
              window.dispatchEvent(event);
            }}
            icon={Menu} 
            label="القائمة" 
          />
          
          {/* الرئيسية */}
          <NavButton 
            onClick={handleHomeClick} 
            icon={Home} 
            label="الرئيسية"
            isActive={location.pathname === (user?.default_page || '/')}
          />

          {/* المساعد الذكي في الوسط */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            whileHover={{ scale: 1.05 }}
            className={cn(
              "relative w-16 h-16 -mt-7 rounded-2xl shadow-2xl flex items-center justify-center transition-all duration-300 backdrop-blur-md border border-white/20",
              canUseAiChat 
                ? "bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 text-white hover:shadow-blue-500/30 hover:scale-110 hover:rotate-2" 
                : "bg-gradient-to-br from-muted to-muted-foreground text-muted-foreground"
            )}
            onClick={handleAiChat}
          >
            <Bot className={cn("w-7 h-7 transition-all duration-300", canUseAiChat && "drop-shadow-lg")} />
            {canUseAiChat && (
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 to-transparent" />
            )}
          </motion.button>
          
          {/* البحث */}
          <SearchSheet open={isSearchOpen} onOpenChange={setIsSearchOpen}>
            <NavButton 
              icon={Search} 
              label="البحث"
              isActive={isSearchOpen}
            />
          </SearchSheet>
          
          {/* السلة */}
          <NavButton 
            onClick={() => setIsCartOpen(true)} 
            icon={ShoppingCart} 
            label="السلة" 
            badgeCount={itemCount}
            isActive={isCartOpen}
          />
        </div>
      </motion.div>
      
      <CartDialog open={isCartOpen} onOpenChange={setIsCartOpen} onCheckout={handleCheckout} />
      <QuickOrderDialog open={isQuickOrderOpen} onOpenChange={setIsQuickOrderOpen} />
    </>
  );
};

export default BottomNav;