import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { StorefrontProvider, useStorefront } from '@/contexts/StorefrontContext';
import StorefrontLayout from '@/components/storefront/StorefrontLayout';
import HeroSection from '@/components/storefront/HeroSection';
import ProductGrid from '@/components/storefront/ProductGrid';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const StorefrontHome = () => {
  const { settings, trackPageView } = useStorefront();
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    trackPageView();
  }, [trackPageView]);

  useEffect(() => {
    if (!settings?.employee_id) return;

    const fetchFeaturedProducts = async () => {
      try {
        setLoading(true);

        // جلب المنتجات المميزة للموظف
        const { data: customProducts } = await supabase
          .from('employee_product_descriptions')
          .select('product_id')
          .eq('employee_id', settings.employee_id)
          .eq('is_featured', true);

        const featuredIds = customProducts?.map(p => p.product_id) || [];

        if (featuredIds.length === 0) {
          setFeaturedProducts([]);
          return;
        }

        // جلب تفاصيل المنتجات
        const { data: products } = await supabase
          .from('products')
          .select(`
            *,
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
          .in('id', featuredIds)
          .eq('is_active', true);

        // فلترة المنتجات المتاحة
        const available = products?.filter(p => 
          p.variants?.some(v => (v.quantity - (v.reserved_quantity || 0)) > 0)
        ) || [];

        setFeaturedProducts(available);
      } catch (err) {
        console.error('Error fetching featured products:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchFeaturedProducts();
  }, [settings?.employee_id]);

  return (
    <div>
      <HeroSection />
      
      <div className="container mx-auto px-4 py-12">
        {/* منتجات مميزة */}
        <div className="mb-16">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold text-foreground">المنتجات المميزة</h2>
            <Link to={`/storefront/${settings.storefront_slug}/products`}>
              <Button variant="outline">عرض الكل</Button>
            </Link>
          </div>
          
          <ProductGrid products={featuredProducts} loading={loading} />
        </div>

        {/* قسم إضافي للترويج */}
        <div className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-lg p-8 md:p-12 text-center">
          <h3 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
            اكتشف مجموعتنا الكاملة
          </h3>
          <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
            تصفح جميع المنتجات المتاحة واختر ما يناسبك
          </p>
          <Link to={`/storefront/${settings.storefront_slug}/products`}>
            <Button size="lg">تسوق الآن</Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

const StorefrontPageWrapper = () => {
  const { slug } = useParams();

  return (
    <StorefrontProvider slug={slug}>
      <StorefrontLayout>
        <StorefrontHome />
      </StorefrontLayout>
    </StorefrontProvider>
  );
};

export default StorefrontPageWrapper;
