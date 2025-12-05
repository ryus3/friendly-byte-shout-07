import React from 'react';
import { Link } from 'react-router-dom';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination, EffectFade } from 'swiper/modules';
import { ArrowLeft, Zap, Gift } from 'lucide-react';
import GradientButton from './ui/GradientButton';
import GradientText from './ui/GradientText';

import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/effect-fade';

const HeroSection = ({ slug, banners = [] }) => {
  const heroBanners = banners.filter(b => b.banner_position === 'hero' && b.is_active);
  const sidebarBanners = banners.filter(b => b.banner_position === 'sidebar' && b.is_active);

  if (heroBanners.length === 0) {
    return <DefaultHero slug={slug} />;
  }

  return (
    <section className="relative">
      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Hero Slider - 2 columns */}
          <div className="lg:col-span-2">
            <Swiper
              modules={[Autoplay, Pagination, EffectFade]}
              effect="fade"
              autoplay={{ delay: 5000, disableOnInteraction: false }}
              pagination={{ clickable: true }}
              loop={true}
              className="rounded-3xl overflow-hidden shadow-2xl h-[500px]"
            >
              {heroBanners.map((banner) => (
                <SwiperSlide key={banner.id}>
                  <div className="relative h-full">
                    {/* Background Image */}
                    <img
                      src={banner.banner_image}
                      alt={banner.banner_title}
                      className="absolute inset-0 w-full h-full object-cover"
                    />

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-900/70 via-pink-800/60 to-blue-900/70" />

                    {/* Content */}
                    <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-8">
                      <GradientText
                        variant="gold"
                        className="text-5xl md:text-7xl font-black mb-6"
                        as="h1"
                        animate
                      >
                        {banner.banner_title || 'عروض حصرية'}
                      </GradientText>

                      <p className="text-2xl text-white/90 mb-8 max-w-2xl">
                        {banner.banner_subtitle || 'أحدث صيحات الموضة 2024 بجودة استثنائية'}
                      </p>

                      <div className="flex gap-4 flex-wrap justify-center">
                        <Link to={banner.banner_link || `/storefront/${slug}/products`}>
                          <GradientButton variant="primary" size="lg" shimmer>
                            تسوق الآن <Zap className="w-5 h-5 mr-2 inline" />
                          </GradientButton>
                        </Link>
                        <Link to={`/storefront/${slug}/products`}>
                          <GradientButton variant="warning" size="lg">
                            اكتشف العروض <Gift className="w-5 h-5 mr-2 inline" />
                          </GradientButton>
                        </Link>
                      </div>
                    </div>

                    {/* Floating Animation Particles */}
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                      {[...Array(20)].map((_, i) => (
                        <div
                          key={i}
                          className="absolute w-2 h-2 bg-white/30 rounded-full animate-float"
                          style={{
                            left: `${Math.random() * 100}%`,
                            top: `${Math.random() * 100}%`,
                            animationDelay: `${Math.random() * 5}s`,
                            animationDuration: `${5 + Math.random() * 10}s`,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </SwiperSlide>
              ))}
            </Swiper>
          </div>

          {/* Sidebar Mini Banners - 1 column */}
          <div className="hidden lg:flex flex-col gap-6">
            {sidebarBanners.slice(0, 2).map((banner) => (
              <Link
                key={banner.id}
                to={banner.banner_link || `/storefront/${slug}/products`}
                className="group relative overflow-hidden rounded-2xl h-[242px] shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-2"
              >
                <img
                  src={banner.banner_image}
                  alt={banner.banner_title}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-br from-black/50 to-transparent" />
                <div className="relative z-10 p-6 h-full flex flex-col justify-end">
                  <h3 className="text-2xl font-black text-white mb-2">
                    {banner.banner_title}
                  </h3>
                  <p className="text-white/90 text-sm mb-3">
                    {banner.banner_subtitle}
                  </p>
                  <span className="inline-flex items-center gap-2 text-white font-bold group-hover:gap-4 transition-all">
                    تسوق الآن <ArrowLeft className="w-4 h-4" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0) translateX(0);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translateY(-100vh) translateX(${Math.random() * 100 - 50}px);
            opacity: 0;
          }
        }
        .animate-float {
          animation: float linear infinite;
        }
      `}</style>
    </section>
  );
};

// Default Hero when no banners
const DefaultHero = ({ slug }) => {
  const [imageLoaded, setImageLoaded] = React.useState(false);
  const [imageError, setImageError] = React.useState(false);

  return (
    <section className="min-h-[60vh] md:min-h-[70vh] relative overflow-hidden">
      {/* Background - Gradient fallback always visible */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-pink-800 to-blue-900" />
      
      {/* Background Image - only show if loaded successfully */}
      {!imageError && (
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1920&q=80"
            alt="Hero"
            className={`w-full h-full object-cover transition-opacity duration-500 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
        </div>
      )}

      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/60 via-pink-800/50 to-blue-900/60" />

      {/* Content */}
      <div className="relative z-10 h-full min-h-[60vh] md:min-h-[70vh] flex flex-col items-center justify-center text-center container mx-auto px-4 py-16">
        <GradientText
          variant="gold"
          className="text-5xl sm:text-6xl md:text-8xl font-black mb-6"
          as="h1"
          animate
        >
          اكتشف الموضة العالمية
        </GradientText>

        <p className="text-xl sm:text-2xl md:text-3xl text-white/90 mb-8 max-w-3xl">
          أحدث صيحات الموضة 2024 بجودة استثنائية وأسعار لا تُقاوم
        </p>

        <div className="flex flex-wrap gap-4 justify-center">
          <Link to={`/storefront/${slug}/products`}>
            <GradientButton variant="primary" size="xl" shimmer>
              تسوق الآن <Zap className="w-6 h-6 mr-2 inline" />
            </GradientButton>
          </Link>
          <Link to={`/storefront/${slug}/products`}>
            <GradientButton variant="premium" size="xl">
              اكتشف العروض <Gift className="w-6 h-6 mr-2 inline" />
            </GradientButton>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
