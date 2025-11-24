import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Shirt, Sparkles, Baby, Zap, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const menuItems = [
  {
    id: 'men',
    icon: Shirt,
    title: 'ملابس رجالية',
    gradient: 'from-blue-500 to-cyan-500',
    featured: [],
  },
  {
    id: 'women',
    icon: Sparkles,
    title: 'ملابس نسائية',
    gradient: 'from-pink-500 to-purple-500',
    featured: [],
  },
  {
    id: 'kids',
    icon: Baby,
    title: 'ملابس أطفال',
    gradient: 'from-orange-500 to-yellow-500',
    featured: [],
  },
  {
    id: 'deals',
    icon: Zap,
    title: 'عروض اليوم',
    gradient: 'from-red-500 to-pink-500',
    badge: 'HOT',
    featured: [],
  },
];

const MegaMenu = ({ slug, products = [] }) => {
  const [activeMenu, setActiveMenu] = useState(null);

  // Group products by department
  const productsByDepartment = products.reduce((acc, product) => {
    const dept = product.department_name || 'other';
    if (!acc[dept]) acc[dept] = [];
    acc[dept].push(product);
    return acc;
  }, {});

  return (
    <nav className="border-t border-border/50 bg-gradient-to-r from-background to-muted/30 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeMenu === item.id;
            
            return (
              <div
                key={item.id}
                className="relative"
                onMouseEnter={() => setActiveMenu(item.id)}
                onMouseLeave={() => setActiveMenu(null)}
              >
                {/* Menu Button */}
                <button
                  className={cn(
                    'flex items-center gap-2 px-4 py-3 rounded-lg transition-all duration-200 group',
                    isActive && 'bg-white/50 dark:bg-gray-800/50'
                  )}
                >
                  <div className={`p-1.5 rounded-lg bg-gradient-to-r ${item.gradient} text-white`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className={cn(
                    'font-semibold text-sm transition-colors',
                    isActive && `bg-gradient-to-r ${item.gradient} bg-clip-text text-transparent`
                  )}>
                    {item.title}
                  </span>
                  {item.badge && (
                    <span className="px-2 py-0.5 bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs font-bold rounded-full animate-pulse">
                      {item.badge}
                    </span>
                  )}
                  <ChevronDown className={cn(
                    'w-4 h-4 transition-transform',
                    isActive && 'rotate-180'
                  )} />
                </button>

                {/* Mega Menu Dropdown */}
                {isActive && (
                  <div className="absolute top-full left-0 right-0 mt-1 w-screen max-w-6xl z-50">
                    <div className="glass-ultra rounded-2xl p-6 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="grid grid-cols-4 gap-4">
                        {(productsByDepartment[item.id] || []).slice(0, 8).map((product) => {
                          const variant = product.variants?.[0];
                          const image = variant?.images?.[0] || '/placeholder.png';
                          const price = variant?.price || 0;

                          return (
                            <Link
                              key={product.id}
                              to={`/storefront/${slug}/products/${product.id}`}
                              className="group/item relative overflow-hidden rounded-xl bg-white dark:bg-gray-800 p-3 hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
                            >
                              <div className="aspect-square overflow-hidden rounded-lg mb-2">
                                <img
                                  src={image}
                                  alt={product.name}
                                  className="w-full h-full object-cover group-hover/item:scale-110 transition-transform duration-500"
                                />
                              </div>
                              <h4 className="font-semibold text-sm line-clamp-1 mb-1">
                                {product.name}
                              </h4>
                              <p className={`font-bold text-sm bg-gradient-to-r ${item.gradient} bg-clip-text text-transparent`}>
                                {price.toLocaleString('ar-IQ')} IQD
                              </p>
                            </Link>
                          );
                        })}
                      </div>

                      {/* View All Link */}
                      <Link
                        to={`/storefront/${slug}/products?dept=${item.id}`}
                        className={cn(
                          'block mt-4 text-center py-2 rounded-lg font-bold transition-all',
                          `bg-gradient-to-r ${item.gradient} text-white hover:shadow-lg`
                        )}
                      >
                        عرض الكل ←
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default MegaMenu;
