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
import { Box, Package, Tag, Calendar, BarChart3, Warehouse, Search, Filter, X, RefreshCw } from 'lucide-react';
import { useInventoryStats } from '@/hooks/useInventoryStats';
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
  <Card className="group bg-gradient-to-br from-background to-muted/30 hover:from-primary/5 hover:to-primary/10 transition-all duration-300 border-border/40 hover:border-primary/30 shadow-sm hover:shadow-md">
    <CardContent className="p-5">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h4 className="font-bold text-foreground mb-1 group-hover:text-primary transition-colors">{item.name}</h4>
          {showProductDetails && item.variants && (
            <p className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full inline-block">
              {item.variants} متغير متوفر
            </p>
          )}
        </div>
        <Badge variant="outline" className="text-sm shrink-0 font-bold bg-primary/10 text-primary border-primary/30">
          {formatCurrency(item.value)}
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-3 text-sm mb-4">
        <div className="text-center p-3 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl border border-primary/20">
          <div className="font-bold text-lg text-primary">{formatNumber(item.quantity)}</div>
          <div className="text-xs text-muted-foreground font-medium">إجمالي</div>
        </div>
        <div className="text-center p-3 bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-900/20 rounded-xl border border-emerald-200/50 dark:border-emerald-800/30">
          <div className="font-bold text-lg text-emerald-600 dark:text-emerald-400">{formatNumber(item.available)}</div>
          <div className="text-xs text-emerald-700/70 dark:text-emerald-300/70 font-medium">متوفر</div>
        </div>
        <div className="text-center p-3 bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-950/30 dark:to-orange-900/20 rounded-xl border border-orange-200/50 dark:border-orange-800/30">
          <div className="font-bold text-lg text-orange-600 dark:text-orange-400">{formatNumber(item.reserved)}</div>
          <div className="text-xs text-orange-700/70 dark:text-orange-300/70 font-medium">محجوز</div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center p-2 bg-muted/30 rounded-lg">
          <span className="text-sm text-muted-foreground font-medium">القيمة المتوفرة:</span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(item.available_value)}</span>
        </div>
        <div className="flex justify-between items-center p-2 bg-muted/30 rounded-lg">
          <span className="text-sm text-muted-foreground font-medium">القيمة المحجوزة:</span>
          <span className="font-bold text-orange-600 dark:text-orange-400">{formatCurrency(item.reserved_value)}</span>
        </div>
        {item.cost_value && (
          <div className="flex justify-between items-center p-2 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg border border-blue-200/50 dark:border-blue-800/30">
            <span className="text-sm text-blue-700 dark:text-blue-300 font-medium">التكلفة الإجمالية:</span>
            <span className="font-bold text-blue-600 dark:text-blue-400">{formatCurrency(item.cost_value)}</span>
          </div>
        )}
        {item.expected_profit && (
          <div className="flex justify-between items-center p-2 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 rounded-lg border border-green-200/50 dark:border-green-800/30">
            <span className="text-sm text-green-700 dark:text-green-300 font-medium">الربح المتوقع:</span>
            <span className="font-bold text-green-600 dark:text-green-400">{formatCurrency(item.expected_profit)}</span>
          </div>
        )}
      </div>
    </CardContent>
  </Card>
);

const InventoryValueDialog = ({ open, onOpenChange, totalInventoryValue }) => {
  const [activeTab, setActiveTab] = useState('summary');
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    department: '',
    category: '',
    productType: '',
    season: ''
  });
  
  // استخدام النظام الموحد للإحصائيات
  const {
    // الإحصائيات الأساسية
    totalProducts,
    totalQuantity,
    totalSaleValue: totalValue,
    totalCostValue: totalCost,
    totalExpectedProfit,
    reservedQuantity,
    
    // تصنيف مستويات المخزون
    highStockCount,
    mediumStockCount,
    lowStockCount,
    outOfStockCount,
    
    // حالة النظام
    isLoading: loading,
    refreshStats
  } = useInventoryStats({
    autoRefresh: open, // تحديث فقط عند فتح النافذة
    refreshInterval: 60000 // كل دقيقة
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
    try {
      // جلب خيارات الفلترة
      const { data: filterOptions, error: filterError } = await supabase
        .from('inventory')
        .select(`
          products!inner (
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
          )
        `)
        .gt('quantity', 0);

      if (filterError) throw filterError;

      // تنظيم خيارات الفلترة
      const filterDepartments = new Set();
      const filterCategories = new Set();
      const filterProductTypes = new Set();
      const filterSeasons = new Set();

      filterOptions?.forEach(item => {
        const product = item.products;
        product.product_departments?.forEach(pd => {
          if (pd.departments) {
            const exists = Array.from(filterDepartments).some(d => d.id === pd.departments.id);
            if (!exists) filterDepartments.add(pd.departments);
          }
        });
        product.product_categories?.forEach(pc => {
          if (pc.categories) {
            const exists = Array.from(filterCategories).some(c => c.id === pc.categories.id);
            if (!exists) filterCategories.add(pc.categories);
          }
        });
        product.product_product_types?.forEach(ppt => {
          if (ppt.product_types) {
            const exists = Array.from(filterProductTypes).some(t => t.id === ppt.product_types.id);
            if (!exists) filterProductTypes.add(ppt.product_types);
          }
        });
        product.product_seasons_occasions?.forEach(pso => {
          if (pso.seasons_occasions) {
            const exists = Array.from(filterSeasons).some(s => s.id === pso.seasons_occasions.id);
            if (!exists) filterSeasons.add(pso.seasons_occasions);
          }
        });
      });

      setInventoryData(prev => ({
        ...prev,
        filterOptions: {
          departments: Array.from(filterDepartments).sort((a, b) => a.name.localeCompare(b.name)),
          categories: Array.from(filterCategories).sort((a, b) => a.name.localeCompare(b.name)),
          productTypes: Array.from(filterProductTypes).sort((a, b) => a.name.localeCompare(b.name)),
          seasons: Array.from(filterSeasons).sort((a, b) => a.name.localeCompare(b.name))
        }
      }));

    } catch (error) {
      console.error('خطأ في جلب تفاصيل المخزون:', error);
      toast({
        title: "خطأ",
        description: "حدث خطأ في جلب تفاصيل المخزون",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (open) {
      fetchInventoryDetails();
      refreshStats(); // تحديث الإحصائيات الموحدة
    }
  }, [open, filters, refreshStats]);

  // حساب القيم المعروضة
  const availableValue = totalValue - (reservedQuantity * (totalValue / (totalQuantity || 1)));
  const reservedValue = reservedQuantity * (totalValue / (totalQuantity || 1));

  // حساب النسب المئوية
  const profitMargin = totalValue > 0 ? ((totalValue - totalCost) / totalValue * 100) : 0;

  const handleFilterReset = () => {
    setFilters({
      department: '',
      category: '',
      productType: '',
      season: ''
    });
    setSearchTerm('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg">
              <Warehouse className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold">تفاصيل قيمة المخزون</h2>
              <p className="text-sm text-muted-foreground">إجمالي قيمة المخزون: {formatCurrency(totalValue)}</p>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col h-full overflow-hidden">
          {/* شريط الفلاتر */}
          <div className="flex flex-wrap gap-3 p-4 bg-muted/30 rounded-lg mb-4">
            <div className="flex items-center gap-2 flex-1 min-w-64">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="البحث..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9"
              />
            </div>
            
            {/* فلتر القسم */}
            <Select value={filters.department} onValueChange={(value) => setFilters(f => ({ ...f, department: value }))}>
              <SelectTrigger className="w-48 h-9">
                <SelectValue placeholder="جميع الأقسام" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">جميع الأقسام</SelectItem>
                {inventoryData.filterOptions.departments.map(dept => (
                  <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* فلتر التصنيف */}
            <Select value={filters.category} onValueChange={(value) => setFilters(f => ({ ...f, category: value }))}>
              <SelectTrigger className="w-48 h-9">
                <SelectValue placeholder="جميع التصنيفات" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">جميع التصنيفات</SelectItem>
                {inventoryData.filterOptions.categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleFilterReset}
              className="h-9 px-3"
            >
              <X className="w-4 h-4 ml-1" />
              مسح الفلاتر
            </Button>

            <Button 
              variant="outline" 
              size="sm" 
              onClick={refreshStats}
              disabled={loading}
              className="h-9 px-3"
            >
              <RefreshCw className={`w-4 h-4 ml-1 ${loading ? 'animate-spin' : ''}`} />
              تحديث
            </Button>
          </div>

          {/* المحتوى الرئيسي */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="summary" className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                الملخص العام
              </TabsTrigger>
              <TabsTrigger value="details" className="flex items-center gap-2">
                <Package className="w-4 h-4" />
                التفاصيل
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-hidden">
              <TabsContent value="summary" className="h-full">
                <ScrollArea className="h-full">
                  <div className="space-y-6 p-1">
                    {/* الملخص المالي */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <BarChart3 className="w-5 h-5" />
                          الملخص المالي
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                          <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950/30 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800/30">
                            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{formatCurrency(totalValue)}</div>
                            <div className="text-sm text-blue-700/70 dark:text-blue-300/70 font-medium mt-1">إجمالي القيمة</div>
                          </div>
                          <div className="text-center p-6 bg-gradient-to-br from-emerald-50 to-green-100 dark:from-emerald-950/30 dark:to-green-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800/30">
                            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(availableValue)}</div>
                            <div className="text-sm text-emerald-700/70 dark:text-emerald-300/70 font-medium mt-1">القيمة المتوفرة</div>
                          </div>
                          <div className="text-center p-6 bg-gradient-to-br from-orange-50 to-red-100 dark:from-orange-950/30 dark:to-red-900/20 rounded-xl border border-orange-200 dark:border-orange-800/30">
                            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{formatCurrency(reservedValue)}</div>
                            <div className="text-sm text-orange-700/70 dark:text-orange-300/70 font-medium mt-1">القيمة المحجوزة</div>
                          </div>
                          <div className="text-center p-6 bg-gradient-to-br from-purple-50 to-violet-100 dark:from-purple-950/30 dark:to-violet-900/20 rounded-xl border border-purple-200 dark:border-purple-800/30">
                            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{formatNumber(totalQuantity)}</div>
                            <div className="text-sm text-purple-700/70 dark:text-purple-300/70 font-medium mt-1">إجمالي الكمية</div>
                          </div>
                          <div className="text-center p-6 bg-gradient-to-br from-yellow-50 to-amber-100 dark:from-yellow-950/30 dark:to-amber-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800/30">
                            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{formatCurrency(totalCost)}</div>
                            <div className="text-sm text-yellow-700/70 dark:text-yellow-300/70 font-medium mt-1">إجمالي التكلفة</div>
                          </div>
                          <div className="text-center p-6 bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-teal-950/30 dark:to-cyan-900/20 rounded-xl border border-teal-200 dark:border-teal-800/30">
                            <div className="text-2xl font-bold text-teal-600 dark:text-teal-400">{formatCurrency(totalExpectedProfit)}</div>
                            <div className="text-sm text-teal-700/70 dark:text-teal-300/70 font-medium mt-1">الربح المتوقع</div>
                          </div>
                        </div>
                        
                        {/* النسب المئوية */}
                        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 rounded-lg border border-green-200/50 dark:border-green-800/30">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium text-green-700 dark:text-green-300">هامش الربح</span>
                              <span className="text-lg font-bold text-green-600 dark:text-green-400">{profitMargin.toFixed(1)}%</span>
                            </div>
                          </div>
                          <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-lg border border-blue-200/50 dark:border-blue-800/30">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">عدد المنتجات</span>
                              <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{formatNumber(totalProducts)}</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* إحصائيات مستويات المخزون */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Package className="w-5 h-5" />
                          توزيع مستويات المخزون
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800/30">
                            <div className="text-xl font-bold text-green-600 dark:text-green-400">{formatNumber(highStockCount)}</div>
                            <div className="text-xs text-green-700/70 dark:text-green-300/70 font-medium">مخزون جيد</div>
                          </div>
                          <div className="text-center p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800/30">
                            <div className="text-xl font-bold text-orange-600 dark:text-orange-400">{formatNumber(mediumStockCount)}</div>
                            <div className="text-xs text-orange-700/70 dark:text-orange-300/70 font-medium">مخزون متوسط</div>
                          </div>
                          <div className="text-center p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800/30">
                            <div className="text-xl font-bold text-red-600 dark:text-red-400">{formatNumber(lowStockCount)}</div>
                            <div className="text-xs text-red-700/70 dark:text-red-300/70 font-medium">مخزون منخفض</div>
                          </div>
                          <div className="text-center p-4 bg-gray-50 dark:bg-gray-950/20 rounded-lg border border-gray-200 dark:border-gray-800/30">
                            <div className="text-xl font-bold text-gray-600 dark:text-gray-400">{formatNumber(outOfStockCount)}</div>
                            <div className="text-xs text-gray-700/70 dark:text-gray-300/70 font-medium">مخزون نافذ</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="details" className="h-full">
                <div className="text-center py-12">
                  <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-muted-foreground">التفاصيل التفصيلية</h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    سيتم إضافة التفاصيل التفصيلية للمنتجات والأقسام قريباً
                  </p>
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