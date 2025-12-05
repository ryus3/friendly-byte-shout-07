import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Percent, Zap, Gift, Sparkles } from 'lucide-react';

const defaultBanners = [
  {
    id: 1,
    title: 'FLASH SALE',
    subtitle: 'خصم حتى 70%',
    image: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=800&q=80',
    gradient: 'from-red-600 to-orange-500',
    icon: Zap,
    size: 'large'
  },
  {
    id: 2,
    title: 'وصل حديثاً',
    subtitle: 'تشكيلة الربيع',
    image: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&q=80',
    gradient: 'from-pink-600 to-rose-500',
    icon: Sparkles,
    size: 'small'
  },
  {
    id: 3,
    title: 'شحن مجاني',
    subtitle: 'للطلبات فوق 50,000',
    image: 'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=800&q=80',
    gradient: 'from-blue-600 to-cyan-500',
    icon: Gift,
    size: 'small'
  },
  {
    id: 4,
    title: 'BRANDS',
    subtitle: 'ماركات عالمية',
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
    gradient: 'from-purple-600 to-violet-500',
    icon: Percent,
    size: 'medium'
  },
  {
    id: 5,
    title: 'SALE',
    subtitle: 'تخفيضات نهاية الموسم',
    image: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800&q=80',
    gradient: 'from-emerald-600 to-green-500',
    icon: Percent,
    size: 'medium'
  }
];

const ProfessionalBanners = ({ slug, banners = [] }) => {
  const displayBanners = banners.length > 0 
    ? banners.filter(b => b.is_active).map((b, idx) => ({
        id: b.id,
        title: b.banner_title,
        subtitle: b.banner_subtitle,
        image: b.banner_image,
        link: b.banner_link,
        gradient: defaultBanners[idx % defaultBanners.length].gradient,
        icon: defaultBanners[idx % defaultBanners.length].icon,
        size: idx === 0 ? 'large' : idx < 3 ? 'small' : 'medium'
      }))
    : defaultBanners;

  return (
    <section className="py-6 bg-muted/30">
      <div className="container mx-auto px-4">
        {/* شبكة البنرات */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {/* البنر الكبير */}
          <Link
            to={displayBanners[0]?.link || `/storefront/${slug}/products`}
            className="col-span-2 row-span-2 group relative overflow-hidden rounded-2xl h-[280px] sm:h-[350px]"
          >
            <img 
              src={displayBanners[0]?.image} 
              alt={displayBanners[0]?.title}
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
            />
            <div className={`absolute inset-0 bg-gradient-to-br ${displayBanners[0]?.gradient} opacity-70`} />
            <div className="relative z-10 h-full p-6 flex flex-col justify-end text-white">
              {displayBanners[0]?.icon && (
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center mb-4">
                  {React.createElement(displayBanners[0].icon, { className: "h-6 w-6" })}
                </div>
              )}
              <h3 className="text-3xl sm:text-4xl font-black mb-2">{displayBanners[0]?.title}</h3>
              <p className="text-lg text-white/90 mb-4">{displayBanners[0]?.subtitle}</p>
              <span className="inline-flex items-center gap-2 font-bold group-hover:gap-4 transition-all">
                تسوق الآن <ArrowLeft className="h-5 w-5" />
              </span>
            </div>
          </Link>

          {/* البنرات الصغيرة */}
          {displayBanners.slice(1, 3).map((banner) => (
            <Link
              key={banner.id}
              to={banner.link || `/storefront/${slug}/products`}
              className="group relative overflow-hidden rounded-2xl h-[135px] sm:h-[170px]"
            >
              <img 
                src={banner.image} 
                alt={banner.title}
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
              />
              <div className={`absolute inset-0 bg-gradient-to-br ${banner.gradient} opacity-70`} />
              <div className="relative z-10 h-full p-4 flex flex-col justify-end text-white">
                <h4 className="text-lg sm:text-xl font-black mb-1">{banner.title}</h4>
                <p className="text-sm text-white/90">{banner.subtitle}</p>
              </div>
            </Link>
          ))}

          {/* البنرات المتوسطة */}
          {displayBanners.slice(3, 5).map((banner) => (
            <Link
              key={banner.id}
              to={banner.link || `/storefront/${slug}/products`}
              className="group relative overflow-hidden rounded-2xl h-[135px] sm:h-[170px]"
            >
              <img 
                src={banner.image} 
                alt={banner.title}
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
              />
              <div className={`absolute inset-0 bg-gradient-to-br ${banner.gradient} opacity-70`} />
              <div className="relative z-10 h-full p-4 flex flex-col justify-end text-white">
                <h4 className="text-lg sm:text-xl font-black mb-1">{banner.title}</h4>
                <p className="text-sm text-white/90">{banner.subtitle}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProfessionalBanners;
