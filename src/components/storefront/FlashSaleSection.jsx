import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Zap, Clock, ArrowLeft, Star, ShoppingCart, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';

// منتجات Flash Sale الافتراضية
const defaultFlashProducts = [
  {
    id: 1,
    name: 'جاكيت جلد أصلي',
    originalPrice: 85000,
    salePrice: 45000,
    discount: 47,
    image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400&q=80',
    rating: 4.8,
    sold: 234
  },
  {
    id: 2,
    name: 'حذاء رياضي Nike',
    originalPrice: 65000,
    salePrice: 39000,
    discount: 40,
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80',
    rating: 4.9,
    sold: 567
  },
  {
    id: 3,
    name: 'ساعة يد فاخرة',
    originalPrice: 120000,
    salePrice: 72000,
    discount: 40,
    image: 'https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=400&q=80',
    rating: 4.7,
    sold: 189
  },
  {
    id: 4,
    name: 'حقيبة يد جلد',
    originalPrice: 55000,
    salePrice: 27500,
    discount: 50,
    image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400&q=80',
    rating: 4.6,
    sold: 312
  },
  {
    id: 5,
    name: 'نظارة شمسية',
    originalPrice: 35000,
    salePrice: 19000,
    discount: 46,
    image: 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=400&q=80',
    rating: 4.5,
    sold: 445
  },
  {
    id: 6,
    name: 'قميص رجالي',
    originalPrice: 28000,
    salePrice: 14000,
    discount: 50,
    image: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400&q=80',
    rating: 4.4,
    sold: 678
  }
];

const FlashSaleSection = ({ slug, products = [] }) => {
  const [timeLeft, setTimeLeft] = useState({
    hours: 23,
    minutes: 45,
    seconds: 30
  });
  const scrollRef = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        let { hours, minutes, seconds } = prev;
        
        if (seconds > 0) {
          seconds--;
        } else {
          seconds = 59;
          if (minutes > 0) {
            minutes--;
          } else {
            minutes = 59;
            if (hours > 0) {
              hours--;
            } else {
              hours = 23;
            }
          }
        }
        
        return { hours, minutes, seconds };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const displayProducts = products.length > 0 ? products : defaultFlashProducts;

  return (
    <section className="py-6 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20">
      <div className="container mx-auto px-4">
        {/* الهيدر */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            {/* أيقونة Flash Sale */}
            <div className="flex items-center gap-2 bg-gradient-to-r from-red-500 to-orange-500 text-white px-4 py-2 rounded-full">
              <Zap className="h-5 w-5 animate-pulse fill-yellow-300" />
              <span className="font-black text-lg">Flash Sale</span>
            </div>

            {/* العداد التنازلي */}
            <div className="hidden sm:flex items-center gap-2">
              <Clock className="h-5 w-5 text-red-500" />
              <div className="flex items-center gap-1">
                <div className="bg-gray-900 text-white px-2 py-1 rounded font-mono font-bold">
                  {String(timeLeft.hours).padStart(2, '0')}
                </div>
                <span className="font-bold">:</span>
                <div className="bg-gray-900 text-white px-2 py-1 rounded font-mono font-bold">
                  {String(timeLeft.minutes).padStart(2, '0')}
                </div>
                <span className="font-bold">:</span>
                <div className="bg-gray-900 text-white px-2 py-1 rounded font-mono font-bold animate-pulse">
                  {String(timeLeft.seconds).padStart(2, '0')}
                </div>
              </div>
            </div>
          </div>

          <Link 
            to={`/storefront/${slug}/products?sale=true`}
            className="text-sm font-medium text-red-600 hover:text-red-700 flex items-center gap-1"
          >
            عرض الكل
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>

        {/* المنتجات - Horizontal Scroll */}
        <div 
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory"
        >
          {displayProducts.map((product) => (
            <Link
              key={product.id}
              to={`/storefront/${slug}/product/${product.id}`}
              className="group shrink-0 w-[160px] sm:w-[200px] snap-start"
            >
              <div className="bg-background rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-border">
                {/* الصورة */}
                <div className="relative aspect-square overflow-hidden">
                  <img 
                    src={product.image} 
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  
                  {/* بادج الخصم */}
                  <div className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                    -{product.discount}%
                  </div>

                  {/* زر المفضلة */}
                  <button className="absolute top-2 left-2 w-8 h-8 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Heart className="h-4 w-4" />
                  </button>

                  {/* زر الإضافة للسلة */}
                  <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="sm" className="w-full bg-gradient-to-r from-red-500 to-orange-500 text-white text-xs h-8">
                      <ShoppingCart className="h-3 w-3 ml-1" />
                      إضافة للسلة
                    </Button>
                  </div>
                </div>

                {/* المعلومات */}
                <div className="p-3">
                  <h3 className="font-medium text-sm mb-2 line-clamp-2 group-hover:text-red-600 transition-colors">
                    {product.name}
                  </h3>
                  
                  {/* التقييم */}
                  <div className="flex items-center gap-1 mb-2">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    <span className="text-xs text-muted-foreground">{product.rating}</span>
                    <span className="text-xs text-muted-foreground">({product.sold} مبيع)</span>
                  </div>

                  {/* السعر */}
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-red-600">
                      {product.salePrice?.toLocaleString()}
                    </span>
                    <span className="text-xs text-muted-foreground line-through">
                      {product.originalPrice?.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </section>
  );
};

export default FlashSaleSection;
