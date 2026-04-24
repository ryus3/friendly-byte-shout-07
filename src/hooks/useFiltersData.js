import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import superAPI from '@/api/SuperAPI';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import devLog from '@/lib/devLogger';

// Cache موحّد لتقليل الاستهلاك وتجنب الازدواج
const FILTERS_CACHE_TTL = 3 * 60 * 1000; // 3 دقائق
const filtersCache = new Map(); // key -> { ts, data, pending }
/**
 * مفتاح الكاش حسب المستخدم وإعدادات الصلاحيات
 */
const getCacheKey = (user, isAdmin, includePermissions) => {
  const uid = isAdmin ? 'admin' : (user?.id || 'anon');
  return `${uid}:${includePermissions ? 'withPerm' : 'noPerm'}`;
};

/**
 * Hook توحيدي لجلب وإدارة بيانات المرشحات
 * يقلل التكرار ويحسن الأداء ويوحد منطق الصلاحيات
 */
export const useFiltersData = (options = {}) => {
  const { includePermissions = true, refreshTrigger = null } = options;
  const { user, isAdmin } = useAuth();
  
  const [filtersData, setFiltersData] = useState({
    // البيانات الأساسية
    departments: [],
    categories: [],
    colors: [],
    sizes: [],
    productTypes: [],
    seasonsOccasions: [],
    
    // البيانات المفلترة حسب الصلاحيات
    allowedDepartments: [],
    allowedCategories: [],
    allowedProducts: [],
    
    // حالة التحميل والأخطاء
    loading: true,
    error: null,
    hasFullAccess: false
  });

  // جلب البيانات من النظام التوحيدي الموحد
  const fetchFiltersData = async () => {
    const cacheKey = getCacheKey(user, isAdmin, includePermissions);
    // استخدام الكاش إن كان صالحاً
    const cached = filtersCache.get(cacheKey);
    const now = Date.now();

    if (cached && cached.data && now - cached.ts < FILTERS_CACHE_TTL) {
      setFiltersData({ ...cached.data, loading: false, error: null });
      return;
    }

    // تجنب الازدواج: مشاركة الطلب الجاري
    if (cached?.pending) {
      try {
        const data = await cached.pending;
        setFiltersData({ ...data, loading: false, error: null });
        return;
      } catch (e) {
        // تجاهل ونستمر بجلب جديد
      }
    }

    // set loading
    setFiltersData(prev => ({ ...prev, loading: true, error: null }));

    const pendingPromise = (async () => {
      // جلب البيانات من SuperAPI لتقليل الطلبات
      const allData = await superAPI.getAllData();

      const parsedData = {
        departments: allData.departments || [],
        categories: allData.categories || [],
        colors: allData.colors || [],
        sizes: allData.sizes || [],
        productTypes: allData.productTypes || [],
        seasonsOccasions: allData.seasons || []
      };

      // الصلاحيات
      let permissionsData = {
        allowedDepartments: parsedData.departments,
        allowedCategories: parsedData.categories,
        allowedProducts: [],
        hasFullAccess: true
      };

      if (includePermissions && user?.id && !isAdmin) {
        const { data: userPermissions, error: permError } = await supabase
          .rpc('get_user_allowed_filters', { p_user_id: user.id });

        if (!permError && userPermissions?.[0]) {
          const userPerms = userPermissions[0];
          permissionsData = {
            allowedDepartments: userPerms.allowed_departments || [],
            allowedCategories: userPerms.allowed_categories || [],
            allowedProducts: userPerms.allowed_products || [],
            hasFullAccess: userPerms.has_full_access || false
          };
        }
      }

      const finalData = {
        ...parsedData,
        ...permissionsData,
        loading: false,
        error: null
      };

      // حفظ في الكاش
      filtersCache.set(cacheKey, { ts: Date.now(), data: finalData, pending: null });
      return finalData;
    })();

    // تسجيل الطلب الجاري ليتشاركه بقية النسخ
    filtersCache.set(cacheKey, { ts: cached?.ts || 0, data: cached?.data || null, pending: pendingPromise });

    try {
      const data = await pendingPromise;
      setFiltersData(data);

      devLog.log('🔍 useFiltersData - تم جلب البيانات بنجاح:', {
        departments: data.departments?.length || 0,
        categories: data.categories?.length || 0,
        colors: data.colors?.length || 0,
        sizes: data.sizes?.length || 0,
        hasFullAccess: data.hasFullAccess,
        categoriesData: data.categories
      });
    } catch (error) {
      console.error('❌ خطأ في جلب بيانات المرشحات:', error);
      setFiltersData(prev => ({ ...prev, loading: false, error: error.message }));
      // تنظيف الطلب الجاري الفاشل
      const curr = filtersCache.get(cacheKey);
      if (curr?.pending) filtersCache.set(cacheKey, { ts: curr.ts, data: curr.data, pending: null });
    }
  };

  // تحديث البيانات عند تغيير المستخدم أو trigger
  useEffect(() => {
    fetchFiltersData();
  }, [user?.id, isAdmin, includePermissions, refreshTrigger]);

  // دوال مساعدة للوصول السريع للبيانات
  const getFilteredData = useMemo(() => {
    const { allowedDepartments, allowedCategories, hasFullAccess } = filtersData;
    
    return {
      // الأقسام المسموحة
      allowedDepartmentIds: hasFullAccess 
        ? filtersData.departments.map(d => d.id)
        : allowedDepartments.map(d => d.id),
      
      allowedDepartmentNames: hasFullAccess 
        ? filtersData.departments.map(d => d.name)
        : allowedDepartments.map(d => d.name),

      // التصنيفات المسموحة  
      allowedCategoryIds: hasFullAccess 
        ? filtersData.categories.map(c => c.id)
        : allowedCategories.map(c => c.id),
        
      allowedCategoryNames: hasFullAccess 
        ? filtersData.categories.map(c => c.name)
        : allowedCategories.map(c => c.name),

      // فحص الصلاحيات
      canAccessDepartment: (departmentId) => {
        if (hasFullAccess) return true;
        return allowedDepartments.some(d => d.id === departmentId);
      },

      canAccessCategory: (categoryId) => {
        if (hasFullAccess) return true;
        return allowedCategories.some(c => c.id === categoryId);
      },

      // البحث السريع
      findDepartmentByName: (name) => 
        filtersData.departments.find(d => d.name === name),
        
      findCategoryByName: (name) => 
        filtersData.categories.find(c => c.name === name),
        
      findColorByName: (name) => 
        filtersData.colors.find(c => c.name === name),
        
      findSizeByName: (name) => 
        filtersData.sizes.find(s => s.name === name)
    };
  }, [filtersData]);

  // دالة إعادة تحميل البيانات
  const refreshFiltersData = () => {
    const cacheKey = getCacheKey(user, isAdmin, includePermissions);
    filtersCache.delete(cacheKey);
    fetchFiltersData();
  };

  return {
    // البيانات الأساسية
    departments: filtersData.departments,
    categories: filtersData.categories,
    colors: filtersData.colors,
    sizes: filtersData.sizes,
    productTypes: filtersData.productTypes,
    seasonsOccasions: filtersData.seasonsOccasions,
    
    // البيانات المفلترة حسب الصلاحيات
    allowedDepartments: filtersData.allowedDepartments,
    allowedCategories: filtersData.allowedCategories,
    allowedProducts: filtersData.allowedProducts,
    
    // حالة التحميل
    loading: filtersData.loading,
    error: filtersData.error,
    hasFullAccess: filtersData.hasFullAccess,
    
    // دوال مساعدة
    ...getFilteredData,
    refreshFiltersData
  };
};

export default useFiltersData;