import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { StorefrontProvider, useStorefront } from '@/contexts/StorefrontContext';
import StorefrontLayout from '@/components/storefront/StorefrontLayout';
import HeroSlider from '@/components/storefront/HeroSlider';
import ProfessionalCategories from '@/components/storefront/ProfessionalCategories';
import ProfessionalBanners from '@/components/storefront/ProfessionalBanners';
import FlashSaleSection from '@/components/storefront/FlashSaleSection';
import MobileBottomNav from '@/components/storefront/MobileBottomNav';
import PremiumProductCard from '@/components/storefront/PremiumProductCard';
import GradientText from '@/components/storefront/ui/GradientText';
import PremiumLoader from '@/components/storefront/ui/PremiumLoader';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Star, TrendingUp, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import devLog from '@/lib/devLogger';
import { applyThemeTokens } from '@/lib/storefront-themes';

const StorefrontHome = () => {
  const { settings, trackPageView } = useStorefront();
  const [banners, setBanners] = useState([]);
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    trackPageView();
  }, [trackPageView]);

  // Apply selected theme tokens to <html> so all storefront components inherit it
  useEffect(() => {
    if (settings?.theme_name) {
      applyThemeTokens(settings.theme_name);
    }
  }, [settings?.theme_name]);

  useEffect(() => {
    if (!settings?.employee_id) return;

    const fetchData = async () => {
      try {
        setIsLoading(true);
        devLog.log('🏪 Fetching storefront data for employee:', settings.employee_id);

        // جلب البانرات
        const { data: bannersData } = await supabase
          .from('employee_banners')
          .select('*')
          .eq('employee_id', settings.employee_id)
          .eq('is_active', true)
          .order('display_order');

        setBanners(bannersData || []);
        devLog.log('🎨 Banners:', bannersData?.length || 0);

        // === النظام الهجين: جلب المنتجات المسموحة التي هي في المتجر ===
        
        // 1. جلب IDs المنتجات المسموحة للموظف
        const { data: allowedProductsData, error: allowedError } = await supabase
          .from('employee_allowed_products')
          .select('product_id')
          .eq('employee_id', settings.employee_id)
          .eq('is_active', true);

        devLog.log('📋 Allowed products:', allowedProductsData?.length || 0, 'Error:', allowedError);
        let allowedProductIds = allowedProductsData?.map(ap => ap.product_id) || [];

        // ✅ Fallback للمدير العام: إذا كان صاحب المتجر مديراً ولا توجد منتجات مسموحة بعد، اعرض جميع المنتجات النشطة
        if (allowedProductIds.length === 0) {
          const { data: ownerRoles } = await supabase
            .from('user_roles')
            .select('roles(name)')
            .eq('user_id', settings.employee_id)
            .eq('is_active', true);
          const ownerIsAdmin = (ownerRoles || []).some(r => ['super_admin', 'admin'].includes(r.roles?.name));
          if (ownerIsAdmin) {
            const { data: allActive } = await supabase
              .from('products')
              .select('id')
              .eq('is_active', true);
            allowedProductIds = (allActive || []).map(p => p.id);
            devLog.log('🛡️ Admin fallback active products:', allowedProductIds.length);
          }
        }

        if (allowedProductIds.length === 0) {
          devLog.log('⚠️ No products available for this storefront');
          setProducts([]);
          setIsLoading(false);
          return;
        }

        // 2. جلب المنتجات المعروضة في المتجر (is_in_storefront = true)
        const { data: storefrontDescriptions, error: descError } = await supabase
          .from('employee_product_descriptions')
          .select('product_id, is_featured, display_order')
          .eq('employee_id', settings.employee_id)
          .eq('is_in_storefront', true);

        devLog.log('🏪 Storefront descriptions:', storefrontDescriptions?.length || 0, 'Error:', descError);

        const storefrontProductIds = storefrontDescriptions
          ?.filter(d => allowedProductIds.includes(d.product_id))
          .map(d => d.product_id) || [];

        const featuredProductIds = storefrontDescriptions
          ?.filter(d => d.is_featured && allowedProductIds.includes(d.product_id))
          .map(d => d.product_id) || [];

        let productIdsToFetch = featuredProductIds.length > 0
          ? featuredProductIds
          : (storefrontProductIds.length > 0
              ? storefrontProductIds.slice(0, 24)
              : allowedProductIds.slice(0, 24));

        devLog.log('🎯 Product IDs to fetch:', productIdsToFetch.length);

        if (productIdsToFetch.length === 0) {
          devLog.log('⚠️ No products to display in storefront');
          setProducts([]);
          setIsLoading(false);
          return;
        }


        const { data: productsData, error: prodError } = await supabase
          .from('products')
          .select(`
            *,
            category:categories(id, name),
            department:departments(id, name),
            variants:product_variants(
              id,
              price,
              images,
              color:colors(id, name, hex_code),
              size:sizes(id, name)
            )
          `)
          .in('id', productIdsToFetch)
          .eq('is_active', true);

        devLog.log('📦 Products fetched:', productsData?.length || 0, 'Error:', prodError);

        if (!productsData || productsData.length === 0) {
          setProducts([]);
          setIsLoading(false);
          return;
        }

        // جلب المخزون بشكل منفصل
        const variantIds = productsData.flatMap(p => p.variants?.map(v => v.id) || []);
        const { data: inventoryData } = await supabase
          .from('inventory')
          .select('variant_id, quantity, reserved_quantity')
          .in('variant_id', variantIds);

        devLog.log('📊 Inventory:', inventoryData?.length || 0, 'items');

        // إنشاء خريطة المخزون
        const inventoryMap = {};
        inventoryData?.forEach(inv => {
          inventoryMap[inv.variant_id] = inv;
        });

        // دمج المخزون مع المنتجات
        const productsWithInventory = productsData.map(p => ({
          ...p,
          variants: p.variants?.map(v => ({
            ...v,
            inventory: inventoryMap[v.id] || { quantity: 0, reserved_quantity: 0 }
          }))
        }));

        // فلترة المنتجات المتاحة فقط (التي لديها مخزون)
        const availableProducts = productsWithInventory.filter(p => 
          p.variants?.some(v => {
            const qty = v.inventory?.quantity ?? 0;
            const reserved = v.inventory?.reserved_quantity ?? 0;
            return (qty - reserved) > 0;
          })
        );

        devLog.log('✅ Available products:', availableProducts.length);
        setProducts(availableProducts);
      } catch (err) {
        console.error('❌ Error fetching storefront data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [settings?.employee_id]);

  if (isLoading) {
    return <PremiumLoader message="جاري تحميل المتجر..." />;
  }

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      {/* Hero Slider */}
      <HeroSlider slug={settings?.slug} banners={banners} products={products} />

      {/* الفئات الاحترافية */}
      <ProfessionalCategories slug={settings?.slug} />

      {/* Flash Sale */}
      <FlashSaleSection slug={settings?.slug} products={products.slice(0, 6)} />

      {/* البنرات الاحترافية */}
      <ProfessionalBanners slug={settings?.slug} banners={banners} />

      {/* المنتجات المميزة */}
      <section className="py-8 bg-background">
        <div className="container mx-auto px-4">
          {/* العنوان */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-orange-500 rounded-xl flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-black">المنتجات المميزة</h2>
                <p className="text-sm text-muted-foreground">اختيارنا لك من أفضل المنتجات</p>
              </div>
            </div>
            <Link to={`/storefront/${settings?.slug}/products`}>
              <Button variant="ghost" size="sm" className="gap-1">
                عرض الكل
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          
          {products.length === 0 ? (
            <div className="text-center py-16 bg-muted/30 rounded-2xl">
              <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles className="h-10 w-10 text-muted-foreground" />
              </div>
              <p className="text-xl font-bold mb-2">قريباً!</p>
              <p className="text-muted-foreground">سيتم إضافة المنتجات قريباً</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
              {products.slice(0, 10).map((product) => (
                <PremiumProductCard 
                  key={product.id} 
                  product={product} 
                  slug={settings?.slug}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* قسم الترند */}
      {products.length > 0 && (
        <section className="py-8 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-black">الأكثر مبيعاً</h2>
                  <p className="text-sm text-muted-foreground">المنتجات الأكثر طلباً هذا الأسبوع</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
              {products.slice(0, 5).map((product, idx) => (
                <div key={product.id} className="relative">
                  {/* رقم الترتيب */}
                  <div className="absolute top-2 right-2 z-10 w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-black text-sm shadow-lg">
                    {idx + 1}
                  </div>
                  <PremiumProductCard 
                    product={product} 
                    slug={settings?.slug}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* شريط التنقل السفلي للموبايل */}
      <MobileBottomNav />
    </div>
  );
};

const StorefrontGate = ({ children }) => {
  const { settings, settingsLoading, error } = useStorefront();
  if (settingsLoading) return <PremiumLoader message="جاري تحميل المتجر..." />;
  if (error || !settings) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white p-6" dir="rtl">
        <div className="max-w-md text-center backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-black mb-2">المتجر غير موجود</h1>
          <p className="text-white/60 text-sm mb-6">الرابط الذي حاولت فتحه غير صحيح أو أن المتجر غير نشط حالياً.</p>
          <Link to="/"><Button variant="outline" className="text-white border-white/20">العودة للرئيسية</Button></Link>
        </div>
      </div>
    );
  }
  return children;
};

const StorefrontPageWrapper = () => {
  const { slug } = useParams();
  const [allProducts, setAllProducts] = useState([]);

  useEffect(() => {
    const fetchProducts = async () => {
      const { data } = await supabase
        .from('products')
        .select(`
          *,
          variants:product_variants(*)
        `)
        .eq('is_active', true)
        .limit(50);
      setAllProducts(data || []);
    };
    fetchProducts();
  }, []);

  return (
    <StorefrontProvider slug={slug}>
      <StorefrontGate>
        <StorefrontLayout products={allProducts}>
          <StorefrontHome />
        </StorefrontLayout>
      </StorefrontGate>
    </StorefrontProvider>
  );
};

export default StorefrontPageWrapper;
