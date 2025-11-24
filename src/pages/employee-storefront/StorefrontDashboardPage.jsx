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
      console.log('🏪 بدء إنشاء المتجر...');
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('❌ لا يوجد مستخدم مسجل دخول');
        toast({
          title: 'خطأ',
          description: 'يجب تسجيل الدخول أولاً',
          variant: 'destructive'
        });
        return;
      }

      console.log('✅ المستخدم:', user.id);

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('business_page_name, employee_code')
        .eq('user_id', user.id)
        .single();

      if (profileError) {
        console.error('❌ خطأ في جلب الملف الشخصي:', profileError);
        throw profileError;
      }

      console.log('✅ الملف الشخصي:', profile);

      const slug = `${profile.employee_code || user.id.substring(0, 8)}-shop`;
      console.log('📍 Slug:', slug);

      const { data, error } = await supabase
        .from('employee_storefront_settings')
        .insert({
          employee_id: user.id,
          slug: slug,
          theme_name: 'modern',
          primary_color: '#8B5CF6',
          secondary_color: '#EC4899',
          accent_color: '#3B82F6',
          is_active: true
        })
        .select()
        .single();

      if (error) {
        console.error('❌ خطأ في إنشاء المتجر:', error);
        throw error;
      }

      console.log('✅ تم إنشاء المتجر بنجاح:', data);
      
      setSettings(data);
      toast({
        title: '🎉 تم إنشاء المتجر بنجاح',
        description: 'يمكنك الآن تخصيص متجرك الإلكتروني'
      });
    } catch (err) {
      console.error('💥 خطأ في إنشاء المتجر:', err);
      toast({
        title: 'خطأ',
        description: err.message || 'فشل إنشاء المتجر. حاول مرة أخرى',
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
        <Card className="max-w-3xl w-full shadow-2xl border-2">
          <CardContent className="text-center space-y-10 p-16">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-fuchsia-400 to-purple-500 blur-3xl opacity-20" />
              <Store className="h-40 w-40 mx-auto relative z-10" style={{ 
                background: 'linear-gradient(135deg, #D946EF 0%, #8B5CF6 50%, #3B82F6 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }} />
            </div>
            
            <div className="space-y-6">
              <h1 className="text-7xl md:text-8xl font-black bg-gradient-to-br from-fuchsia-600 via-purple-600 to-blue-600 bg-clip-text text-transparent leading-[1.1]">
                أنشئ متجرك
                <br />
                الإلكتروني
              </h1>
              <p className="text-2xl md:text-3xl text-foreground/80 font-semibold max-w-2xl mx-auto leading-relaxed">
                احصل على متجر احترافي عالمي
                <br />
                لعرض منتجاتك واستقبال الطلبات
              </p>
            </div>
            
            <GradientButton
              gradient="from-fuchsia-500 via-purple-500 to-blue-500"
              onClick={createStorefront}
              className="text-2xl px-12 py-8 shadow-2xl hover:shadow-fuchsia-500/50 transition-all duration-300 hover:scale-105"
            >
              <Sparkles className="h-8 w-8 ml-3" />
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
        <h1 className="text-6xl font-black bg-gradient-to-br from-fuchsia-600 via-purple-600 to-blue-600 bg-clip-text text-transparent mb-3 leading-tight">
          {settings.business_name || 'متجري'}
        </h1>
        <p className="text-2xl text-muted-foreground font-medium">
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
