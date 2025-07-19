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
import { Loader2, Plus, LayoutGrid, List, SlidersHorizontal, Search, ShoppingCart, Check, X, QrCode, Filter } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import PermissionBasedProductGrid from '@/components/products/PermissionBasedProductGrid';
import ProductList from '@/components/products/ProductList';
import ProductFilters from '@/components/products/ProductFilters';
import AdvancedProductFilters from '@/components/products/AdvancedProductFilters';
import QuickOrderDialog from '@/components/quick-order/QuickOrderDialog';
import ProductVariantDialog from '@/components/products/ProductVariantDialog';
import BarcodeScannerDialog from '@/components/products/BarcodeScannerDialog';
import { toast } from '@/components/ui/use-toast';

const ProductsPage = () => {
  const location = useLocation();
  const { products, loading, addToCart, clearCart } = useInventory();
  const { user, isAdmin, productPermissions, filterProductsByPermissions } = useAuth();
  const { hasPermission } = usePermissions();
  
  console.log('📦 صفحة المنتجات:', {
    products: products?.length || 0,
    loading,
    user: user?.full_name,
    isAdmin,
    hasProductPermissions: !!productPermissions && Object.keys(productPermissions).length > 0
  });
  const { colors, categories: allCategories, departments: allDepartments } = useVariants();
  
  // فلتر خاص بالصلاحيات - محفوظ محلياً
  const [permissionFilters, setPermissionFilters] = useLocalStorage('productPermissionFilters', {
    category: 'all',
    department: 'all'
  });

  // الحصول على البيانات المسموحة للمستخدم
  const allowedData = useMemo(() => {
    if (isAdmin) {
      return {
        allowedCategories: allCategories,
        allowedDepartments: allDepartments
      };
    }

    const categoryPerm = productPermissions?.category;
    const departmentPerm = productPermissions?.department;

    const allowedCategories = categoryPerm?.has_full_access 
      ? allCategories 
      : allCategories.filter(cat => categoryPerm?.allowed_items?.includes(cat.id)) || [];

    const allowedDepartments = departmentPerm?.has_full_access 
      ? allDepartments 
      : allDepartments.filter(dept => departmentPerm?.allowed_items?.includes(dept.id)) || [];

    return {
      allowedCategories,
      allowedDepartments
    };
  }, [isAdmin, allCategories, allDepartments, productPermissions]);

  // فلترة المنتجات أولاً بالصلاحيات ثم بالفلاتر الإضافية
  const permissionFilteredProducts = useMemo(() => {
    let filtered = filterProductsByPermissions(products);
    
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
    department: 'all',
    seasonOccasion: 'all',
    productType: 'all',
    brand: 'all',
    color: 'all',
    size: 'all',
    price: [0, 500000],
  });
  
  const [dialogs, setDialogs] = useState({
    quickOrder: false,
    productVariant: false,
    barcodeScanner: false,
    advancedFilters: false,
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

    // فلترة حسب القسم
    if (filters.department !== 'all') {
      tempProducts = tempProducts.filter(p => 
        p.product_departments?.some(pd => pd.department_id === filters.department)
      );
    }

    // فلترة حسب التصنيف
    if (filters.category !== 'all') {
      tempProducts = tempProducts.filter(p => 
        p.product_categories?.some(pc => pc.category_id === filters.category)
      );
    }

    // فلترة حسب الموسم/المناسبة
    if (filters.seasonOccasion !== 'all') {
      tempProducts = tempProducts.filter(p => 
        p.product_seasons_occasions?.some(pso => pso.season_occasion_id === filters.seasonOccasion)
      );
    }

    // فلترة حسب نوع المنتج
    if (filters.productType !== 'all') {
      tempProducts = tempProducts.filter(p => 
        p.product_product_types?.some(ppt => ppt.product_type_id === filters.productType)
      );
    }

    // فلترة حسب العلامة التجارية
    if (filters.brand !== 'all') {
      tempProducts = tempProducts.filter(p => p.brand === filters.brand);
    }

    // فلترة حسب اللون
    if (filters.color !== 'all') {
      tempProducts = tempProducts.filter(p => 
        p.variants.some(v => v.color_id === filters.color)
      );
    }

    // فلترة حسب الحجم
    if (filters.size !== 'all') {
      tempProducts = tempProducts.filter(p => 
        p.variants.some(v => v.size_id === filters.size)
      );
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

  const handleBarcodeScan = (scanData) => {
    console.log("🔍 بيانات المسح في صفحة المنتجات:", scanData);
    
    let searchTerm = '';
    let foundProduct = null;
    let foundVariant = null;
    
    // التعامل مع QR Code محلل (JSON)
    if (typeof scanData === 'object' && scanData !== null) {
      const { product_id, variant_id, product_name, color, size } = scanData;
      
      // البحث بمعرف المنتج أو المتغير
      if (product_id) {
        foundProduct = permissionFilteredProducts.find(p => p.id === product_id);
        if (foundProduct && variant_id) {
          foundVariant = foundProduct.variants.find(v => v.id === variant_id);
        }
      }
      
      searchTerm = product_name || scanData.qr_id || scanData.barcode || '';
    } else {
      // التعامل مع نص عادي
      searchTerm = scanData;
      
      // البحث بالباركود أو المعرف
      foundProduct = permissionFilteredProducts.find(p => 
        p.id === scanData ||
        p.barcode === scanData ||
        p.variants.some(v => v.barcode === scanData || v.id === scanData)
      );
      
      if (foundProduct) {
        foundVariant = foundProduct.variants.find(v => v.barcode === scanData || v.id === scanData);
      }
    }
    
    // تحديث فلتر البحث
    setFilters(prev => ({ ...prev, searchTerm }));
    
    // إذا تم العثور على المنتج، فتحه مباشرة
    if (foundProduct) {
      console.log("📦 تم العثور على المنتج:", foundProduct.name, foundVariant ? `- ${foundVariant.color} ${foundVariant.size}` : '');
      
      // إظهار تفاصيل المنتج
      handleProductSelect(foundProduct);
      
      toast({ 
        title: "✅ تم العثور على المنتج", 
        description: `${foundProduct.name}${foundVariant ? ` - ${foundVariant.color} ${foundVariant.size}` : ''}`,
        variant: "success"
      });
    } else {
      // البحث النصي
      toast({ 
        title: "🔍 تم البحث", 
        description: `البحث عن: ${searchTerm}`,
        variant: "default"
      });
    }
  };

  const resetPermissionFilters = () => {
    setPermissionFilters({ category: 'all', department: 'all' });
  };

  const hasActivePermissionFilters = permissionFilters.category !== 'all' || permissionFilters.department !== 'all';

  // مكون فلتر الصلاحيات
  const PermissionBasedFilter = () => {
    // إذا لم يكن لدى المستخدم صلاحيات متعددة، لا نعرض الفلتر
    if (!isAdmin && allowedData.allowedCategories.length <= 1 && allowedData.allowedDepartments.length <= 1) {
      return null;
    }

    return (
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4" />
              <CardTitle className="text-sm">فلترة المنتجات حسب الصلاحيات</CardTitle>
            </div>
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
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* فلتر الأقسام */}
            {allowedData.allowedDepartments.length > 1 && (
              <div className="space-y-2">
                <Label className="text-xs font-medium">القسم</Label>
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
                <Label className="text-xs font-medium">التصنيف الرئيسي</Label>
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
          </div>

          {/* معلومات الفلترة الحالية */}
          {hasActivePermissionFilters && (
            <div className="pt-2 border-t">
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {permissionFilters.department !== 'all' && (
                  <span className="bg-accent px-2 py-1 rounded">
                    القسم: {allowedData.allowedDepartments.find(d => d.id === permissionFilters.department)?.name}
                  </span>
                )}
                {permissionFilters.category !== 'all' && (
                  <span className="bg-accent px-2 py-1 rounded">
                    التصنيف: {allowedData.allowedCategories.find(c => c.id === permissionFilters.category)?.name}
                  </span>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
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
            onAdvancedFilters={() => setDialogs(prev => ({ ...prev, advancedFilters: true }))}
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

      <AdvancedProductFilters
        open={dialogs.advancedFilters}
        onOpenChange={(open) => setDialogs(prev => ({ ...prev, advancedFilters: open }))}
        filters={filters}
        setFilters={setFilters}
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