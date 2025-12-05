import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination, EffectFade, Navigation } from 'swiper/modules';
import { ArrowLeft, ArrowRight, Zap, Percent, Truck, Shield } from 'lucide-react';
import GradientButton from './ui/GradientButton';

import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/effect-fade';
import 'swiper/css/navigation';

// منتجات وهمية للعرض في السلايدر
const defaultSlides = [
  {
    id: 1,
    title: 'تشكيلة الشتاء الجديدة',
    subtitle: 'خصم يصل إلى 70% على أحدث الموديلات',
    bgGradient: 'from-purple-900 via-pink-800 to-rose-700',
    bgImage: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1920&q=80',
    products: [
      { id: 1, name: 'جاكيت شتوي', price: 45000, image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=300' },
      { id: 2, name: 'سويتر صوف', price: 32000, image: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=300' },
      { id: 3, name: 'بنطلون جينز', price: 28000, image: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=300' },
    ],
    badge: { text: 'عرض محدود', icon: Zap, color: 'bg-red-500' }
  },
  {
    id: 2,
    title: 'أزياء رمضان',
    subtitle: 'تشكيلة حصرية للمناسبات الخاصة',
    bgGradient: 'from-emerald-900 via-teal-800 to-cyan-700',
    bgImage: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1920&q=80',
    products: [
      { id: 4, name: 'ثوب رجالي', price: 55000, image: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=300' },
      { id: 5, name: 'عباية أنيقة', price: 48000, image: 'https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=300' },
    ],
    badge: { text: 'جديد', icon: Percent, color: 'bg-emerald-500' }
  },
  {
    id: 3,
    title: 'شحن مجاني',
    subtitle: 'على جميع الطلبات فوق 50,000 د.ع',
    bgGradient: 'from-blue-900 via-indigo-800 to-violet-700',
    bgImage: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1920&q=80',
    products: [
      { id: 6, name: 'حقيبة يد', price: 35000, image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=300' },
      { id: 7, name: 'حذاء رياضي', price: 42000, image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300' },
      { id: 8, name: 'ساعة يد', price: 65000, image: 'https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=300' },
    ],
    badge: { text: 'شحن مجاني', icon: Truck, color: 'bg-blue-500' }
  }
];

const HeroSlider = ({ slug, banners = [], products = [] }) => {
  const [imageLoaded, setImageLoaded] = useState({});

  // استخدام البانرات إن وجدت، وإلا السلايدات الافتراضية
  const slides = banners.length > 0 
    ? banners.filter(b => b.banner_position === 'hero' && b.is_active).map(b => ({
        id: b.id,
        title: b.banner_title || 'عروض حصرية',
        subtitle: b.banner_subtitle || 'اكتشف أحدث المنتجات',
        bgImage: b.banner_image,
        bgGradient: 'from-purple-900 via-pink-800 to-rose-700',
        link: b.banner_link,
        products: [],
        badge: { text: 'عرض خاص', icon: Zap, color: 'bg-red-500' }
      }))
    : defaultSlides;

  return (
    <section className="relative">
      <Swiper
        modules={[Autoplay, Pagination, EffectFade, Navigation]}
        effect="fade"
        autoplay={{ delay: 5000, disableOnInteraction: false }}
        pagination={{ 
          clickable: true,
          bulletClass: 'swiper-pagination-bullet !bg-white/50 !w-3 !h-3',
          bulletActiveClass: '!bg-white !w-8 !rounded-full'
        }}
        navigation={{
          prevEl: '.hero-prev',
          nextEl: '.hero-next',
        }}
        loop={true}
        className="h-[450px] sm:h-[500px] md:h-[550px]"
      >
        {slides.map((slide) => (
          <SwiperSlide key={slide.id}>
            <div className="relative h-full">
              {/* خلفية متدرجة */}
              <div className={`absolute inset-0 bg-gradient-to-br ${slide.bgGradient}`} />
              
              {/* صورة الخلفية */}
              {slide.bgImage && (
                <img
                  src={slide.bgImage}
                  alt=""
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
                    imageLoaded[slide.id] ? 'opacity-40' : 'opacity-0'
                  }`}
                  onLoad={() => setImageLoaded(prev => ({ ...prev, [slide.id]: true }))}
                />
              )}

              {/* المحتوى */}
              <div className="relative z-10 h-full container mx-auto px-4">
                <div className="h-full flex flex-col lg:flex-row items-center justify-between gap-8 py-8">
                  {/* النص */}
                  <div className="flex-1 text-center lg:text-right">
                    {/* Badge */}
                    {slide.badge && (
                      <div className={`inline-flex items-center gap-2 ${slide.badge.color} text-white px-4 py-2 rounded-full text-sm font-bold mb-4 animate-pulse`}>
                        <slide.badge.icon className="h-4 w-4" />
                        {slide.badge.text}
                      </div>
                    )}
                    
                    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white mb-4 leading-tight">
                      {slide.title}
                    </h1>
                    <p className="text-lg sm:text-xl text-white/90 mb-6 max-w-lg mx-auto lg:mx-0">
                      {slide.subtitle}
                    </p>
                    
                    <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
                      <Link to={slide.link || `/storefront/${slug}/products`}>
                        <GradientButton variant="primary" size="lg" shimmer>
                          تسوق الآن
                          <ArrowLeft className="h-5 w-5 mr-2" />
                        </GradientButton>
                      </Link>
                    </div>

                    {/* مميزات */}
                    <div className="flex flex-wrap gap-4 mt-6 justify-center lg:justify-start">
                      <div className="flex items-center gap-2 text-white/80 text-sm">
                        <Shield className="h-4 w-4" />
                        <span>ضمان الجودة</span>
                      </div>
                      <div className="flex items-center gap-2 text-white/80 text-sm">
                        <Truck className="h-4 w-4" />
                        <span>توصيل سريع</span>
                      </div>
                    </div>
                  </div>

                  {/* المنتجات المصغرة */}
                  {slide.products && slide.products.length > 0 && (
                    <div className="hidden lg:flex items-end gap-4">
                      {slide.products.slice(0, 3).map((product, idx) => (
                        <div 
                          key={product.id}
                          className={`bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/20 transform hover:scale-105 transition-all duration-300 ${
                            idx === 1 ? 'scale-110' : ''
                          }`}
                          style={{ 
                            transform: `translateY(${idx === 1 ? '-20px' : '0'})`,
                          }}
                        >
                          <div className="w-28 h-28 rounded-xl overflow-hidden bg-white/20 mb-2">
                            <img 
                              src={product.image} 
                              alt={product.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <p className="text-white text-xs font-medium truncate mb-1">{product.name}</p>
                          <p className="text-white font-bold text-sm">
                            {product.price?.toLocaleString()} <span className="text-xs">د.ع</span>
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* جزيئات عائمة */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {[...Array(15)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-2 h-2 bg-white/20 rounded-full"
                    style={{
                      left: `${Math.random() * 100}%`,
                      top: `${Math.random() * 100}%`,
                      animation: `float ${5 + Math.random() * 10}s linear infinite`,
                      animationDelay: `${Math.random() * 5}s`,
                    }}
                  />
                ))}
              </div>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>

      {/* أزرار التنقل */}
      <button className="hero-prev absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors">
        <ArrowRight className="h-5 w-5" />
      </button>
      <button className="hero-next absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors">
        <ArrowLeft className="h-5 w-5" />
      </button>

      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(-100vh) rotate(360deg); opacity: 0; }
        }
      `}</style>
    </section>
  );
};

export default HeroSlider;
