import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star, Edit, Upload } from 'lucide-react';
import GradientButton from '@/components/storefront/ui/GradientButton';

const ProductManagementCard = ({ product, isFeatured, onToggleFeatured, onEditDescription, canUploadImages }) => {
  const firstVariant = product.variants?.[0];
  const imageUrl = firstVariant?.images?.[0] || '/placeholder.png';
  const price = firstVariant?.price || 0;

  return (
    <Card className="overflow-hidden hover:shadow-xl transition-all duration-300">
      <div className="flex gap-4 p-4">
        <div className="relative w-24 h-24 rounded-xl overflow-hidden shadow-lg flex-shrink-0">
          <img 
            src={imageUrl} 
            alt={product.name}
            className="w-full h-full object-cover"
          />
          {isFeatured && (
            <div className="absolute top-1 left-1 bg-yellow-500 rounded-full p-1 shadow-lg">
              <Star className="h-4 w-4 text-white fill-white" />
            </div>
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-lg truncate">{product.name}</h3>
          <p className="text-sm text-muted-foreground truncate">{product.brand}</p>
          <p className="text-lg font-bold text-primary mt-1">
            {price.toLocaleString('ar-IQ')} IQD
          </p>
        </div>
        
        <div className="flex flex-col gap-2">
          <Button
            variant={isFeatured ? 'default' : 'outline'}
            size="sm"
            onClick={onToggleFeatured}
            className="gap-2"
          >
            <Star className={`h-4 w-4 ${isFeatured ? 'fill-white' : ''}`} />
            {isFeatured ? 'مميز' : 'تمييز'}
          </Button>
          
          <GradientButton
            gradient="from-blue-500 to-purple-500"
            onClick={onEditDescription}
            className="text-sm"
          >
            <Edit className="h-4 w-4 ml-1" />
            تعديل
          </GradientButton>
          
          {canUploadImages && (
            <Button variant="outline" size="sm">
              <Upload className="h-4 w-4 ml-1" />
              صور
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};

export default ProductManagementCard;
