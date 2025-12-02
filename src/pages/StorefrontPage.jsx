import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { StorefrontProvider, useStorefront } from '@/contexts/StorefrontContext';
import StorefrontLayout from '@/components/storefront/StorefrontLayout';
import HeroSection from '@/components/storefront/HeroSection';
import CategoryCircles from '@/components/storefront/CategoryCircles';
import BrandBanners from '@/components/storefront/BrandBanners';
import FlashSaleBar from '@/components/storefront/FlashSaleBar';
import PromoPopup from '@/components/storefront/PromoPopup';
import PremiumProductCard from '@/components/storefront/PremiumProductCard';
import GradientText from '@/components/storefront/ui/GradientText';
import PremiumLoader from '@/components/storefront/ui/PremiumLoader';
import { supabase } from '@/integrations/supabase/client';

const StorefrontHome = () => {
  const { settings, trackPageView } = useStorefront();
  const [banners, setBanners] = useState([]);
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    trackPageView();
  }, [trackPageView]);

  useEffect(() => {
    if (!settings?.employee_id) return;

    const fetchData = async () => {
      try {
        setIsLoading(true);

        // جلب البانرات
        const { data: bannersData } = await supabase
          .from('employee_banners')
          .select('*')
          .eq('employee_id', settings.employee_id)
          .eq('is_active', true)
          .order('display_order');

        setBanners(bannersData || []);

        // جلب المنتجات المميزة
        const { data: customProducts } = await supabase
          .from('employee_product_descriptions')
          .select('product_id')
          .eq('employee_id', settings.employee_id)
          .eq('is_featured', true)
          .order('display_order');

        if (customProducts && customProducts.length > 0) {
          const productIds = customProducts.map(p => p.product_id);

          const { data: productsData } = await supabase
            .from('products')
            .select(`
              *,
              category:categories(id, name),
              department:departments(id, name),
              variants:product_variants(
                id,
                color,
                size,
                price,
                quantity,
                reserved_quantity,
                images
              )
            `)
            .in('id', productIds)
            .eq('is_active', true);

          // فلترة المنتجات المتاحة فقط
          const availableProducts = productsData?.filter(p => 
            p.variants?.some(v => {
              const qty = v.inventory?.quantity ?? v.quantity ?? 0;
              const reserved = v.inventory?.reserved_quantity ?? v.reserved_quantity ?? 0;
              return (qty - reserved) > 0;
            })
          ) || [];

          setProducts(availableProducts);
        } else {
          // إذا لم يوجد منتجات مميزة، جلب أحدث المنتجات
          const { data: latestProducts } = await supabase
            .from('products')
            .select(`
              *,
              category:categories(id, name),
              department:departments(id, name),
              variants:product_variants(
                id,
                color,
                size,
                price,
                quantity,
                reserved_quantity,
                images
              )
            `)
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(8);

          // فلترة المنتجات المتاحة فقط
          const availableProducts = latestProducts?.filter(p => 
            p.variants?.some(v => {
              const qty = v.inventory?.quantity ?? v.quantity ?? 0;
              const reserved = v.inventory?.reserved_quantity ?? v.reserved_quantity ?? 0;
              return (qty - reserved) > 0;
            })
          ) || [];

          setProducts(availableProducts);
        }
      } catch (err) {
        console.error('Error fetching storefront data:', err);
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
    <div className="min-h-screen">
      {/* Flash Sale Bar */}
      <FlashSaleBar />

      {/* Hero Section */}
      <HeroSection slug={settings?.slug} banners={banners} />

      {/* Category Circles */}
      <CategoryCircles slug={settings?.slug} />

      {/* Featured Products Section */}
      <section className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <GradientText 
            gradient="from-purple-600 via-pink-600 to-blue-600" 
            className="text-3xl sm:text-4xl md:text-5xl font-black mb-4"
          >
            المنتجات المميزة ⭐
          </GradientText>
          <p className="text-lg sm:text-xl text-muted-foreground">
            اكتشف أحدث وأفضل المنتجات المختارة خصيصاً لك
          </p>
        </div>
        
        {products.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-xl text-muted-foreground mb-4">لا توجد منتجات مميزة حالياً</p>
            <p className="text-muted-foreground">تحقق مرة أخرى قريباً!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {products.map((product) => (
              <PremiumProductCard 
                key={product.id} 
                product={product} 
                slug={settings?.slug}
              />
            ))}
          </div>
        )}
      </section>

      {/* Brand Banners */}
      <BrandBanners slug={settings?.slug} />

      {/* Promo Popup */}
      <PromoPopup code="WELCOME20" discount="20%" delay={3000} />
    </div>
  );
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
      <StorefrontLayout products={allProducts}>
        <StorefrontHome />
      </StorefrontLayout>
    </StorefrontProvider>
  );
};

export default StorefrontPageWrapper;
