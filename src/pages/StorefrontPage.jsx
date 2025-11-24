import React from 'react';
import { useParams } from 'react-router-dom';
import { StorefrontProvider, useStorefront } from '@/contexts/StorefrontContext';
import StorefrontLayout from '@/components/storefront/StorefrontLayout';
import HeroSection from '@/components/storefront/HeroSection';
import PremiumProductCard from '@/components/storefront/PremiumProductCard';
import GradientText from '@/components/storefront/ui/GradientText';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const StorefrontHome = () => {
  const { settings, trackPageView } = useStorefront();

  React.useEffect(() => {
    trackPageView();
  }, [trackPageView]);

  // جلب البانرات
  const { data: banners = [] } = useQuery({
    queryKey: ['storefront-banners', settings?.employee_id],
    queryFn: async () => {
      if (!settings?.employee_id) return [];
      const { data } = await supabase
        .from('employee_banners')
        .select('*')
        .eq('employee_id', settings.employee_id)
        .eq('is_active', true)
        .order('display_order');
      return data || [];
    },
    enabled: !!settings?.employee_id,
  });

  // جلب المنتجات المميزة
  const { data: products = [], isLoading } = useQuery({
    queryKey: ['storefront-featured-products', settings?.employee_id],
    queryFn: async () => {
      if (!settings?.employee_id) return [];
      
      const { data: customProducts } = await supabase
        .from('employee_product_descriptions')
        .select('product_id')
        .eq('employee_id', settings.employee_id)
        .eq('is_featured', true)
        .order('display_order');

      if (!customProducts || customProducts.length === 0) return [];

      const productIds = customProducts.map(p => p.product_id);

      const { data } = await supabase
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

      return data || [];
    },
    enabled: !!settings?.employee_id,
  });

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
  const [products, setProducts] = React.useState([]);

  React.useEffect(() => {
    const fetchProducts = async () => {
      const { data } = await supabase
        .from('products')
        .select(`
          *,
          variants:product_variants(*)
        `)
        .eq('is_active', true)
        .limit(50);
      setProducts(data || []);
    };
    fetchProducts();
  }, []);

  return (
    <StorefrontProvider slug={slug}>
      <StorefrontLayout products={products}>
        <StorefrontHome />
      </StorefrontLayout>
    </StorefrontProvider>
  );
};

export default StorefrontPageWrapper;
