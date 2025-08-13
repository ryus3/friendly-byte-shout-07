import React from 'react';
import { Home, ShoppingBag, User, Search, Heart } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCapacitor } from '@/hooks/useCapacitor';

const MobileBottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isNative } = useCapacitor();

  const navItems = [
    {
      id: 'home',
      label: 'الرئيسية',
      icon: Home,
      path: '/',
    },
    {
      id: 'products',
      label: 'المنتجات',
      icon: ShoppingBag,
      path: '/products',
    },
    {
      id: 'search',
      label: 'البحث',
      icon: Search,
      path: '/search',
    },
    {
      id: 'favorites',
      label: 'المفضلة',
      icon: Heart,
      path: '/favorites',
    },
    {
      id: 'profile',
      label: 'الحساب',
      icon: User,
      path: '/profile',
    },
  ];

  const handleNavigation = (path) => {
    navigate(path);
  };

  return (
    <nav className={`
      fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border
      ${isNative ? 'pb-safe-area-inset-bottom' : ''}
    `}>
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          
          return (
            <button
              key={item.id}
              onClick={() => handleNavigation(item.path)}
              className={`
                flex flex-col items-center justify-center min-w-0 flex-1 py-2 px-1 rounded-lg transition-all duration-200
                ${isActive 
                  ? 'text-primary bg-primary/10' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }
              `}
            >
              <Icon className={`h-5 w-5 mb-1 ${isActive ? 'scale-110' : ''} transition-transform duration-200`} />
              <span className="text-xs font-medium truncate">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;