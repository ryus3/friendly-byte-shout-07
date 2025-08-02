import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/customSupabaseClient';
import { useFilteredProducts } from '@/hooks/useFilteredProducts';
import { 
  Package, 
  Shirt, 
  ShoppingBag, 
  Palette, 
  Tag,
  Crown,
  Star,
  TrendingUp
} from 'lucide-react';

const CategoryFilterCards = ({ onFilterChange, currentFilters = {} }) => {
  const [departments, setDepartments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [productTypes, setProductTypes] = useState([]);
  const [seasonsOccasions, setSeasonsOccasions] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState(null);
  const [loading, setLoading] = useState(true);

  // جلب البيانات من قاعدة البيانات
  useEffect(() => {
    fetchFilterData();
  }, []);

  const fetchFilterData = async () => {
    try {
      setLoading(true);

      const [deptResponse, catResponse, typeResponse, seasonResponse] = await Promise.all([
        supabase.from('departments').select('*').eq('is_active', true).order('name'),
        supabase.from('categories').select('*').eq('is_active', true).order('name'),
        supabase.from('product_types').select('*').eq('is_active', true).order('name'),
        supabase.from('seasons_occasions').select('*').eq('is_active', true).order('name')
      ]);

      if (deptResponse.data) setDepartments(deptResponse.data);
      if (catResponse.data) setCategories(catResponse.data);
      if (typeResponse.data) setProductTypes(typeResponse.data);
      if (seasonResponse.data) setSeasonsOccasions(seasonResponse.data);

    } catch (error) {
      console.error('خطأ في جلب بيانات الفلاتر:', error);
    } finally {
      setLoading(false);
    }
  };

  // أيقونات للأقسام المختلفة
  const getIconForDepartment = (name) => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('ملابس') || lowerName.includes('clothes')) return Shirt;
    if (lowerName.includes('حقائب') || lowerName.includes('bag')) return ShoppingBag;
    if (lowerName.includes('أحذية') || lowerName.includes('shoes')) return Package;
    if (lowerName.includes('إكسسوار') || lowerName.includes('accessories')) return Crown;
    return Package;
  };

  const getIconForCategory = (name) => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('فاخر') || lowerName.includes('luxury')) return Crown;
    if (lowerName.includes('شائع') || lowerName.includes('popular')) return TrendingUp;
    if (lowerName.includes('مميز') || lowerName.includes('special')) return Star;
    return Tag;
  };

  // ألوان متدرجة للكروت
  const getGradientForIndex = (index, type) => {
    const gradients = {
      department: [
        'from-blue-500 to-blue-700',
        'from-purple-500 to-purple-700', 
        'from-pink-500 to-pink-700',
        'from-indigo-500 to-indigo-700',
        'from-cyan-500 to-cyan-700'
      ],
      category: [
        'from-emerald-500 to-emerald-700',
        'from-teal-500 to-teal-700',
        'from-green-500 to-green-700',
        'from-lime-500 to-lime-700',
        'from-cyan-500 to-cyan-700'
      ],
      type: [
        'from-orange-500 to-orange-700',
        'from-amber-500 to-amber-700',
        'from-yellow-500 to-yellow-700',
        'from-red-500 to-red-700',
        'from-rose-500 to-rose-700'
      ],
      season: [
        'from-violet-500 to-violet-700',
        'from-fuchsia-500 to-fuchsia-700',
        'from-purple-500 to-purple-700',
        'from-indigo-500 to-indigo-700',
        'from-blue-500 to-blue-700'
      ]
    };
    
    return gradients[type][index % gradients[type].length];
  };

  const handleFilterClick = (filterType, filterId, filterName) => {
    const newFilter = { type: filterType, id: filterId, name: filterName };
    setSelectedFilter(newFilter);
    onFilterChange(newFilter);
  };

  const clearFilter = () => {
    setSelectedFilter(null);
    onFilterChange(null);
  };

  return (
    <div className="space-y-8 mb-8">
      {/* عنوان القسم */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          🎯 فلترة المنتجات بالأقسام والتصنيفات
        </h2>
        <p className="text-muted-foreground">اختر قسم أو تصنيف لعرض المنتجات المتعلقة به</p>
      </div>

      {/* الفلتر المحدد */}
      {selectedFilter && (
        <div className="flex items-center justify-center gap-3 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-xl border border-blue-200 dark:border-blue-800">
          <Badge variant="secondary" className="text-sm font-medium">
            🔍 الفلتر النشط: {selectedFilter.name}
          </Badge>
          <button
            onClick={clearFilter}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium underline"
          >
            إزالة الفلتر
          </button>
        </div>
      )}

      {/* كروت الأقسام */}
      <div className="space-y-6">
        <div className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            الأقسام الرئيسية
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {departments.map((dept, index) => {
              const IconComponent = getIconForDepartment(dept.name);
              const isSelected = selectedFilter?.type === 'department' && selectedFilter.id === dept.id;
              
              return (
                <Card 
                  key={dept.id}
                  className={`cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl ${
                    isSelected ? 'ring-2 ring-blue-500 shadow-lg' : ''
                  }`}
                  onClick={() => handleFilterClick('department', dept.id, dept.name)}
                >
                  <CardContent className="p-6">
                    <div className={`text-center space-y-3 bg-gradient-to-br ${getGradientForIndex(index, 'department')} text-white rounded-lg p-4`}>
                      <div className="flex justify-center">
                        <IconComponent className="w-8 h-8" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm">{dept.name}</h4>
                        {dept.description && (
                          <p className="text-xs opacity-90 mt-1">{dept.description}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* كروت التصنيفات */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Tag className="w-5 h-5 text-emerald-600" />
            التصنيفات
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {categories.map((cat, index) => {
              const IconComponent = getIconForCategory(cat.name);
              const isSelected = selectedFilter?.type === 'category' && selectedFilter.id === cat.id;
              
              return (
                <Card 
                  key={cat.id}
                  className={`cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl ${
                    isSelected ? 'ring-2 ring-emerald-500 shadow-lg' : ''
                  }`}
                  onClick={() => handleFilterClick('category', cat.id, cat.name)}
                >
                  <CardContent className="p-4">
                    <div className={`text-center space-y-2 bg-gradient-to-br ${getGradientForIndex(index, 'category')} text-white rounded-lg p-3`}>
                      <div className="flex justify-center">
                        <IconComponent className="w-6 h-6" />
                      </div>
                      <h4 className="font-semibold text-xs">{cat.name}</h4>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* كروت أنواع المنتجات */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Palette className="w-5 h-5 text-orange-600" />
            أنواع المنتجات
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-7 gap-3">
            {productTypes.map((type, index) => {
              const isSelected = selectedFilter?.type === 'product_type' && selectedFilter.id === type.id;
              
              return (
                <Card 
                  key={type.id}
                  className={`cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-lg ${
                    isSelected ? 'ring-2 ring-orange-500 shadow-lg' : ''
                  }`}
                  onClick={() => handleFilterClick('product_type', type.id, type.name)}
                >
                  <CardContent className="p-3">
                    <div className={`text-center bg-gradient-to-br ${getGradientForIndex(index, 'type')} text-white rounded-lg p-2`}>
                      <h4 className="font-medium text-xs">{type.name}</h4>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* كروت المواسم والمناسبات */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Star className="w-5 h-5 text-violet-600" />
            المواسم والمناسبات
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {seasonsOccasions.map((season, index) => {
              const isSelected = selectedFilter?.type === 'season_occasion' && selectedFilter.id === season.id;
              
              return (
                <Card 
                  key={season.id}
                  className={`cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl ${
                    isSelected ? 'ring-2 ring-violet-500 shadow-lg' : ''
                  }`}
                  onClick={() => handleFilterClick('season_occasion', season.id, season.name)}
                >
                  <CardContent className="p-4">
                    <div className={`text-center space-y-2 bg-gradient-to-br ${getGradientForIndex(index, 'season')} text-white rounded-lg p-3`}>
                      <div className="text-lg">🎭</div>
                      <h4 className="font-semibold text-xs">{season.name}</h4>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CategoryFilterCards;