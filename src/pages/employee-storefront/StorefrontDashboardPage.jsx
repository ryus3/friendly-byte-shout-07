import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Store, TrendingUp, Users, ShoppingCart, Settings, ExternalLink, Package, Sparkles, Target, Copy, Check, Globe } from 'lucide-react';
import StorefrontAnalytics from '@/components/employee-storefront/StorefrontAnalytics';
import PremiumButton from '@/components/storefront/ui/PremiumButton';
import PremiumLoader from '@/components/storefront/ui/PremiumLoader';
import GradientText from '@/components/storefront/ui/GradientText';
import StatCard from '@/components/storefront/dashboard/StatCard';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

const StorefrontDashboardPage = () => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  // رابط المتجر العام الكامل
  const getStoreUrl = () => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/storefront/${settings?.slug}`;
  };

  const copyStoreLink = async () => {
    try {
      await navigator.clipboard.writeText(getStoreUrl());
      setCopied(true);
      toast({ title: 'تم نسخ الرابط!' });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({ title: 'خطأ في النسخ', variant: 'destructive' });
    }
  };

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
    return <PremiumLoader message="جاري تحميل لوحة التحكم..." />;
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

      {/* رابط المتجر العام - بارز جداً */}
      <Card className="mb-6 sm:mb-8 border-2 border-primary/30 bg-gradient-to-r from-primary/5 to-purple-500/5">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-r from-primary to-purple-600 text-white">
                <Globe className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">رابط متجرك العام</p>
                <p className="font-mono text-sm sm:text-base break-all text-primary font-semibold">
                  {getStoreUrl()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={copyStoreLink}
                className="flex-1 sm:flex-none"
              >
                {copied ? <Check className="h-4 w-4 ml-2" /> : <Copy className="h-4 w-4 ml-2" />}
                {copied ? 'تم النسخ' : 'نسخ الرابط'}
              </Button>
              <Button
                size="sm"
                onClick={() => window.open(getStoreUrl(), '_blank')}
                className="flex-1 sm:flex-none bg-gradient-to-r from-primary to-purple-600 hover:opacity-90"
              >
                <ExternalLink className="h-4 w-4 ml-2" />
                افتح المتجر
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions - تصميم كروت احترافية 2x2 */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {/* المتجر */}
        <Card 
          className="relative overflow-hidden border-2 transition-all duration-300 hover:scale-105 hover:shadow-2xl shadow-blue/20 cursor-pointer group min-h-[100px] sm:min-h-[120px]"
          onClick={() => window.open(`/storefront/${settings.slug}`, '_blank')}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-cyan-500 opacity-5" />
          <CardContent className="p-3 sm:p-4 md:p-6 relative z-10 flex flex-col items-center justify-center h-full">
            <div className="p-2 sm:p-3 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-lg mb-2 sm:mb-3">
              <ExternalLink className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8" />
            </div>
            <div className="text-base sm:text-lg md:text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-cyan-500 text-center">
              المتجر
            </div>
          </CardContent>
        </Card>

        {/* الإعدادات */}
        <Card 
          className="relative overflow-hidden border-2 transition-all duration-300 hover:scale-105 hover:shadow-2xl shadow-indigo/20 cursor-pointer group min-h-[100px] sm:min-h-[120px]"
          onClick={() => navigate('/dashboard/storefront/settings')}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-500 opacity-5" />
          <CardContent className="p-3 sm:p-4 md:p-6 relative z-10 flex flex-col items-center justify-center h-full">
            <div className="p-2 sm:p-3 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 text-white shadow-lg mb-2 sm:mb-3">
              <Settings className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8" />
            </div>
            <div className="text-base sm:text-lg md:text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-500 text-center">
              الإعدادات
            </div>
          </CardContent>
        </Card>

        {/* المنتجات */}
        <Card 
          className="relative overflow-hidden border-2 transition-all duration-300 hover:scale-105 hover:shadow-2xl shadow-emerald/20 cursor-pointer group min-h-[100px] sm:min-h-[120px]"
          onClick={() => navigate('/dashboard/storefront/products')}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-teal-500 opacity-5" />
          <CardContent className="p-3 sm:p-4 md:p-6 relative z-10 flex flex-col items-center justify-center h-full">
            <div className="p-2 sm:p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg mb-2 sm:mb-3">
              <Package className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8" />
            </div>
            <div className="text-base sm:text-lg md:text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-500 text-center">
              المنتجات
            </div>
          </CardContent>
        </Card>

        {/* إعدادات متقدمة */}
        <Card 
          className="relative overflow-hidden border-2 transition-all duration-300 hover:scale-105 hover:shadow-2xl shadow-orange/20 cursor-pointer group min-h-[100px] sm:min-h-[120px]"
          onClick={() => navigate('/dashboard/storefront/advanced-settings')}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500 to-red-500 opacity-5" />
          <CardContent className="p-3 sm:p-4 md:p-6 relative z-10 flex flex-col items-center justify-center h-full">
            <div className="p-2 sm:p-3 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 text-white shadow-lg mb-2 sm:mb-3">
              <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8" />
            </div>
            <div className="text-base sm:text-lg md:text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-500 text-center">
              متقدم
            </div>
          </CardContent>
        </Card>
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
