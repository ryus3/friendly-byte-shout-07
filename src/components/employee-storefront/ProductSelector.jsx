import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star, StarOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const ProductSelector = ({ products, selectedProduct, customDescriptions, onSelect, onRefresh }) => {
  const toggleFeatured = async (productId, isFeatured) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (isFeatured) {
        const { error } = await supabase
          .from('employee_product_descriptions')
          .update({ is_featured: false })
          .eq('employee_id', user.id)
          .eq('product_id', productId);

        if (error) throw error;
      } else {
        const existing = customDescriptions[productId];

        if (existing) {
          const { error } = await supabase
            .from('employee_product_descriptions')
            .update({ is_featured: true })
            .eq('id', existing.id);

          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('employee_product_descriptions')
            .insert({
              employee_id: user.id,
              product_id: productId,
              is_featured: true
            });

          if (error) throw error;
        }
      }

      onRefresh();
      toast({
        title: isFeatured ? 'تمت الإزالة' : 'تمت الإضافة',
        description: isFeatured ? 'تمت إزالة المنتج من المميزة' : 'تمت إضافة المنتج للمنتجات المميزة'
      });
    } catch (err) {
      console.error('Error toggling featured:', err);
      toast({
        title: 'خطأ',
        description: 'فشل تحديث المنتج',
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="space-y-2 max-h-[600px] overflow-y-auto">
      {products.map(product => {
        const customDesc = customDescriptions[product.id];
        const isFeatured = customDesc?.is_featured || false;
        const isSelected = selectedProduct?.id === product.id;

        return (
          <div
            key={product.id}
            className={`p-3 border rounded-lg cursor-pointer transition-all ${
              isSelected ? 'border-primary bg-primary/5' : 'hover:bg-accent'
            }`}
            onClick={() => onSelect(product)}
          >
            <div className="flex items-start gap-3">
              <img
                src={product.variants?.[0]?.images?.[0] || product.image || '/placeholder.png'}
                alt={product.name}
                className="w-16 h-16 object-cover rounded"
              />

              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm truncate">{product.name}</h4>
                <p className="text-xs text-muted-foreground">{product.brand}</p>
                <div className="flex items-center gap-2 mt-1">
                  {isFeatured && (
                    <Badge variant="default" className="text-xs">مميز</Badge>
                  )}
                  {customDesc && (
                    <Badge variant="secondary" className="text-xs">مخصص</Badge>
                  )}
                </div>
              </div>

              <Button
                variant={isFeatured ? 'default' : 'outline'}
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFeatured(product.id, isFeatured);
                }}
              >
                {isFeatured ? <Star className="h-4 w-4 fill-current" /> : <StarOff className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ProductSelector;
