import React from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, Heart, Eye, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import AnimatedBadge from './ui/AnimatedBadge';

const PremiumProductCard = ({ product, slug }) => {
  const [isHovered, setIsHovered] = React.useState(false);
  
  // دعم هيكل المخزون المرن
  const availableVariant = product.variants?.find(v => {
    const qty = v.inventory?.quantity ?? v.quantity ?? 0;
    const reserved = v.inventory?.reserved_quantity ?? v.reserved_quantity ?? 0;
    return (qty - reserved) > 0;
  });

  if (!availableVariant) return null;

  const mainImage = availableVariant.images?.[0] || product.image || '/placeholder.png';
  const hoverImage = availableVariant.images?.[1] || mainImage;
  const price = availableVariant.price;
  const originalPrice = price * 1.4;
  const discount = Math.round(((originalPrice - price) / originalPrice) * 100);
  
  const isNew = new Date() - new Date(product.created_at) < 7 * 24 * 60 * 60 * 1000;
  const isFeatured = product.is_featured || Math.random() > 0.7;
  const rating = 4 + Math.random();
  const reviews = Math.floor(Math.random() * 500) + 10;

  // جلب اللون بشكل مرن
  const colorData = availableVariant.color;
  const colorName = typeof colorData === 'object' ? colorData?.name : colorData;
  const colorHex = typeof colorData === 'object' ? colorData?.hex_code : null;

  // جمع الألوان المتاحة
  const availableColors = product.variants
    ?.filter(v => {
      const qty = v.inventory?.quantity ?? v.quantity ?? 0;
      const reserved = v.inventory?.reserved_quantity ?? v.reserved_quantity ?? 0;
      return (qty - reserved) > 0;
    })
    ?.map(v => {
      const c = v.color;
      return typeof c === 'object' ? c : { name: c, hex_code: null };
    })
    ?.filter((c, i, arr) => arr.findIndex(x => x.name === c.name) === i)
    ?.slice(0, 5) || [];

  return (
    <div
      className="group relative overflow-hidden rounded-2xl bg-card shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-2"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Image Container */}
      <Link to={`/storefront/${slug}/product/${product.id}`} className="block">
        <div className="relative aspect-square overflow-hidden bg-muted">
          {/* Main Image */}
          <img
            src={isHovered ? hoverImage : mainImage}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            loading="lazy"
          />

          {/* Hover Overlay with Quick Actions */}
          <div className={cn(
            "absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          )}>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              <button className="p-3 bg-white/90 backdrop-blur-sm rounded-full hover:bg-white transition-all shadow-lg hover:scale-110">
                <ShoppingCart className="w-5 h-5 text-gray-800" />
              </button>
              <button className="p-3 bg-white/90 backdrop-blur-sm rounded-full hover:bg-white transition-all shadow-lg hover:scale-110">
                <Heart className="w-5 h-5 text-red-500" />
              </button>
              <button className="p-3 bg-white/90 backdrop-blur-sm rounded-full hover:bg-white transition-all shadow-lg hover:scale-110">
                <Eye className="w-5 h-5 text-blue-500" />
              </button>
            </div>
          </div>

          {/* Badges */}
          <div className="absolute top-3 right-3 flex flex-col gap-2">
            {isNew && (
              <AnimatedBadge variant="success" glow>
                جديد ✨
              </AnimatedBadge>
            )}
            {discount > 0 && (
              <AnimatedBadge variant="danger" pulse glow>
                -{discount}% 🔥
              </AnimatedBadge>
            )}
            {isFeatured && (
              <AnimatedBadge variant="premium" glow>
                مميز ⭐
              </AnimatedBadge>
            )}
          </div>
        </div>
      </Link>

      {/* Content */}
      <div className="p-5 space-y-3">
        {/* Category */}
        <span className="text-xs bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent font-semibold uppercase">
          {product.category?.name || product.department?.name || 'عام'}
        </span>

        {/* Title */}
        <Link to={`/storefront/${slug}/product/${product.id}`}>
          <h3 className="text-lg font-bold text-foreground line-clamp-2 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:to-purple-600 transition-all">
            {product.name}
          </h3>
        </Link>

        {/* Rating */}
        <div className="flex items-center gap-2">
          <div className="flex">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={cn(
                  "w-4 h-4",
                  i < Math.floor(rating) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
                )}
              />
            ))}
          </div>
          <span className="text-sm text-muted-foreground">({reviews})</span>
        </div>

        {/* Price */}
        <div className="flex items-center gap-3">
          {discount > 0 && (
            <span className="text-gray-400 line-through text-sm">
              {originalPrice.toLocaleString('ar-IQ')} IQD
            </span>
          )}
          <span className="text-2xl font-black bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            {price.toLocaleString('ar-IQ')} IQD
          </span>
        </div>

        {/* Colors Preview */}
        {availableColors.length > 0 && (
          <div className="flex gap-2">
            {availableColors.map((color, idx) => (
              <div
                key={idx}
                className="w-6 h-6 rounded-full border-2 border-gray-200 hover:scale-125 transition-transform cursor-pointer shadow-sm"
                style={{ backgroundColor: color.hex_code || '#ccc' }}
                title={color.name}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PremiumProductCard;
