import React from 'react';
import { Link } from 'react-router-dom';
import { useStorefront } from '@/contexts/StorefrontContext';
import { Badge } from '@/components/ui/badge';

const ProductCard = ({ product }) => {
  const { settings } = useStorefront();
  
  // جلب أول variant متاح
  const availableVariant = product.variants?.find(v => 
    (v.quantity - (v.reserved_quantity || 0)) > 0
  );

  if (!availableVariant) return null;

  const mainImage = availableVariant.images?.[0] || product.image || '/placeholder.png';
  const price = availableVariant.price;

  return (
    <Link to={`/storefront/${settings.storefront_slug}/products/${product.id}`}>
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
