import React from 'react';
import { Link } from 'react-router-dom';
import GradientText from './ui/GradientText';
import { Sparkles } from 'lucide-react';

const BrandBanners = ({ slug }) => {
  const brands = [
    { 
      id: 1, 
      name: 'KIKO', 
      discount: '30%', 
      image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800',
      gradient: 'from-pink-500 to-rose-500'
    },
    { 
      id: 2, 
      name: 'NARS', 
      discount: '45%', 
      image: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800',
      gradient: 'from-purple-500 to-indigo-500'
    },
    { 
      id: 3, 
      name: 'ZARA', 
      discount: '25%', 
      image: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=800',
      gradient: 'from-blue-500 to-cyan-500'
    },
    { 
      id: 4, 
      name: 'H&M', 
      discount: '35%', 
      image: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=800',
      gradient: 'from-orange-500 to-red-500'
    },
  ];

  return (
    <section className="py-12 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <GradientText 
            gradient="from-orange-600 via-red-600 to-pink-600" 
            className="text-3xl md:text-4xl font-black mb-4"
          >
            عروض العلامات التجارية
          </GradientText>
          <p className="text-lg text-muted-foreground">خصومات حصرية على أشهر الماركات</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {brands.map((brand) => (
            <Link
              key={brand.id}
              to={`/storefront/${slug}/products?brand=${brand.name}`}
              className="group relative overflow-hidden rounded-2xl h-64 shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-2"
            >
              {/* Background Image */}
              <img
                src={brand.image}
                alt={brand.name}
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
              />
              
              {/* Gradient Overlay */}
              <div className={`absolute inset-0 bg-gradient-to-br ${brand.gradient} opacity-60`} />

              {/* Content */}
              <div className="relative z-10 p-6 h-full flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <h3 className="text-3xl font-black text-white">
                    {brand.name}
                  </h3>
                  <Sparkles className="w-6 h-6 text-yellow-300 animate-pulse" />
                </div>

                <div className="space-y-2">
                  <div className="inline-block px-4 py-2 bg-white/20 backdrop-blur-sm rounded-xl border-2 border-white/30">
                    <p className="text-sm text-white/90 font-medium">خصم يصل إلى</p>
                    <p className="text-4xl font-black text-white">{brand.discount}</p>
                  </div>
                  <p className="text-white font-bold">تسوق الآن →</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BrandBanners;
