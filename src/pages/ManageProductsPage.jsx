
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
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { toast } from '@/components/ui/use-toast';
import BarcodeScannerDialog from '@/components/products/BarcodeScannerDialog';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import EditProductDialog from '@/components/manage-products/EditProductDialog';
import { useAuth } from '@/contexts/AuthContext';

const ManageProductsPage = () => {
  const { products, deleteProducts, loading, refetchProducts } = useInventory();
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [viewMode, setViewMode] = useLocalStorage('manageProductsViewMode', isMobile ? 'grid' : 'list');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  useEffect(() => {
    if (isMobile) {
      setViewMode('grid');
    }
  }, [isMobile, setViewMode]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [products, searchTerm]);
  
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
      setSelectedProductIds(filteredProducts.map(p => p.id));
    } else {
      setSelectedProductIds([]);
    }
  }, [filteredProducts]);

  const handleDeleteSelected = async () => {
    const { success } = await deleteProducts(selectedProductIds);
    if (success) {
      toast({
        title: "تم الحذف",
        description: `تم حذف ${selectedProductIds.length} منتج(ات) بنجاح.`,
        variant: 'success'
      });
      setSelectedProductIds([]);
    } else {
       toast({
        title: "خطأ",
        description: "فشل حذف المنتجات المحددة.",
        variant: 'destructive'
      });
    }
    setIsDeleteAlertOpen(false);
  };
  
  const handleDeleteSingle = useCallback((product) => {
    setSelectedProductIds([product.id]);
    setIsDeleteAlertOpen(true);
  }, []);

  const onProductUpdate = useCallback(() => {
    refetchProducts();
  }, [refetchProducts]);

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
    } else {
      toast({
        title: "غير مصرح",
        description: "ليس لديك الصلاحية لإدارة المتغيرات.",
        variant: "destructive"
      });
    }
  }, [hasPermission, navigate]);

  const handleEdit = useCallback((product) => {
    setEditingProduct(product);
  }, []);

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
        
        <EditProductDialog
            product={editingProduct}
            open={!!editingProduct}
            onOpenChange={() => setEditingProduct(null)}
            onSuccess={onProductUpdate}
        />

      <div className="space-y-6">
        <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => navigate('/')}>
                <ArrowRight className="h-4 w-4 ml-2" />
                رجوع
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">إدارة المنتجات</h1>
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
          isMobile={isMobile}
        />

        {filteredProducts.length > 0 && viewMode === 'list' && (
          <div className="flex items-center gap-4 p-3 bg-card border rounded-lg">
            <Checkbox 
              id="select-all"
              checked={selectedProductIds.length === filteredProducts.length && filteredProducts.length > 0}
              onCheckedChange={handleSelectAll}
              indeterminate={selectedProductIds.length > 0 && selectedProductIds.length < filteredProducts.length}
            />
            <label htmlFor="select-all" className="text-sm font-medium">تحديد الكل</label>
          </div>
        )}

        <AnimatePresence>
          {viewMode === 'list' ? (
            <motion.div layout className="space-y-3">
              {filteredProducts.map((product) => (
                <motion.div layout key={product.id}>
                  <ManageProductListItem 
                    product={product} 
                    isSelected={selectedProductIds.includes(product.id)} 
                    onSelect={handleSelectProduct}
                    onProductUpdate={onProductUpdate}
                    onEdit={handleEdit}
                  />
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.div layout className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredProducts.map((product) => (
                <motion.div layout key={product.id}>
                   <ManageProductCard
                    product={product}
                    onEdit={handleEdit}
                    onDelete={handleDeleteSingle}
                    onPrint={handlePrintSingle}
                  />
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
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
