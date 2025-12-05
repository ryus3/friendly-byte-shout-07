import React from 'react';
import { Link } from 'react-router-dom';

const categories = [
  { 
    id: 'men', 
    name: 'رجال', 
    image: 'https://images.unsplash.com/photo-1617137968427-85924c800a22?w=400&q=80',
    gradient: 'from-blue-600 to-cyan-500'
  },
  { 
    id: 'women', 
    name: 'نساء', 
    image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=400&q=80',
    gradient: 'from-pink-600 to-rose-500'
  },
  { 
    id: 'kids', 
    name: 'أطفال', 
    image: 'https://images.unsplash.com/photo-1622290291468-a28f7a7dc6a8?w=400&q=80',
    gradient: 'from-yellow-500 to-orange-500'
  },
  { 
    id: 'sports', 
    name: 'رياضة', 
    image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&q=80',
    gradient: 'from-green-600 to-emerald-500'
  },
  { 
    id: 'accessories', 
    name: 'إكسسوارات', 
    image: 'https://images.unsplash.com/photo-1611923134239-b9be5816e23d?w=400&q=80',
    gradient: 'from-purple-600 to-violet-500'
  },
  { 
    id: 'shoes', 
    name: 'أحذية', 
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80',
    gradient: 'from-red-600 to-orange-500'
  },
  { 
    id: 'bags', 
    name: 'حقائب', 
    image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400&q=80',
    gradient: 'from-amber-600 to-yellow-500'
  },
  { 
    id: 'watches', 
    name: 'ساعات', 
    image: 'https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=400&q=80',
    gradient: 'from-slate-600 to-gray-500'
  },
];

const ProfessionalCategories = ({ slug }) => {
  return (
    <section className="py-8 bg-background">
      <div className="container mx-auto px-4">
        {/* العنوان */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl sm:text-2xl font-black">
            تسوق حسب الفئة
          </h2>
          <Link 
            to={`/storefront/${slug}/products`}
            className="text-sm font-medium text-pink-600 hover:text-pink-700 flex items-center gap-1"
          >
            عرض الكل
            <span>←</span>
          </Link>
        </div>

        {/* شبكة الفئات */}
        <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-8 gap-3 sm:gap-4">
          {categories.map((category) => (
            <Link
              key={category.id}
              to={`/storefront/${slug}/products?category=${category.name}`}
              className="group flex flex-col items-center"
            >
              {/* الصورة الدائرية */}
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 mb-2">
                <div className={`absolute inset-0 rounded-full bg-gradient-to-br ${category.gradient} opacity-20 group-hover:opacity-40 transition-opacity`} />
                <div className="absolute inset-1 rounded-full overflow-hidden bg-muted">
                  <img 
                    src={category.image} 
                    alt={category.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                </div>
                {/* حدود متدرجة */}
                <div className={`absolute inset-0 rounded-full border-2 border-transparent bg-gradient-to-br ${category.gradient} opacity-0 group-hover:opacity-100 transition-opacity`} style={{ WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)', WebkitMaskComposite: 'xor', maskComposite: 'exclude', padding: '2px' }} />
              </div>
              
              {/* الاسم */}
              <span className="text-xs sm:text-sm font-medium text-center group-hover:text-pink-600 transition-colors">
                {category.name}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProfessionalCategories;
