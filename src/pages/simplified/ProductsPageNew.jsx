/**
 * 📦 صفحة المنتجات المبسطة
 * 
 * نموذج للصفحة الجديدة:
 * - بيانات من API واحد
 * - كود بسيط ومفهوم
 * - تصميم جميل محفوظ
 * - real-time updates
 */

import React, { useState } from 'react';
import { Search, Plus, Filter, Grid, List } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import { useProducts } from '@/core/hooks/useData';
import { useAppData } from '@/core/components/DataProvider';

export const ProductsPageNew = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // grid | list
  const [selectedCategory, setSelectedCategory] = useState('all');

  const { canManageProducts } = useAppData();
  
  // جلب المنتجات مع real-time updates
  const { data: products, loading, create, update, remove } = useProducts({
    ...(selectedCategory !== 'all' && { category: selectedCategory })
  });

  // فلترة المنتجات حسب البحث
  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.barcode?.includes(searchTerm)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">المنتجات</h1>
          <p className="text-muted-foreground">إدارة وعرض المنتجات</p>
        </div>
        
        {canManageProducts && (
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            إضافة منتج
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="البحث في المنتجات..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* View Mode */}
            <div className="flex border rounded-md">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="rounded-r-none"
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="rounded-l-none"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Products Grid/List */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map((product) => (
            <ProductCard 
              key={product.id} 
              product={product}
              onUpdate={update}
              onDelete={remove}
              canManage={canManageProducts}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredProducts.map((product) => (
            <ProductListItem 
              key={product.id} 
              product={product}
              onUpdate={update}
              onDelete={remove}
              canManage={canManageProducts}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {filteredProducts.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">لا توجد منتجات</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm ? 'لم يتم العثور على منتجات تطابق البحث' : 'لم يتم إضافة أي منتجات بعد'}
            </p>
            {canManageProducts && !searchTerm && (
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                إضافة منتج جديد
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// مكون بطاقة المنتج
const ProductCard = ({ product, onUpdate, onDelete, canManage }) => {
  const variants = product.product_variants || [];
  const totalStock = variants.reduce((sum, v) => sum + (v.quantity || 0), 0);

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      {/* Product Image */}
      <div className="aspect-square bg-muted relative">
        {product.image_url ? (
          <img 
            src={product.image_url} 
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Package className="h-12 w-12 text-muted-foreground" />
          </div>
        )}
        
        {/* Stock Badge */}
        <Badge 
          variant={totalStock > 10 ? 'default' : totalStock > 0 ? 'secondary' : 'destructive'}
          className="absolute top-2 right-2"
        >
          {totalStock} قطعة
        </Badge>
      </div>

      <CardContent className="p-4">
        <div className="space-y-2">
          <h3 className="font-medium line-clamp-2">{product.name}</h3>
          
          {product.barcode && (
            <p className="text-xs text-muted-foreground font-mono">
              {product.barcode}
            </p>
          )}

          {/* Variants Summary */}
          {variants.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {variants.slice(0, 3).map((variant) => (
                <Badge key={variant.id} variant="outline" className="text-xs">
                  {variant.colors?.name} - {variant.sizes?.name}
                </Badge>
              ))}
              {variants.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{variants.length - 3}
                </Badge>
              )}
            </div>
          )}

          {/* Price Range */}
          {variants.length > 0 && (
            <div className="text-sm font-medium">
              {Math.min(...variants.map(v => v.selling_price)).toLocaleString()} - {' '}
              {Math.max(...variants.map(v => v.selling_price)).toLocaleString()} د.ع
            </div>
          )}
        </div>

        {canManage && (
          <div className="flex gap-2 mt-4">
            <Button variant="outline" size="sm" className="flex-1">
              تعديل
            </Button>
            <Button variant="outline" size="sm" className="flex-1">
              عرض
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// مكون عنصر القائمة
const ProductListItem = ({ product, onUpdate, onDelete, canManage }) => {
  const variants = product.product_variants || [];
  const totalStock = variants.reduce((sum, v) => sum + (v.quantity || 0), 0);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          {/* Product Image */}
          <div className="w-16 h-16 bg-muted rounded-md flex-shrink-0">
            {product.image_url ? (
              <img 
                src={product.image_url} 
                alt={product.name}
                className="w-full h-full object-cover rounded-md"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <Package className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium truncate">{product.name}</h3>
            {product.barcode && (
              <p className="text-sm text-muted-foreground font-mono">
                {product.barcode}
              </p>
            )}
            <div className="flex items-center gap-4 mt-1">
              <Badge 
                variant={totalStock > 10 ? 'default' : totalStock > 0 ? 'secondary' : 'destructive'}
              >
                {totalStock} قطعة
              </Badge>
              <span className="text-sm text-muted-foreground">
                {variants.length} متغير
              </span>
            </div>
          </div>

          {/* Actions */}
          {canManage && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                تعديل
              </Button>
              <Button variant="outline" size="sm">
                عرض
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ProductsPageNew;