import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { toast } from '@/components/ui/use-toast';
import devLog from '@/lib/devLogger';

export const useCitiesCache = () => {
  const [cities, setCities] = useState([]);
  const [regions, setRegions] = useState([]);
  const [allRegions, setAllRegions] = useState([]); // ✅ جميع المناطق دفعة واحدة
  const [loading, setLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [syncInfo, setSyncInfo] = useState(null);
  const { getTokenForUser } = useAlWaseet();
  const { user } = useAuth();

  // جلب المدن من الجدول الموحد
  const fetchCities = async () => {
    try {
      const { data, error } = await supabase
        .from('cities_master')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setCities(data || []);
      return data || [];
    } catch (error) {
      console.error('❌ خطأ في جلب المدن من cache:', error);
      toast({
        title: "خطأ",
        description: "فشل جلب قائمة المدن",
        variant: "destructive"
      });
      return [];
    }
  };

  // جلب جميع المناطق من الجدول الموحد مع pagination
  const fetchAllRegions = async () => {
    try {
      let allRegions = [];
      let hasMore = true;
      let page = 0;
      const pageSize = 1000;

      devLog.log('🔄 بدء جلب المناطق مع pagination...');

      while (hasMore) {
        const { data, error } = await supabase
          .from('regions_master')
          .select('*')
          .eq('is_active', true)
          .order('name')
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allRegions = [...allRegions, ...data];
          devLog.log(`✅ جلب ${data.length} منطقة (الصفحة ${page + 1})، الإجمالي: ${allRegions.length}`);
        }

        hasMore = data && data.length === pageSize;
        page++;

        // تأخير صغير لتجنب إغراق الـ API
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      devLog.log(`✅ اكتمل جلب جميع المناطق: ${allRegions.length} منطقة`);
      setAllRegions(allRegions); // ✅ حفظ في allRegions state
      return allRegions;
    } catch (error) {
      console.error('❌ خطأ في جلب المناطق من cache:', error);
      return [];
    }
  };

  // جلب المناطق لمدينة معينة من الجدول الموحد
  const fetchRegionsByCity = async (cityId) => {
    try {
      const { data, error } = await supabase
        .from('regions_master')
        .select('*')
        .eq('city_id', cityId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ خطأ في جلب المناطق من cache:', error);
      toast({
        title: "خطأ",
        description: "فشل جلب قائمة المناطق",
        variant: "destructive"
      });
      return [];
    }
  };

  // ✅ فلترة المناطق من الـ cache بدون API calls
  const getRegionsByCity = (alwaseetCityId) => {
    if (!alwaseetCityId) return [];
    return allRegions.filter(r => 
      String(r.city_id) === String(alwaseetCityId)
    );
  };

  // جلب معلومات آخر مزامنة ناجحة - مع دعم فلترة حسب الشريك
  const fetchSyncInfo = async (partnerName = null) => {
    try {
      let syncData;
      
      if (partnerName) {
        // ✅ استخدام RPC الجديد لجلب آخر مزامنة حسب الشريك
        const { data, error } = await supabase.rpc('get_last_successful_cities_regions_sync_by_partner', {
          partner_name: partnerName
        });
        if (error) throw error;
        syncData = Array.isArray(data) ? data[0] : data;
        devLog.log(`🔍 fetchSyncInfo (${partnerName}) نتيجة:`, syncData);
      } else {
        // fallback للـ RPC العام
        const { data, error } = await supabase.rpc('get_last_successful_cities_regions_sync');
        if (error) throw error;
        syncData = Array.isArray(data) ? data[0] : data;
        devLog.log('🔍 fetchSyncInfo (all) نتيجة:', syncData);
      }
      
      setSyncInfo(syncData);
      
      if (syncData?.last_sync_at) {
        setLastUpdated(syncData.last_sync_at);
      }
      
      return syncData;
    } catch (error) {
      console.error('خطأ في جلب معلومات المزامنة:', error);
      return null;
    }
  };

  // 🚀 المزامنة الذكية في الخلفية (بدون timeout)
  const updateCacheBackground = async (partnerName = 'alwaseet') => {
    // ✅ جلب التوكن الصحيح للشريك المحدد
    const tokenData = await getTokenForUser(user?.id, null, partnerName);
    
    if (!tokenData?.token) {
      const partnerNameAr = partnerName === 'modon' ? 'مدن' : 'الوسيط';
      toast({
        title: "تنبيه",
        description: `يجب تسجيل الدخول لـ${partnerNameAr} أولاً`,
        variant: "destructive"
      });
      return false;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const functionName = partnerName === 'modon' ? 'update-modon-cache' : 'update-cities-cache';
      
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { 
          token: tokenData.token,  // ✅ التوكن الصحيح
          user_id: session?.user?.id 
        }
      });

      if (error) throw error;

      if (data?.success) {
        const partnerNameAr = partnerName === 'modon' ? 'مدن' : 'الوسيط';
        toast({
          title: "بدأت المزامنة الذكية",
          description: `جاري تحديث المدن والمناطق من ${partnerNameAr} في الخلفية - ستظهر النتائج تلقائياً`,
          variant: "default"
        });
        
        return { success: true, progress_id: data.progress_id };
      }
      return { success: false };
    } catch (error) {
      console.error('❌ خطأ في بدء المزامنة:', error);
      toast({
        title: "فشل بدء المزامنة", 
        description: error.message,
        variant: "destructive"
      });
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  // تحديث cache من شركة التوصيل (دعم متعدد الشركاء)
  const updateCache = async (partnerName = 'alwaseet') => {
    // ✅ جلب التوكن الصحيح للشريك المحدد
    const tokenData = await getTokenForUser(user?.id, null, partnerName);
    
    if (!tokenData?.token) {
      const partnerNameAr = partnerName === 'modon' ? 'مدن' : 'الوسيط';
      toast({
        title: "تنبيه",
        description: `يجب تسجيل الدخول لـ${partnerNameAr} أولاً`,
        variant: "destructive"
      });
      return false;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      // تحديد Edge Function المناسب حسب الشريك
      const functionName = partnerName === 'modon' ? 'update-modon-cache' : 'update-cities-cache';
      
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { 
          token: tokenData.token,  // ✅ التوكن الصحيح
          user_id: session?.user?.id 
        }
      });

      if (error) throw error;

      if (data?.success) {
        const partnerNameAr = partnerName === 'modon' ? 'مدن' : 'الوسيط';
        toast({
          title: "بدأت المزامنة الذكية",
          description: `جاري تحديث المدن والمناطق من ${partnerNameAr} في الخلفية`,
          variant: "default"
        });
        
        return { success: true, progress_id: data.progress_id };
      }
      return { success: false };
    } catch (error) {
      console.error('❌ خطأ في بدء المزامنة:', error);
      toast({
        title: "فشل بدء المزامنة", 
        description: error.message,
        variant: "destructive"
      });
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  // فحص إذا كان cache فارغ أو قديم
  const isCacheEmpty = () => cities.length === 0;

  // جلب المدن والمناطق عند التحميل الأولي
  useEffect(() => {
    const loadCacheData = async () => {
      setIsLoading(true);
      devLog.log('🔄 بدء تحميل الـ Cache...');
      await fetchCities();
      const loadedRegions = await fetchAllRegions();
      setAllRegions(loadedRegions); // ✅ حفظ جميع المناطق
      await fetchSyncInfo();
      setIsLoaded(true);
      setIsLoading(false);
      devLog.log('✅ اكتمل تحميل الـ Cache');
    };
    loadCacheData();
  }, []);

  return {
    cities,
    regions,
    allRegions, // ✅ جميع المناطق
    loading,
    isLoading,
    isLoaded,
    lastUpdated,
    syncInfo,
    fetchCities,
    fetchRegionsByCity,
    getRegionsByCity, // ✅ فلترة من الـ cache
    fetchAllRegions,
    updateCache,
    updateCacheBackground, // ✅ إضافة دالة المزامنة الخلفية
    fetchSyncInfo,
    isCacheEmpty
  };
};