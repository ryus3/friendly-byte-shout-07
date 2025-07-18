import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useLocalStorage } from '@/hooks/useLocalStorage.jsx';
import { useVariants } from '@/contexts/VariantsContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Loader2, Plus, LayoutGrid, List, SlidersHorizontal, Search, ShoppingCart, Check, X, QrCode, Filter, Settings2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import PermissionBasedProductGrid from '@/components/products/PermissionBasedProductGrid';
import ProductList from '@/components/products/ProductList';
import ProductFilters from '@/components/products/ProductFilters';
import QuickOrderDialog from '@/components/quick-order/QuickOrderDialog';
import ProductVariantDialog from '@/components/products/ProductVariantDialog';
import BarcodeScannerDialog from '@/components/products/BarcodeScannerDialog';
import { toast } from '@/components/ui/use-toast';

const ProductsPage = () => {
  const location = useLocation();
  const { products, loading, addToCart, clearCart } = useInventory();
  const { user, isAdmin, productPermissions, filterProductsByPermissions } = useAuth();
  const { hasPermission } = usePermissions();
  const { 
    colors, 
    categories: allCategories, 
    departments: allDepartments,
    seasonsOccasions: allSeasonsOccasions,
    productTypes: allProductTypes,
    sizes: allSizes
  } = useVariants();
  
  // فلتر خاص بالصلاحيات - محفوظ محلياً
  const [permissionFilters, setPermissionFilters] = useLocalStorage('productPermissionFilters', {
    category: 'all',
    department: 'all',
    season_occasion: 'all',
    product_type: 'all',
    color: 'all',
    size: 'all'
  });

  // الحصول على البيانات المسموحة للمستخدم
  const allowedData = useMemo(() => {
    if (isAdmin) {
      return {
        allowedCategories: allCategories,
        allowedDepartments: allDepartments,
        allowedSeasonsOccasions: allSeasonsOccasions,
        allowedProductTypes: allProductTypes,
        allowedColors: colors,
        allowedSizes: allSizes
      };
    }

    const categoryPerm = productPermissions?.category;
    const departmentPerm = productPermissions?.department;
    const seasonPerm = productPermissions?.season_occasion;
    const productTypePerm = productPermissions?.product_type;
    const colorPerm = productPermissions?.color;
    const sizePerm = productPermissions?.size;

    const allowedCategories = categoryPerm?.has_full_access 
      ? allCategories 
      : allCategories.filter(cat => categoryPerm?.allowed_items?.includes(cat.id)) || [];

    const allowedDepartments = departmentPerm?.has_full_access 
      ? allDepartments 
      : allDepartments.filter(dept => departmentPerm?.allowed_items?.includes(dept.id)) || [];

    const allowedSeasonsOccasions = seasonPerm?.has_full_access 
      ? allSeasonsOccasions 
      : allSeasonsOccasions.filter(season => seasonPerm?.allowed_items?.includes(season.id)) || [];

    const allowedProductTypes = productTypePerm?.has_full_access 
      ? allProductTypes 
      : allProductTypes.filter(type => productTypePerm?.allowed_items?.includes(type.id)) || [];

    const allowedColors = colorPerm?.has_full_access 
      ? colors 
      : colors.filter(color => colorPerm?.allowed_items?.includes(color.id)) || [];

    const allowedSizes = sizePerm?.has_full_access 
      ? allSizes 
      : allSizes.filter(size => sizePerm?.allowed_items?.includes(size.id)) || [];

    return {
      allowedCategories,
      allowedDepartments,
      allowedSeasonsOccasions,
      allowedProductTypes,
      allowedColors,
      allowedSizes
    };
  }, [isAdmin, allCategories, allDepartments, allSeasonsOccasions, allProductTypes, colors, allSizes, productPermissions]);

  // فلترة المنتجات أولاً بالصلاحيات ثم بالفلاتر الإضافية
  const permissionFilteredProducts = useMemo(() => {
    console.log('ProductsPage - المنتجات الأصلية:', products);
    let filtered = filterProductsByPermissions(products);
    console.log('ProductsPage - المنتجات بعد فلترة الصلاحيات:', filtered);
    
    // تطبيق فلاتر إضافية للمستخدمين الذين لديهم صلاحيات متعددة
    if (permissionFilters.department !== 'all') {
      filtered = filtered.filter(product => 
        product.product_departments?.some(pd => pd.department_id === permissionFilters.department)
      );
    }

    if (permissionFilters.category !== 'all') {
      filtered = filtered.filter(product => 
        product.product_categories?.some(pc => pc.category_id === permissionFilters.category)
      );
    }

    if (permissionFilters.season_occasion !== 'all') {
      filtered = filtered.filter(product => 
        product.product_seasons_occasions?.some(pso => pso.season_occasion_id === permissionFilters.season_occasion)
      );
    }

    if (permissionFilters.product_type !== 'all') {
      filtered = filtered.filter(product => 
        product.product_product_types?.some(ppt => ppt.product_type_id === permissionFilters.product_type)
      );
    }

    if (permissionFilters.color !== 'all') {
      filtered = filtered.filter(product => 
        product.variants?.some(variant => variant.color_id === permissionFilters.color)
      );
    }

    if (permissionFilters.size !== 'all') {
      filtered = filtered.filter(product => 
        product.variants?.some(variant => variant.size_id === permissionFilters.size)
      );
    }

    return filtered;
  }, [products, filterProductsByPermissions, permissionFilters]);
  
  const { categories, brands } = useMemo(() => {
    // استخراج التصنيفات والعلامات التجارية من المنتجات المفلترة
    const uniqueCategories = [...new Set(permissionFilteredProducts.map(p => p.categories?.main_category).filter(Boolean))];
    const uniqueBrands = [...new Set(permissionFilteredProducts.map(p => p.brand).filter(Boolean))];
    
    return { categories: uniqueCategories, brands: uniqueBrands };
  }, [permissionFilteredProducts]);
  
  const [viewMode, setViewMode] = useLocalStorage('productsViewMode', 'list');
  const [filters, setFilters] = useState({
    searchTerm: '',
    category: 'all',
    brand: 'all',
    color: 'all',
    size: 'all',
    price: [0, 500000],
  });
  
  const [dialogs, setDialogs] = useState({
    quickOrder: false,
    productVariant: false,
    barcodeScanner: false,
  });
  const [selectedProduct, setSelectedProduct] = useState(null);

  const isMobile = useMediaQuery("(max-width: 768px)");

  // إزالة الإجبار على تغيير وضع العرض حسب الشاشة - دع المستخدم يختار
  
  // دعم البحث من الشريط السفلي
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const searchTerm = searchParams.get('search');
    
    if (searchTerm) {
      setFilters(prev => ({ ...prev, searchTerm }));
    }
    
    // دعم البحث عبر state من الـ navigation
    if (location.state?.searchTerm) {
      setFilters(prev => ({ ...prev, searchTerm: location.state.searchTerm }));
    }
    
    if (location.state?.selectedProduct) {
      setSelectedProduct(location.state.selectedProduct);
      setDialogs(prev => ({ ...prev, productVariant: true }));
    }
  }, [location]);

  const filteredProducts = useMemo(() => {
    let tempProducts = permissionFilteredProducts.filter(p => p.is_active !== false);

    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      tempProducts = tempProducts.filter(p =>
        p.name.toLowerCase().includes(term) ||
        p.sku_base?.toLowerCase().includes(term) ||
        p.variants.some(v => v.barcode === term)
      );
    }

    if (filters.category !== 'all') {
      tempProducts = tempProducts.filter(p => p.categories?.main_category === filters.category);
    }
    if (filters.brand !== 'all') {
      tempProducts = tempProducts.filter(p => p.brand === filters.brand);
    }
    if (filters.color !== 'all') {
      tempProducts = tempProducts.filter(p => p.variants.some(v => v.color === filters.color));
    }
    if (filters.size !== 'all') {
      tempProducts = tempProducts.filter(p => p.variants.some(v => v.size === filters.size));
    }
    
    tempProducts = tempProducts.filter(p => {
        const price = p.variants[0]?.price || 0;
        return price >= filters.price[0] && price <= filters.price[1];
    });

    return tempProducts;
  }, [permissionFilteredProducts, filters]);
  
  const handleCreateOrder = (product, variant, quantity) => {
    clearCart();
    addToCart(product, variant, quantity, false);
    setDialogs(prev => ({ ...prev, productVariant: false, quickOrder: true }));
    setSelectedProduct(null);
  };

  const handleProductSelect = (product) => {
    setSelectedProduct(product);
    setDialogs(prev => ({ ...prev, productVariant: true }));
  };

  const handleBarcodeScan = (barcode) => {
    setFilters(prev => ({ ...prev, searchTerm: barcode }));
    const foundProduct = permissionFilteredProducts.find(p => p.variants.some(v => v.barcode === barcode));
    if (foundProduct) {
      handleProductSelect(foundProduct);
    } else {
      toast({ title: "لم يتم العثور على المنتج", description: "لا يوجد منتج بهذا الباركود.", variant: "destructive" });
    }
  };

  const resetPermissionFilters = () => {
    setPermissionFilters({ 
      category: 'all', 
      department: 'all',
      season_occasion: 'all',
      product_type: 'all',
      color: 'all',
      size: 'all'
    });
  };

  const hasActivePermissionFilters = Object.entries(permissionFilters).some(([key, value]) => value !== 'all');

  // مكون فلتر الصلاحيات المحسن
  const PermissionBasedFilter = () => {
    // تحديد ما إذا كان للمستخدم خيارات متعددة في أي من الفئات
    const hasMultipleOptions = 
      allowedData.allowedCategories.length > 1 || 
      allowedData.allowedDepartments.length > 1 ||
      allowedData.allowedSeasonsOccasions.length > 1 ||
      allowedData.allowedProductTypes.length > 1 ||
      allowedData.allowedColors.length > 1 ||
      allowedData.allowedSizes.length > 1;

    // إذا لم يكن لدى المستخدم خيارات متعددة، لا نعرض الفلتر
    if (!isAdmin && !hasMultipleOptions) {
      return null;
    }

    return (
      <div className="mb-4">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Settings2 className="w-4 h-4" />
              إعدادات الصفحة
              {hasActivePermissionFilters && (
                <span className="bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded-full">
                  {Object.values(permissionFilters).filter(v => v !== 'all').length}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[400px] p-4" align="start">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">فلترة المنتجات</h4>
                {hasActivePermissionFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetPermissionFilters}
                    className="text-xs h-7"
                  >
                    <X className="w-3 h-3 ml-1" />
                    إعادة تعيين
                  </Button>
                )}
              </div>
              <Separator />
              
              <div className="grid grid-cols-1 gap-4">
                {/* فلتر الأقسام */}
                {allowedData.allowedDepartments.length > 1 && (
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">القسم</Label>
                    <Select
                      value={permissionFilters.department}
                      onValueChange={(value) => setPermissionFilters(prev => ({ ...prev, department: value }))}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="اختر القسم" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">جميع الأقسام</SelectItem>
                        {allowedData.allowedDepartments.map(dept => (
                          <SelectItem key={dept.id} value={dept.id}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* فلتر التصنيفات */}
                {allowedData.allowedCategories.length > 1 && (
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">التصنيف الرئيسي</Label>
                    <Select
                      value={permissionFilters.category}
                      onValueChange={(value) => setPermissionFilters(prev => ({ ...prev, category: value }))}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="اختر التصنيف" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">جميع التصنيفات</SelectItem>
                        {allowedData.allowedCategories.map(cat => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* فلتر المواسم والمناسبات */}
                {allowedData.allowedSeasonsOccasions.length > 1 && (
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">الموسم/المناسبة</Label>
                    <Select
                      value={permissionFilters.season_occasion}
                      onValueChange={(value) => setPermissionFilters(prev => ({ ...prev, season_occasion: value }))}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="اختر الموسم" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">جميع المواسم</SelectItem>
                        {allowedData.allowedSeasonsOccasions.map(season => (
                          <SelectItem key={season.id} value={season.id}>
                            {season.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* فلتر أنواع المنتجات */}
                {allowedData.allowedProductTypes.length > 1 && (
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">نوع المنتج</Label>
                    <Select
                      value={permissionFilters.product_type}
                      onValueChange={(value) => setPermissionFilters(prev => ({ ...prev, product_type: value }))}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="اختر نوع المنتج" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">جميع الأنواع</SelectItem>
                        {allowedData.allowedProductTypes.map(type => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* فلتر الألوان */}
                {allowedData.allowedColors.length > 1 && (
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">اللون</Label>
                    <Select
                      value={permissionFilters.color}
                      onValueChange={(value) => setPermissionFilters(prev => ({ ...prev, color: value }))}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="اختر اللون" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">جميع الألوان</SelectItem>
                        {allowedData.allowedColors.map(color => (
                          <SelectItem key={color.id} value={color.id}>
                            <div className="flex items-center gap-2">
                              {color.hex_code && (
                                <div 
                                  className="w-3 h-3 rounded-full border" 
                                  style={{ backgroundColor: color.hex_code }}
                                />
                              )}
                              {color.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* فلتر الأحجام */}
                {allowedData.allowedSizes.length > 1 && (
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">الحجم</Label>
                    <Select
                      value={permissionFilters.size}
                      onValueChange={(value) => setPermissionFilters(prev => ({ ...prev, size: value }))}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="اختر الحجم" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">جميع الأحجام</SelectItem>
                        {allowedData.allowedSizes.map(size => (
                          <SelectItem key={size.id} value={size.id}>
                            {size.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* معلومات الفلترة الحالية */}
              {hasActivePermissionFilters && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">الفلاتر المطبقة:</Label>
                    <div className="flex flex-wrap gap-1">
                      {permissionFilters.department !== 'all' && (
                        <span className="bg-accent px-2 py-1 rounded text-xs">
                          القسم: {allowedData.allowedDepartments.find(d => d.id === permissionFilters.department)?.name}
                        </span>
                      )}
                      {permissionFilters.category !== 'all' && (
                        <span className="bg-accent px-2 py-1 rounded text-xs">
                          التصنيف: {allowedData.allowedCategories.find(c => c.id === permissionFilters.category)?.name}
                        </span>
                      )}
                      {permissionFilters.season_occasion !== 'all' && (
                        <span className="bg-accent px-2 py-1 rounded text-xs">
                          الموسم: {allowedData.allowedSeasonsOccasions.find(s => s.id === permissionFilters.season_occasion)?.name}
                        </span>
                      )}
                      {permissionFilters.product_type !== 'all' && (
                        <span className="bg-accent px-2 py-1 rounded text-xs">
                          النوع: {allowedData.allowedProductTypes.find(t => t.id === permissionFilters.product_type)?.name}
                        </span>
                      )}
                      {permissionFilters.color !== 'all' && (
                        <span className="bg-accent px-2 py-1 rounded text-xs">
                          اللون: {allowedData.allowedColors.find(c => c.id === permissionFilters.color)?.name}
                        </span>
                      )}
                      {permissionFilters.size !== 'all' && (
                        <span className="bg-accent px-2 py-1 rounded text-xs">
                          الحجم: {allowedData.allowedSizes.find(s => s.id === permissionFilters.size)?.name}
                        </span>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>المنتجات - RYUS</title>
        <meta name="description" content="تصفح جميع المنتجات المتاحة في المخزون." />
      </Helmet>
      <div className="flex flex-col h-full">
        <header className="flex-shrink-0 p-4 border-b space-y-4">
          <PermissionBasedFilter />
          <ProductFilters
            filters={filters}
            setFilters={setFilters}
            categories={categories}
            brands={brands}
            colors={colors}
            onBarcodeSearch={() => setDialogs(prev => ({ ...prev, barcodeScanner: true }))}
            viewMode={viewMode}
            setViewMode={setViewMode}
            onProductSelect={handleProductSelect}
          />
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {filteredProducts.length > 0 ? (
            viewMode === 'grid' ? (
              <PermissionBasedProductGrid products={filteredProducts} onProductSelect={handleProductSelect} onCreateOrder={handleCreateOrder} />
            ) : (
              <ProductList products={filteredProducts} onProductSelect={handleProductSelect} />
            )
          ) : (
            <div className="text-center py-16">
              <h2 className="text-2xl font-bold mb-2">لا توجد منتجات مطابقة</h2>
              <p className="text-muted-foreground">حاول تغيير فلاتر البحث أو إضافة منتجات جديدة.</p>
            </div>
          )}
        </main>
      </div>
      
      <ProductVariantDialog
        product={selectedProduct}
        open={dialogs.productVariant}
        onClose={() => {
            setDialogs(prev => ({ ...prev, productVariant: false }));
            setSelectedProduct(null);
        }}
        onCreateOrder={handleCreateOrder}
      />

      <BarcodeScannerDialog
        open={dialogs.barcodeScanner}
        onOpenChange={(open) => setDialogs(prev => ({ ...prev, barcodeScanner: open }))}
        onScanSuccess={handleBarcodeScan}
      />

      {hasPermission('create_order') && (
        <QuickOrderDialog
          open={dialogs.quickOrder}
          onOpenChange={(open) => setDialogs(prev => ({ ...prev, quickOrder: open }))}
          onOrderCreated={() => {
            clearCart();
            setDialogs(prev => ({ ...prev, quickOrder: false }));
          }}
        />
      )}
    </>
  );
};

export default ProductsPage;