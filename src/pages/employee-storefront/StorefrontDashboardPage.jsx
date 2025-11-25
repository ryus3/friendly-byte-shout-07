import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Store, TrendingUp, Users, ShoppingCart, Settings, ExternalLink, Package, Sparkles, Target } from 'lucide-react';
import StorefrontAnalytics from '@/components/employee-storefront/StorefrontAnalytics';
import PremiumButton from '@/components/storefront/ui/PremiumButton';
import GradientText from '@/components/storefront/ui/GradientText';
import StatCard from '@/components/storefront/dashboard/StatCard';
import { toast } from '@/hooks/use-toast';

const StorefrontDashboardPage = () => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const [creating, setCreating] = useState(false);

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
      setCreating(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('يجب تسجيل الدخول أولاً');

      // التوجيه مباشرة إلى Setup Wizard
      navigate('/dashboard/storefront/setup-wizard');
      
    } catch (err) {
      toast({
        title: 'خطأ',
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setCreating(false);
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
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-purple-950/20 dark:via-pink-950/20 dark:to-blue-950/20 flex items-center justify-center p-4 sm:p-6 md:p-8">
        <Card className="max-w-3xl w-full shadow-2xl border-2 min-h-[500px] flex items-center">
          <CardContent className="text-center space-y-6 sm:space-y-8 md:space-y-10 p-6 sm:p-8 md:p-12 lg:p-16">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-fuchsia-400 to-purple-500 blur-3xl opacity-20" />
              <Store className="h-20 w-20 sm:h-24 sm:w-24 md:h-32 md:w-32 lg:h-40 lg:w-40 mx-auto relative z-10" style={{ 
                background: 'linear-gradient(135deg, #D946EF 0%, #8B5CF6 50%, #3B82F6 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }} />
            </div>
            
            <div className="space-y-4 sm:space-y-6">
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl xl:text-8xl font-black bg-gradient-to-br from-fuchsia-600 via-purple-600 to-blue-600 bg-clip-text text-transparent leading-[1.1] px-4">
                أنشئ متجرك
                <br className="hidden sm:inline" />
                {' '}الإلكتروني
              </h1>
              <p className="text-base sm:text-lg md:text-xl lg:text-2xl xl:text-3xl text-foreground/80 font-semibold max-w-2xl mx-auto leading-relaxed px-4">
                احصل على متجر احترافي عالمي
                <br />
                لعرض منتجاتك واستقبال الطلبات
              </p>
            </div>
            
            <PremiumButton
              variant="primary"
              size="lg"
              onClick={createStorefront}
              disabled={creating}
              className="text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl px-4 py-3 sm:px-6 sm:py-4 md:px-8 md:py-6 lg:px-12 lg:py-8"
            >
              {creating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 lg:h-8 lg:w-8 border-2 border-white border-t-transparent ml-2 sm:ml-3" />
                  جاري الإنشاء...
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 lg:h-8 lg:w-8 ml-2 sm:ml-3" />
                  إنشاء المتجر الآن
                </>
              )}
            </PremiumButton>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 bg-gradient-to-br from-background via-background to-purple-50 dark:to-purple-950/20 min-h-screen">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black bg-gradient-to-br from-fuchsia-600 via-purple-600 to-blue-600 bg-clip-text text-transparent mb-3 leading-tight">
          {settings.business_name || 'متجري'}
        </h1>
        <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-muted-foreground font-medium">
          إدارة متجرك الإلكتروني الاحترافي
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <PremiumButton 
          variant="primary"
          size="md"
          onClick={() => window.open(`/storefront/${settings.storefront_slug}`, '_blank')}
        >
          <ExternalLink className="w-5 h-5 ml-2" />
          معاينة المتجر
        </PremiumButton>
        
        <PremiumButton 
          variant="settings"
          size="md"
          onClick={() => navigate('/dashboard/storefront/settings')}
        >
          <Settings className="w-5 h-5 ml-2" />
          الإعدادات
        </PremiumButton>
        
        <PremiumButton 
          variant="success"
          size="md"
          onClick={() => navigate('/dashboard/storefront/products')}
        >
          <Package className="w-5 h-5 ml-2" />
          المنتجات
        </PremiumButton>
        
        <PremiumButton 
          variant="primary"
          size="md"
          onClick={() => navigate('/dashboard/storefront/promotions')}
        >
          <Sparkles className="w-5 h-5 ml-2" />
          العروض
        </PremiumButton>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
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
