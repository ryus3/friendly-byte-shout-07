import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { useInventory } from '@/contexts/InventoryContext';
import { Button } from '@/components/ui/button';
import { ArrowRight, Package, RefreshCw } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import ManageProductsToolbar from '@/components/manage-products/ManageProductsToolbar';
import ManageProductListItem from '@/components/manage-products/ManageProductListItem';
import ManageProductCard from '@/components/manage-products/ManageProductCard';
import PrintLabelsDialog from '@/components/manage-products/PrintLabelsDialog';
import BarcodeScannerDialog from '@/components/products/BarcodeScannerDialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useLocalStorage } from '@/hooks/useLocalStorage.jsx';
import { toast } from '@/components/ui/use-toast';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import SmartPagination from '@/components/ui/SmartPagination';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { Badge } from '@/components/ui/badge';
import { RefreshCacheButton } from '@/components/products/RefreshCacheButton';

const EmployeeProductsPage = () => {
  const { products, deleteProducts, loading, refreshProducts } = useInventory();
  const { user: currentUser, filterProductsByPermissions } = useAuth();
  const navigate = useNavigate();
  const isMobile = useMediaQuery("(max-width: 768px)");
  
  // استخدام كلا المعرفين للمقارنة الموثوقة
  const userIdPrimary = currentUser?.id;
  const userIdSecondary = currentUser?.user_id;
  const isOwner = useCallback((ownerId) => {
    if (!ownerId) return false;
    return ownerId === userIdPrimary || ownerId === userIdSecondary;
  }, [userIdPrimary, userIdSecondary]);

  const [viewMode, setViewMode] = useLocalStorage('empProductsViewMode', 'list');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [showFilter, setShowFilter] = useState('mine');
  const ITEMS_PER_PAGE = 15;
  const [currentPage, setCurrentPage] = useState(1);

  // فلترة المنتجات - منتجاتي فقط
  const myProducts = useMemo(() => {
    if (!products) return [];
    return products.filter(p => isOwner(p.owner_user_id));
  }, [products, isOwner]);

  // "جميع المنتجات المصرح بها" = منتجاتي + منتجات النظام المصرح بها
  const displayProducts = useMemo(() => {
    if (showFilter === 'mine') return myProducts;
    // فلترة منتجات النظام (غير ملكي) حسب الصلاحيات
    const systemProducts = (products || []).filter(p => !isOwner(p.owner_user_id));
    const allowedSystem = filterProductsByPermissions ? filterProductsByPermissions(systemProducts) : [];
    // دمج منتجاتي + المنتجات المصرح بها
    return [...myProducts, ...allowedSystem];
  }, [showFilter, myProducts, products, isOwner, filterProductsByPermissions]);

  const searchFilteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return displayProducts;
    const lowerSearchTerm = searchTerm.toLowerCase();
    return displayProducts.filter(product =>
      product.name?.toLowerCase().includes(lowerSearchTerm) ||
      product.sku?.toLowerCase().includes(lowerSearchTerm) ||
      product.barcode?.toLowerCase().includes(lowerSearchTerm) ||
      product.variants?.some(v =>
        v.barcode?.toLowerCase().includes(lowerSearchTerm) ||
        v.sku?.toLowerCase().includes(lowerSearchTerm)
      )
    );
  }, [displayProducts, searchTerm]);

  const sortedProducts = useMemo(() => {
    return [...searchFilteredProducts].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [searchFilteredProducts]);

  const totalPages = Math.ceil(sortedProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = sortedProducts.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, showFilter]);

  const selectedProducts = useMemo(() =>
    products.filter(p => selectedProductIds.includes(p.id)),
    [products, selectedProductIds]
  );

  const handleSelectProduct = useCallback((productId) => {
    setSelectedProductIds(prev =>
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
    );
  }, []);

  const handleSelectAll = useCallback((isChecked) => {
    if (isChecked) {
      setSelectedProductIds(searchFilteredProducts.map(p => p.id));
    } else {
      setSelectedProductIds([]);
    }
  }, [searchFilteredProducts]);

  const handleDeleteSelected = async () => {
    // Only allow deleting own products
    const ownProducts = selectedProductIds.filter(id => {
      const p = products.find(pr => pr.id === id);
      return isOwner(p?.owner_user_id);
    });
    if (ownProducts.length === 0) {
      toast({ title: "خطأ", description: "يمكنك حذف منتجاتك فقط", variant: "destructive" });
      return;
    }
    try {
      setIsDeleteAlertOpen(false);
      toast({ title: "جاري الحذف...", description: `حذف ${ownProducts.length} منتج(ات)` });
      const { success } = await deleteProducts(ownProducts);
      if (success) {
        toast({ title: "تم الحذف بنجاح ✅", description: `تم حذف ${ownProducts.length} منتج` });
        setSelectedProductIds([]);
        refreshProducts();
      }
    } catch (error) {
      toast({ title: "خطأ", description: "فشل في حذف المنتجات", variant: "destructive" });
    }
  };

  const handleDeleteSingle = useCallback((product) => {
    if (!isOwner(product.owner_user_id)) {
      toast({ title: "خطأ", description: "يمكنك حذف منتجاتك فقط", variant: "destructive" });
      return;
    }
    setSelectedProductIds([product.id]);
    setIsDeleteAlertOpen(true);
  }, [isOwner]);

  const handleScanSuccess = useCallback((decodedText) => {
    setIsScannerOpen(false);
    setSearchTerm(decodedText);
    toast({ title: "تم البحث", description: `جاري البحث عن: ${decodedText}` });
  }, []);

  const handlePrintSingle = useCallback((product) => {
    setSelectedProductIds([product.id]);
    setIsPrintDialogOpen(true);
  }, []);

  const handleQuickPrintLabels = useCallback(() => {
    if (myProducts.length === 0) {
      toast({ title: "لا توجد منتجات", description: "لا توجد منتجات لطباعة الملصقات.", variant: "default" });
      return;
    }
    setSelectedProductIds(myProducts.map(p => p.id));
    setIsPrintDialogOpen(true);
  }, [myProducts]);

  const isMyProduct = useCallback((product) => isOwner(product.owner_user_id), [isOwner]);

  return (
    <>
      <Helmet>
        <title>منتجاتي - نظام RYUS</title>
      </Helmet>

      <PrintLabelsDialog
        open={isPrintDialogOpen}
        onOpenChange={setIsPrintDialogOpen}
        products={selectedProducts}
      />

      <BarcodeScannerDialog
        open={isScannerOpen}
        onOpenChange={setIsScannerOpen}
        onScanSuccess={handleScanSuccess}
      />

      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => navigate('/employee-financial-center')}>
              <ArrowRight className="h-4 w-4 ml-2" />
              رجوع
            </Button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                إدارة المنتجات
              </h1>
              <p className="text-muted-foreground text-sm">إدارة منتجاتك الخاصة</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <RefreshCacheButton />
            <Badge variant="outline" className="text-base px-3 py-1">
              <Package className="w-4 h-4 ml-1" />
              {myProducts.length} منتج خاص
            </Badge>
          </div>
        </div>

        {/* فلتر التبديل بين منتجاتي ومنتجات النظام */}
        <div className="flex gap-2">
          <Button
            variant={showFilter === 'mine' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowFilter('mine')}
          >
            منتجاتي ({myProducts.length})
          </Button>
          <Button
            variant={showFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowFilter('all')}
          >
            جميع المنتجات المصرح بها ({displayProducts.length})
          </Button>
        </div>

        <ManageProductsToolbar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onAddProduct={() => navigate('/products/add')}
          onManageCategories={() => navigate('/manage-variants')}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          selectedCount={selectedProductIds.length}
          onClearSelection={() => setSelectedProductIds([])}
          onDeleteSelected={() => setIsDeleteAlertOpen(true)}
          onPrintSelected={() => setIsPrintDialogOpen(true)}
          onBarcodeSearch={() => setIsScannerOpen(true)}
          onQuickPrintLabels={handleQuickPrintLabels}
          isMobile={isMobile}
        />

        {searchFilteredProducts.length > 0 && viewMode === 'list' && (
          <div className="flex items-center gap-4 p-3 bg-card border rounded-lg shadow-lg shadow-black/10 dark:shadow-lg dark:shadow-primary/20">
            <Checkbox
              id="select-all-emp"
              checked={selectedProductIds.length === searchFilteredProducts.length && searchFilteredProducts.length > 0}
              onCheckedChange={handleSelectAll}
            />
            <label htmlFor="select-all-emp" className="text-sm font-medium">تحديد الكل</label>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-48 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : sortedProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <Package className="w-16 h-16 text-muted-foreground" />
            <h2 className="text-xl font-bold text-muted-foreground">لا توجد منتجات</h2>
            <p className="text-muted-foreground">ابدأ بإضافة منتجاتك الخاصة</p>
            <Button onClick={() => navigate('/products/add')}>إضافة منتج جديد</Button>
          </div>
        ) : (
          <AnimatePresence>
            {viewMode === 'list' ? (
              <motion.div layout className="space-y-3">
                {paginatedProducts.map((product) => (
                  <motion.div layout key={product.id} className="relative">
                    {/* Badge تمييز المنتج */}
                    <div className="absolute top-2 left-2 z-10">
                      {isMyProduct(product) ? (
                        <Badge className="bg-emerald-500/90 text-white text-xs">منتجي</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">منتج النظام</Badge>
                      )}
                    </div>
                    <ManageProductListItem
                      product={product}
                      isSelected={selectedProductIds.includes(product.id)}
                      onSelect={handleSelectProduct}
                      onProductUpdate={() => {}}
                      refetchProducts={refreshProducts}
                    />
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {paginatedProducts.map((product) => (
                  <motion.div layout key={product.id} className="relative">
                    <div className="absolute top-2 left-2 z-10">
                      {isMyProduct(product) ? (
                        <Badge className="bg-emerald-500/90 text-white text-xs">منتجي</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">منتج النظام</Badge>
                      )}
                    </div>
                    <ManageProductCard
                      product={product}
                      onDelete={handleDeleteSingle}
                      onPrint={handlePrintSingle}
                    />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        )}

        <SmartPagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={sortedProducts.length}
          itemsPerPage={ITEMS_PER_PAGE}
        />
      </div>

      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف المنتجات المحددة؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف {selectedProductIds.length} منتج نهائياً. لا يمكن التراجع.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSelected} className="bg-destructive hover:bg-destructive/90">
              حذف المنتجات
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default EmployeeProductsPage;
