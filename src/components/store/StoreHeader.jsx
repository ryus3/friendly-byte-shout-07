import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  ShoppingCart, 
  User, 
  Menu, 
  X, 
  Heart, 
  Search,
  Bell,
  Crown,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

const StoreHeader = ({ cartItemsCount = 0, onCartClick, onQuickOrderClick }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navigationItems = [
    { label: 'الرئيسية', href: '#hero' },
    { label: 'المنتجات', href: '#products' },
    { label: 'المميزة', href: '#featured' },
    { label: 'الأكثر طلباً', href: '#trending' },
    { label: 'العروض', href: '#offers' },
    { label: 'اتصل بنا', href: '#contact' }
  ];

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
            <div className="hidden md:block">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
                RYUS
              </h1>
              <p className="text-xs text-muted-foreground -mt-1">
                متجرك العصري
              </p>
            </div>
          </motion.div>

          {/* القائمة الرئيسية - الحاسوب */}
          <nav className="hidden lg:flex items-center space-x-8 space-x-reverse">
            {navigationItems.map((item, index) => (
              <motion.a
                key={item.label}
                href={item.href}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="relative text-foreground hover:text-primary transition-colors duration-300 font-medium"
              >
                {item.label}
                <span className="absolute inset-x-0 -bottom-1 h-0.5 bg-gradient-to-r from-primary to-purple-500 scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
              </motion.a>
            ))}
          </nav>

          {/* أيقونات التفاعل */}
          <div className="flex items-center gap-2">
            
            {/* البحث - مخفي على الهاتف */}
            <Button
              variant="ghost"
              size="icon"
              className="hidden md:flex w-10 h-10 rounded-full hover:bg-accent"
            >
              <Search className="w-5 h-5" />
            </Button>

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

            {/* الطلب السريع */}
            <Button
              onClick={onQuickOrderClick}
              className="hidden md:flex bg-gradient-to-r from-primary to-purple-500 text-white px-6 py-2 rounded-full hover:shadow-lg hover:shadow-primary/30 transition-all duration-300"
            >
              <Sparkles className="w-4 h-4 ml-2" />
              طلب سريع
            </Button>

            {/* قائمة الهاتف */}
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild className="lg:hidden">
                <Button variant="ghost" size="icon" className="w-10 h-10 rounded-full">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80 bg-background/95 backdrop-blur-xl border-l border-border/50">
                <div className="flex flex-col h-full">
                  
                  {/* رأس القائمة */}
                  <div className="flex items-center justify-between py-4 border-b border-border/50">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-primary to-purple-500 rounded-lg flex items-center justify-center">
                        <Crown className="w-5 h-5 text-white" />
                      </div>
                      <span className="font-bold text-xl">RYUS</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="w-8 h-8 rounded-full"
                    >
                      <X className="w-5 h-5" />
                    </Button>
                  </div>

                  {/* القائمة */}
                  <nav className="flex flex-col py-6 space-y-2">
                    {navigationItems.map((item, index) => (
                      <motion.a
                        key={item.label}
                        href={item.href}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-accent transition-colors duration-300 font-medium"
                      >
                        {item.label}
                      </motion.a>
                    ))}
                  </nav>

                  {/* أزرار سريعة */}
                  <div className="mt-auto space-y-3 pb-6">
                    <Button
                      onClick={() => {
                        onQuickOrderClick();
                        setIsMobileMenuOpen(false);
                      }}
                      className="w-full bg-gradient-to-r from-primary to-purple-500 text-white rounded-xl py-3"
                    >
                      <Sparkles className="w-4 h-4 ml-2" />
                      طلب سريع
                    </Button>
                    
                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        className="flex-1 rounded-xl py-3"
                      >
                        <User className="w-4 h-4 ml-2" />
                        الحساب
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 rounded-xl py-3"
                      >
                        <Search className="w-4 h-4 ml-2" />
                        البحث
                      </Button>
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
};

export default StoreHeader;