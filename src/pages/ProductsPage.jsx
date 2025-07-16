import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/AuthContext';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useLocalStorage } from '@/hooks/useLocalStorage.jsx';
import { useVariants } from '@/contexts/VariantsContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, LayoutGrid, List, SlidersHorizontal, Search, ShoppingCart, Check, X, QrCode } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import ProductGrid from '@/components/products/ProductGrid';
import ProductList from '@/components/products/ProductList';
import ProductFilters from '@/components/products/ProductFilters';
import QuickOrderDialog from '@/components/quick-order/QuickOrderDialog';
import ProductVariantDialog from '@/components/products/ProductVariantDialog';
import BarcodeScannerDialog from '@/components/products/BarcodeScannerDialog';
import { toast } from '@/components/ui/use-toast';

const ProductsPage = () => {
  const location = useLocation();
  const { products, loading, addToCart, clearCart } = useInventory();
  const { hasPermission } = useAuth();
  const { colors } = useVariants();
  
  const { categories, brands } = useMemo(() => {
    // استخراج التصنيفات والعلامات التجارية المسموحة فقط
    const allowedProducts = products.filter(product => {
      // التحقق من صلاحيات التصنيفات
      if (product.product_categories && product.product_categories.length > 0) {
        const hasAllowedCategory = product.product_categories.some(pc => 
          hasPermission('view_category_all') || hasPermission(`view_category_${pc.category_id}`)
        );
        if (!hasAllowedCategory) return false;
      }

      // التحقق من صلاحيات الأقسام
      if (product.product_departments && product.product_departments.length > 0) {
        const hasAllowedDepartment = product.product_departments.some(pd => 
          hasPermission('view_department_all') || hasPermission(`view_department_${pd.department_id}`)
        );
        if (!hasAllowedDepartment) return false;
      }

      return true;
    });

    const uniqueCategories = [...new Set(allowedProducts.map(p => p.categories?.main_category).filter(Boolean))];
    const uniqueBrands = [...new Set(allowedProducts.map(p => p.brand).filter(Boolean))];
    
    return { categories: uniqueCategories, brands: uniqueBrands };
  }, [products, hasPermission]);
  
  const [viewMode, setViewMode] = useLocalStorage('productsViewMode', 'grid');
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
    let tempProducts = products.filter(p => p.is_visible);

    // تطبيق صلاحيات المنتجات حسب التصنيفات والأقسام والمتغيرات
    tempProducts = tempProducts.filter(product => {
      // التحقق من صلاحيات التصنيفات
      if (product.product_categories && product.product_categories.length > 0) {
        const hasAllowedCategory = product.product_categories.some(pc => 
          hasPermission('view_category_all') || hasPermission(`view_category_${pc.category_id}`)
        );
        if (!hasAllowedCategory) return false;
      }

      // التحقق من صلاحيات الأقسام
      if (product.product_departments && product.product_departments.length > 0) {
        const hasAllowedDepartment = product.product_departments.some(pd => 
          hasPermission('view_department_all') || hasPermission(`view_department_${pd.department_id}`)
        );
        if (!hasAllowedDepartment) return false;
      }

      // التحقق من صلاحيات الألوان
      if (product.variants && product.variants.length > 0) {
        const hasAllowedColor = product.variants.some(variant => 
          !variant.color_id || hasPermission('view_color_all') || hasPermission(`view_color_${variant.color_id}`)
        );
        if (!hasAllowedColor) return false;

        // التحقق من صلاحيات الأحجام
        const hasAllowedSize = product.variants.some(variant => 
          !variant.size_id || hasPermission('view_size_all') || hasPermission(`view_size_${variant.size_id}`)
        );
        if (!hasAllowedSize) return false;
      }

      // التحقق من صلاحيات أنواع المنتجات
      if (product.product_product_types && product.product_product_types.length > 0) {
        const hasAllowedProductType = product.product_product_types.some(ppt => 
          hasPermission('view_product_type_all') || hasPermission(`view_product_type_${ppt.product_type_id}`)
        );
        if (!hasAllowedProductType) return false;
      }

      // التحقق من صلاحيات المواسم والمناسبات
      if (product.product_seasons_occasions && product.product_seasons_occasions.length > 0) {
        const hasAllowedSeasonOccasion = product.product_seasons_occasions.some(pso => 
          hasPermission('view_season_occasion_all') || hasPermission(`view_season_occasion_${pso.season_occasion_id}`)
        );
        if (!hasAllowedSeasonOccasion) return false;
      }

      return true;
    });

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
  }, [products, filters]);
  
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
    const foundProduct = products.find(p => p.variants.some(v => v.barcode === barcode));
    if (foundProduct) {
      handleProductSelect(foundProduct);
    } else {
      toast({ title: "لم يتم العثور على المنتج", description: "لا يوجد منتج بهذا الباركود.", variant: "destructive" });
    }
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
        <header className="flex-shrink-0 p-4 border-b">
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
              <ProductGrid products={filteredProducts} onProductSelect={handleProductSelect} onCreateOrder={handleCreateOrder} />
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