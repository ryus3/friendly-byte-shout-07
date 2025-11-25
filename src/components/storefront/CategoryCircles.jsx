import React from 'react';
import { Link } from 'react-router-dom';
import GradientText from './ui/GradientText';

const CategoryCircles = ({ slug }) => {
  const categories = [
    { id: 1, name: 'الرجال', icon: '👔', gradient: 'from-blue-500 to-cyan-500' },
    { id: 2, name: 'النساء', icon: '👗', gradient: 'from-pink-500 to-purple-500' },
    { id: 3, name: 'الأطفال', icon: '🧸', gradient: 'from-yellow-500 to-orange-500' },
    { id: 4, name: 'الرياضة', icon: '⚽', gradient: 'from-green-500 to-emerald-500' },
    { id: 5, name: 'الإكسسوارات', icon: '👜', gradient: 'from-purple-500 to-pink-500' },
    { id: 6, name: 'الأحذية', icon: '👟', gradient: 'from-red-500 to-orange-500' },
  ];

  return (
    <section className="py-12 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <GradientText 
            gradient="from-purple-600 via-pink-600 to-blue-600" 
            className="text-3xl md:text-4xl font-black mb-4"
          >
            تسوق حسب الفئة
          </GradientText>
          <p className="text-lg text-muted-foreground">اكتشف جميع الأقسام المتاحة</p>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4 sm:gap-6 md:gap-8">
          {categories.map((category) => (
            <Link
              key={category.id}
              to={`/storefront/${slug}/products?category=${category.name}`}
              className="group flex flex-col items-center"
            >
              <div className={`
                w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-32
                rounded-full 
                bg-gradient-to-br ${category.gradient}
                flex items-center justify-center
                shadow-xl
                group-hover:scale-110 group-hover:shadow-2xl
                transition-all duration-300
                border-4 border-white dark:border-gray-800
              `}>
                <span className="text-3xl sm:text-4xl md:text-5xl">{category.icon}</span>
              </div>
              <p className="mt-3 font-bold text-sm sm:text-base text-center group-hover:text-purple-600 transition-colors">
                {category.name}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CategoryCircles;
