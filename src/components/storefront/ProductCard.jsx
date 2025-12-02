import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useStorefront } from '@/contexts/StorefrontContext';
import { Badge } from '@/components/ui/badge';

const ProductCard = ({ product }) => {
  const { settings } = useStorefront();
  const { slug: urlSlug } = useParams();
  
  // استخدام slug من URL أو من settings
  const storeSlug = settings?.slug || urlSlug;
  
  // جلب أول variant متاح مع دعم هيكل المخزون
  const availableVariant = product.variants?.find(v => {
    const qty = v.inventory?.quantity ?? v.quantity ?? 0;
    const reserved = v.inventory?.reserved_quantity ?? v.reserved_quantity ?? 0;
    return (qty - reserved) > 0;
  });

  if (!availableVariant) return null;

  const mainImage = availableVariant.images?.[0] || product.image || '/placeholder.png';
  const price = availableVariant.price;
  const colorName = availableVariant.color?.name || availableVariant.color || '';

  return (
    <Link to={`/storefront/${storeSlug}/products/${product.id}`}>
      <div className="group relative overflow-hidden rounded-lg border border-border bg-card hover:shadow-lg transition-all duration-300">
        {/* صورة المنتج */}
        <div className="aspect-square overflow-hidden bg-muted">
          <img
            src={mainImage}
            alt={product.name}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        </div>

        {/* معلومات المنتج */}
        <div className="p-4 space-y-2">
          <h3 className="font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
            {product.name}
          </h3>
          
          {product.brand && (
            <p className="text-sm text-muted-foreground">{product.brand}</p>
          )}

          <div className="flex items-center justify-between">
            <span className="text-lg font-bold text-primary">
              {price?.toLocaleString('ar-IQ')} IQD
            </span>
            
            {product.variants && product.variants.length > 1 && (
              <Badge variant="secondary" className="text-xs">
                {product.variants.length} خيار
              </Badge>
            )}
          </div>
        </div>

        {/* شارة "جديد" إذا كان المنتج حديث */}
        {new Date() - new Date(product.created_at) < 7 * 24 * 60 * 60 * 1000 && (
          <Badge className="absolute top-2 right-2">جديد</Badge>
        )}
      </div>
    </Link>
  );
};

export default ProductCard;
