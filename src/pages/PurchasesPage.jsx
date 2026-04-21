import React, { useState, useMemo, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useInventory } from '@/contexts/InventoryContext';
import { useImprovedPurchases } from '@/hooks/useImprovedPurchases';
import { useSuper } from '@/contexts/SuperProvider';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { PlusCircle, ArrowRight, Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from '@/components/ui/use-toast';
import UnifiedPurchasesStats from '@/components/purchases/UnifiedPurchasesStats';
import UnifiedPurchasesToolbar from '@/components/purchases/UnifiedPurchasesToolbar';
import PurchasesList from '@/components/purchases/PurchasesList';
import PurchasesGrid from '@/components/purchases/PurchasesGrid';
import SmartPagination from '@/components/ui/SmartPagination';

import AddPurchaseDialog from '@/components/purchases/AddPurchaseDialog';
import PurchaseDetailsDialog from '@/components/purchases/PurchaseDetailsDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

const PurchasesPage = () => {
  const { purchases: inventoryPurchases, loading: inventoryLoading } = useInventory();
  const { purchases: hookPurchases, loading: hookLoading, fetchPurchases, deletePurchase } = useImprovedPurchases();
  const { hasPermission } = usePermissions();
  const { allUsers = [] } = useAuth();
  const { cashSources = [] } = useSuper();

  const purchases = hookPurchases.length > 0 ? hookPurchases : inventoryPurchases;
  const loading = hookLoading || inventoryLoading;
  const navigate = useNavigate();
  
  const [filters, setFilters] = useState({ searchTerm: '', dateFilter: 'all', creatorFilter: 'all' });
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('purchases-view-mode') || 'grid';
  });
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [purchaseToDelete, setPurchaseToDelete] = useState(null);
  
  const ITEMS_PER_PAGE = 15;
  const [currentPage, setCurrentPage] = useState(1);

  React.useEffect(() => {
    localStorage.setItem('purchases-view-mode', viewMode);
  }, [viewMode]);

  React.useEffect(() => {
    if (hookPurchases.length === 0) {
      fetchPurchases();
    }
  }, [fetchPurchases, hookPurchases.length]);

  // فهرسة المستخدمين والقاصات للوصول السريع
  const usersById = useMemo(() => {
    const map = new Map();
    for (const u of allUsers) {
      const id = u.user_id || u.id;
      if (id) map.set(id, u);
    }
    return map;
  }, [allUsers]);

  const cashSourcesById = useMemo(() => {
    const map = new Map();
    for (const c of cashSources) {
      if (c?.id) map.set(c.id, c);
    }
    return map;
  }, [cashSources]);

  const getCreatorInfo = (createdBy) => {
    if (!createdBy) return { name: 'غير محدد', role: 'unknown' };
    const u = usersById.get(createdBy);
    if (!u) return { name: 'مستخدم محذوف', role: 'unknown' };
    const roles = Array.isArray(u.roles) ? u.roles : [];
    let role = 'employee';
    if (roles.includes('super_admin') || roles.includes('admin')) role = 'admin';
    else if (roles.includes('department_manager')) role = 'department_manager';
    return { name: u.full_name || u.username || 'موظف', role };
  };

  const getCashSourceInfo = (cashSourceId) => {
    if (!cashSourceId) return null;
    const cs = cashSourcesById.get(cashSourceId);
    return cs ? { name: cs.name } : null;
  };

  // قائمة المستخدمين الذين لديهم مشتريات (للفلتر)
  const purchaseCreators = useMemo(() => {
    const ids = new Set((purchases || []).map(p => p.created_by).filter(Boolean));
    return Array.from(ids).map(id => {
      const info = getCreatorInfo(id);
      return { id, name: info.name, role: info.role };
    }).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  }, [purchases, usersById]);

  const filteredPurchases = useMemo(() => {
    if (!purchases) return [];
    let filtered = [...purchases].sort((a, b) => 
      new Date(b.purchase_date || b.created_at) - new Date(a.purchase_date || a.created_at)
    );

    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(p => 
        (p.supplier_name?.toLowerCase() || '').includes(term) ||
        (p.purchase_number?.toString().toLowerCase() || '').includes(term) ||
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
      
      if (startDate) {
        filtered = filtered.filter(p => {
          const purchaseDate = p.purchase_date ? new Date(p.purchase_date) : new Date(p.created_at);
          return purchaseDate >= startDate;
        });
      }
    }

    // فلتر المنشئ (موظف / مدير عام / مدير قسم)
    if (filters.creatorFilter && filters.creatorFilter !== 'all') {
      if (filters.creatorFilter === 'admin_only') {
        filtered = filtered.filter(p => getCreatorInfo(p.created_by).role === 'admin');
      } else if (filters.creatorFilter === 'employees_only') {
        filtered = filtered.filter(p => {
          const r = getCreatorInfo(p.created_by).role;
          return r === 'department_manager' || r === 'employee';
        });
      } else if (filters.creatorFilter.startsWith('user:')) {
        const id = filters.creatorFilter.slice(5);
        filtered = filtered.filter(p => p.created_by === id);
      }
    }

    return filtered;
  }, [purchases, filters, usersById]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const totalPages = Math.ceil(filteredPurchases.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedPurchases = filteredPurchases.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handleViewDetails = (purchase) => {
    setSelectedPurchase(purchase);
    setIsDetailsOpen(true);
  };
  
  const handleAddPurchase = () => {
    if (hasPermission('add_purchase')) {
      setIsAddOpen(true);
    }
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

  const handlePurchaseAdded = () => {
    setIsAddOpen(false);
    fetchPurchases();
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
        
        <UnifiedPurchasesStats 
          onCardClick={handleStatCardClick}
          onFilterChange={(f) => {
            if (f.dateRange) {
              const { from, to } = f.dateRange;
              const now = new Date();
              if (from && to) {
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                const startOfYear = new Date(now.getFullYear(), 0, 1);
                if (from.getTime() === startOfMonth.getTime()) {
                  setFilters(prev => ({ ...prev, dateFilter: 'this_month' }));
                } else if (from.getTime() === startOfYear.getTime()) {
                  setFilters(prev => ({ ...prev, dateFilter: 'this_year' }));
                } else {
                  setFilters(prev => ({ ...prev, dateFilter: 'custom' }));
                }
              }
            }
          }}
        />
        
        <UnifiedPurchasesToolbar 
          filters={filters} 
          onFiltersChange={setFilters}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        {/* فلتر المنشئ */}
        {purchaseCreators.length > 1 && (
          <div className="flex items-center gap-3 p-3 bg-card border rounded-lg">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Label className="text-sm whitespace-nowrap">عرض المشتريات لـ:</Label>
            <Select
              value={filters.creatorFilter || 'all'}
              onValueChange={(v) => setFilters(prev => ({ ...prev, creatorFilter: v }))}
            >
              <SelectTrigger className="w-full sm:w-[260px]">
                <SelectValue placeholder="الكل" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل المشتريات</SelectItem>
                <SelectItem value="admin_only">مشتريات النظام (المدير العام)</SelectItem>
                <SelectItem value="employees_only">مشتريات الموظفين فقط</SelectItem>
                {purchaseCreators.map(c => (
                  <SelectItem key={c.id} value={`user:${c.id}`}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        
        {viewMode === 'table' ? (
          <PurchasesList 
            purchases={paginatedPurchases} 
            isLoading={loading}
            onViewDetails={handleViewDetails}
            onDelete={handleDeletePurchase}
            getCreatorInfo={getCreatorInfo}
            getCashSourceInfo={getCashSourceInfo}
          />
        ) : (
          <PurchasesGrid 
            purchases={paginatedPurchases} 
            isLoading={loading}
            onViewDetails={handleViewDetails}
            onDelete={handleDeletePurchase}
            getCreatorInfo={getCreatorInfo}
            getCashSourceInfo={getCashSourceInfo}
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

      <AddPurchaseDialog 
        open={isAddOpen} 
        onOpenChange={setIsAddOpen}
        onPurchaseAdded={handlePurchaseAdded}
      />
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
