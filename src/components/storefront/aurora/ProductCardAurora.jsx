import React, { useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, Eye, Sparkles } from 'lucide-react';
import { useStorefront } from '@/contexts/StorefrontContext';

const ProductCardAurora = ({ product, slug, size = 'md', showBadge = true }) => {
  const cardRef = useRef(null);
  const [hovered, setHovered] = useState(false);
  const { addToCart } = useStorefront();

  const availableVariant = product.variants?.find(v => {
    const qty = v.inventory?.quantity ?? v.quantity ?? 0;
    const reserved = v.inventory?.reserved_quantity ?? v.reserved_quantity ?? 0;
    return (qty - reserved) > 0;
  });
  if (!availableVariant) return null;

  const mainImage = availableVariant.images?.[0] || product.image || '/placeholder.png';
  const hoverImage = availableVariant.images?.[1] || mainImage;
  const price = availableVariant.price;
  const isNew = product.created_at && (Date.now() - new Date(product.created_at).getTime()) < 7 * 86400000;

  const onMove = useCallback((e) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX ?? e.touches?.[0]?.clientX ?? 0) - rect.left) / rect.width;
    const y = ((e.clientY ?? e.touches?.[0]?.clientY ?? 0) - rect.top) / rect.height;
    el.style.setProperty('--ty', `${(x - 0.5) * 8}deg`);
    el.style.setProperty('--tx', `${(0.5 - y) * 8}deg`);
  }, []);
  const onLeave = useCallback(() => {
    const el = cardRef.current;
    if (!el) return;
    el.style.setProperty('--tx', '0deg');
    el.style.setProperty('--ty', '0deg');
    setHovered(false);
  }, []);

  const handleQuickAdd = (e) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart?.({
      productId: product.id,
      variantId: availableVariant.id,
      name: product.name,
      price,
      image: mainImage,
      color: availableVariant.color?.name,
      size: availableVariant.size?.name,
    }, 1);
  };

  const aspect = size === 'lg' ? 'aspect-[4/5]' : size === 'sm' ? 'aspect-square' : 'aspect-[4/5]';

  return (
    <div
      ref={cardRef}
      className="aurora-tilt glass overflow-hidden group relative"
      onMouseMove={onMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={onLeave}
      onTouchMove={onMove}
      onTouchEnd={onLeave}
      style={{ borderRadius: 'var(--aurora-radius)' }}
    >
      <Link to={`/storefront/${slug}/product/${product.id}`} className="block">
        <div className={`relative ${aspect} overflow-hidden`} style={{ borderRadius: 'inherit' }}>
          <img
            src={hovered ? hoverImage : mainImage}
            alt={product.name}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
          {/* gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-transparent opacity-60 group-hover:opacity-90 transition-opacity" />

          {/* Top badges */}
          {showBadge && (
            <div className="absolute top-3 inset-inline-start-3 flex flex-col gap-1.5 z-10" style={{ insetInlineStart: 12 }}>
              {isNew && (
                <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full text-white aurora-pulse"
                  style={{ background: 'linear-gradient(135deg, rgb(var(--aurora-violet)), rgb(var(--aurora-fuchsia)))' }}>
                  جديد ✨
                </span>
              )}
            </div>
          )}

          {/* Quick actions */}
          <div className="absolute bottom-3 inset-inline-end-3 flex gap-2 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 z-10"
            style={{ insetInlineEnd: 12 }}>
            <button
              onClick={handleQuickAdd}
              aria-label="أضف للسلة"
              className="w-10 h-10 rounded-full glass-hi flex items-center justify-center hover:scale-110 transition-transform"
              style={{ color: 'var(--aurora-text)' }}
            >
              <ShoppingCart className="w-4 h-4" />
            </button>
            <Link
              to={`/storefront/${slug}/product/${product.id}`}
              aria-label="عرض سريع"
              onClick={(e) => e.stopPropagation()}
              className="w-10 h-10 rounded-full glass-hi flex items-center justify-center hover:scale-110 transition-transform"
              style={{ color: 'var(--aurora-text)' }}
            >
              <Eye className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Content */}
        <div className="p-3 sm:p-4 space-y-2">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3 h-3" style={{ color: 'rgb(var(--aurora-cyan))' }} />
            <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: 'var(--aurora-text-dim)' }}>
              {product.category?.name || product.department?.name || 'عام'}
            </span>
          </div>
          <h3 className="text-sm sm:text-base font-bold line-clamp-2 leading-snug" style={{ color: 'var(--aurora-text)' }}>
            {product.name}
          </h3>
          <div className="flex items-baseline gap-2">
            <span className="text-base sm:text-lg font-black aurora-gradient-text">
              {price.toLocaleString('ar-IQ')}
            </span>
            <span className="text-[10px] font-bold" style={{ color: 'var(--aurora-text-dim)' }}>د.ع</span>
          </div>
        </div>
      </Link>
    </div>
  );
};

export default ProductCardAurora;
