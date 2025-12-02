import React from 'react';
import { useParams } from 'react-router-dom';
import PremiumProductCard from './PremiumProductCard';
import { Skeleton } from '@/components/ui/skeleton';

const ProductGrid = ({ products, loading }) => {
  const { slug } = useParams();
  
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-64 w-full rounded-2xl" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-6 w-1/3" />
          </div>
        ))}
      </div>
    );
  }

  if (!products || products.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="mb-4 text-6xl">🛒</div>
        <p className="text-muted-foreground text-lg">لا توجد منتجات متاحة حالياً</p>
        <p className="text-muted-foreground text-sm mt-2">تحقق مرة أخرى قريباً!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {products.map((product) => (
        <PremiumProductCard key={product.id} product={product} slug={slug} />
      ))}
    </div>
  );
};

export default ProductGrid;
