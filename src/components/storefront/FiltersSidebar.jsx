import React from 'react';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { X } from 'lucide-react';
import GradientText from './ui/GradientText';
import GradientButton from './ui/GradientButton';

const FiltersSidebar = ({ 
  filters, 
  updateFilters, 
  resetFilters,
  categories = [],
  departments = [],
  colors = [],
  sizes = []
}) => {
  return (
    <aside className="w-80 h-fit bg-gradient-to-b from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 p-6 rounded-3xl shadow-xl sticky top-8">
      <div className="flex items-center justify-between mb-6">
        <GradientText gradient="from-blue-600 to-purple-600" size="2xl" className="font-black">
          الفلاتر
        </GradientText>
        <button
          onClick={resetFilters}
          className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full text-red-500 transition-all"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Price Range */}
      <div className="mb-8">
        <GradientText gradient="from-blue-600 to-purple-600" size="lg" className="mb-4 font-bold">
          السعر
        </GradientText>
        <div className="space-y-4">
          <Slider
            min={0}
            max={1000000}
            step={10000}
            value={[filters.minPrice, filters.maxPrice]}
            onValueChange={([min, max]) => updateFilters({ minPrice: min, maxPrice: max })}
            className="[&_[role=slider]]:bg-gradient-to-r [&_[role=slider]]:from-blue-500 [&_[role=slider]]:to-purple-500 [&_[role=slider]]:border-0 [&_[role=slider]]:shadow-lg [&_[role=slider]]:shadow-purple-500/50"
          />
          <div className="flex justify-between text-sm">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 font-bold">
              {filters.minPrice.toLocaleString('ar-IQ')} IQD
            </span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 font-bold">
              {filters.maxPrice.toLocaleString('ar-IQ')} IQD
            </span>
          </div>
        </div>
      </div>

      {/* Categories */}
      {categories.length > 0 && (
        <div className="mb-8">
          <GradientText gradient="from-pink-600 to-red-600" size="lg" className="mb-4 font-bold">
            الفئات
          </GradientText>
          <div className="space-y-2">
            {categories.map((cat) => (
              <label
                key={cat.id}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 dark:hover:from-purple-900/20 dark:hover:to-pink-900/20 cursor-pointer group transition-all"
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={filters.category === cat.id}
                    onCheckedChange={(checked) => updateFilters({ category: checked ? cat.id : null })}
                    className="group-hover:border-purple-500"
                  />
                  <span className="group-hover:text-purple-600 dark:group-hover:text-purple-400 font-medium transition-colors">
                    {cat.name}
                  </span>
                </div>
                <span className="px-2 py-1 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 rounded-full text-xs font-semibold">
                  {cat.count || 0}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Departments */}
      {departments.length > 0 && (
        <div className="mb-8">
          <GradientText gradient="from-emerald-600 to-teal-600" size="lg" className="mb-4 font-bold">
            الأقسام
          </GradientText>
          <div className="space-y-2">
            {departments.map((dept) => (
              <label
                key={dept.id}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-gradient-to-r hover:from-emerald-50 hover:to-teal-50 dark:hover:from-emerald-900/20 dark:hover:to-teal-900/20 cursor-pointer group transition-all"
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={filters.department === dept.id}
                    onCheckedChange={(checked) => updateFilters({ department: checked ? dept.id : null })}
                    className="group-hover:border-emerald-500"
                  />
                  <span className="group-hover:text-emerald-600 dark:group-hover:text-emerald-400 font-medium transition-colors">
                    {dept.name}
                  </span>
                </div>
                <span className="px-2 py-1 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 rounded-full text-xs font-semibold">
                  {dept.count || 0}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Colors */}
      {colors.length > 0 && (
        <div className="mb-8">
          <GradientText gradient="from-orange-600 to-yellow-600" size="lg" className="mb-4 font-bold">
            الألوان
          </GradientText>
          <div className="grid grid-cols-6 gap-3">
            {colors.map((color) => (
              <button
                key={color}
                onClick={() => {
                  const newColors = filters.colors.includes(color)
                    ? filters.colors.filter(c => c !== color)
                    : [...filters.colors, color];
                  updateFilters({ colors: newColors });
                }}
                className={`w-10 h-10 rounded-full border-4 transition-all hover:scale-125 ${
                  filters.colors.includes(color)
                    ? 'border-purple-500 scale-110 shadow-lg shadow-purple-500/50'
                    : 'border-transparent hover:border-purple-300'
                }`}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
        </div>
      )}

      {/* Sizes */}
      {sizes.length > 0 && (
        <div className="mb-8">
          <GradientText gradient="from-purple-600 to-pink-600" size="lg" className="mb-4 font-bold">
            المقاسات
          </GradientText>
          <div className="grid grid-cols-4 gap-2">
            {sizes.map((size) => (
              <button
                key={size}
                onClick={() => {
                  const newSizes = filters.sizes.includes(size)
                    ? filters.sizes.filter(s => s !== size)
                    : [...filters.sizes, size];
                  updateFilters({ sizes: newSizes });
                }}
                className={`p-3 rounded-xl border-2 font-bold transition-all ${
                  filters.sizes.includes(size)
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white border-purple-600 shadow-lg shadow-purple-500/50 scale-105'
                    : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20'
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Apply Button */}
      <GradientButton
        gradient="from-blue-600 via-purple-600 to-pink-600"
        hoverGradient="from-blue-700 via-purple-700 to-pink-700"
        shadowColor="purple-500"
        className="w-full"
      >
        تطبيق الفلاتر
      </GradientButton>
    </aside>
  );
};

export default FiltersSidebar;
