import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination, EffectFade, Navigation } from 'swiper/modules';
import { ArrowLeft, ArrowRight, Zap, Truck, TrendingUp, Star, Sparkles } from 'lucide-react';
import GradientButton from './ui/GradientButton';

import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/effect-fade';
import 'swiper/css/navigation';

const defaultSlides = [
  {
    id: 1,
    title: 'Winter Collection',
    subtitle: 'اكتشف أحدث صيحات الموضة الشتوية',
    hashtag: '#ElegantWinter',
    bgImage: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1920&q=80',
    products: [
      { id: 1, name: 'جاكيت فاخر', price: 75000, oldPrice: 95000, image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=300', badge: 'NEW' },
      { id: 2, name: 'سويتر كشمير', price: 55000, oldPrice: 72000, image: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=300', badge: 'HOT' },
      { id: 3, name: 'معطف صوف', price: 89000, oldPrice: 120000, image: 'https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=300', badge: '-25%' },
      { id: 4, name: 'بنطلون جينز', price: 35000, oldPrice: 45000, image: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=300' },
    ],
    badges: [
      { text: 'trends', color: 'bg-black/80', icon: TrendingUp },
      { text: 'Flash Sale', color: 'bg-red-500', icon: Zap },
      { text: 'Free Shipping', color: 'bg-emerald-500', icon: Truck },
    ]
  },
  {
    id: 2,
    title: 'Summer Vibes',
    subtitle: 'تشكيلة صيفية منعشة بألوان زاهية',
    hashtag: '#SummerStyle',
    bgImage: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=1920&q=80',
    products: [
      { id: 5, name: 'فستان صيفي', price: 42000, oldPrice: 58000, image: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=300', badge: 'SALE' },
      { id: 6, name: 'بلوزة أنيقة', price: 28000, oldPrice: 38000, image: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=300' },
      { id: 7, name: 'تنورة عصرية', price: 32000, oldPrice: 45000, image: 'https://images.unsplash.com/photo-1583496661160-fb5886a0uj80?w=300', badge: 'NEW' },
    ],
    badges: [
      { text: 'NEW IN', color: 'bg-pink-500', icon: Sparkles },
      { text: 'Up to 40% OFF', color: 'bg-orange-500', icon: Star },
    ]
  },
  {
    id: 3,
    title: 'Sport Edition',
    subtitle: 'ملابس رياضية بجودة عالمية',
    hashtag: '#ActiveLife',
    bgImage: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1920&q=80',
    products: [
      { id: 8, name: 'طقم رياضي', price: 65000, oldPrice: 85000, image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=300', badge: '-23%' },
      { id: 9, name: 'حذاء رياضي', price: 78000, oldPrice: 99000, image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300', badge: 'BEST' },
    ],
    badges: [
      { text: 'Limited Edition', color: 'bg-purple-500', icon: Star },
      { text: 'Free Returns', color: 'bg-blue-500', icon: Truck },
    ]
  }
];

const HeroSlider = ({ slug, banners = [], products = [] }) => {
  const [imageLoaded, setImageLoaded] = useState({});

  // استخدام البانرات المخصصة أو الافتراضية
  const slides = banners.length > 0 
    ? banners.filter(b => b.banner_position === 'hero' && b.is_active).map(b => ({
        id: b.id,
        title: b.banner_title || 'New Collection',
        subtitle: b.banner_subtitle || 'اكتشف أحدث المنتجات',
        hashtag: '#NewArrivals',
        bgImage: b.banner_image,
        link: b.banner_link,
        products: products.slice(0, 4).map(p => ({
          id: p.id,
          name: p.name,
          price: p.price,
          oldPrice: p.original_price || p.price * 1.2,
          image: p.images?.[0] || p.image_url,
          badge: p.discount_percentage ? `-${p.discount_percentage}%` : null
        })),
        badges: [
          { text: 'عرض خاص', color: 'bg-red-500', icon: Zap },
        ]
      }))
    : defaultSlides;

  return (
    <section className="relative">
      <Swiper
        modules={[Autoplay, Pagination, EffectFade, Navigation]}
        effect="fade"
        autoplay={{ delay: 6000, disableOnInteraction: false }}
        pagination={{ 
          clickable: true,
          bulletClass: 'swiper-pagination-bullet !bg-white/40 !w-2 !h-2 !mx-1',
          bulletActiveClass: '!bg-white !w-6 !rounded-full'
        }}
        navigation={{
          prevEl: '.hero-prev',
          nextEl: '.hero-next',
        }}
        loop={true}
        className="h-[500px] sm:h-[550px] md:h-[600px]"
      >
        {slides.map((slide) => (
          <SwiperSlide key={slide.id}>
            <div className="relative h-full overflow-hidden">
              {/* خلفية الصورة مع تأثير */}
              <div className="absolute inset-0">
                <img
                  src={slide.bgImage}
                  alt=""
                  className={`w-full h-full object-cover transition-all duration-1000 scale-105 ${
                    imageLoaded[slide.id] ? 'opacity-100' : 'opacity-0'
                  }`}
                  onLoad={() => setImageLoaded(prev => ({ ...prev, [slide.id]: true }))}
                />
                {/* Overlay متدرج */}
                <div className="absolute inset-0 bg-gradient-to-l from-black/80 via-black/50 to-black/30" />
              </div>

              {/* المحتوى الرئيسي */}
              <div className="relative z-10 h-full container mx-auto px-4">
                <div className="h-full flex flex-col lg:flex-row items-center justify-between gap-6 py-8">
                  
                  {/* الجانب الأيسر - المنتجات */}
                  <div className="hidden lg:grid grid-cols-2 gap-3 w-[45%] order-1">
                    {slide.products?.slice(0, 4).map((product, idx) => (
                      <Link
                        key={product.id}
                        to={slide.link || `/storefront/${slug}/product/${product.id}`}
                        className={`group relative bg-white/10 backdrop-blur-md rounded-xl overflow-hidden border border-white/20 hover:border-white/40 transition-all duration-300 hover:scale-[1.02] ${
                          idx === 0 ? 'row-span-2' : ''
                        }`}
                      >
                        {/* Badge */}
                        {product.badge && (
                          <span className="absolute top-2 left-2 z-10 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-full">
                            {product.badge}
                          </span>
                        )}
                        
                        {/* الصورة */}
                        <div className={`overflow-hidden ${idx === 0 ? 'h-48' : 'h-24'}`}>
                          <img 
                            src={product.image} 
                            alt={product.name}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          />
                        </div>
                        
                        {/* المعلومات */}
                        <div className="p-2">
                          <p className="text-white text-xs font-medium truncate">{product.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-white font-bold text-sm">
                              {product.price?.toLocaleString()}
                            </span>
                            {product.oldPrice && (
                              <span className="text-white/50 text-xs line-through">
                                {product.oldPrice?.toLocaleString()}
                              </span>
                            )}
                            <span className="text-white/60 text-[10px]">د.ع</span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>

                  {/* الجانب الأيمن - النص */}
                  <div className="flex-1 text-center lg:text-right order-2 lg:order-2">
                    {/* الهاشتاج */}
                    <div className="inline-flex items-center gap-2 text-white/70 text-sm mb-3">
                      <TrendingUp className="h-4 w-4" />
                      <span>{slide.hashtag}</span>
                    </div>
                    
                    {/* العنوان */}
                    <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black text-white mb-3 leading-tight font-brand">
                      {slide.title}
                    </h1>
                    
                    {/* الوصف */}
                    <p className="text-lg sm:text-xl text-white/80 mb-6 max-w-lg mx-auto lg:mx-0 lg:mr-0">
                      {slide.subtitle}
                    </p>
                    
                    {/* زر الشراء */}
                    <Link to={slide.link || `/storefront/${slug}/products`}>
                      <GradientButton variant="primary" size="lg" shimmer className="group">
                        تسوق الآن
                        <ArrowLeft className="h-5 w-5 mr-2 group-hover:-translate-x-1 transition-transform" />
                      </GradientButton>
                    </Link>
                  </div>
                </div>
              </div>

              {/* شريط البادجات السفلي - SHEIN Style */}
              <div className="absolute bottom-0 left-0 right-0 z-20">
                <div className="flex items-center justify-center gap-2 p-3 bg-gradient-to-t from-black/60 to-transparent">
                  {slide.badges?.map((badge, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center gap-1.5 ${badge.color} text-white px-3 py-1.5 rounded-full text-xs font-bold`}
                    >
                      {badge.icon && <badge.icon className="h-3 w-3" />}
                      {badge.text}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>

      {/* أزرار التنقل */}
      <button className="hero-prev absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors group">
        <ArrowRight className="h-5 w-5 group-hover:scale-110 transition-transform" />
      </button>
      <button className="hero-next absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors group">
        <ArrowLeft className="h-5 w-5 group-hover:scale-110 transition-transform" />
      </button>
    </section>
  );
};

export default HeroSlider;