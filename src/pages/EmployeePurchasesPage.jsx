import React, { useState, useMemo, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useInventory } from '@/contexts/InventoryContext';
import { useImprovedPurchases } from '@/hooks/useImprovedPurchases';
import { Button } from '@/components/ui/button';
import { PlusCircle, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { toast } from '@/components/ui/use-toast';
import PurchasesList from '@/components/purchases/PurchasesList';
import PurchasesGrid from '@/components/purchases/PurchasesGrid';
import PurchasesToolbar from '@/components/purchases/PurchasesToolbar';
import SmartPagination from '@/components/ui/SmartPagination';
import AddPurchaseDialog from '@/components/purchases/AddPurchaseDialog';
import PurchaseDetailsDialog from '@/components/purchases/PurchaseDetailsDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

const EmployeePurchasesPage = () => {
  const { purchases: inventoryPurchases, loading: inventoryLoading } = useInventory();
  const { purchases: hookPurchases, loading: hookLoading, fetchPurchases, deletePurchase } = useImprovedPurchases();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const userId = currentUser?.id || currentUser?.user_id;

  const allPurchases = hookPurchases.length > 0 ? hookPurchases : inventoryPurchases;
  const loading = hookLoading || inventoryLoading;

  // فلترة بمشتريات الموظف فقط
  const myPurchases = useMemo(() => {
    if (!allPurchases || !userId) return [];
    return allPurchases.filter(p => p.created_by === userId);
  }, [allPurchases, userId]);

  const [filters, setFilters] = useState({ searchTerm: '', dateFilter: 'all' });
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('emp-purchases-view-mode') || 'grid');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [purchaseToDelete, setPurchaseToDelete] = useState(null);
  const ITEMS_PER_PAGE = 15;
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    localStorage.setItem('emp-purchases-view-mode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (hookPurchases.length === 0) fetchPurchases();
  }, [fetchPurchases, hookPurchases.length]);

  const filteredPurchases = useMemo(() => {
    let filtered = [...myPurchases].sort((a, b) =>
      new Date(b.purchase_date || b.created_at) - new Date(a.purchase_date || a.created_at)
    );

    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        (p.supplier_name?.toLowerCase() || '').includes(term) ||
        (p.purchase_number?.toString().toLowerCase() || '').includes(term)
      );
    }

    if (filters.dateFilter !== 'all') {
      const now = new Date();
      let startDate;
      if (filters.dateFilter === 'this_month') startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      else if (filters.dateFilter === 'this_year') startDate = new Date(now.getFullYear(), 0, 1);
      if (startDate) {
        filtered = filtered.filter(p => {
          const purchaseDate = p.purchase_date ? new Date(p.purchase_date) : new Date(p.created_at);
          return purchaseDate >= startDate;
        });
      }
    }
    return filtered;
  }, [myPurchases, filters]);

  useEffect(() => { setCurrentPage(1); }, [filters]);

  const totalPages = Math.ceil(filteredPurchases.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedPurchases = filteredPurchases.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handleDeletePurchase = (purchase) => {
    setPurchaseToDelete(purchase);
    setIsDeleteAlertOpen(true);
  };

  const confirmDeletePurchase = async () => {
    if (purchaseToDelete) {
      const result = await deletePurchase(purchaseToDelete.id);
      if (result.success) {
        toast({ title: "تم الحذف", description: "تم حذف فاتورة الشراء بنجاح.", variant: 'success' });
      }
    }
    setIsDeleteAlertOpen(false);
    setPurchaseToDelete(null);
  };

  return (
    <>
      <Helmet>
        <title>مشترياتي - نظام RYUS</title>
      </Helmet>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => navigate('/employee-financial-center')}>
              <ArrowRight className="h-4 w-4 ml-2" />
              رجوع
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">مشترياتي</h1>
              <p className="text-muted-foreground">إدارة فواتير الشراء الخاصة بك</p>
            </div>
          </div>
          <Button onClick={() => setIsAddOpen(true)}>
            <PlusCircle className="w-4 h-4 ml-2" />
            إضافة فاتورة شراء
          </Button>
        </div>

        <PurchasesToolbar
          filters={filters}
          onFiltersChange={setFilters}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        {viewMode === 'table' ? (
          <PurchasesList
            purchases={paginatedPurchases}
            isLoading={loading}
            onViewDetails={(p) => { setSelectedPurchase(p); setIsDetailsOpen(true); }}
            onDelete={handleDeletePurchase}
          />
        ) : (
          <PurchasesGrid
            purchases={paginatedPurchases}
            isLoading={loading}
            onViewDetails={(p) => { setSelectedPurchase(p); setIsDetailsOpen(true); }}
            onDelete={handleDeletePurchase}
          />
        )}

        <SmartPagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={filteredPurchases.length}
          itemsPerPage={ITEMS_PER_PAGE}
        />
      </div>

      <AddPurchaseDialog open={isAddOpen} onOpenChange={setIsAddOpen} onPurchaseAdded={() => { setIsAddOpen(false); fetchPurchases(); }} filterByOwnerUserId={userId} />
      <PurchaseDetailsDialog purchase={selectedPurchase} open={isDetailsOpen} onOpenChange={setIsDetailsOpen} />

      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف فاتورة الشراء؟</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف فاتورة الشراء رقم {purchaseToDelete?.purchase_number || purchaseToDelete?.id}؟
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

export default EmployeePurchasesPage;
