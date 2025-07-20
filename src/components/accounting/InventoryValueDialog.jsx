import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Box, Package, Tag, Calendar, BarChart3, Warehouse, Search, Filter, X } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/hooks/use-toast';

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('ar-IQ', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0) + ' د.ع';
};

const formatNumber = (num) => {
  return new Intl.NumberFormat('ar-IQ').format(num || 0);
};

const ItemCard = ({ item, showProductDetails = false }) => (
  <Card className="bg-card/50 hover:bg-card/80 transition-colors border-border/50">
    <CardContent className="p-4">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h4 className="font-semibold text-foreground mb-1">{item.name}</h4>
          {showProductDetails && item.variants && (
            <p className="text-xs text-muted-foreground">
              {item.variants} متغير متوفر
            </p>
          )}
        </div>
        <Badge variant="outline" className="text-xs shrink-0">
          {formatCurrency(item.value)}
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="text-center p-2 bg-muted/50 rounded">
          <div className="font-semibold text-primary">{formatNumber(item.quantity)}</div>
          <div className="text-muted-foreground">إجمالي</div>
        </div>
        <div className="text-center p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded">
          <div className="font-semibold text-emerald-600 dark:text-emerald-400">{formatNumber(item.available)}</div>
          <div className="text-muted-foreground">متوفر</div>
        </div>
        <div className="text-center p-2 bg-orange-50 dark:bg-orange-950/30 rounded">
          <div className="font-semibold text-orange-600 dark:text-orange-400">{formatNumber(item.reserved)}</div>
          <div className="text-muted-foreground">محجوز</div>
        </div>
      </div>

      <div className="mt-3 pt-2 border-t border-border/50">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">المتوفر: {formatCurrency(item.available_value)}</span>
          <span className="text-muted-foreground">المحجوز: {formatCurrency(item.reserved_value)}</span>
        </div>
      </div>
    </CardContent>
  </Card>
);

const InventoryValueDialog = ({ open, onOpenChange, totalInventoryValue }) => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('summary');
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    department: '',
    category: '',
    productType: '',
    season: ''
  });
  
  const [inventoryData, setInventoryData] = useState({
    departments: [],
    categories: [],
    productTypes: [],
    seasons: [],
    products: [],
    filterOptions: {
      departments: [],
      categories: [],
      productTypes: [],
      seasons: []
    }
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

      // تنظيم البيانات
      const departmentMap = new Map();
      const categoryMap = new Map();
      const productTypeMap = new Map();
      const seasonMap = new Map();
      const productMap = new Map();
      
      // خيارات الفلترة
      const filterDepartments = new Set();
      const filterCategories = new Set();
      const filterProductTypes = new Set();
      const filterSeasons = new Set();

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

        // إضافة خيارات الفلترة
        product.product_departments?.forEach(pd => {
          if (pd.departments) filterDepartments.add(pd.departments);
        });
        product.product_categories?.forEach(pc => {
          if (pc.categories) filterCategories.add(pc.categories);
        });
        product.product_product_types?.forEach(ppt => {
          if (ppt.product_types) filterProductTypes.add(ppt.product_types);
        });
        product.product_seasons_occasions?.forEach(pso => {
          if (pso.seasons_occasions) filterSeasons.add(pso.seasons_occasions);
        });

        // معالجة الأقسام
        product.product_departments?.forEach(pd => {
          const dept = pd.departments;
          if (!dept) return;
          
          if (!departmentMap.has(dept.id)) {
            departmentMap.set(dept.id, {
              id: dept.id,
              name: dept.name,
              quantity: 0,
              available: 0,
              reserved: 0,
              value: 0,
              available_value: 0,
              reserved_value: 0,
              items: 0
            });
          }
          
          const deptData = departmentMap.get(dept.id);
          deptData.quantity += quantity;
          deptData.available += available;
          deptData.reserved += reserved;
          deptData.value += totalValue;
          deptData.available_value += availableValue;
          deptData.reserved_value += reservedValue;
          deptData.items += 1;
        });

        // معالجة التصنيفات
        product.product_categories?.forEach(pc => {
          const cat = pc.categories;
          if (!cat) return;
          
          if (!categoryMap.has(cat.id)) {
            categoryMap.set(cat.id, {
              id: cat.id,
              name: cat.name,
              quantity: 0,
              available: 0,
              reserved: 0,
              value: 0,
              available_value: 0,
              reserved_value: 0,
              items: 0
            });
          }
          
          const catData = categoryMap.get(cat.id);
          catData.quantity += quantity;
          catData.available += available;
          catData.reserved += reserved;
          catData.value += totalValue;
          catData.available_value += availableValue;
          catData.reserved_value += reservedValue;
          catData.items += 1;
        });

        // معالجة أنواع المنتجات
        product.product_product_types?.forEach(ppt => {
          const type = ppt.product_types;
          if (!type) return;
          
          if (!productTypeMap.has(type.id)) {
            productTypeMap.set(type.id, {
              id: type.id,
              name: type.name,
              quantity: 0,
              available: 0,
              reserved: 0,
              value: 0,
              available_value: 0,
              reserved_value: 0,
              items: 0
            });
          }
          
          const typeData = productTypeMap.get(type.id);
          typeData.quantity += quantity;
          typeData.available += available;
          typeData.reserved += reserved;
          typeData.value += totalValue;
          typeData.available_value += availableValue;
          typeData.reserved_value += reservedValue;
          typeData.items += 1;
        });

        // معالجة المواسم
        product.product_seasons_occasions?.forEach(pso => {
          const season = pso.seasons_occasions;
          if (!season) return;
          
          if (!seasonMap.has(season.id)) {
            seasonMap.set(season.id, {
              id: season.id,
              name: season.name,
              type: season.type,
              quantity: 0,
              available: 0,
              reserved: 0,
              value: 0,
              available_value: 0,
              reserved_value: 0,
              items: 0
            });
          }
          
          const seasonData = seasonMap.get(season.id);
          seasonData.quantity += quantity;
          seasonData.available += available;
          seasonData.reserved += reserved;
          seasonData.value += totalValue;
          seasonData.available_value += availableValue;
          seasonData.reserved_value += reservedValue;
          seasonData.items += 1;
        });

        // معالجة المنتجات
        const productKey = product.id;
        if (!productMap.has(productKey)) {
          productMap.set(productKey, {
            id: product.id,
            name: product.name,
            quantity: 0,
            available: 0,
            reserved: 0,
            value: 0,
            available_value: 0,
            reserved_value: 0,
            variants: 0
          });
        }
        
        const prodData = productMap.get(productKey);
        prodData.quantity += quantity;
        prodData.available += available;
        prodData.reserved += reserved;
        prodData.value += totalValue;
        prodData.available_value += availableValue;
        prodData.reserved_value += reservedValue;
        prodData.variants += 1;
      });

      setInventoryData({
        departments: Array.from(departmentMap.values()).sort((a, b) => b.value - a.value),
        categories: Array.from(categoryMap.values()).sort((a, b) => b.value - a.value),
        productTypes: Array.from(productTypeMap.values()).sort((a, b) => b.value - a.value),
        seasons: Array.from(seasonMap.values()).sort((a, b) => b.value - a.value),
        products: Array.from(productMap.values()).sort((a, b) => b.value - a.value),
        filterOptions: {
          departments: Array.from(filterDepartments),
          categories: Array.from(filterCategories),
          productTypes: Array.from(filterProductTypes),
          seasons: Array.from(filterSeasons)
        }
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

  // فلترة البيانات
  const getFilteredData = (data) => {
    return data.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilters({
      department: '',
      category: '',
      productType: '',
      season: ''
    });
  };

  const totalAvailable = inventoryData.products.reduce((sum, item) => sum + (item.available_value || 0), 0);
  const totalReserved = inventoryData.products.reduce((sum, item) => sum + (item.reserved_value || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Box className="w-5 h-5 text-primary" />
            تفاصيل قيمة المخزون
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* الملخص */}
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-primary">
                    {formatCurrency(totalInventoryValue)}
                  </div>
                  <p className="text-sm text-muted-foreground">إجمالي القيمة</p>
                </div>
                <div>
                  <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(totalAvailable)}
                  </div>
                  <p className="text-sm text-muted-foreground">المتوفر للبيع</p>
                </div>
                <div>
                  <div className="text-xl font-bold text-orange-600 dark:text-orange-400">
                    {formatCurrency(totalReserved)}
                  </div>
                  <p className="text-sm text-muted-foreground">المحجوز</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* البحث والفلترة */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="البحث في المنتجات..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pr-10"
                  />
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={clearFilters}
                  disabled={!searchTerm}
                >
                  <X className="w-4 h-4 mr-1" />
                  مسح
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* التفاصيل */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5 text-xs">
              <TabsTrigger value="summary" className="text-xs">الملخص</TabsTrigger>
              <TabsTrigger value="departments" className="text-xs">الأقسام</TabsTrigger>
              <TabsTrigger value="categories" className="text-xs">التصنيفات</TabsTrigger>
              <TabsTrigger value="types" className="text-xs">الأنواع</TabsTrigger>
              <TabsTrigger value="products" className="text-xs">المنتجات</TabsTrigger>
            </TabsList>

            <ScrollArea className="h-64 mt-4">
              <TabsContent value="summary" className="mt-0 space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                  <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                    <CardContent className="p-3">
                      <Warehouse className="w-6 h-6 text-blue-600 dark:text-blue-400 mx-auto mb-1" />
                      <div className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                        {inventoryData.departments.length}
                      </div>
                      <div className="text-xs text-blue-600 dark:text-blue-400">قسم</div>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800">
                    <CardContent className="p-3">
                      <Tag className="w-6 h-6 text-purple-600 dark:text-purple-400 mx-auto mb-1" />
                      <div className="text-sm font-semibold text-purple-700 dark:text-purple-300">
                        {inventoryData.categories.length}
                      </div>
                      <div className="text-xs text-purple-600 dark:text-purple-400">تصنيف</div>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
                    <CardContent className="p-3">
                      <Package className="w-6 h-6 text-green-600 dark:text-green-400 mx-auto mb-1" />
                      <div className="text-sm font-semibold text-green-700 dark:text-green-300">
                        {inventoryData.productTypes.length}
                      </div>
                      <div className="text-xs text-green-600 dark:text-green-400">نوع</div>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800">
                    <CardContent className="p-3">
                      <BarChart3 className="w-6 h-6 text-orange-600 dark:text-orange-400 mx-auto mb-1" />
                      <div className="text-sm font-semibold text-orange-700 dark:text-orange-300">
                        {inventoryData.products.length}
                      </div>
                      <div className="text-xs text-orange-600 dark:text-orange-400">منتج</div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="departments" className="mt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {getFilteredData(inventoryData.departments).map((dept) => (
                    <ItemCard key={dept.id} item={dept} />
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="categories" className="mt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {getFilteredData(inventoryData.categories).map((cat) => (
                    <ItemCard key={cat.id} item={cat} />
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="types" className="mt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {getFilteredData(inventoryData.productTypes).map((type) => (
                    <ItemCard key={type.id} item={type} />
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="products" className="mt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {getFilteredData(inventoryData.products).slice(0, 50).map((product) => (
                    <ItemCard key={product.id} item={product} showProductDetails />
                  ))}
                </div>
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InventoryValueDialog;