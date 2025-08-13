import React from 'react';
import { ArrowLeft, Menu, Search, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCapacitor } from '@/hooks/useCapacitor';

const MobileHeader = ({ 
  title, 
  showBack = false, 
  onBack, 
  showMenu = false, 
  onMenuToggle,
  showSearch = false,
  onSearchToggle,
  showCart = false,
  cartItemsCount = 0,
  onCartOpen
}) => {
  const { isNative, setStatusBarColor } = useCapacitor();

  React.useEffect(() => {
    if (isNative) {
      // تعيين لون شريط الحالة للتطبيق الأصلي
      setStatusBarColor('#3b82f6', true);
    }
  }, [isNative, setStatusBarColor]);

  return (
    <header className={`
      sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60
      ${isNative ? 'pt-safe-area-inset-top' : ''}
    `}>
      <div className="container flex h-14 items-center justify-between px-4">
        {/* الجانب الأيسر */}
        <div className="flex items-center gap-2">
          {showBack && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="h-8 w-8 p-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          
          {showMenu && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onMenuToggle}
              className="h-8 w-8 p-0"
            >
              <Menu className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* العنوان */}
        <h1 className="text-lg font-semibold text-foreground truncate px-2">
          {title}
        </h1>

        {/* الجانب الأيمن */}
        <div className="flex items-center gap-2">
          {showSearch && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onSearchToggle}
              className="h-8 w-8 p-0"
            >
              <Search className="h-4 w-4" />
            </Button>
          )}
          
          {showCart && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCartOpen}
              className="h-8 w-8 p-0 relative"
            >
              <ShoppingCart className="h-4 w-4" />
              {cartItemsCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">
                  {cartItemsCount > 9 ? '9+' : cartItemsCount}
                </span>
              )}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};

export default MobileHeader;