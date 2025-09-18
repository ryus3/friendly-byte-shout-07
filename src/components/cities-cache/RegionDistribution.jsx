import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const RegionDistribution = ({ cities }) => {
  const [citiesWithRegions, setCitiesWithRegions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchRegionCounts = async () => {
      if (!cities || cities.length === 0) return;
      
      setLoading(true);
      try {
        // جلب عدد المناطق لكل مدينة مباشرة من قاعدة البيانات
        const { data, error } = await supabase
          .from('cities_cache')
          .select(`
            id,
            name,
            regions_cache!inner(count)
          `)
          .eq('is_active', true)
          .eq('regions_cache.is_active', true)
          .order('name');

        if (error) {
          console.error('خطأ في جلب توزيع المناطق:', error);
          return;
        }

        // معالجة البيانات لإحصاء المناطق لجميع المدن
        const cityRegionCounts = await Promise.all(
          cities.map(async (city) => {
            const { count, error } = await supabase
              .from('regions_cache')
              .select('*', { count: 'exact', head: true })
              .eq('city_id', city.alwaseet_id)
              .eq('is_active', true);

            if (error) {
              console.error(`خطأ في عد مناطق المدينة ${city.name}:`, error);
              return { ...city, regionCount: 0 };
            }

            return { ...city, regionCount: count || 0 };
          })
        );

        setCitiesWithRegions(cityRegionCounts);
      } catch (error) {
        console.error('خطأ في جلب توزيع المناطق:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRegionCounts();
  }, [cities]);

  if (loading) {
    return (
      <div className="mt-4 p-4 bg-secondary/30 rounded-lg">
        <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          جاري تحميل توزيع المناطق...
        </h4>
      </div>
    );
  }

  return (
    <div className="mt-4 p-4 bg-secondary/30 rounded-lg">
      <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
        <MapPin className="h-4 w-4" />
        توزيع المناطق حسب المدن (جميع المدن الـ18):
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-xs max-h-80 overflow-y-auto">
        {citiesWithRegions.map((city) => (
          <div key={city.id} className="flex items-center justify-between p-2 bg-background rounded border">
            <span className="font-medium truncate" title={city.name}>{city.name}</span>
            <Badge variant="outline" className="text-xs">
              {city.regionCount} منطقة
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RegionDistribution;