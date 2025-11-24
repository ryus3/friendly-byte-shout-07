import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Store, TrendingUp, Users, ShoppingCart, Settings, ExternalLink, Package, Sparkles, Target } from 'lucide-react';
import StorefrontAnalytics from '@/components/employee-storefront/StorefrontAnalytics';
import GradientButton from '@/components/storefront/ui/GradientButton';
import GradientText from '@/components/storefront/ui/GradientText';
import StatCard from '@/components/storefront/dashboard/StatCard';
import { toast } from '@/hooks/use-toast';

const StorefrontDashboardPage = () => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newOrdersCount, setNewOrdersCount] = useState(0);

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
        
        // جلب عدد الطلبات الجديدة
        const { count } = await supabase
          .from('storefront_orders')
          .select('*', { count: 'exact', head: true })
          .eq('employee_id', user.id)
          .eq('status', 'pending_approval');
        
        setNewOrdersCount(count || 0);
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-purple-950/20 dark:via-pink-950/20 dark:to-blue-950/20">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-r from-purple-500 to-pink-500 animate-pulse" />
          <p className="text-lg font-semibold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">
            جاري التحميل...
          </p>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-purple-950/20 dark:via-pink-950/20 dark:to-blue-950/20 flex items-center justify-center p-8">
        <Card className="max-w-2xl w-full shadow-2xl border-2">
          <CardContent className="text-center space-y-8 p-12">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 blur-3xl opacity-20 animate-pulse" />
              <Store className="h-32 w-32 mx-auto text-transparent bg-clip-text relative z-10" style={{ 
                background: 'linear-gradient(135deg, #8B5CF6, #EC4899)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }} />
            </div>
            
            <div className="space-y-4">
              <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 animate-gradient">
                أنشئ متجرك الإلكتروني
              </h1>
              <p className="text-xl text-muted-foreground max-w-md mx-auto">
                احصل على متجر احترافي عالمي لعرض منتجاتك واستقبال الطلبات
              </p>
            </div>
            
            <GradientButton
              gradient="from-purple-500 via-pink-500 to-blue-500"
              onClick={createStorefront}
              className="text-lg px-8 py-6 shadow-2xl"
            >
              <Sparkles className="h-6 w-6 ml-2" />
              إنشاء المتجر الآن
            </GradientButton>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 bg-gradient-to-br from-background via-background to-purple-50 dark:to-purple-950/20 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <GradientText gradient="from-purple-600 via-pink-600 to-blue-600" className="text-5xl mb-2 animate-gradient">
          {settings.business_name}
        </GradientText>
        <p className="text-xl text-muted-foreground">
          إدارة متجرك الإلكتروني الاحترافي
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <GradientButton 
          gradient="from-blue-500 to-cyan-500"
          onClick={() => window.open(`/storefront/${settings.storefront_slug}`, '_blank')}
        >
          <ExternalLink className="w-5 h-5 ml-2" />
          معاينة المتجر
        </GradientButton>
        
        <GradientButton 
          gradient="from-purple-500 to-pink-500"
          onClick={() => navigate('/dashboard/storefront/settings')}
        >
          <Settings className="w-5 h-5 ml-2" />
          الإعدادات
        </GradientButton>
        
        <GradientButton 
          gradient="from-emerald-500 to-teal-500"
          onClick={() => navigate('/dashboard/storefront/products')}
        >
          <Package className="w-5 h-5 ml-2" />
          المنتجات
        </GradientButton>
        
        <GradientButton 
          gradient="from-orange-500 to-red-500"
          onClick={() => navigate('/dashboard/storefront/promotions')}
        >
          <Sparkles className="w-5 h-5 ml-2" />
          العروض
        </GradientButton>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="زوار اليوم"
          value={stats?.visitors || 0}
          icon={<Users className="h-6 w-6" />}
          gradient="from-blue-500 to-cyan-500"
          shadowColor="blue"
        />
        <StatCard
          title="طلبات جديدة"
          value={newOrdersCount}
          icon={<ShoppingCart className="h-6 w-6" />}
          gradient="from-purple-500 to-pink-500"
          shadowColor="purple"
          badge={newOrdersCount > 0}
        />
        <StatCard
          title="مبيعات اليوم"
          value={`${(stats?.revenue || 0).toLocaleString('ar-IQ')} IQD`}
          icon={<TrendingUp className="h-6 w-6" />}
          gradient="from-emerald-500 to-teal-500"
          shadowColor="emerald"
        />
        <StatCard
          title="معدل التحويل"
          value={`${stats?.conversion_rate || 0}%`}
          icon={<Target className="h-6 w-6" />}
          gradient="from-orange-500 to-red-500"
          shadowColor="orange"
        />
      </div>

      {/* Analytics */}
      <StorefrontAnalytics employeeId={settings.employee_id} />
    </div>
  );
};

export default StorefrontDashboardPage;
