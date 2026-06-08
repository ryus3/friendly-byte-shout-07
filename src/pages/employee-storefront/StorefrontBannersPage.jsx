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
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-slate-950 relative" dir="rtl">
      <div className="fixed inset-0 -z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[60vw] max-w-[500px] h-[60vw] max-h-[500px] bg-amber-500/15 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 left-0 w-[60vw] max-w-[500px] h-[60vw] max-h-[500px] bg-orange-500/15 rounded-full blur-[100px]" />
      </div>
      <div className="relative z-10 px-3 sm:px-6 py-4 sm:py-6 space-y-4 max-w-6xl mx-auto">
        <h1 className="text-xl sm:text-2xl font-black bg-gradient-to-r from-amber-300 to-orange-300 bg-clip-text text-transparent">
          البانرات الإعلانية
        </h1>
        <Card className="backdrop-blur-2xl bg-white/5 border-white/10 rounded-3xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base sm:text-lg text-white">ربط ذكي مع المنتجات والأقسام</CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <BannerManager banners={banners} onUpdate={fetchBanners} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};


export default StorefrontBannersPage;
