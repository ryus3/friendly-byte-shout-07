import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import ProductCustomizationPanel from '@/components/employee-storefront/ProductCustomizationPanel';
import ProductManagementCard from '@/components/storefront/dashboard/ProductManagementCard';
import GradientText from '@/components/storefront/ui/GradientText';
import PremiumLoader from '@/components/storefront/ui/PremiumLoader';
import { Search, Star, Package, Store, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';

const StorefrontProductsManagePage = () => {
  const [products, setProducts] = useState([]);
  const [allowedProductIds, setAllowedProductIds] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [customDescriptions, setCustomDescriptions] = useState({});
  const [storefrontProducts, setStorefrontProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([
      fetchUser(),
      fetchAllowedProducts(),
      fetchCustomDescriptions(),
      fetchStorefrontProducts()
    ]);
    setLoading(false);
  };

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

  // جلب المنتجات المسموحة للموظف من الجدول الجديد
  const fetchAllowedProducts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // جلب IDs المنتجات المسموحة
      const { data: allowedData, error: allowedError } = await supabase
        .from('employee_allowed_products')
        .select('product_id')
        .eq('employee_id', user.id)
        .eq('is_active', true);

      if (allowedError) throw allowedError;

      const productIds = allowedData?.map(ap => ap.product_id) || [];
      setAllowedProductIds(productIds);

      if (productIds.length === 0) {
        setProducts([]);
        return;
      }

      // جلب تفاصيل المنتجات المسموحة
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select(`
          *,
          variants:product_variants(
            id,
            price,
            images,
            color:colors(id, name, hex_code),
            size:sizes(id, name),
            inventory!inventory_variant_id_fkey(quantity, reserved_quantity)
          )
        `)
        .in('id', productIds)
        .eq('is_active', true);

      if (productsError) throw productsError;

      // فلترة المنتجات التي لديها مخزون متاح
      const available = productsData?.filter(p =>
        p.variants?.some(v => {
          const qty = v.inventory?.quantity || 0;
          const reserved = v.inventory?.reserved_quantity || 0;
          return (qty - reserved) > 0;
        })
      ) || [];

      setProducts(available);
    } catch (err) {
      console.error('Error fetching allowed products:', err);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ في جلب المنتجات المسموحة',
        variant: 'destructive'
      });
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

  // جلب المنتجات المعروضة في المتجر (is_in_storefront = true)
  const fetchStorefrontProducts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('employee_product_descriptions')
        .select('product_id')
        .eq('employee_id', user.id)
        .eq('is_in_storefront', true);

      setStorefrontProducts(data?.map(d => d.product_id) || []);
    } catch (err) {
      console.error('Error fetching storefront products:', err);
    }
  };

  // تبديل عرض المنتج في المتجر
  const toggleStorefront = async (productId) => {
    const isInStorefront = storefrontProducts.includes(productId);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const existing = customDescriptions[productId];

      if (isInStorefront) {
        // إزالة من المتجر
        if (existing) {
          await supabase
            .from('employee_product_descriptions')
            .update({ is_in_storefront: false })
            .eq('id', existing.id);
        }
        setStorefrontProducts(prev => prev.filter(id => id !== productId));
        toast({ title: 'تم إزالة المنتج من المتجر' });
      } else {
        // إضافة للمتجر
        if (existing) {
          await supabase
            .from('employee_product_descriptions')
            .update({ is_in_storefront: true })
            .eq('id', existing.id);
        } else {
          await supabase
            .from('employee_product_descriptions')
            .insert({
              employee_id: user.id,
              product_id: productId,
              is_in_storefront: true
            });
        }
        setStorefrontProducts(prev => [...prev, productId]);
        toast({ title: 'تمت إضافة المنتج للمتجر' });
      }
      
      await fetchCustomDescriptions();
    } catch (err) {
      console.error('Error toggling storefront:', err);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ في تحديث المنتج',
        variant: 'destructive'
      });
    }
  };

  // تبديل المنتج المميز
  const toggleFeatured = async (productId) => {
    const existing = customDescriptions[productId];
    const isFeatured = existing?.is_featured;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (existing) {
        await supabase
          .from('employee_product_descriptions')
          .update({ is_featured: !isFeatured })
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
      
      await fetchCustomDescriptions();
      toast({ title: isFeatured ? 'تم إلغاء التمييز' : 'تم تمييز المنتج' });
    } catch (err) {
      console.error('Error toggling featured:', err);
    }
  };

  const filteredProducts = products.filter(p =>
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.brand?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const storefrontProductsList = filteredProducts.filter(p => storefrontProducts.includes(p.id));

  if (loading) {
    return <PremiumLoader message="جاري تحميل المنتجات..." />;
  }

  // إذا لم تكن هناك منتجات مسموحة
  if (allowedProductIds.length === 0) {
    return (
      <div className="p-4 sm:p-6 md:p-8 bg-gradient-to-br from-background via-background to-purple-50 dark:to-purple-950/20 min-h-screen">
        <GradientText gradient="from-purple-600 via-pink-600 to-blue-600" className="text-2xl sm:text-3xl md:text-4xl mb-8">
          إدارة المنتجات
        </GradientText>
        
        <Card className="max-w-2xl mx-auto border-2 border-orange-200 dark:border-orange-800">
          <CardContent className="text-center py-16 space-y-4">
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-r from-orange-100 to-yellow-100 dark:from-orange-900/30 dark:to-yellow-900/30 flex items-center justify-center">
              <AlertCircle className="h-10 w-10 text-orange-500" />
            </div>
            <h3 className="text-xl font-bold">لا توجد منتجات مسموحة</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              لم يتم تخصيص أي منتجات لمتجرك بعد. تواصل مع المدير لإضافة منتجات لقائمتك المسموحة.
            </p>
          </CardContent>
        </Card>
      </div>
    );
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
            <div>
              <GradientText gradient="from-purple-600 to-pink-600" className="text-xl sm:text-2xl">
                منتجاتك المسموحة ({filteredProducts.length})
              </GradientText>
              <p className="text-sm text-muted-foreground mt-1">
                اختر المنتجات التي تريد عرضها في متجرك
              </p>
            </div>
            
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
            {filteredProducts.map(product => {
              const isInStorefront = storefrontProducts.includes(product.id);
              const isFeatured = customDescriptions[product.id]?.is_featured;
              
              return (
                <div key={product.id} className="relative">
                  <ProductManagementCard
                    product={product}
                    isFeatured={isFeatured}
                    onToggleFeatured={() => toggleFeatured(product.id)}
                    onEditDescription={() => setSelectedProduct(product)}
                    canUploadImages={user?.can_upload_custom_images}
                  />
                  {/* زر إضافة/إزالة من المتجر */}
                  <div className="absolute top-3 left-3">
                    <Button
                      size="sm"
                      variant={isInStorefront ? "default" : "outline"}
                      className={isInStorefront 
                        ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0" 
                        : "border-purple-300 text-purple-600 hover:bg-purple-50"
                      }
                      onClick={() => toggleStorefront(product.id)}
                    >
                      <Store className="h-4 w-4 ml-1" />
                      {isInStorefront ? 'في المتجر' : 'أضف للمتجر'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Storefront Products Sidebar */}
        <div className="lg:col-span-1">
          <div className="sticky top-8 p-6 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 rounded-3xl shadow-2xl border-4 border-purple-200 dark:border-purple-800">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 shadow-lg">
                <Store className="h-6 w-6 text-white" />
              </div>
              <div>
                <GradientText gradient="from-purple-600 to-pink-600" className="text-xl font-bold">
                  منتجات متجرك
                </GradientText>
                <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0">
                  {storefrontProducts.length} منتج
                </Badge>
              </div>
            </div>
            
            {storefrontProductsList.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <Package className="h-16 w-16 mx-auto text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">لا توجد منتجات في متجرك</p>
                <p className="text-xs text-muted-foreground">اضغط "أضف للمتجر" لإضافة منتج</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {storefrontProductsList.map(product => {
                  const firstVariant = product.variants?.[0];
                  const imageUrl = firstVariant?.images?.[0] || '/placeholder.png';
                  const isFeatured = customDescriptions[product.id]?.is_featured;
                  
                  return (
                    <div 
                      key={product.id}
                      className="flex items-center gap-3 p-3 bg-white dark:bg-gray-900 rounded-xl shadow-lg hover:shadow-xl transition-all cursor-pointer border-2 border-transparent hover:border-purple-300 dark:hover:border-purple-700"
                      onClick={() => setSelectedProduct(product)}
                    >
                      <div className="relative">
                        <img 
                          src={imageUrl} 
                          alt={product.name}
                          className="w-16 h-16 rounded-lg object-cover shadow"
                        />
                        {isFeatured && (
                          <Star className="absolute -top-1 -right-1 h-5 w-5 text-yellow-500 fill-yellow-500" />
                        )}
                      </div>
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