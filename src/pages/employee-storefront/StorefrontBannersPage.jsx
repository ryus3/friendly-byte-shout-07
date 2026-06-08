import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import BannerManager from '@/components/employee-storefront/BannerManager';

const StorefrontBannersPage = () => {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('employee_banners')
        .select('*')
        .eq('employee_id', user.id)
        .order('display_order', { ascending: true });

      setBanners(data || []);
    } catch (err) {
      console.error('Error fetching banners:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[100vw] overflow-x-clip px-3 sm:px-6 py-4 sm:py-8 space-y-4" dir="rtl">
      <h1 className="text-2xl sm:text-3xl font-bold">إدارة البانرات</h1>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg sm:text-xl">البانرات الإعلانية — ربط ذكي مع المنتجات والأقسام</CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          <BannerManager banners={banners} onUpdate={fetchBanners} />
        </CardContent>
      </Card>
    </div>
  );
};


export default StorefrontBannersPage;
