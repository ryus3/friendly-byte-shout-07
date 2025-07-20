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
  <Card className="group bg-gradient-to-br from-background to-muted/30 hover:from-primary/5 hover:to-primary/10 transition-all duration-300 border-border/40 hover:border-primary/30 shadow-sm hover:shadow-md">
    <CardContent className="p-3 sm:p-4">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-sm sm:text-base text-foreground mb-1 group-hover:text-primary transition-colors truncate">{item.name}</h4>
          {showProductDetails && item.variants && (
            <p className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full inline-block">
              {item.variants} متغير
            </p>
          )}
        </div>
        <Badge variant="outline" className="text-xs font-bold bg-primary/10 text-primary border-primary/30 shrink-0">
          {formatCurrency(item.value)}
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs sm:text-sm mb-3">
        <div className="text-center p-2 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg border border-primary/20">
          <div className="font-bold text-sm sm:text-base text-primary">{formatNumber(item.quantity)}</div>
          <div className="text-xs text-muted-foreground font-medium">إجمالي</div>
        </div>
        <div className="text-center p-2 bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-900/20 rounded-lg border border-emerald-200/50 dark:border-emerald-800/30">
          <div className="font-bold text-sm sm:text-base text-emerald-600 dark:text-emerald-400">{formatNumber(item.available)}</div>
          <div className="text-xs text-emerald-700/70 dark:text-emerald-300/70 font-medium">متوفر</div>
        </div>
        <div className="text-center p-2 bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-950/30 dark:to-orange-900/20 rounded-lg border border-orange-200/50 dark:border-orange-800/30">
          <div className="font-bold text-sm sm:text-base text-orange-600 dark:text-orange-400">{formatNumber(item.reserved)}</div>
          <div className="text-xs text-orange-700/70 dark:text-orange-300/70 font-medium">محجوز</div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center p-2 bg-muted/30 rounded-lg">
          <span className="text-xs text-muted-foreground font-medium">المتوفر:</span>
          <span className="font-bold text-xs sm:text-sm text-emerald-600 dark:text-emerald-400">{formatCurrency(item.available_value)}</span>
        </div>
        <div className="flex justify-between items-center p-2 bg-muted/30 rounded-lg">
          <span className="text-xs text-muted-foreground font-medium">المحجوز:</span>
          <span className="font-bold text-xs sm:text-sm text-orange-600 dark:text-orange-400">{formatCurrency(item.reserved_value)}</span>
        </div>
        {item.cost_value && (
          <div className="flex justify-between items-center p-2 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg border border-blue-200/50 dark:border-blue-800/30">
            <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">التكلفة:</span>
            <span className="font-bold text-xs sm:text-sm text-blue-600 dark:text-blue-400">{formatCurrency(item.cost_value)}</span>
          </div>
        )}
        {item.expected_profit !== undefined && (
          <div className="flex justify-between items-center p-2 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 rounded-lg border border-green-200/50 dark:border-green-800/30">
            <span className="text-xs text-green-700 dark:text-green-300 font-medium">الربح المتوقع:</span>
            <span className="font-bold text-xs sm:text-sm text-green-600 dark:text-green-400">{formatCurrency(item.expected_profit)}</span>
          </div>
        )}
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

  const [filteredSummary, setFilteredSummary] = useState({
    totalValue: 0,
    totalAvailable: 0,
    totalReserved: 0,
    totalQuantity: 0,
    totalCost: 0,
    totalExpectedProfit: 0,
    itemsCount: 0
  });

  const fetchInventoryDetails = async () => {
    setLoading(true);
    try {
      // بناء query الفلترة
      let query = supabase
        .from('inventory')
        .select(`
          *,
          products!inner (
            id,
            name,
            base_price,
            cost_price,
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
            cost_price,
            colors (name),
            sizes (name)
          )
        `)
        .gt('quantity', 0);

      // تطبيق فلاتر قاعدة البيانات
      if (filters.department) {
        query = query.filter('products.product_departments.departments.id', 'eq', filters.department);
      }
      if (filters.category) {
        query = query.filter('products.product_categories.categories.id', 'eq', filters.category);
      }
      if (filters.productType) {
        query = query.filter('products.product_product_types.product_types.id', 'eq', filters.productType);
      }
      if (filters.season) {
        query = query.filter('products.product_seasons_occasions.seasons_occasions.id', 'eq', filters.season);
      }

      const { data: inventoryItems, error } = await query;

      if (error) throw error;

      // جلب خيارات الفلترة (بدون تطبيق فلاتر)
      const { data: allInventoryItems, error: optionsError } = await supabase
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

      if (optionsError) throw optionsError;

      // تنظيم البيانات
      const departmentMap = new Map();
      const categoryMap = new Map();
      const productTypeMap = new Map();
      const seasonMap = new Map();
      const productMap = new Map();
      
      // خيارات الفلترة من جميع البيانات
      const filterDepartments = new Set();
      const filterCategories = new Set();
      const filterProductTypes = new Set();
      const filterSeasons = new Set();

      // معالجة خيارات الفلترة - إزالة التكرار
      allInventoryItems.forEach(item => {
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

      // معالجة البيانات المفلترة
      inventoryItems.forEach(item => {
        const product = item.products;
        const variant = item.product_variants;
        const quantity = item.quantity || 0;
        const reserved = item.reserved_quantity || 0;
        const available = quantity - reserved;
        const price = variant.price || product.base_price || 0;
        const costPrice = variant.cost_price || product.cost_price || 0;
        const totalValue = quantity * price;
        const availableValue = available * price;
        const reservedValue = reserved * price;
        const totalCost = quantity * costPrice;
        const expectedProfit = totalValue - totalCost;

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
              cost_value: 0,
              expected_profit: 0,
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
          deptData.cost_value += totalCost;
          deptData.expected_profit += expectedProfit;
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
              cost_value: 0,
              expected_profit: 0,
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
          catData.cost_value += totalCost;
          catData.expected_profit += expectedProfit;
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
              cost_value: 0,
              expected_profit: 0,
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
          typeData.cost_value += totalCost;
          typeData.expected_profit += expectedProfit;
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
              cost_value: 0,
              expected_profit: 0,
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
          seasonData.cost_value += totalCost;
          seasonData.expected_profit += expectedProfit;
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
            cost_value: 0,
            expected_profit: 0,
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
        prodData.cost_value += totalCost;
        prodData.expected_profit += expectedProfit;
        prodData.variants += 1;
      });

      setInventoryData({
        departments: Array.from(departmentMap.values()).sort((a, b) => b.value - a.value),
        categories: Array.from(categoryMap.values()).sort((a, b) => b.value - a.value),
        productTypes: Array.from(productTypeMap.values()).sort((a, b) => b.value - a.value),
        seasons: Array.from(seasonMap.values()).sort((a, b) => b.value - a.value),
        products: Array.from(productMap.values()).sort((a, b) => b.value - a.value),
        filterOptions: {
          departments: Array.from(filterDepartments).sort((a, b) => a.name.localeCompare(b.name)),
          categories: Array.from(filterCategories).sort((a, b) => a.name.localeCompare(b.name)),
          productTypes: Array.from(filterProductTypes).sort((a, b) => a.name.localeCompare(b.name)),
          seasons: Array.from(filterSeasons).sort((a, b) => a.name.localeCompare(b.name))
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
  }, [open, filters]); // إعادة التحميل عند تغيير الفلاتر

  // تطبيق الفلاتر وحساب النتائج المفلترة
  useEffect(() => {
    if (!inventoryData.departments.length && !inventoryData.categories.length && 
        !inventoryData.productTypes.length && !inventoryData.seasons.length && 
        !inventoryData.products.length) return;

    // دمج جميع البيانات لحساب الفلترة
    const allItems = [
      ...inventoryData.departments,
      ...inventoryData.categories, 
      ...inventoryData.productTypes,
      ...inventoryData.seasons,
      ...inventoryData.products
    ];

    // فلترة البيانات
    const filteredItems = allItems.filter(item => {
      const matchesSearch = searchTerm === '' || item.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });

    // حساب الملخص المفلتر
    const summary = filteredItems.reduce((acc, item) => {
      acc.totalValue += item.value || 0;
      acc.totalAvailable += item.available_value || 0;
      acc.totalReserved += item.reserved_value || 0;
      acc.totalQuantity += item.quantity || 0;
      acc.totalCost += item.cost_value || 0;
      acc.totalExpectedProfit += item.expected_profit || 0;
      acc.itemsCount += 1;
      return acc;
    }, {
      totalValue: 0,
      totalAvailable: 0,
      totalReserved: 0,
      totalQuantity: 0,
      totalCost: 0,
      totalExpectedProfit: 0,
      itemsCount: 0
    });

    setFilteredSummary(summary);
  }, [inventoryData, searchTerm, filters]);

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

  const hasActiveFilters = searchTerm || Object.values(filters).some(f => f !== '');

  // حساب القيم المفلترة للملخص
  const filteredTotalValue = hasActiveFilters ? filteredSummary.totalValue : totalInventoryValue;
  const filteredTotalAvailable = hasActiveFilters ? filteredSummary.totalAvailable : inventoryData.products.reduce((sum, item) => sum + (item.available_value || 0), 0);
  const filteredTotalReserved = hasActiveFilters ? filteredSummary.totalReserved : inventoryData.products.reduce((sum, item) => sum + (item.reserved_value || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden p-4 sm:p-6">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl font-bold">
            <div className="p-1.5 bg-gradient-to-br from-primary/20 to-primary/10 rounded-lg">
              <Box className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            </div>
            تفاصيل قيمة المخزون
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* الملخص المحسن */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30 shadow-sm hover:shadow-md transition-all duration-300">
              <CardContent className="p-3 sm:p-4 text-center">
                <div className="mb-2 p-1.5 bg-primary/10 rounded-full inline-block">
                  <BarChart3 className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
                </div>
                <div className="text-lg sm:text-xl font-bold text-primary mb-1 leading-tight">
                  {formatCurrency(filteredTotalValue)}
                </div>
                <p className="text-xs text-muted-foreground font-medium">
                  {hasActiveFilters ? 'القيمة المفلترة' : 'إجمالي القيمة'}
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-900/20 border-emerald-200/50 dark:border-emerald-800/30 shadow-sm hover:shadow-md transition-all duration-300">
              <CardContent className="p-3 sm:p-4 text-center">
                <div className="mb-2 p-1.5 bg-emerald-100 dark:bg-emerald-900/50 rounded-full inline-block">
                  <Package className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400 mb-1 leading-tight">
                  {formatCurrency(filteredTotalAvailable)}
                </div>
                <p className="text-xs text-emerald-700/70 dark:text-emerald-300/70 font-medium">المتوفر للبيع</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-950/30 dark:to-orange-900/20 border-orange-200/50 dark:border-orange-800/30 shadow-sm hover:shadow-md transition-all duration-300">
              <CardContent className="p-3 sm:p-4 text-center">
                <div className="mb-2 p-1.5 bg-orange-100 dark:bg-orange-900/50 rounded-full inline-block">
                  <Warehouse className="w-3 h-3 sm:w-4 sm:h-4 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="text-lg sm:text-xl font-bold text-orange-600 dark:text-orange-400 mb-1 leading-tight">
                  {formatCurrency(filteredTotalReserved)}
                </div>
                <p className="text-xs text-orange-700/70 dark:text-orange-300/70 font-medium">المحجوز</p>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 border-blue-200/50 dark:border-blue-800/30 shadow-sm hover:shadow-md transition-all duration-300">
              <CardContent className="p-3 sm:p-4 text-center">
                <div className="mb-2 p-1.5 bg-blue-100 dark:bg-blue-900/50 rounded-full inline-block">
                  <Tag className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="text-lg sm:text-xl font-bold text-blue-600 dark:text-blue-400 mb-1 leading-tight">
                  {formatCurrency(hasActiveFilters ? filteredSummary.totalCost : inventoryData.products.reduce((sum, item) => sum + (item.cost_value || 0), 0))}
                </div>
                <p className="text-xs text-blue-700/70 dark:text-blue-300/70 font-medium">إجمالي التكلفة</p>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/30 dark:to-green-900/20 border-green-200/50 dark:border-green-800/30 shadow-sm hover:shadow-md transition-all duration-300">
              <CardContent className="p-3 sm:p-4 text-center">
                <div className="mb-2 p-1.5 bg-green-100 dark:bg-green-900/50 rounded-full inline-block">
                  <BarChart3 className="w-3 h-3 sm:w-4 sm:h-4 text-green-600 dark:text-green-400" />
                </div>
                <div className="text-lg sm:text-xl font-bold text-green-600 dark:text-green-400 mb-1 leading-tight">
                  {formatCurrency(hasActiveFilters ? filteredSummary.totalExpectedProfit : inventoryData.products.reduce((sum, item) => sum + (item.expected_profit || 0), 0))}
                </div>
                <p className="text-xs text-green-700/70 dark:text-green-300/70 font-medium">الربح المتوقع</p>
              </CardContent>
            </Card>
          </div>


          {/* نظام الفلترة المتقدم */}
          <Card>
            <CardContent className="p-4">
              <div className="space-y-4">
                {/* البحث */}
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
                    disabled={!hasActiveFilters}
                  >
                    <X className="w-4 h-4 mr-1" />
                    مسح الفلاتر
                  </Button>
                </div>

                {/* فلاتر متقدمة */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <Label className="text-xs">القسم</Label>
                    <Select value={filters.department || "all"} onValueChange={(value) => setFilters({...filters, department: value === "all" ? "" : value})}>
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="اختر القسم" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">جميع الأقسام</SelectItem>
                        {inventoryData.filterOptions.departments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs">التصنيف</Label>
                    <Select value={filters.category || "all"} onValueChange={(value) => setFilters({...filters, category: value === "all" ? "" : value})}>
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="اختر التصنيف" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">جميع التصنيفات</SelectItem>
                        {inventoryData.filterOptions.categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs">نوع المنتج</Label>
                    <Select value={filters.productType || "all"} onValueChange={(value) => setFilters({...filters, productType: value === "all" ? "" : value})}>
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="اختر النوع" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">جميع الأنواع</SelectItem>
                        {inventoryData.filterOptions.productTypes.map((type) => (
                          <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs">الموسم</Label>
                    <Select value={filters.season || "all"} onValueChange={(value) => setFilters({...filters, season: value === "all" ? "" : value})}>
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="اختر الموسم" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">جميع المواسم</SelectItem>
                        {inventoryData.filterOptions.seasons.map((season) => (
                          <SelectItem key={season.id} value={season.id}>{season.name} ({season.type === 'season' ? 'موسم' : 'مناسبة'})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* ملخص النتائج المفلترة */}
                {hasActiveFilters && (
                  <Card className="bg-muted/30">
                    <CardContent className="p-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">نتائج الفلترة:</span>
                        <div className="flex gap-4">
                          <span>{filteredSummary.itemsCount} عنصر</span>
                          <span className="font-semibold text-primary">{formatCurrency(filteredSummary.totalValue)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </CardContent>
          </Card>

          {/* التفاصيل */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-6 text-xs">
              <TabsTrigger value="summary" className="text-xs">الملخص</TabsTrigger>
              <TabsTrigger value="departments" className="text-xs">الأقسام</TabsTrigger>
              <TabsTrigger value="categories" className="text-xs">التصنيفات</TabsTrigger>
              <TabsTrigger value="types" className="text-xs">الأنواع</TabsTrigger>
              <TabsTrigger value="seasons" className="text-xs">المواسم</TabsTrigger>
              <TabsTrigger value="products" className="text-xs">المنتجات</TabsTrigger>
            </TabsList>

            <ScrollArea className="h-64 mt-4">
              <TabsContent value="summary" className="mt-0 space-y-2 sm:space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 text-center">
                  <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                    <CardContent className="p-2 sm:p-3">
                      <Warehouse className="w-4 h-4 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400 mx-auto mb-1" />
                      <div className="text-xs sm:text-sm font-semibold text-blue-700 dark:text-blue-300">
                        {inventoryData.departments.length}
                      </div>
                      <div className="text-xs text-blue-600 dark:text-blue-400">قسم</div>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800">
                    <CardContent className="p-2 sm:p-3">
                      <Tag className="w-4 h-4 sm:w-6 sm:h-6 text-purple-600 dark:text-purple-400 mx-auto mb-1" />
                      <div className="text-xs sm:text-sm font-semibold text-purple-700 dark:text-purple-300">
                        {inventoryData.categories.length}
                      </div>
                      <div className="text-xs text-purple-600 dark:text-purple-400">تصنيف</div>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
                    <CardContent className="p-2 sm:p-3">
                      <Package className="w-4 h-4 sm:w-6 sm:h-6 text-green-600 dark:text-green-400 mx-auto mb-1" />
                      <div className="text-xs sm:text-sm font-semibold text-green-700 dark:text-green-300">
                        {inventoryData.productTypes.length}
                      </div>
                      <div className="text-xs text-green-600 dark:text-green-400">نوع</div>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800">
                    <CardContent className="p-2 sm:p-3">
                      <BarChart3 className="w-4 h-4 sm:w-6 sm:h-6 text-orange-600 dark:text-orange-400 mx-auto mb-1" />
                      <div className="text-xs sm:text-sm font-semibold text-orange-700 dark:text-orange-300">
                        {inventoryData.products.length}
                      </div>
                      <div className="text-xs text-orange-600 dark:text-orange-400">منتج</div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="departments" className="mt-0">
                <div className="grid grid-cols-1 gap-2 sm:gap-3">
                  {getFilteredData(inventoryData.departments).map((dept) => (
                    <ItemCard key={dept.id} item={dept} />
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="categories" className="mt-0">
                <div className="grid grid-cols-1 gap-2 sm:gap-3">
                  {getFilteredData(inventoryData.categories).map((cat) => (
                    <ItemCard key={cat.id} item={cat} />
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="types" className="mt-0">
                <div className="grid grid-cols-1 gap-2 sm:gap-3">
                  {getFilteredData(inventoryData.productTypes).map((type) => (
                    <ItemCard key={type.id} item={type} />
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="seasons" className="mt-0">
                <div className="grid grid-cols-1 gap-2 sm:gap-3">
                  {getFilteredData(inventoryData.seasons).map((season) => (
                    <ItemCard key={season.id} item={season} />
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="products" className="mt-0">
                <div className="grid grid-cols-1 gap-2 sm:gap-3">
                  {getFilteredData(inventoryData.products).slice(0, 30).map((product) => (
                    <ItemCard key={product.id} item={product} showProductDetails />
                  ))}
                  {inventoryData.products.length > 30 && (
                    <div className="text-center text-sm text-muted-foreground p-4">
                      عرض 30 منتج من أصل {inventoryData.products.length}
                    </div>
                  )}
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