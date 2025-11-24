import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import ProductSelector from '@/components/employee-storefront/ProductSelector';
import CustomDescriptionEditor from '@/components/employee-storefront/CustomDescriptionEditor';
import { Search } from 'lucide-react';

const StorefrontProductsManagePage = () => {
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [customDescriptions, setCustomDescriptions] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
    fetchCustomDescriptions();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data } = await supabase
        .from('products')
        .select(`
          *,
          variants:product_variants(
            id,
            color,
            size,
            price,
            quantity,
            reserved_quantity,
            images
          )
        `)
        .eq('is_active', true);

      const available = data?.filter(p =>
        p.variants?.some(v => (v.quantity - (v.reserved_quantity || 0)) > 0)
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

  const filteredProducts = products.filter(p =>
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.brand?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-6">
      <h1 className="text-3xl font-bold">إدارة المنتجات</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* قائمة المنتجات */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>المنتجات المتاحة</CardTitle>
              <div className="relative mt-2">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="ابحث عن منتج..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10"
                />
              </div>
            </CardHeader>
            <CardContent>
              <ProductSelector
                products={filteredProducts}
                selectedProduct={selectedProduct}
                customDescriptions={customDescriptions}
                onSelect={setSelectedProduct}
                onRefresh={fetchCustomDescriptions}
              />
            </CardContent>
          </Card>
        </div>

        {/* محرر الوصف المخصص */}
        <div className="lg:col-span-2">
          {selectedProduct ? (
            <CustomDescriptionEditor
              product={selectedProduct}
              customDescription={customDescriptions[selectedProduct.id]}
              onSave={fetchCustomDescriptions}
            />
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-96">
                <p className="text-muted-foreground">اختر منتجاً لإضافة وصف مخصص</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default StorefrontProductsManagePage;
