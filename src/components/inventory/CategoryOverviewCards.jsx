import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { 
  Package, 
  Shirt, 
  Footprints, 
  Wrench, 
  Home, 
  Car, 
  Heart, 
  Gift,
  Sparkles,
  Sun,
  Snowflake,
  Calendar,
  Tag,
  Layers,
  Grid3X3
} from 'lucide-react';
import Loader from '@/components/ui/loader';

const CategoryOverviewCards = ({ onFilterChange, currentFilter }) => {
  const [data, setData] = useState({
    departments: [],
    categories: [],
    productTypes: [],
    seasonsOccasions: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const [departmentsRes, categoriesRes, productTypesRes, seasonsRes] = await Promise.all([
        supabase.from('departments').select('*').eq('is_active', true).order('name'),
        supabase.from('categories').select('*').order('name'),
        supabase.from('product_types').select('*').order('name'),
        supabase.from('seasons_occasions').select('*').order('name')
      ]);

      setData({
        departments: departmentsRes.data || [],
        categories: categoriesRes.data || [],
        productTypes: productTypesRes.data || [],
        seasonsOccasions: seasonsRes.data || []
      });
    } catch (error) {
      console.error('خطأ في جلب البيانات:', error);
    } finally {
      setLoading(false);
    }
  };

  const getIconForDepartment = (name) => {
    const iconMap = {
      'ملابس': Shirt,
      'أحذية': Footprints,
      'أدوات': Wrench,
      'منزلية': Home,
      'سيارات': Car,
      'تجميل': Heart,
      'هدايا': Gift
    };
    return iconMap[name] || Package;
  };

  const getIconForCategory = (name) => {
    const iconMap = {
      'رجالي': Shirt,
      'نسائي': Heart,
      'أطفال': Gift,
      'رياضي': Footprints,
      'كاجوال': Shirt,
      'رسمي': Sparkles
    };
    return iconMap[name] || Tag;
  };

  const getIconForType = (name) => {
    return Layers;
  };

  const getIconForSeason = (name, type) => {
    if (type === 'season') {
      const seasonMap = {
        'صيف': Sun,
        'شتاء': Snowflake,
        'ربيع': Sparkles,
        'خريف': Calendar
      };
      return seasonMap[name] || Sun;
    }
    return Calendar;
  };

  const getGradientForIndex = (index, type) => {
    const gradients = {
      department: [
        'from-blue-500/20 to-cyan-500/20',
        'from-purple-500/20 to-pink-500/20', 
        'from-green-500/20 to-emerald-500/20',
        'from-orange-500/20 to-red-500/20',
        'from-indigo-500/20 to-purple-500/20',
        'from-teal-500/20 to-blue-500/20'
      ],
      category: [
        'from-rose-500/20 to-pink-500/20',
        'from-violet-500/20 to-purple-500/20',
        'from-sky-500/20 to-blue-500/20',
        'from-emerald-500/20 to-teal-500/20',
        'from-amber-500/20 to-orange-500/20',
        'from-lime-500/20 to-green-500/20'
      ],
      productType: [
        'from-slate-500/20 to-gray-500/20',
        'from-zinc-500/20 to-neutral-500/20',
        'from-stone-500/20 to-gray-500/20'
      ],
      season: [
        'from-yellow-500/20 to-orange-500/20',
        'from-blue-500/20 to-indigo-500/20',
        'from-green-500/20 to-lime-500/20',
        'from-red-500/20 to-pink-500/20'
      ]
    };
    
    return gradients[type][index % gradients[type].length];
  };

  const handleCardClick = (filterType, filterId, filterName) => {
    const newFilter = {
      type: filterType,
      id: filterId,
      name: filterName
    };
    
    // إذا كان نفس الفلتر المحدد، قم بإلغاء التحديد
    if (currentFilter && 
        currentFilter.type === filterType && 
        currentFilter.id === filterId) {
      onFilterChange(null);
    } else {
      onFilterChange(newFilter);
    }
  };

  const isSelected = (type, id) => {
    return currentFilter && currentFilter.type === type && currentFilter.id === id;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {/* كروت الأقسام */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-foreground">الأقسام الرئيسية</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-16 bg-card rounded-lg border animate-pulse" />
            ))}
          </div>
        </div>

        {/* كروت التصنيفات */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-foreground">التصنيفات</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-12 bg-card rounded-lg border animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* عرض الفلتر النشط */}
      {currentFilter && (
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-primary rounded-full"></div>
            <span className="text-sm font-medium">
              فلترة حسب: <span className="text-primary">{currentFilter.name}</span>
            </span>
          </div>
          <button
            onClick={() => onFilterChange(null)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            إلغاء الفلترة
          </button>
        </div>
      )}

      {/* كروت الأقسام الرئيسية */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Grid3X3 className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">الأقسام الرئيسية</h3>
          <span className="text-sm text-muted-foreground">({data.departments.length})</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {data.departments.map((dept, index) => {
            const Icon = getIconForDepartment(dept.name);
            const isActive = isSelected('department', dept.id);
            
            return (
              <div
                key={dept.id}
                onClick={() => handleCardClick('department', dept.id, dept.name)}
                className={`
                  relative overflow-hidden rounded-lg border transition-all duration-200 cursor-pointer
                  ${isActive 
                    ? 'border-primary bg-primary/10 shadow-md transform scale-105' 
                    : 'border-border bg-card hover:border-primary/50 hover:shadow-sm'
                  }
                `}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${getGradientForIndex(index, 'department')}`} />
                <div className="relative p-4 flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-white/50 dark:bg-black/20">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-primary/70 bg-primary/10 px-2 py-1 rounded">
                        {index + 1}
                      </span>
                      <h4 className="font-semibold text-foreground truncate">{dept.name}</h4>
                    </div>
                    {dept.description && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">{dept.description}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* كروت التصنيفات */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Tag className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">التصنيفات</h3>
          <span className="text-sm text-muted-foreground">({data.categories.length})</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
          {data.categories.map((category, index) => {
            const Icon = getIconForCategory(category.name);
            const isActive = isSelected('category', category.id);
            
            return (
              <div
                key={category.id}
                onClick={() => handleCardClick('category', category.id, category.name)}
                className={`
                  relative overflow-hidden rounded-lg border transition-all duration-200 cursor-pointer
                  ${isActive 
                    ? 'border-primary bg-primary/10 shadow-md transform scale-105' 
                    : 'border-border bg-card hover:border-primary/50 hover:shadow-sm'
                  }
                `}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${getGradientForIndex(index, 'category')}`} />
                <div className="relative p-3 flex items-center gap-2">
                  <Icon className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="text-sm font-medium text-foreground truncate">{category.name}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* كروت أنواع المنتجات */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">أنواع المنتجات</h3>
          <span className="text-sm text-muted-foreground">({data.productTypes.length})</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
          {data.productTypes.map((type, index) => {
            const Icon = getIconForType(type.name);
            const isActive = isSelected('product_type', type.id);
            
            return (
              <div
                key={type.id}
                onClick={() => handleCardClick('product_type', type.id, type.name)}
                className={`
                  relative overflow-hidden rounded-lg border transition-all duration-200 cursor-pointer
                  ${isActive 
                    ? 'border-primary bg-primary/10 shadow-md transform scale-105' 
                    : 'border-border bg-card hover:border-primary/50 hover:shadow-sm'
                  }
                `}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${getGradientForIndex(index, 'productType')}`} />
                <div className="relative p-3 flex items-center gap-2">
                  <Icon className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="text-sm font-medium text-foreground truncate">{type.name}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* كروت المواسم والمناسبات */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">المواسم والمناسبات</h3>
          <span className="text-sm text-muted-foreground">({data.seasonsOccasions.length})</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
          {data.seasonsOccasions.map((season, index) => {
            const Icon = getIconForSeason(season.name, season.type);
            const isActive = isSelected('season_occasion', season.id);
            
            return (
              <div
                key={season.id}
                onClick={() => handleCardClick('season_occasion', season.id, season.name)}
                className={`
                  relative overflow-hidden rounded-lg border transition-all duration-200 cursor-pointer
                  ${isActive 
                    ? 'border-primary bg-primary/10 shadow-md transform scale-105' 
                    : 'border-border bg-card hover:border-primary/50 hover:shadow-sm'
                  }
                `}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${getGradientForIndex(index, 'season')}`} />
                <div className="relative p-3 flex items-center gap-2">
                  <Icon className="w-4 h-4 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-foreground truncate block">{season.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {season.type === 'season' ? 'موسم' : 'مناسبة'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CategoryOverviewCards;