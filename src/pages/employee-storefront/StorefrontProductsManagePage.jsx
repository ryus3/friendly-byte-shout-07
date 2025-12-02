import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import ProductCustomizationPanel from '@/components/employee-storefront/ProductCustomizationPanel';
import ProductManagementCard from '@/components/storefront/dashboard/ProductManagementCard';
import GradientText from '@/components/storefront/ui/GradientText';
import PremiumLoader from '@/components/storefront/ui/PremiumLoader';
import { Search, Star, Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const StorefrontProductsManagePage = () => {
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [customDescriptions, setCustomDescriptions] = useState({});
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetchUser();
    fetchProducts();
    fetchCustomDescriptions();
    fetchFeaturedProducts();
  }, []);

  const fetchUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('can_upload_custom_images')
        .eq('user_id', user.id)
        .single();
      
      setUser({ ...user, can_upload_custom_images: profile?.can_upload_custom_images });
    }
  };

  const fetchProducts = async () => {
    try {
      const { data } = await supabase
        .from('products')
        .select(`
          *,
          variants:product_variants(
            id,
            price,
            images,
            color:colors(id, name, hex_code),
            size:sizes(id, name),
            inventory(quantity, reserved_quantity)
          )
        `)
        .eq('is_active', true);

      const available = data?.filter(p =>
        p.variants?.some(v => {
          const qty = v.inventory?.quantity || 0;
          const reserved = v.inventory?.reserved_quantity || 0;
          return (qty - reserved) > 0;
        })
      ) || [];

      setProducts(available);
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomDescriptions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('employee_product_descriptions')
        .select('*')
        .eq('employee_id', user.id);

      const descriptionsMap = {};
      data?.forEach(desc => {
        descriptionsMap[desc.product_id] = desc;
      });

      setCustomDescriptions(descriptionsMap);
    } catch (err) {
      console.error('Error fetching custom descriptions:', err);
    }
  };

  const fetchFeaturedProducts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('employee_product_descriptions')
        .select('product_id')
        .eq('employee_id', user.id)
        .eq('is_featured', true);

      setFeaturedProducts(data?.map(d => d.product_id) || []);
    } catch (err) {
      console.error('Error fetching featured products:', err);
    }
  };

  const toggleFeatured = async (productId) => {
    const isFeatured = featuredProducts.includes(productId);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (isFeatured) {
        await supabase
          .from('employee_product_descriptions')
          .update({ is_featured: false })
          .eq('employee_id', user.id)
          .eq('product_id', productId);
        
        setFeaturedProducts(prev => prev.filter(id => id !== productId));
      } else {
        const existing = customDescriptions[productId];
        
        if (existing) {
          await supabase
            .from('employee_product_descriptions')
            .update({ is_featured: true })
            .eq('id', existing.id);
        } else {
          await supabase
            .from('employee_product_descriptions')
            .insert({
              employee_id: user.id,
              product_id: productId,
              is_featured: true
            });
        }
        
        setFeaturedProducts(prev => [...prev, productId]);
      }
      
      await fetchCustomDescriptions();
    } catch (err) {
      console.error('Error toggling featured:', err);
    }
  };

  const filteredProducts = products.filter(p =>
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.brand?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const featuredProductsList = filteredProducts.filter(p => featuredProducts.includes(p.id));

  if (loading) {
    return <PremiumLoader message="جاري تحميل المنتجات..." />;
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 bg-gradient-to-br from-background via-background to-purple-50 dark:to-purple-950/20 min-h-screen space-y-6 sm:space-y-8">
      {/* Header */}
      <GradientText gradient="from-purple-600 via-pink-600 to-blue-600" className="text-2xl sm:text-3xl md:text-4xl">
        إدارة المنتجات
      </GradientText>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
        {/* Products List */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
            <GradientText gradient="from-purple-600 to-pink-600" className="text-xl sm:text-2xl">
              منتجات المتجر ({filteredProducts.length})
            </GradientText>
            
            <div className="relative w-full sm:w-72">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ابحث عن منتج..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10 border-2"
              />
            </div>
          </div>
          
          <div className="space-y-4">
            {filteredProducts.map(product => (
              <ProductManagementCard
                key={product.id}
                product={product}
                isFeatured={featuredProducts.includes(product.id)}
                onToggleFeatured={() => toggleFeatured(product.id)}
                onEditDescription={() => setSelectedProduct(product)}
                canUploadImages={user?.can_upload_custom_images}
              />
            ))}
          </div>
        </div>
        
        {/* Featured Products Sidebar */}
        <div className="lg:col-span-1">
          <div className="sticky top-8 p-6 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 rounded-3xl shadow-2xl border-4 border-purple-200 dark:border-purple-800">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-xl bg-gradient-to-r from-yellow-400 to-orange-500 shadow-lg">
                <Star className="h-6 w-6 text-white fill-white" />
              </div>
              <div>
                <GradientText gradient="from-purple-600 to-pink-600" className="text-xl font-bold">
                  المنتجات المميزة
                </GradientText>
                <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0">
                  {featuredProducts.length} منتج
                </Badge>
              </div>
            </div>
            
            {featuredProductsList.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <Package className="h-16 w-16 mx-auto text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">لا توجد منتجات مميزة</p>
                <p className="text-xs text-muted-foreground">اضغط على نجمة لإضافة منتج</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {featuredProductsList.map(product => {
                  const firstVariant = product.variants?.[0];
                  const imageUrl = firstVariant?.images?.[0] || '/placeholder.png';
                  
                  return (
                    <div 
                      key={product.id}
                      className="flex items-center gap-3 p-3 bg-white dark:bg-gray-900 rounded-xl shadow-lg hover:shadow-xl transition-all cursor-pointer border-2 border-transparent hover:border-purple-300 dark:hover:border-purple-700"
                      onClick={() => setSelectedProduct(product)}
                    >
                      <img 
                        src={imageUrl} 
                        alt={product.name}
                        className="w-16 h-16 rounded-lg object-cover shadow"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold truncate text-sm">{product.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{product.brand}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Product Customization Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-3xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <ProductCustomizationPanel
              product={selectedProduct}
              customDescription={customDescriptions[selectedProduct.id]}
              canUploadImages={user?.can_upload_custom_images}
              onSave={() => {
                fetchCustomDescriptions();
                setSelectedProduct(null);
              }}
            />
            <div className="p-6 border-t flex gap-4">
              <button
                onClick={() => setSelectedProduct(null)}
                className="flex-1 px-6 py-3 rounded-xl bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StorefrontProductsManagePage;
