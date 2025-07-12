import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Bot, Home, Search, Menu, User, Settings, Package } from 'lucide-react';
import { useInventory } from '@/contexts/InventoryContext';
import CartDialog from '@/components/orders/CartDialog';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAiChat } from '@/contexts/AiChatContext';
import { cn } from '@/lib/utils';
import QuickOrderDialog from '@/components/quick-order/QuickOrderDialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';

const NavButton = ({ onClick, icon: Icon, label, className, badgeCount, isActive }) => (
  <motion.button
    onClick={onClick}
    whileTap={{ scale: 0.95 }}
    className={cn(
      "relative flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary transition-all duration-300 flex-1 h-14 rounded-lg",
      isActive && "text-primary bg-primary/5 shadow-sm",
      className
    )}
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
    <span className={cn("text-xs font-medium transition-all duration-200", isActive && "font-bold")}>{label}</span>
  </motion.button>
);

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
  const { user, hasPermission } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { path: '/', icon: Home, label: 'لوحة التحكم', permission: 'view_dashboard', color: 'text-blue-500' },
    { path: '/products', icon: Package, label: 'المنتجات', permission: 'view_products', color: 'text-orange-500' },
    { path: '/my-orders', icon: ShoppingCart, label: 'طلباتي', permission: 'view_orders', color: 'text-green-500' },
    { path: '/settings', icon: Settings, label: 'الاعدادات', permission: 'view_settings', color: 'text-gray-500' }
  ];

  const visibleMenuItems = menuItems.filter(item => hasPermission(item.permission));

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
  const { products } = useInventory();
  const navigate = useNavigate();

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.description?.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 6);

  const handleSearch = () => {
    if (searchQuery.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
      onOpenChange(false);
      setSearchQuery('');
    } else {
      navigate('/products');
      onOpenChange(false);
    }
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
            <Button onClick={handleSearch}>بحث</Button>
          </div>

          {searchQuery && (
            <div className="space-y-2">
              <h3 className="font-medium text-sm text-muted-foreground">نتائج البحث:</h3>
              {filteredProducts.length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {filteredProducts.map((product) => (
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
                        <p className="font-medium text-sm">{product.name}</p>
                        <p className="text-xs text-muted-foreground">{product.price?.toLocaleString()} د.ع</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">لم يتم العثور على نتائج</p>
              )}
            </div>
          )}
        </div>
      </SheetContent>
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
  
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

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
        className="fixed bottom-0 right-0 left-0 bg-card/95 backdrop-blur-xl border-t border-border/50 z-50 md:hidden shadow-2xl"
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
                : "bg-gradient-to-br from-gray-400 to-gray-600 text-white/70"
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