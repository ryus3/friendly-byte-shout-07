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
    <div className="container mx-auto p-4 md:p-8 space-y-6">
      <h1 className="text-3xl font-bold">إدارة البانرات</h1>

      <Card>
        <CardHeader>
          <CardTitle>البانرات الإعلانية</CardTitle>
        </CardHeader>
        <CardContent>
          <BannerManager
            banners={banners}
            onUpdate={fetchBanners}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default StorefrontBannersPage;
