
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/use-toast';
import { useSearchParams } from 'react-router-dom';
import InventoryHeader from '@/components/inventory/InventoryHeader';
import InventoryStats from '@/components/inventory/InventoryStats';
import InventoryFilters from '@/components/inventory/InventoryFilters';
import EditStockDialog from '@/components/inventory/EditStockDialog';
import BarcodeScannerDialog from '@/components/products/BarcodeScannerDialog';
import ReservedStockDialog from '@/components/inventory/ReservedStockDialog';
import { useReactToPrint } from 'react-to-print';
import InventoryPDF from '@/components/pdf/InventoryPDF';
import Loader from '@/components/ui/loader';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { Package, ChevronDown } from 'lucide-react';
import InventoryItem from '@/components/inventory/InventoryItem';

const InventoryList = ({ items, onEditStock, canEdit, stockFilter, isLoading, onSelectionChange, selectedItems, isMobile }) => {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-20 w-full rounded-lg bg-card border p-3 flex items-center gap-4">
            <Checkbox disabled />
            <div className="w-12 h-12 rounded-md bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded bg-muted" />
              <div className="h-3 w-1/2 rounded bg-muted" />
            </div>
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          </div>
        ))}
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-400 mb-2">لا توجد عناصر</h3>
        <p className="text-gray-500">جرب تغيير معايير البحث أو الفلترة</p>
      </div>
    );
  }

  return (
    <Accordion type="multiple" className="w-full space-y-2">
      {items.map(product => (
        <AccordionItem key={product.id} value={`product-${product.id}`} className="bg-card rounded-lg border">
          <AccordionTrigger className="p-3 hover:no-underline">
            <div className="flex items-center gap-4 w-full">
              <Checkbox
                checked={selectedItems.includes(product.id)}
                onCheckedChange={(checked) => onSelectionChange(product.id, checked)}
                onClick={(e) => e.stopPropagation()}
              />
              <img src={product.images?.[0] || '/api/placeholder/150/150'} alt={product.name} className="w-12 h-12 rounded-md object-cover" />
              <div className="flex-1 text-right">
                <p className="font-semibold text-foreground">{product.name}</p>
                <p className="text-sm text-muted-foreground">{product.variants?.length || 0} متغيرات</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2 p-3 border-t">
              {product.variants && product.variants.map(variant => (
                <InventoryItem
                  key={variant.id}
                  variant={variant}
                  product={product}
                  onEditStock={canEdit ? () => onEditStock(product, variant) : null}
                />
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
};


const InventoryPage = () => {
  const { products, orders, loading, settings, updateVariantStock } = useInventory();
  const { allUsers, hasPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const printComponentRef = useRef();
  const isMobile = useMediaQuery("(max-width: 768px)");

  const [filters, setFilters] = useState({
    searchTerm: '',
    stockFilter: 'all',
    category: 'all',
    price: [0, 500000],
    color: 'all',
    size: 'all',
  });
  const [editingItem, setEditingItem] = useState(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isBarcodeScannerOpen, setIsBarcodeScannerOpen] = useState(false);
  const [isReservedStockDialogOpen, setIsReservedStockDialogOpen] = useState(false);
  const [selectedItemsForExport, setSelectedItemsForExport] = useState([]);
  const [productsForExport, setProductsForExport] = useState([]);

  useEffect(() => {
    const productParam = searchParams.get('product');
    const variantParam = searchParams.get('variant');
    const highlightParam = searchParams.get('highlight');
    const stockFilterParam = searchParams.get('stockFilter');
    
    if (productParam || variantParam) {
      // إذا جاء من تنبيه المخزون، فلتر للمنتج المحدد
      if (productParam) {
        const product = products?.find(p => p.id === productParam);
        if (product) {
          setFilters(currentFilters => ({
            ...currentFilters, 
            searchTerm: product.name,
            stockFilter: 'low' // فلتر للمخزون المنخفض
          }));
        }
      }
    } else if (highlightParam) {
      setFilters(currentFilters => ({...currentFilters, searchTerm: highlightParam}));
    }
    
    if (stockFilterParam) {
      setFilters(currentFilters => ({...currentFilters, stockFilter: stockFilterParam}));
    }
  }, [searchParams, products]);

  const allCategories = useMemo(() => {
    if (!Array.isArray(products)) return [];
    const categories = new Set();
    products.forEach(p => {
      if (p.categories?.main_category) {
        categories.add(p.categories.main_category);
      }
    });
    return Array.from(categories);
  }, [products]);

  const inventoryItems = useMemo(() => {
    if (!Array.isArray(products) || !settings) return [];
    const { lowStockThreshold = 5, mediumStockThreshold = 10 } = settings;

    return products.map(product => {
        const variantsWithLevels = (product.variants || []).map(variant => {
          let stockLevel = 'high';
          const quantity = variant.quantity || 0;
          if (quantity > 0 && quantity <= lowStockThreshold) stockLevel = 'low';
          else if (quantity > 0 && quantity <= mediumStockThreshold) stockLevel = 'medium';
          const stockPercentage = Math.min((quantity / (mediumStockThreshold + 5)) * 100, 100);
          return { ...variant, stockLevel, stockPercentage };
        });

        const totalStock = variantsWithLevels.reduce((acc, v) => acc + (v.quantity || 0), 0);
        const totalReserved = variantsWithLevels.reduce((acc, v) => acc + (v.reserved || 0), 0);
      
        const hasLowStockVariant = variantsWithLevels.some(v => v.stockLevel === 'low');
        const hasMediumStockVariant = variantsWithLevels.some(v => v.stockLevel === 'medium');

        let overallStockLevel = 'high';
        if (hasLowStockVariant) overallStockLevel = 'low';
        else if (hasMediumStockVariant) overallStockLevel = 'medium';
        

        return {
          ...product,
          totalStock,
          totalReserved,
          stockLevel: overallStockLevel,
          variants: variantsWithLevels,
        };
    });
  }, [products, settings]);
  
  const reservedOrders = useMemo(() => {
    const safeOrders = Array.isArray(orders) ? orders : [];
    const safeUsers = Array.isArray(allUsers) ? allUsers : [];
    return safeOrders
      .filter(o => o.status === 'pending')
      .map(o => ({
        ...o,
        employeeName: safeUsers.find(u => u.id === o.created_by)?.full_name || 'غير معروف'
      }));
  }, [orders, allUsers]);

  const filteredItems = useMemo(() => {
    let items = [...inventoryItems];

    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      items = items.filter(p =>
        p.name.toLowerCase().includes(term) ||
        (p.sku_base && p.sku_base.toLowerCase().includes(term)) ||
        (p.variants && p.variants.some(v => v.sku && v.sku.toLowerCase().includes(term)))
      );
    }

    if (filters.category !== 'all') {
      items = items.filter(p => p.categories?.main_category === filters.category);
    }
    
    if (filters.color !== 'all') {
      items = items.filter(p => p.variants.some(v => v.color === filters.color));
    }
    
    if (filters.size !== 'all') {
      items = items.filter(p => p.variants.some(v => v.size === filters.size));
    }

    if (filters.price && (filters.price[0] > 0 || filters.price[1] < 500000)) {
      items = items.filter(p => p.variants.some(v => v.price >= filters.price[0] && v.price <= filters.price[1]));
    }

    if (filters.stockFilter !== 'all') {
      if (filters.stockFilter === 'reserved') {
        items = items.filter(item => item.totalReserved > 0);
      } else {
        items = items.filter(item => item.variants.some(v => v.stockLevel === filters.stockFilter));
      }
    }

    return items;
  }, [inventoryItems, filters]);

  const inventoryStats = useMemo(() => {
      const variants = inventoryItems.flatMap(item => item.variants || []);
      return {
          lowStockCount: variants.filter(v => v.stockLevel === 'low').length,
          mediumStockCount: variants.filter(v => v.stockLevel === 'medium').length,
          highStockCount: variants.filter(v => v.stockLevel === 'high').length,
          reservedStockCount: inventoryItems.reduce((sum, item) => sum + (item.totalReserved || 0), 0),
          totalVariants: variants.length,
      };
  }, [inventoryItems]);

  const handleEditStock = (product, variant) => {
    setEditingItem({ product, variant });
    setIsEditDialogOpen(true);
  };

  const handleFilterChange = useCallback((stockLevel) => {
    if (stockLevel === 'reserved') {
      setIsReservedStockDialogOpen(true);
    } else {
      setFilters(currentFilters => ({ ...currentFilters, stockFilter: stockLevel }));
    }
  }, []);

  const handlePrint = useReactToPrint({
    content: () => printComponentRef.current,
    documentTitle: 'تقرير-الجرد',
    onAfterPrint: () => toast({ title: "تمت الطباعة بنجاح" }),
  });
  
  const prepareAndPrint = useCallback(() => {
    if (selectedItemsForExport.length === 0) {
        toast({
            title: "لم يتم تحديد أي شيء",
            description: "الرجاء تحديد المنتجات التي تريد تصديرها أولاً.",
            variant: "destructive",
        });
        return;
    }
    const itemsToPrint = inventoryItems.filter(item => selectedItemsForExport.includes(item.id));
    setProductsForExport(itemsToPrint);
  }, [selectedItemsForExport, inventoryItems]);

  useEffect(() => {
    if (productsForExport.length > 0) {
        handlePrint();
        setProductsForExport([]); 
    }
  }, [productsForExport, handlePrint]);


  const handleBarcodeScan = (decodedText) => {
    setFilters(prev => ({ ...prev, searchTerm: decodedText }));
    setIsBarcodeScannerOpen(false);
    toast({ title: "تم البحث", description: `تم البحث عن الباركود: ${decodedText}` });
  };

  const handleSelectionChange = (productId, isSelected) => {
    setSelectedItemsForExport(prev => {
      const currentItems = Array.isArray(prev) ? [...prev] : [];
      if (isSelected) {
        if (!currentItems.includes(productId)) {
          return [...currentItems, productId];
        }
        return currentItems;
      } else {
        return currentItems.filter(id => id !== productId);
      }
    });
  };

  if (loading) {
    return <div className="flex h-full w-full items-center justify-center"><Loader /></div>;
  }

  return (
    <>
      <Helmet>
        <title>الجرد التفصيلي - نظام RYUS</title>
        <meta name="description" content="عرض وإدارة المخزون بشكل تفصيلي." />
      </Helmet>
      <div className="space-y-6">
        <InventoryHeader onExport={prepareAndPrint} />
        
        <InventoryStats 
          totalVariants={inventoryStats.totalVariants}
          lowStockCount={inventoryStats.lowStockCount}
          mediumStockCount={inventoryStats.mediumStockCount}
          highStockCount={inventoryStats.highStockCount}
          reservedStockCount={inventoryStats.reservedStockCount}
          onFilterChange={handleFilterChange}
          inventoryItems={inventoryItems}
        />

        <InventoryFilters
          filters={filters}
          setFilters={setFilters}
          categories={allCategories}
          onBarcodeSearch={() => setIsBarcodeScannerOpen(true)}
        />

        <InventoryList
          items={filteredItems}
          isLoading={loading}
          onEditStock={handleEditStock}
          canEdit={hasPermission('edit_stock')}
          stockFilter={filters.stockFilter}
          onSelectionChange={handleSelectionChange}
          selectedItems={selectedItemsForExport}
          isMobile={isMobile}
        />
      </div>

      {editingItem && (
        <EditStockDialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          item={editingItem}
          onSuccess={() => {
            // This will trigger a re-fetch in InventoryContext
          }}
        />
      )}

      <BarcodeScannerDialog
        open={isBarcodeScannerOpen}
        onOpenChange={setIsBarcodeScannerOpen}
        onScanSuccess={handleBarcodeScan}
      />
      
      <ReservedStockDialog
        open={isReservedStockDialogOpen}
        onOpenChange={setIsReservedStockDialogOpen}
        reservedOrders={reservedOrders}
        allUsers={allUsers}
      />
      <div style={{ display: 'none' }}>
        <InventoryPDF ref={printComponentRef} products={productsForExport} />
      </div>
    </>
  );
};

export default InventoryPage;
