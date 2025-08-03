import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/UnifiedAuthContext';

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

  // جلب البيانات الأساسية للمرشحات
  const fetchFiltersData = async () => {
    try {
      console.log('🔄 بدء جلب بيانات المرشحات التوحيدية...');
      setFiltersData(prev => ({ ...prev, loading: true, error: null }));

      // محاولة جلب البيانات من database function أولاً
      let { data: baseData, error: baseError } = await supabase
        .rpc('get_filters_data');

      console.log('📊 استجابة get_filters_data:', baseData, baseError);
      
      let parsedData = {};

      // إذا فشلت database function، استخدم الطريقة التقليدية
      if (baseError || !baseData) {
        console.log('⚠️ database function فشلت، استخدام الطريقة التقليدية...');
        
        const [deptRes, catRes, colorRes, sizeRes, typeRes, seasonRes] = await Promise.all([
          supabase.from('departments').select('*').eq('is_active', true).order('display_order'),
          supabase.from('categories').select('*').order('name'),
          supabase.from('colors').select('*').order('name'),
          supabase.from('sizes').select('*').order('display_order'),
          supabase.from('product_types').select('*').order('name'),
          supabase.from('seasons_occasions').select('*').order('name')
        ]);

        parsedData = {
          departments: deptRes.data || [],
          categories: catRes.data || [],
          colors: colorRes.data || [],
          sizes: sizeRes.data || [],
          productTypes: typeRes.data || [],
          seasonsOccasions: seasonRes.data || []
        };
      } else {
        // استخدام بيانات database function
        const result = baseData?.[0] || {};
        parsedData = {
          departments: result.departments || [],
          categories: result.categories || [],
          colors: result.colors || [],
          sizes: result.sizes || [],
          productTypes: result.product_types || [],
          seasonsOccasions: result.seasons_occasions || []
        };
      }

      console.log('📦 البيانات المفكوكة:', parsedData);

      // جلب الصلاحيات إذا مطلوبة
      let permissionsData = {
        allowedDepartments: parsedData.departments,
        allowedCategories: parsedData.categories,
        allowedProducts: [],
        hasFullAccess: true
      };

      if (includePermissions && user?.id && !isAdmin) {
        console.log('🔐 جلب صلاحيات المستخدم:', user.id);
        const { data: userPermissions, error: permError } = await supabase
          .rpc('get_user_allowed_filters', { p_user_id: user.id });

        console.log('👤 صلاحيات المستخدم:', userPermissions, permError);

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

      setFiltersData({
        ...parsedData,
        ...permissionsData,
        loading: false,
        error: null
      });

      console.log('📊 تم جلب بيانات المرشحات التوحيدية بنجاح:', {
        departments: parsedData.departments.length,
        categories: parsedData.categories.length,
        colors: parsedData.colors.length,
        hasFullAccess: permissionsData.hasFullAccess
      });

    } catch (error) {
      console.error('❌ خطأ في جلب بيانات المرشحات:', error);
      setFiltersData(prev => ({
        ...prev,
        loading: false,
        error: error.message
      }));
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