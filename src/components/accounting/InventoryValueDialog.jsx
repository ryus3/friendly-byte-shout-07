import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Box, Package, Tag, Calendar, BarChart3, Warehouse, Shield } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('ar-IQ', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0) + ' د.ع';
};

const CategoryCard = ({ title, items, icon: Icon, color }) => {
  const totalValue = items.reduce((sum, item) => sum + item.value, 0);
  const totalAvailable = items.reduce((sum, item) => sum + item.available_value, 0);
  const totalReserved = items.reduce((sum, item) => sum + item.reserved_value, 0);

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className={`flex items-center gap-2 text-lg text-${color}-600`}>
          <Icon className="w-5 h-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* إجمالي القيمة */}
          <div className={`p-4 rounded-lg bg-${color}-50 border border-${color}-200`}>
            <div className="text-center">
              <div className={`text-2xl font-bold text-${color}-700 mb-1`}>
                {formatCurrency(totalValue)}
              </div>
              <Badge variant="outline" className={`text-${color}-600 border-${color}-300`}>
                إجمالي القيمة
              </Badge>
            </div>
          </div>

          {/* تفاصيل المتوفر والمحجوز */}
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="text-lg font-semibold text-green-700">
                {formatCurrency(totalAvailable)}
              </div>
              <p className="text-xs text-green-600 mt-1">متوفر</p>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg border border-orange-200">
              <div className="text-lg font-semibold text-orange-700">
                {formatCurrency(totalReserved)}
              </div>
              <p className="text-xs text-orange-600 mt-1">محجوز</p>
            </div>
          </div>

          <Separator />

          {/* قائمة العناصر */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {items.map((item, index) => (
              <div key={index} className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                <div className="flex-1">
                  <p className="font-medium text-sm">{item.name}</p>
                  <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                    <span>كمية: {item.quantity}</span>
                    <span>متوفر: {item.available}</span>
                    <span>محجوز: {item.reserved}</span>
                  </div>
                </div>
                <div className="text-left">
                  <div className="font-semibold text-sm">
                    {formatCurrency(item.value)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatCurrency(item.price)} / قطعة
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const InventoryValueDialog = ({ open, onOpenChange, totalInventoryValue }) => {
  const [loading, setLoading] = useState(false);
  const [inventoryData, setInventoryData] = useState({
    departments: [],
    categories: [],
    productTypes: [],
    seasons: [],
    products: []
  });

  const fetchInventoryDetails = async () => {
    setLoading(true);
    try {
      // جلب بيانات المخزون مع جميع العلاقات
      const { data: inventoryItems, error } = await supabase
        .from('inventory')
        .select(`
          *,
          products!inner (
            id,
            name,
            base_price,
            product_departments (
              departments (id, name)
            ),
            product_categories (
              categories (id, name)
            ),
            product_product_types (
              product_types (id, name)
            ),
            product_seasons_occasions (
              seasons_occasions (id, name, type)
            )
          ),
          product_variants!inner (
            id,
            price,
            colors (name),
            sizes (name)
          )
        `)
        .gt('quantity', 0);

      if (error) throw error;

      // تنظيم البيانات حسب الأقسام
      const departmentMap = new Map();
      const categoryMap = new Map();
      const productTypeMap = new Map();
      const seasonMap = new Map();
      const productMap = new Map();

      inventoryItems.forEach(item => {
        const product = item.products;
        const variant = item.product_variants;
        const quantity = item.quantity || 0;
        const reserved = item.reserved_quantity || 0;
        const available = quantity - reserved;
        const price = variant.price || product.base_price || 0;
        const totalValue = quantity * price;
        const availableValue = available * price;
        const reservedValue = reserved * price;

        // معالجة الأقسام
        product.product_departments?.forEach(pd => {
          const dept = pd.departments;
          if (!dept) return;
          
          if (!departmentMap.has(dept.id)) {
            departmentMap.set(dept.id, {
              name: dept.name,
              quantity: 0,
              available: 0,
              reserved: 0,
              value: 0,
              available_value: 0,
              reserved_value: 0,
              price: 0
            });
          }
          
          const deptData = departmentMap.get(dept.id);
          deptData.quantity += quantity;
          deptData.available += available;
          deptData.reserved += reserved;
          deptData.value += totalValue;
          deptData.available_value += availableValue;
          deptData.reserved_value += reservedValue;
        });

        // معالجة التصنيفات
        product.product_categories?.forEach(pc => {
          const cat = pc.categories;
          if (!cat) return;
          
          if (!categoryMap.has(cat.id)) {
            categoryMap.set(cat.id, {
              name: cat.name,
              quantity: 0,
              available: 0,
              reserved: 0,
              value: 0,
              available_value: 0,
              reserved_value: 0,
              price: 0
            });
          }
          
          const catData = categoryMap.get(cat.id);
          catData.quantity += quantity;
          catData.available += available;
          catData.reserved += reserved;
          catData.value += totalValue;
          catData.available_value += availableValue;
          catData.reserved_value += reservedValue;
        });

        // معالجة أنواع المنتجات
        product.product_product_types?.forEach(ppt => {
          const type = ppt.product_types;
          if (!type) return;
          
          if (!productTypeMap.has(type.id)) {
            productTypeMap.set(type.id, {
              name: type.name,
              quantity: 0,
              available: 0,
              reserved: 0,
              value: 0,
              available_value: 0,
              reserved_value: 0,
              price: 0
            });
          }
          
          const typeData = productTypeMap.get(type.id);
          typeData.quantity += quantity;
          typeData.available += available;
          typeData.reserved += reserved;
          typeData.value += totalValue;
          typeData.available_value += availableValue;
          typeData.reserved_value += reservedValue;
        });

        // معالجة المواسم
        product.product_seasons_occasions?.forEach(pso => {
          const season = pso.seasons_occasions;
          if (!season) return;
          
          if (!seasonMap.has(season.id)) {
            seasonMap.set(season.id, {
              name: `${season.name} (${season.type === 'season' ? 'موسم' : 'مناسبة'})`,
              quantity: 0,
              available: 0,
              reserved: 0,
              value: 0,
              available_value: 0,
              reserved_value: 0,
              price: 0
            });
          }
          
          const seasonData = seasonMap.get(season.id);
          seasonData.quantity += quantity;
          seasonData.available += available;
          seasonData.reserved += reserved;
          seasonData.value += totalValue;
          seasonData.available_value += availableValue;
          seasonData.reserved_value += reservedValue;
        });

        // معالجة المنتجات
        const productKey = product.id;
        if (!productMap.has(productKey)) {
          productMap.set(productKey, {
            name: product.name,
            quantity: 0,
            available: 0,
            reserved: 0,
            value: 0,
            available_value: 0,
            reserved_value: 0,
            price: 0
          });
        }
        
        const prodData = productMap.get(productKey);
        prodData.quantity += quantity;
        prodData.available += available;
        prodData.reserved += reserved;
        prodData.value += totalValue;
        prodData.available_value += availableValue;
        prodData.reserved_value += reservedValue;
      });

      setInventoryData({
        departments: Array.from(departmentMap.values()).sort((a, b) => b.value - a.value),
        categories: Array.from(categoryMap.values()).sort((a, b) => b.value - a.value),
        productTypes: Array.from(productTypeMap.values()).sort((a, b) => b.value - a.value),
        seasons: Array.from(seasonMap.values()).sort((a, b) => b.value - a.value),
        products: Array.from(productMap.values()).sort((a, b) => b.value - a.value).slice(0, 20) // أفضل 20 منتج
      });

    } catch (error) {
      console.error('Error fetching inventory details:', error);
      toast({
        title: "خطأ",
        description: "فشل في جلب تفاصيل المخزون",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchInventoryDetails();
    }
  }, [open]);

  const totalAvailable = Object.values(inventoryData).flat().reduce((sum, items) => 
    Array.isArray(items) ? sum + items.reduce((s, item) => s + (item.available_value || 0), 0) : sum, 0
  );
  
  const totalReserved = Object.values(inventoryData).flat().reduce((sum, items) => 
    Array.isArray(items) ? sum + items.reduce((s, item) => s + (item.reserved_value || 0), 0) : sum, 0
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Box className="w-6 h-6 text-primary" />
            تفاصيل قيمة المخزون
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* إجمالي قيمة المخزون */}
          <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
            <CardContent className="p-6">
              <div className="text-center space-y-4">
                <div className="text-4xl font-bold text-primary">
                  {formatCurrency(totalInventoryValue)}
                </div>
                <Badge variant="outline" className="text-lg px-4 py-2">
                  إجمالي قيمة المخزون
                </Badge>
                
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <div className="text-2xl font-bold text-green-700">
                      {formatCurrency(totalAvailable)}
                    </div>
                    <p className="text-green-600 font-medium">المتوفر للبيع</p>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                    <div className="text-2xl font-bold text-orange-700">
                      {formatCurrency(totalReserved)}
                    </div>
                    <p className="text-orange-600 font-medium">المحجوز</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* التفاصيل في تابات */}
          <Tabs defaultValue="departments" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="departments" className="text-sm">الأقسام</TabsTrigger>
              <TabsTrigger value="categories" className="text-sm">التصنيفات</TabsTrigger>
              <TabsTrigger value="types" className="text-sm">أنواع المنتجات</TabsTrigger>
              <TabsTrigger value="seasons" className="text-sm">المواسم</TabsTrigger>
              <TabsTrigger value="products" className="text-sm">أفضل المنتجات</TabsTrigger>
            </TabsList>

            <div className="mt-6 max-h-96 overflow-y-auto">
              <TabsContent value="departments" className="mt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {inventoryData.departments.map((dept, index) => (
                    <CategoryCard
                      key={index}
                      title={dept.name}
                      items={[dept]}
                      icon={Warehouse}
                      color="blue"
                    />
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="categories" className="mt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {inventoryData.categories.map((cat, index) => (
                    <CategoryCard
                      key={index}
                      title={cat.name}
                      items={[cat]}
                      icon={Tag}
                      color="purple"
                    />
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="types" className="mt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {inventoryData.productTypes.map((type, index) => (
                    <CategoryCard
                      key={index}
                      title={type.name}
                      items={[type]}
                      icon={Package}
                      color="green"
                    />
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="seasons" className="mt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {inventoryData.seasons.map((season, index) => (
                    <CategoryCard
                      key={index}
                      title={season.name}
                      items={[season]}
                      icon={Calendar}
                      color="orange"
                    />
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="products" className="mt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {inventoryData.products.map((product, index) => (
                    <CategoryCard
                      key={index}
                      title={product.name}
                      items={[product]}
                      icon={BarChart3}
                      color="red"
                    />
                  ))}
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InventoryValueDialog;