import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { StorefrontProvider, useStorefront } from '@/contexts/StorefrontContext';
import StorefrontLayout from '@/components/storefront/StorefrontLayout';
import HeroSection from '@/components/storefront/HeroSection';
import PremiumProductCard from '@/components/storefront/PremiumProductCard';
import GradientText from '@/components/storefront/ui/GradientText';
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
              variants:product_variants(
                id,
                color,
                size,
                quantity,
                reserved_quantity,
                price,
                images
              ),
              category:categories(name),
              department:departments(name)
            `)
            .in('id', productIds)
            .eq('is_active', true);

          setProducts(productsData || []);
        }
      } catch (err) {
        console.error('Error fetching storefront data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [settings?.employee_id]);

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <HeroSection slug={settings?.slug} banners={banners} />

      {/* Featured Products Section */}
      <section className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <GradientText 
            variant="holographic" 
            className="text-4xl md:text-5xl font-black mb-4"
            as="h2"
            animate
          >
            المنتجات المميزة
          </GradientText>
          <p className="text-xl text-muted-foreground">
            اكتشف أحدث وأفضل المنتجات المختارة خصيصاً لك
          </p>
        </div>
        
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-xl text-muted-foreground mb-4">لا توجد منتجات متاحة حالياً</p>
            <p className="text-muted-foreground">تحقق مرة أخرى قريباً!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
