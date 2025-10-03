import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useSimpleInventory } from '@/hooks/useSimpleInventory';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from '@/components/ui/use-toast';
import { useSearchParams } from 'react-router-dom';
import { scrollToTopInstant } from '@/utils/scrollToTop';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import InventoryProductGrid from '@/components/inventory/InventoryProductGrid';
import InventoryFilters from '@/components/inventory/InventoryFilters';
import BarcodeScannerDialog from '@/components/products/BarcodeScannerDialog';
import UnifiedInventoryStats from '@/components/inventory/UnifiedInventoryStats';
import Loader from '@/components/ui/loader';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

const InventoryPage = () => {
  const { items: inventoryItems, loading, refetch } = useSimpleInventory();
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  
  const [searchParams] = useSearchParams();
  const isMobile = useMediaQuery("(max-width: 768px)");

  const [filters, setFilters] = useState({
    searchTerm: '',
    stockFilter: 'all',
  });

  const [isBarcodeScannerOpen, setIsBarcodeScannerOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);

  useEffect(() => {
    scrollToTopInstant();
  }, []);

  // تصفية بسيطة للعناصر
  const filteredItems = useMemo(() => {
    let items = [...inventoryItems];
    
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      items = items.filter(item =>
        item.product_name?.toLowerCase().includes(term) ||
        item.category_name?.toLowerCase().includes(term) ||
        item.color_name?.toLowerCase().includes(term) ||
        item.size_name?.toLowerCase().includes(term)
      );
    }
    
    if (filters.stockFilter && filters.stockFilter !== 'all') {
      if (filters.stockFilter === 'out-of-stock') {
        items = items.filter(item => Number(item.available_quantity) === 0);
      } else if (filters.stockFilter === 'low') {
        items = items.filter(item => {
          const avail = Number(item.available_quantity);
          return avail > 0 && avail <= 5;
        });
      } else if (filters.stockFilter === 'medium') {
        items = items.filter(item => {
          const avail = Number(item.available_quantity);
          return avail > 5 && avail <= 10;
        });
      }
    }
    
    return items;
  }, [inventoryItems, filters]);

  const handleFilterChange = useCallback((key, value) => {
    if (typeof key === 'string' && value === undefined) {
      setFilters(currentFilters => ({ ...currentFilters, stockFilter: key }));
    } else {
      setFilters(currentFilters => ({ ...currentFilters, [key]: value }));
    }
  }, []);

  const handleBarcodeScan = (decodedText) => {
    setFilters(prev => ({ ...prev, searchTerm: decodedText }));
    setIsBarcodeScannerOpen(false);
  };

  if (loading) {
    return <Loader message="جاري تحميل بيانات الجرد..." />;
  }

  return (
    <>
      <Helmet>
        <title>جرد المنتجات - نظام إدارة المخزون</title>
        <meta name="description" content="عرض وإدارة جرد جميع المنتجات والمخزون" />
      </Helmet>

      <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-full">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">جرد المنتجات</h1>
            <p className="text-muted-foreground mt-1">إدارة ومتابعة مخزون جميع المنتجات</p>
          </div>
        </div>

        <UnifiedInventoryStats 
          onFilterChange={handleFilterChange}
          onDepartmentFilter={(dept) => {
            toast({ 
              title: 'تنبيه', 
              description: 'فلترة الأقسام قيد التطوير',
              variant: 'default' 
            });
          }}
        />

        <InventoryFilters
          filters={filters}
          setFilters={setFilters}
          onFilterChange={handleFilterChange}
          onBarcodeSearch={() => setIsBarcodeScannerOpen(true)}
        />

        <InventoryProductGrid
          items={filteredItems}
          onProductClick={(product) => {
            setSelectedProduct(product);
            setIsProductDialogOpen(true);
          }}
        />

        <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl">{selectedProduct?.name}</DialogTitle>
            </DialogHeader>
            
            {selectedProduct && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">التصنيف:</span>
                    <span className="font-semibold mr-2">{selectedProduct.category}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">إجمالي المتاح:</span>
                    <span className="font-semibold mr-2">{selectedProduct.totalAvailable}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">إجمالي محجوز:</span>
                    <span className="font-semibold mr-2">{selectedProduct.totalReserved}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">إجمالي الكمية:</span>
                    <span className="font-semibold mr-2">{selectedProduct.totalQuantity}</span>
                  </div>
                </div>
                
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3">المتغيرات:</h3>
                  <div className="space-y-2">
                    {selectedProduct.variants?.map((variant) => (
                      <div key={variant.variant_id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-4 h-4 rounded-full border-2 border-border"
                            style={{ backgroundColor: variant.color_hex || '#ccc' }}
                          />
                          <div>
                            <span className="font-medium">{variant.color_name}</span>
                            <span className="mx-2">•</span>
                            <span className="text-muted-foreground">{variant.size_name}</span>
                          </div>
                        </div>
                        <div className="flex gap-6 text-sm">
                          <div>
                            <span className="text-muted-foreground ml-1">متاح:</span>
                            <Badge variant={Number(variant.available_quantity) === 0 ? 'destructive' : 'default'}>
                              {variant.available_quantity}
                            </Badge>
                          </div>
                          {Number(variant.reserved_quantity) > 0 && (
                            <div>
                              <span className="text-muted-foreground ml-1">محجوز:</span>
                              <Badge variant="warning">{variant.reserved_quantity}</Badge>
                            </div>
                          )}
                          <div>
                            <span className="text-muted-foreground ml-1">إجمالي:</span>
                            <Badge variant="outline">{variant.total_quantity}</Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <BarcodeScannerDialog
          open={isBarcodeScannerOpen}
          onOpenChange={setIsBarcodeScannerOpen}
          onScanSuccess={handleBarcodeScan}
        />
      </div>
    </>
  );
};

export default InventoryPage;
