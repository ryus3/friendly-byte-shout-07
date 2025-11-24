import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Store, TrendingUp, Users, ShoppingCart, Settings, ExternalLink } from 'lucide-react';
import StorefrontAnalytics from '@/components/employee-storefront/StorefrontAnalytics';
import { toast } from '@/hooks/use-toast';

const StorefrontDashboardPage = () => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStorefrontData();
  }, []);

  const fetchStorefrontData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // جلب إعدادات المتجر
      const { data: settingsData } = await supabase
        .from('employee_storefront_settings')
        .select('*')
        .eq('employee_id', user.id)
        .single();

      setSettings(settingsData);

      // جلب إحصائيات اليوم
      if (settingsData) {
        const today = new Date().toISOString().split('T')[0];
        const { data: statsData } = await supabase
          .from('storefront_analytics')
          .select('*')
          .eq('employee_id', user.id)
          .eq('date', today)
          .single();

        setStats(statsData);
      }
    } catch (err) {
      console.error('Error fetching storefront data:', err);
    } finally {
      setLoading(false);
    }
  };

  const createStorefront = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // جلب معلومات الموظف
      const { data: profile } = await supabase
        .from('profiles')
        .select('business_page_name, employee_code')
        .eq('user_id', user.id)
        .single();

      const slug = `${profile.employee_code || user.id.substring(0, 8)}-shop`;

      const { data, error } = await supabase
        .from('employee_storefront_settings')
        .insert({
          employee_id: user.id,
          storefront_slug: slug,
          business_name: profile.business_page_name || 'متجري',
          theme: 'modern',
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;

      setSettings(data);
      toast({
        title: 'تم إنشاء المتجر',
        description: 'يمكنك الآن تخصيص متجرك الإلكتروني'
      });
    } catch (err) {
      console.error('Error creating storefront:', err);
      toast({
        title: 'خطأ',
        description: 'فشل إنشاء المتجر',
        variant: 'destructive'
      });
    }
  };

  if (loading) {
    return <div className="p-8">جاري التحميل...</div>;
  }

  if (!settings) {
    return (
      <div className="container mx-auto p-8">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <Store className="h-24 w-24 mx-auto text-muted-foreground" />
          <h1 className="text-3xl font-bold">أنشئ متجرك الإلكتروني</h1>
          <p className="text-muted-foreground text-lg">
            احصل على متجر احترافي لعرض منتجاتك واستقبال الطلبات عبر الإنترنت
          </p>
          <Button size="lg" onClick={createStorefront}>
            إنشاء المتجر الآن
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">لوحة تحكم المتجر</h1>
          <p className="text-muted-foreground">{settings.business_name}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => window.open(`/storefront/${settings.storefront_slug}`, '_blank')}
          >
            <ExternalLink className="h-4 w-4 ml-2" />
            عرض المتجر
          </Button>
          <Button onClick={() => navigate('/dashboard/storefront/settings')}>
            <Settings className="h-4 w-4 ml-2" />
            الإعدادات
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">الزوار اليوم</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.visitors || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.page_views || 0} مشاهدة صفحة
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">الطلبات</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.orders || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.cart_additions || 0} إضافة للسلة
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">الإيرادات</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(stats?.revenue || 0).toLocaleString('ar-IQ')} IQD
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.conversion_rate || 0}% معدل التحويل
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">المنتجات المعروضة</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.product_views || 0}</div>
            <p className="text-xs text-muted-foreground">مشاهدة منتج</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:bg-accent" onClick={() => navigate('/dashboard/storefront/products')}>
          <CardHeader>
            <CardTitle>إدارة المنتجات</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              اختر المنتجات المميزة وأضف أوصافاً مخصصة
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-accent" onClick={() => navigate('/dashboard/storefront/promotions')}>
          <CardHeader>
            <CardTitle>العروض والخصومات</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              أنشئ عروضاً ترويجية لزيادة المبيعات
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-accent" onClick={() => navigate('/dashboard/storefront/banners')}>
          <CardHeader>
            <CardTitle>البانرات الإعلانية</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              أضف صوراً جذابة للصفحة الرئيسية
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Analytics */}
      <StorefrontAnalytics employeeId={settings.employee_id} />
    </div>
  );
};

export default StorefrontDashboardPage;
