
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { useInventory } from '@/contexts/InventoryContext';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import ManageProductsToolbar from '@/components/manage-products/ManageProductsToolbar';
import ManageProductListItem from '@/components/manage-products/ManageProductListItem';
import ManageProductCard from '@/components/manage-products/ManageProductCard';
import { Checkbox } from '@/components/ui/checkbox';
import PrintLabelsDialog from '@/components/manage-products/PrintLabelsDialog';
import { useLocalStorage } from '@/hooks/useLocalStorage.jsx';
import { toast } from '@/components/ui/use-toast';
import BarcodeScannerDialog from '@/components/products/BarcodeScannerDialog';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import SmartPagination from '@/components/ui/SmartPagination';

import { useAuth } from '@/contexts/UnifiedAuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useFilteredProducts } from '@/hooks/useFilteredProducts';

const ManageProductsPage = () => {
  const { products, deleteProducts, loading, refreshProducts } = useInventory();
  const { user } = useAuth();
  const { hasPermission, isAdmin } = usePermissions();
  const navigate = useNavigate();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [viewMode, setViewMode] = useLocalStorage('manageProductsViewMode', 'list');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  

  // استخدام hook الفلترة المحسن
  const filteredProducts = useFilteredProducts(products);
  
  const ITEMS_PER_PAGE = 15;
  const [currentPage, setCurrentPage] = useState(1);
  
  // فلترة إضافية للبحث - محسنة للأداء
  const searchFilteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return filteredProducts;
    
    const lowerSearchTerm = searchTerm.toLowerCase();
    return filteredProducts.filter(product => 
      product.name.toLowerCase().includes(lowerSearchTerm) ||
      product.description?.toLowerCase().includes(lowerSearchTerm) ||
      product.variants?.some(variant => 
        variant.barcode?.toLowerCase().includes(lowerSearchTerm) ||
        variant.sku?.toLowerCase().includes(lowerSearchTerm)
      )
    );
  }, [filteredProducts, searchTerm]);

  // إعادة تعيين الصفحة عند تغيير البحث
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // حساب الصفحات
  const totalPages = Math.ceil(searchFilteredProducts.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedProducts = searchFilteredProducts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  

  // إزالة الإجبار على وضع الشبكة في الهاتف - دع المستخدم يختار

  
  const selectedProducts = useMemo(() => 
    products.filter(p => selectedProductIds.includes(p.id)),
    [products, selectedProductIds]
  );

  const handleSelectProduct = useCallback((productId) => {
    setSelectedProductIds(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
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
    const productsToDelete = selectedProductIds;
    const productNames = products
      .filter(p => productsToDelete.includes(p.id))
      .map(p => p.name);
    
    try {
      // التحديث الفوري - إخفاء المنتجات من الواجهة قبل الحذف
      setSelectedProductIds([]);
      
      // إضافة loading state لمنع التفاعل المتكرر
      setIsDeleteAlertOpen(false);
      
      // عرض toast للتحميل
      toast({
        title: "جاري الحذف...",
        description: `حذف ${productsToDelete.length} منتج(ات)`,
        variant: "default"
      });

      const { success, warning } = await deleteProducts(productsToDelete);
      
      if (success) {
        // رسالة نجاح مفصلة
        toast({
          title: "تم الحذف بنجاح ✅",
          description: `تم حذف: ${productNames.slice(0, 3).join(', ')}${productNames.length > 3 ? ` و ${productNames.length - 3} منتج آخر` : ''}`,
          variant: "default"
        });
        
        // Additional warning if needed
        if (warning) {
          setTimeout(() => {
            toast({
              title: "تحذير",
              description: warning,
              variant: 'default'
            });
          }, 1000);
        }
      } else {
        // إعادة تحديد المنتجات في حالة الفشل
        setSelectedProductIds(productsToDelete);
        toast({
          title: "خطأ في الحذف",
          description: "فشل حذف المنتجات المحددة.",
          variant: 'destructive'
        });
      }
    } catch (error) {
      // إعادة تحديد المنتجات في حالة الخطأ
      setSelectedProductIds(productsToDelete);
      console.error('Delete error:', error);
      toast({
        title: "خطأ أثناء الحذف",
        description: "حدث خطأ أثناء الحذف.",
        variant: 'destructive'
      });
    }
  };
  
  const handleDeleteSingle = useCallback((product) => {
    setSelectedProductIds([product.id]);
    setIsDeleteAlertOpen(true);
  }, []);

  const onProductUpdate = useCallback(() => {
    // لا حاجة لتحديث إضافي - يتم تلقائياً في SuperProvider
  }, []);

  const handleScanSuccess = useCallback((decodedText) => {
    setIsScannerOpen(false);
    setSearchTerm(decodedText);
    toast({ title: "تم البحث", description: `جاري البحث عن: ${decodedText}` });
  }, []);

  const handlePrintSingle = useCallback((product) => {
    setSelectedProductIds([product.id]);
    setIsPrintDialogOpen(true);
  }, []);

  const handleManageVariants = useCallback(() => {
    if (hasPermission('manage_variants')) {
      navigate('/manage-variants');
    }
    // Remove the unauthorized toast message
  }, [hasPermission, navigate]);


  const handleQuickPrintLabels = useCallback(() => {
    if (products.length === 0) {
      toast({
        title: "لا توجد منتجات",
        description: "لا توجد منتجات لطباعة الملصقات.",
        variant: "default"
      });
      return;
    }
    // تعيين جميع المنتجات للطباعة
    setSelectedProductIds(products.map(p => p.id));
    setIsPrintDialogOpen(true);
  }, [products]);

  return (
    <>
      <Helmet>
        <title>إدارة المنتجات - RYUS</title>
        <meta name="description" content="إضافة وتعديل وحذف المنتجات في النظام." />
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
        <div className="text-center space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                إدارة المنتجات
            </h1>
            <p className="text-muted-foreground text-sm">
                إضافة وتعديل وحذف المنتجات في النظام
            </p>
        </div>

        <ManageProductsToolbar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onAddProduct={() => navigate('/products/add')}
          onManageCategories={handleManageVariants}
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
          <div className="flex items-center gap-4 p-3 bg-card border rounded-lg
                       shadow-lg shadow-black/10 
                       dark:shadow-lg dark:shadow-primary/20
                       transition-all duration-300 
                       hover:shadow-xl hover:shadow-primary/20
                       dark:hover:shadow-2xl dark:hover:shadow-primary/30">
            <Checkbox 
              id="select-all"
              checked={selectedProductIds.length === searchFilteredProducts.length && searchFilteredProducts.length > 0}
              onCheckedChange={handleSelectAll}
              indeterminate={selectedProductIds.length > 0 && selectedProductIds.length < searchFilteredProducts.length}
            />
            <label htmlFor="select-all" className="text-sm font-medium">تحديد الكل</label>
          </div>
        )}

        <AnimatePresence>
          {viewMode === 'list' ? (
            <motion.div layout className="space-y-3">
              {paginatedProducts && paginatedProducts.length > 0 && paginatedProducts.map((product) => (
                <motion.div layout key={product.id}>
                   <ManageProductListItem 
                     product={product} 
                     isSelected={selectedProductIds.includes(product.id)} 
                     onSelect={handleSelectProduct}
                     onProductUpdate={onProductUpdate}
                     refetchProducts={refreshProducts}
                   />
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {paginatedProducts && paginatedProducts.length > 0 && paginatedProducts.map((product) => (
                <motion.div layout key={product.id}>
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
        
        <SmartPagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={searchFilteredProducts.length}
          itemsPerPage={ITEMS_PER_PAGE}
        />
      </div>

      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف المنتجات المحددة؟</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف {selectedProductIds.length} منتج(ات)؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSelected} className="bg-destructive hover:bg-destructive/90">
              نعم، قم بالحذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ManageProductsPage;
