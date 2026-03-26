import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { useInventory } from '@/contexts/InventoryContext';
import { Button } from '@/components/ui/button';
import { ArrowRight, Package } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import ManageProductsToolbar from '@/components/manage-products/ManageProductsToolbar';
import ManageProductListItem from '@/components/manage-products/ManageProductListItem';
import ManageProductCard from '@/components/manage-products/ManageProductCard';
import { Checkbox } from '@/components/ui/checkbox';
import { useLocalStorage } from '@/hooks/useLocalStorage.jsx';
import { toast } from '@/components/ui/use-toast';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import SmartPagination from '@/components/ui/SmartPagination';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { Badge } from '@/components/ui/badge';

const EmployeeProductsPage = () => {
  const { products, deleteProducts, loading, refreshProducts } = useInventory();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const userId = currentUser?.id || currentUser?.user_id;

  const [viewMode, setViewMode] = useLocalStorage('empProductsViewMode', 'list');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const ITEMS_PER_PAGE = 15;
  const [currentPage, setCurrentPage] = useState(1);

  // فلترة المنتجات الخاصة بالموظف فقط
  const myProducts = useMemo(() => {
    if (!products || !userId) return [];
    return products.filter(p => p.created_by === userId);
  }, [products, userId]);

  const searchFilteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return myProducts;
    const lowerSearchTerm = searchTerm.toLowerCase();
    return myProducts.filter(product =>
      product.name?.toLowerCase().includes(lowerSearchTerm) ||
      product.sku?.toLowerCase().includes(lowerSearchTerm) ||
      product.barcode?.toLowerCase().includes(lowerSearchTerm)
    );
  }, [myProducts, searchTerm]);

  const sortedProducts = useMemo(() => {
    return [...searchFilteredProducts].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [searchFilteredProducts]);

  const totalPages = Math.ceil(sortedProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = sortedProducts.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  useEffect(() => { setCurrentPage(1); }, [searchTerm]);

  const toggleSelectProduct = useCallback((productId) => {
    setSelectedProductIds(prev =>
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
    );
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedProductIds.length === paginatedProducts.length) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(paginatedProducts.map(p => p.id));
    }
  }, [selectedProductIds, paginatedProducts]);

  const handleDeleteSelected = async () => {
    if (selectedProductIds.length === 0) return;
    try {
      await deleteProducts(selectedProductIds);
      toast({ title: "تم الحذف", description: `تم حذف ${selectedProductIds.length} منتج بنجاح` });
      setSelectedProductIds([]);
      setIsDeleteAlertOpen(false);
      refreshProducts();
    } catch (error) {
      toast({ title: "خطأ", description: "فشل في حذف المنتجات", variant: "destructive" });
    }
  };

  return (
    <>
      <Helmet>
        <title>منتجاتي - نظام RYUS</title>
      </Helmet>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => navigate('/employee-financial-center')}>
              <ArrowRight className="h-4 w-4 ml-2" />
              رجوع
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">منتجاتي</h1>
              <p className="text-muted-foreground">إدارة المنتجات الخاصة بك</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline" className="text-base px-3 py-1">
              <Package className="w-4 h-4 ml-1" />
              {myProducts.length} منتج
            </Badge>
            <Button onClick={() => navigate('/products/add')}>
              إضافة منتج جديد
            </Button>
          </div>
        </div>

        <ManageProductsToolbar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          selectedCount={selectedProductIds.length}
          onDeleteSelected={() => setIsDeleteAlertOpen(true)}
        />

        {selectedProductIds.length > 0 && (
          <div className="flex items-center gap-2 p-2 bg-primary/10 rounded-lg">
            <Checkbox
              checked={selectedProductIds.length === paginatedProducts.length}
              onCheckedChange={handleSelectAll}
            />
            <span className="text-sm">{selectedProductIds.length} منتج محدد</span>
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
        ) : viewMode === 'list' ? (
          <div className="space-y-2">
            <AnimatePresence>
              {paginatedProducts.map((product) => (
                <motion.div key={product.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <ManageProductListItem
                    product={product}
                    isSelected={selectedProductIds.includes(product.id)}
                    onToggleSelect={() => toggleSelectProduct(product.id)}
                    onEdit={() => navigate(`/manage-variants?productId=${product.id}`)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <AnimatePresence>
              {paginatedProducts.map((product) => (
                <motion.div key={product.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
                  <ManageProductCard
                    product={product}
                    isSelected={selectedProductIds.includes(product.id)}
                    onToggleSelect={() => toggleSelectProduct(product.id)}
                    onEdit={() => navigate(`/manage-variants?productId=${product.id}`)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
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
