import React, { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { useInventory } from '@/contexts/InventoryContext';
import { useFullPurchases } from '@/hooks/useFullPurchases';
import { Button } from '@/components/ui/button';
import { PlusCircle, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from '@/components/ui/use-toast';
import PurchasesStats from '@/components/purchases/PurchasesStats';
import PurchasesToolbar from '@/components/purchases/PurchasesToolbar';
import PurchasesList from '@/components/purchases/PurchasesList';

import AddPurchaseDialog from '@/components/purchases/AddPurchaseDialog';
import PurchaseDetailsDialog from '@/components/purchases/PurchaseDetailsDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

const PurchasesPage = () => {
  const { purchases: inventoryPurchases, loading: inventoryLoading } = useInventory();
  const { purchases: hookPurchases, loading: hookLoading, fetchPurchases, deletePurchase } = useFullPurchases();
  const { hasPermission } = usePermissions();

  // استخدام البيانات من الهوك إذا كانت متوفرة، وإلا استخدام بيانات الإنفنتوري
  const purchases = hookPurchases.length > 0 ? hookPurchases : inventoryPurchases;
  const loading = hookLoading || inventoryLoading;
  const navigate = useNavigate();
  
  const [filters, setFilters] = useState({ searchTerm: '', dateFilter: 'all' });
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [purchaseToDelete, setPurchaseToDelete] = useState(null);

  // جلب المشتريات عند تحميل الصفحة
  React.useEffect(() => {
    if (hookPurchases.length === 0) {
      fetchPurchases();
    }
  }, [fetchPurchases, hookPurchases.length]);

  const filteredPurchases = useMemo(() => {
    if (!purchases) return [];
    let filtered = [...purchases].sort((a, b) => new Date(b.purchaseDate || b.createdAt) - new Date(a.purchaseDate || a.createdAt));

    if (filters.searchTerm) {
        const term = filters.searchTerm.toLowerCase();
        filtered = filtered.filter(p => 
            (p.supplier?.toLowerCase() || '').includes(term) ||
            (p.id?.toString().toLowerCase() || '').includes(term)
        );
    }

    if (filters.dateFilter !== 'all') {
        const now = new Date();
        let startDate;
        if (filters.dateFilter === 'this_month') {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        } else if (filters.dateFilter === 'this_year') {
            startDate = new Date(now.getFullYear(), 0, 1);
        }
        if(startDate) {
            filtered = filtered.filter(p => {
                const purchaseDate = p.purchaseDate ? new Date(p.purchaseDate) : new Date(p.createdAt);
                return purchaseDate >= startDate;
            });
        }
    }

    return filtered;
  }, [purchases, filters]);

  const handleViewDetails = (purchase) => {
    setSelectedPurchase(purchase);
    setIsDetailsOpen(true);
  };
  
  const handleAddPurchase = () => {
    if (hasPermission('add_purchase')) {
      setIsAddOpen(true);
    }
    // Remove the unauthorized toast message
  };

  const handleStatCardClick = (filter) => {
    setFilters(prev => ({ ...prev, dateFilter: filter }));
  };

  const handleDeletePurchase = (purchase) => {
    setPurchaseToDelete(purchase);
    setIsDeleteAlertOpen(true);
  };

  const confirmDeletePurchase = async () => {
    if (purchaseToDelete) {
      const result = await deletePurchase(purchaseToDelete.id);
      if (result.success) {
        toast({
          title: "تم الحذف",
          description: "تم حذف فاتورة الشراء بنجاح.",
          variant: 'success'
        });
      }
    }
    setIsDeleteAlertOpen(false);
    setPurchaseToDelete(null);
  };

  return (
    <>
      <Helmet>
        <title>المشتريات - نظام RYUS</title>
        <meta name="description" content="إدارة وتتبع جميع فواتير المشتريات والموردين." />
      </Helmet>

      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
                 <Button variant="outline" onClick={() => navigate('/')}>
                    <ArrowRight className="h-4 w-4 ml-2" />
                    رجوع
                </Button>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">المشتريات</h1>
                  <p className="text-muted-foreground">إدارة وتتبع جميع فواتير الشراء.</p>
                </div>
            </div>
             <Button onClick={handleAddPurchase}>
                <PlusCircle className="w-4 h-4 ml-2" />
                إضافة فاتورة شراء
            </Button>
        </div>
        
        {/* الإحصائيات */}
        <PurchasesStats purchases={purchases || []} onCardClick={handleStatCardClick} />
        
        <PurchasesToolbar filters={filters} onFiltersChange={setFilters} />
        <PurchasesList 
          purchases={filteredPurchases} 
          isLoading={loading}
          onViewDetails={handleViewDetails}
          onDelete={handleDeletePurchase}
        />
      </div>

      <AddPurchaseDialog open={isAddOpen} onOpenChange={setIsAddOpen} />
      <PurchaseDetailsDialog purchase={selectedPurchase} open={isDetailsOpen} onOpenChange={setIsDetailsOpen} />
      
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف فاتورة الشراء؟</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف فاتورة الشراء رقم {purchaseToDelete?.purchase_number || purchaseToDelete?.id}؟ 
              سيتم حذف جميع عناصر الفاتورة ولا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeletePurchase} className="bg-destructive hover:bg-destructive/90">
              نعم، قم بالحذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default PurchasesPage;