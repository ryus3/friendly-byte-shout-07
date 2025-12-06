import React from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Home, Grid3X3, Flame, ShoppingCart, User } from 'lucide-react';
import { useStorefront } from '@/contexts/StorefrontContext';

const MobileBottomNav = () => {
  const location = useLocation();
  const { slug } = useParams();
  const { itemCount } = useStorefront();

  const navItems = [
    { 
      id: 'home', 
      icon: Home, 
      label: 'الرئيسية', 
      path: `/storefront/${slug}`,
      exact: true
    },
    { 
      id: 'categories', 
      icon: Grid3X3, 
      label: 'الفئات', 
      path: `/storefront/${slug}/products`
    },
    { 
      id: 'trends', 
      icon: Flame, 
      label: 'الترند', 
      path: `/storefront/${slug}/products?featured=true`
    },
    { 
      id: 'cart', 
      icon: ShoppingCart, 
      label: 'السلة', 
      path: `/storefront/${slug}/cart`,
      badge: itemCount
    },
    { 
      id: 'account', 
      icon: User, 
      label: 'حسابي', 
      path: `/storefront/${slug}/cart` // مؤقتاً يذهب للسلة
    },
  ];

  const isActive = (item) => {
    if (item.exact) {
      return location.pathname === item.path;
    }
    return location.pathname.startsWith(item.path.split('?')[0]);
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-lg border-t border-border">
      <div className="flex items-center justify-around h-16" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}>
        {navItems.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.id}
              to={item.path}
              className={`flex flex-col items-center justify-center flex-1 h-full relative transition-all active:scale-95 ${
                active 
                  ? 'text-pink-600' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {/* مؤشر النشاط */}
              {active && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-gradient-to-r from-pink-500 to-orange-500 rounded-full" />
              )}

              {/* الأيقونة */}
              <div className="relative">
                <item.icon className={`h-5 w-5 transition-transform ${active ? 'scale-110' : ''}`} strokeWidth={active ? 2.5 : 2} />
                
                {/* Badge للسلة */}
                {item.badge > 0 && (
                  <span className="absolute -top-2 -right-2 bg-gradient-to-r from-pink-500 to-orange-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 animate-pulse">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>

              {/* النص */}
              <span className={`text-[10px] mt-1 font-medium ${active ? 'font-bold' : ''}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;