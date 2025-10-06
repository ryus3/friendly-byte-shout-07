import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { toast } from '@/components/ui/use-toast';

export const useCitiesCache = () => {
  const [cities, setCities] = useState([]);
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [syncInfo, setSyncInfo] = useState(null);
  const { token } = useAlWaseet();

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

      console.log('🔄 بدء جلب المناطق مع pagination...');

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
          console.log(`✅ جلب ${data.length} منطقة (الصفحة ${page + 1})، الإجمالي: ${allRegions.length}`);
        }

        hasMore = data && data.length === pageSize;
        page++;

        // تأخير صغير لتجنب إغراق الـ API
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      console.log(`✅ اكتمل جلب جميع المناطق: ${allRegions.length} منطقة`);
      setRegions(allRegions);
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

  // جلب معلومات آخر مزامنة ناجحة فقط
  const fetchSyncInfo = async () => {
    try {
      const { data, error } = await supabase.rpc('get_last_successful_cities_regions_sync');
      if (error) throw error;
      
      console.log('🔍 fetchSyncInfo (successful only) نتيجة:', data);
      
      // Handle array response from RPC function
      const syncData = Array.isArray(data) ? data[0] : data;
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
  const updateCacheBackground = async () => {
    if (!token) {
      toast({
        title: "تنبيه",
        description: "يجب تسجيل الدخول لشركة التوصيل أولاً",
        variant: "destructive"
      });
      return false;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const { data, error } = await supabase.functions.invoke('update-cities-cache', {
        body: { 
          token,
          user_id: session?.user?.id 
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "بدأت المزامنة الذكية",
          description: "جاري تحديث المدن والمناطق في الخلفية - ستظهر النتائج تلقائياً",
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

  // تحديث cache من شركة التوصيل (الطريقة التقليدية)
  const updateCache = async () => {
    // استخدام المزامنة الذكية بدلاً من الطريقة التقليدية
    return await updateCacheBackground();
  };

  // فحص إذا كان cache فارغ أو قديم
  const isCacheEmpty = () => cities.length === 0;

  // جلب المدن والمناطق عند التحميل الأولي
  useEffect(() => {
    const loadCacheData = async () => {
      await fetchCities();
      await fetchAllRegions();
      await fetchSyncInfo();
    };
    loadCacheData();
  }, []);

  return {
    cities,
    regions,
    loading,
    lastUpdated,
    syncInfo,
    fetchCities,
    fetchRegionsByCity,
    fetchAllRegions,
    updateCache,
    fetchSyncInfo,
    isCacheEmpty
  };
};