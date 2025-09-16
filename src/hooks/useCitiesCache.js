import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { toast } from '@/components/ui/use-toast';

export const useCitiesCache = () => {
  const [cities, setCities] = useState([]);
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const { token } = useAlWaseet();

  // جلب المدن من cache
  const fetchCities = async () => {
    try {
      const { data, error } = await supabase
        .from('cities_cache')
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

  // جلب المناطق لمدينة معينة من cache
  const fetchRegionsByCity = async (cityId) => {
    try {
      const { data, error } = await supabase
        .from('regions_cache')
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
      const { data, error } = await supabase.functions.invoke('update-cities-cache', {
        body: { token }
      });

      if (error) throw error;

      toast({
        title: "تم التحديث بنجاح",
        description: data.message || "تم تحديث cache المدن والمناطق",
      });

      setLastUpdated(new Date());
      await fetchCities();
      return true;
    } catch (error) {
      console.error('❌ خطأ في تحديث cache:', error);
      toast({
        title: "خطأ في التحديث",
        description: error.message || "فشل تحديث cache المدن والمناطق",
        variant: "destructive"
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  // فحص إذا كان cache فارغ أو قديم
  const isCacheEmpty = () => cities.length === 0;

  // جلب المدن عند التحميل الأول
  useEffect(() => {
    fetchCities();
  }, []);

  return {
    cities,
    regions,
    loading,
    lastUpdated,
    fetchCities,
    fetchRegionsByCity,
    updateCache,
    isCacheEmpty
  };
};