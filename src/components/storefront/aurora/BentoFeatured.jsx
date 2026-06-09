import React from 'react';
import ProductCardAurora from './ProductCardAurora';
import { Star } from 'lucide-react';

const BentoFeatured = ({ slug, products = [] }) => {
  if (!products.length) return null;
  const items = products.slice(0, 5);

  return (
    <section className="px-3 sm:px-6 mt-10">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, rgb(var(--aurora-violet)), rgb(var(--aurora-fuchsia)))' }}>
          <Star className="w-4 h-4 text-white" />
        </div>
        <div>
          <h2 className="text-lg sm:text-xl font-black aurora-gradient-text">المنتجات المميزة</h2>
          <p className="text-xs" style={{ color: 'var(--aurora-text-dim)' }}>اختيارنا الذهبي لك</p>
        </div>
      </div>

      {/* Bento: 1 large + 4 small on lg, simple grid on mobile */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:auto-rows-[minmax(0,1fr)]">
        {items[0] && (
          <div className="md:col-span-2 md:row-span-2">
            <ProductCardAurora product={items[0]} slug={slug} size="lg" />
          </div>
        )}
        {items.slice(1).map((p) => (
          <div key={p.id}>
            <ProductCardAurora product={p} slug={slug} size="md" />
          </div>
        ))}
      </div>
    </section>
  );
};

export default BentoFeatured;
