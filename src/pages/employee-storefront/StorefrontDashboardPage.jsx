import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  Store, TrendingUp, Users, ShoppingCart, Settings, ExternalLink, Package,
  Sparkles, Target, Copy, Check, Globe, RefreshCw, Image as ImageIcon,
  Percent, Palette, FolderTree, ArrowUpRight, Zap, Eye, DollarSign,
} from 'lucide-react';
import StorefrontAnalytics from '@/components/employee-storefront/StorefrontAnalytics';
import PremiumButton from '@/components/storefront/ui/PremiumButton';
import PremiumLoader from '@/components/storefront/ui/PremiumLoader';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

/**
 * لوحة تحكم المتجر — تصميم زجاجي عالمي (Glassmorphism Aurora)
 * مستوحى من Stitch / Apple / iOS 18 / Tesla dashboard
 */
const StorefrontDashboardPage = () => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const [productsCount, setProductsCount] = useState(0);
  const [promotionsCount, setPromotionsCount] = useState(0);
  const [bannersCount, setBannersCount] = useState(0);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const syncProducts = async () => {
    try {
      setSyncing(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('يجب تسجيل الدخول');

      const { data: rolesData } = await supabase
        .from('user_roles').select('roles(name)').eq('user_id', user.id).eq('is_active', true);
      const roleNames = (rolesData || []).map(r => r.roles?.name).filter(Boolean);
      const isAdmin = roleNames.some(n => ['super_admin', 'admin'].includes(n));

      const productIds = new Set();
      if (isAdmin) {
        const { data } = await supabase.from('products').select('id').eq('is_active', true);
        (data || []).forEach(p => productIds.add(p.id));
      } else {
        const { data: owned } = await supabase.from('products').select('id').eq('owner_user_id', user.id).eq('is_active', true);
        (owned || []).forEach(p => productIds.add(p.id));
        const { data: perms } = await supabase
          .from('user_product_permissions').select('permission_type, allowed_items, has_full_access').eq('user_id', user.id);
        (perms || []).forEach(p => {
          if (p?.permission_type === 'product' && Array.isArray(p.allowed_items)) {
            p.allowed_items.forEach(id => id && productIds.add(id));
          }
        });
        if ((perms || []).some(p => p?.has_full_access)) {
          const { data } = await supabase.from('products').select('id').eq('is_active', true);
          (data || []).forEach(p => productIds.add(p.id));
        }
      }

      if (productIds.size === 0) {
        toast({ title: 'لا توجد منتجات مسموحة', variant: 'destructive' });
        return;
      }

      const rows = Array.from(productIds).map(pid => ({
        employee_id: user.id, product_id: pid, is_active: true, added_by: user.id,
      }));
      const { error } = await supabase
        .from('employee_allowed_products')
        .upsert(rows, { onConflict: 'employee_id,product_id', ignoreDuplicates: true });
      if (error) throw error;

      toast({ title: '✅ تمت المزامنة', description: `${productIds.size} منتج تم استيراده` });
      fetchStorefrontData();
    } catch (err) {
      toast({ title: 'فشل المزامنة', description: err.message, variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  const getStoreUrl = () => `${window.location.origin}/storefront/${settings?.slug}`;

  const copyStoreLink = async () => {
    try {
      await navigator.clipboard.writeText(getStoreUrl());
      setCopied(true);
      toast({ title: '✅ تم نسخ الرابط' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'خطأ في النسخ', variant: 'destructive' });
    }
  };

  useEffect(() => { fetchStorefrontData(); }, []);

  const fetchStorefrontData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: settingsData } = await supabase
        .from('employee_storefront_settings').select('*').eq('employee_id', user.id).maybeSingle();
      setSettings(settingsData);

      if (settingsData) {
        const today = new Date().toISOString().split('T')[0];
        const [
          { data: statsData },
          { count: ordersCnt },
          { count: prodCnt },
          { count: promoCnt },
          { count: bannerCnt },
        ] = await Promise.all([
          supabase.from('storefront_analytics').select('*').eq('employee_id', user.id).eq('date', today).maybeSingle(),
          supabase.from('storefront_orders').select('*', { count: 'exact', head: true }).eq('employee_id', user.id).eq('status', 'pending_approval'),
          supabase.from('employee_product_descriptions').select('*', { count: 'exact', head: true }).eq('employee_id', user.id).eq('is_in_storefront', true),
          supabase.from('employee_promotions').select('*', { count: 'exact', head: true }).eq('employee_id', user.id).eq('is_active', true),
          supabase.from('employee_banners').select('*', { count: 'exact', head: true }).eq('employee_id', user.id).eq('is_active', true),
        ]);
        setStats(statsData);
        setNewOrdersCount(ordersCnt || 0);
        setProductsCount(prodCnt || 0);
        setPromotionsCount(promoCnt || 0);
        setBannersCount(bannerCnt || 0);
      }
    } catch (err) {
      console.error('Error fetching storefront data:', err);
    } finally {
      setLoading(false);
    }
  };

  const createStorefront = () => {
    setCreating(true);
    navigate('/dashboard/storefront/setup-wizard');
  };

  if (loading) return <PremiumLoader message="جاري تحميل لوحة التحكم..." />;

  // ====== Empty state ======
  if (!settings) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-slate-950 flex items-center justify-center p-4">
        <Aurora />
        <div className="relative z-10 max-w-2xl w-full backdrop-blur-2xl bg-white/5 border border-white/10 rounded-[2rem] p-8 sm:p-12 text-center shadow-2xl">
          <div className="relative inline-block mb-6">
            <div className="absolute inset-0 bg-gradient-to-r from-fuchsia-500 to-blue-500 blur-3xl opacity-40" />
            <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-fuchsia-500/50">
              <Store className="h-12 w-12 text-white" />
            </div>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black bg-gradient-to-br from-white via-fuchsia-200 to-blue-200 bg-clip-text text-transparent mb-4 leading-tight">
            أنشئ متجرك الإلكتروني
          </h1>
          <p className="text-base sm:text-lg text-white/70 mb-8">احصل على متجر احترافي عالمي بتصميم زجاجي مذهل</p>
          <PremiumButton variant="primary" size="lg" onClick={createStorefront} disabled={creating}>
            {creating ? <>جاري الإنشاء...</> : <><Sparkles className="h-5 w-5 ml-2" /> ابدأ الآن</>}
          </PremiumButton>
        </div>
      </div>
    );
  }

  // ====== Action cards configuration ======
  const actionCards = [
    { label: 'معاينة المتجر', icon: ExternalLink, grad: 'from-blue-500 via-cyan-500 to-teal-500', desc: 'افتح متجرك العام', onClick: () => window.open(getStoreUrl(), '_blank') },
    { label: 'المنتجات', icon: Package, grad: 'from-emerald-500 to-green-500', desc: `${productsCount} منتج معروض`, onClick: () => navigate('/dashboard/storefront/products') },
    { label: 'الأقسام والفئات', icon: FolderTree, grad: 'from-cyan-500 to-blue-500', desc: 'صور وتسميات مخصصة', onClick: () => navigate('/dashboard/storefront/categories') },
    { label: 'العروض والخصومات', icon: Percent, grad: 'from-pink-500 via-fuchsia-500 to-purple-500', desc: `${promotionsCount} عرض نشط`, onClick: () => navigate('/dashboard/storefront/promotions') },
    { label: 'البنرات الإعلانية', icon: ImageIcon, grad: 'from-amber-500 to-orange-500', desc: `${bannersCount} بانر`, onClick: () => navigate('/dashboard/storefront/banners') },
    { label: 'الطلبات', icon: ShoppingCart, grad: 'from-violet-500 to-purple-500', desc: 'طلبات المتجر', onClick: () => navigate('/dashboard/storefront/orders'), badge: newOrdersCount },
    { label: 'الثيمات والتصميم', icon: Palette, grad: 'from-fuchsia-500 to-rose-500', desc: '8 ثيمات زجاجية', onClick: () => navigate('/dashboard/storefront/settings') },
    { label: 'الدومين المخصص', icon: Globe, grad: 'from-sky-500 to-indigo-500', desc: 'رابط متجرك', onClick: () => navigate('/dashboard/storefront/domain') },
    { label: 'الإعدادات المتقدمة', icon: Settings, grad: 'from-slate-500 to-zinc-600', desc: 'SEO والتحليلات', onClick: () => navigate('/dashboard/storefront/advanced-settings') },
  ];

  const heroStats = [
    { label: 'زوار اليوم', value: stats?.visitors || 0, icon: Eye, color: 'from-cyan-400 to-blue-500' },
    { label: 'طلبات جديدة', value: newOrdersCount, icon: ShoppingCart, color: 'from-fuchsia-400 to-purple-500', badge: newOrdersCount > 0 },
    { label: 'مبيعات اليوم', value: `${(stats?.revenue || 0).toLocaleString('ar-IQ')}`, suffix: 'IQD', icon: DollarSign, color: 'from-emerald-400 to-teal-500' },
    { label: 'التحويل', value: `${stats?.conversion_rate || 0}%`, icon: Target, color: 'from-orange-400 to-red-500' },
  ];

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-950">
      <Aurora />

      <div className="relative z-10 p-4 sm:p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
        {/* ===== Header ===== */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-fuchsia-500 to-blue-500 blur-2xl opacity-50" />
              <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-fuchsia-500 via-purple-600 to-blue-600 flex items-center justify-center shadow-2xl">
                <Store className="h-7 w-7 sm:h-8 sm:w-8 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black bg-gradient-to-br from-white via-fuchsia-200 to-blue-200 bg-clip-text text-transparent leading-tight">
                {settings.business_name || 'متجري'}
              </h1>
              <p className="text-xs sm:text-sm text-white/60 mt-0.5 flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                لوحة تحكم احترافية — متجر إلكتروني عالمي
              </p>
            </div>
          </div>

          <Button
            onClick={syncProducts}
            disabled={syncing}
            className="backdrop-blur-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white shadow-lg"
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 ml-2 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'جاري المزامنة...' : 'مزامنة المنتجات'}
          </Button>
        </div>

        {/* ===== Store URL Hero Card ===== */}
        <div className="relative overflow-hidden backdrop-blur-2xl bg-gradient-to-br from-white/10 via-white/5 to-white/[0.02] border border-white/15 rounded-3xl p-5 sm:p-6 shadow-2xl">
          <div className="absolute -top-32 -right-32 w-64 h-64 bg-fuchsia-500/30 rounded-full blur-3xl" />
          <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-blue-500/30 rounded-full blur-3xl" />

          <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-purple-600 shadow-lg shadow-fuchsia-500/40 flex-shrink-0">
                <Globe className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-white/60">رابط متجرك العام</p>
                <p className="font-mono text-xs sm:text-sm text-white truncate font-semibold mt-0.5">{getStoreUrl()}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button onClick={copyStoreLink} size="sm" variant="outline" className="flex-1 sm:flex-none backdrop-blur-xl bg-white/5 border-white/10 hover:bg-white/10 text-white">
                {copied ? <Check className="h-4 w-4 ml-1" /> : <Copy className="h-4 w-4 ml-1" />}
                {copied ? 'تم النسخ' : 'نسخ'}
              </Button>
              <Button onClick={() => window.open(getStoreUrl(), '_blank')} size="sm" className="flex-1 sm:flex-none bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:opacity-90 shadow-lg shadow-fuchsia-500/30 text-white">
                <ExternalLink className="h-4 w-4 ml-1" /> افتح
              </Button>
            </div>
          </div>
        </div>

        {/* ===== Hero Stats ===== */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {heroStats.map((s, i) => (
            <div
              key={i}
              className="group relative overflow-hidden backdrop-blur-2xl bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-5 hover:bg-white/[0.07] hover:border-white/20 transition-all shadow-xl"
            >
              <div className={`absolute -top-12 -right-12 w-28 h-28 bg-gradient-to-br ${s.color} opacity-20 rounded-full blur-3xl group-hover:opacity-40 transition-opacity`} />
              <div className="relative flex items-start justify-between">
                <div className={`p-2 rounded-xl bg-gradient-to-br ${s.color} shadow-lg`}>
                  <s.icon className="h-4 w-4 text-white" />
                </div>
                {s.badge && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
              </div>
              <div className="relative mt-3">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl sm:text-3xl font-black text-white">{s.value}</span>
                  {s.suffix && <span className="text-[10px] text-white/50">{s.suffix}</span>}
                </div>
                <p className="text-[11px] sm:text-xs text-white/60 mt-1">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ===== Quick Actions Grid (Bento) ===== */}
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white mb-3 flex items-center gap-2">
            <Zap className="h-5 w-5 text-fuchsia-400" /> أدوات إدارة المتجر
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {actionCards.map((card, i) => (
              <button
                key={i}
                onClick={card.onClick}
                className="group relative overflow-hidden backdrop-blur-2xl bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-5 text-right hover:bg-white/[0.08] hover:border-white/25 hover:scale-[1.02] transition-all shadow-xl active:scale-[0.99]"
              >
                <div className={`absolute -top-16 -right-16 w-32 h-32 bg-gradient-to-br ${card.grad} opacity-20 rounded-full blur-3xl group-hover:opacity-40 transition-opacity`} />

                <div className="relative flex items-start justify-between mb-3">
                  <div className={`p-2.5 rounded-xl bg-gradient-to-br ${card.grad} shadow-lg relative`}>
                    <card.icon className="h-5 w-5 text-white" />
                    {card.badge > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] rounded-full h-5 min-w-[20px] px-1 flex items-center justify-center font-bold ring-2 ring-slate-950">
                        {card.badge}
                      </span>
                    )}
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-white/40 group-hover:text-white group-hover:translate-x-[-2px] group-hover:translate-y-[-2px] transition-all" />
                </div>

                <div className="relative">
                  <div className="font-bold text-sm sm:text-base text-white leading-tight">{card.label}</div>
                  <div className="text-[11px] text-white/50 mt-1 truncate">{card.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ===== Analytics ===== */}
        <div className="backdrop-blur-2xl bg-white/5 border border-white/10 rounded-3xl p-4 sm:p-6 shadow-2xl">
          <h2 className="text-lg sm:text-xl font-bold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-400" /> التحليلات والإحصائيات
          </h2>
          <StorefrontAnalytics employeeId={settings.employee_id} />
        </div>
      </div>
    </div>
  );
};

// Aurora background layer
const Aurora = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-fuchsia-600/20 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
    <div className="absolute top-1/3 right-0 w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '10s', animationDelay: '2s' }} />
    <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '12s', animationDelay: '4s' }} />
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_0%,rgba(2,6,23,0.5)_100%)]" />
  </div>
);

export default StorefrontDashboardPage;
