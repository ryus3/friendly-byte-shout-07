
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
import EditProductDialog from '@/components/manage-products/EditProductDialog';
import { useAuth } from '@/contexts/AuthContext';

const ManageProductsPage = () => {
  const { products, deleteProducts, loading, refetchProducts } = useInventory();
  const { hasPermission, user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [viewMode, setViewMode] = useLocalStorage('manageProductsViewMode', 'list');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  const filteredProducts = useMemo(() => {
    let tempProducts = products.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    // تطبيق صلاحيات المنتجات للموظفين
    if (user && user.role !== 'admin' && user.role !== 'deputy' && !user?.permissions?.includes('*')) {
      tempProducts = tempProducts.filter(product => {
        // التحقق من صلاحيات التصنيفات الرئيسية
        if (product.categories?.main_category) {
          try {
            const categoryPermissions = JSON.parse(user?.category_permissions || '["all"]');
            if (!categoryPermissions.includes('all') && !categoryPermissions.includes(product.categories.main_category)) {
              return false;
            }
          } catch (e) {
            console.error('Error parsing category permissions:', e);
          }
        }

        // التحقق من صلاحيات التصنيفات عبر product_categories
        if (product.product_categories && product.product_categories.length > 0) {
          try {
            const categoryPermissions = JSON.parse(user?.category_permissions || '["all"]');
            if (!categoryPermissions.includes('all')) {
              const hasAllowedCategory = product.product_categories.some(pc => 
                categoryPermissions.includes(pc.category_id)
              );
              if (!hasAllowedCategory) return false;
            }
          } catch (e) {
            console.error('Error parsing category permissions:', e);
          }
        }

        // التحقق من صلاحيات الأقسام
        if (product.product_departments && product.product_departments.length > 0) {
          try {
            const departmentPermissions = JSON.parse(user?.department_permissions || '["all"]');
            if (!departmentPermissions.includes('all')) {
              const hasAllowedDepartment = product.product_departments.some(pd => 
                departmentPermissions.includes(pd.department_id)
              );
              if (!hasAllowedDepartment) return false;
            }
          } catch (e) {
            console.error('Error parsing department permissions:', e);
          }
        }

        // التحقق من صلاحيات الألوان والأحجام
        if (product.variants && product.variants.length > 0) {
          try {
            const colorPermissions = JSON.parse(user?.color_permissions || '["all"]');
            const sizePermissions = JSON.parse(user?.size_permissions || '["all"]');
            
            if (!colorPermissions.includes('all') || !sizePermissions.includes('all')) {
              const hasAllowedVariant = product.variants.some(variant => {
                const colorOk = colorPermissions.includes('all') || !variant.color_id || colorPermissions.includes(variant.color_id);
                const sizeOk = sizePermissions.includes('all') || !variant.size_id || sizePermissions.includes(variant.size_id);
                return colorOk && sizeOk;
              });
              if (!hasAllowedVariant) return false;
            }
          } catch (e) {
            console.error('Error parsing color/size permissions:', e);
          }
        }

        return true;
      });
    }
    
    return tempProducts;
  }, [products, searchTerm, user]);
  
  console.log('ManageProductsPage Debug:', {
    isMobile,
    viewMode,
    filteredProductsLength: filteredProducts.length,
    productsLength: products.length
  });

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
        
        <EditProductDialog
            product={editingProduct}
            open={!!editingProduct}
            onOpenChange={() => setEditingProduct(null)}
            onSuccess={onProductUpdate}
        />

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <Button variant="outline" onClick={() => navigate('/') } className="w-full sm:w-auto">
                <ArrowRight className="h-4 w-4 ml-2" />
                رجوع
            </Button>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-center sm:text-right">إدارة المنتجات</h1>
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
              {filteredProducts && filteredProducts.length > 0 && filteredProducts.map((product) => (
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
            <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredProducts && filteredProducts.length > 0 && filteredProducts.map((product) => (
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
