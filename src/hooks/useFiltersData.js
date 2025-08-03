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

  // جلب البيانات من النظام التوحيدي الموحد
  const fetchFiltersData = async () => {
    try {
      setFiltersData(prev => ({ ...prev, loading: true, error: null }));

      // استخدام database function الموحدة فقط
      const { data: baseData, error: baseError } = await supabase
        .rpc('get_filters_data');

      if (baseError) throw baseError;

      const result = baseData?.[0] || {};
      
      // البيانات المباشرة من database function
      const parsedData = {
        departments: result.departments || [],
        categories: result.categories || [],
        colors: result.colors || [],
        sizes: result.sizes || [],
        productTypes: result.product_types || [],
        seasonsOccasions: result.seasons_occasions || []
      };

      // نظام الصلاحيات الموحد
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

      setFiltersData({
        ...parsedData,
        ...permissionsData,
        loading: false,
        error: null
      });

      console.log('🔍 useFiltersData - تم جلب البيانات بنجاح:', {
        departments: parsedData.departments?.length || 0,
        categories: parsedData.categories?.length || 0,
        colors: parsedData.colors?.length || 0,
        sizes: parsedData.sizes?.length || 0,
        hasFullAccess: permissionsData.hasFullAccess,
        categoriesData: parsedData.categories
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