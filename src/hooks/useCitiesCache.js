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

  // جلب جميع المناطق من الجدول الموحد
  const fetchAllRegions = async () => {
    try {
      const { data, error } = await supabase
        .from('regions_master')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setRegions(data || []);
      return data || [];
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

  // جلب معلومات آخر مزامنة
  const fetchSyncInfo = async () => {
    try {
      const { data, error } = await supabase.rpc('get_last_cities_regions_sync');
      if (error) throw error;
      
      console.log('🔍 fetchSyncInfo نتيجة:', data);
      
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

  // تحديث cache من شركة التوصيل
  const updateCache = async () => {
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

      const success = data?.success;
      if (success) {
        // تحديث معلومات المزامنة أولاً
        await fetchSyncInfo();
        
        // ثم تحديث قائمة المدن والمناطق
        await fetchCities();
        await fetchAllRegions();
        
        toast({
          title: "نجح التحديث",
          description: data.message || "تم تحديث cache المدن والمناطق بنجاح",
          variant: "default"
        });
        
        return {
          success: true,
          cities_updated: data.cities_updated || 0,
          regions_updated: data.regions_updated || 0,
          duration_seconds: data.duration_seconds || 0,
          timestamp: data.timestamp
        };
      }
      return { success: false };
    } catch (error) {
      console.error('❌ خطأ في تحديث cache:', error);
      toast({
        title: "فشل التحديث", 
        description: error.message || "حدث خطأ أثناء تحديث cache المدن والمناطق",
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