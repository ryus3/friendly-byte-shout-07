import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { useUnifiedPermissionsSystem as usePermissions } from '@/hooks/useUnifiedPermissionsSystem.jsx';
import { useInventory } from '@/contexts/InventoryContext';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { useUnifiedAutoSync } from '@/hooks/useUnifiedAutoSync';
import { UnifiedSyncSettings } from '@/components/delivery/UnifiedSyncSettings';
import { isPendingStatus } from '@/utils/profitStatusHelper';
import SmartPagination from '@/components/ui/SmartPagination';
import { useProfits } from '@/contexts/ProfitsContext';

import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import OrderList from '@/components/orders/OrderList';
import Loader from '@/components/ui/loader';
import { ShoppingCart, DollarSign, Users, Hourglass, CheckCircle, RefreshCw, Loader2, Archive, Bell, Calendar, FileText, Truck, RotateCcw, Wallet, Sparkles, ChevronLeft } from 'lucide-react';

import OrderDetailsDialog from '@/components/orders/OrderDetailsDialog';
import StatCard from '@/components/dashboard/StatCard';
import UnifiedSettledDuesDialog from '@/components/shared/UnifiedSettledDuesDialog';
import ManagerProfitsCard from '@/components/shared/ManagerProfitsCard';
import EmployeeSettlementCard from '@/components/orders/EmployeeSettlementCard';
import ManagerProfitsDialog from '@/components/profits/ManagerProfitsDialog';
import EmployeeDeliveryInvoicesTab from '@/components/orders/EmployeeDeliveryInvoicesTab';
import ProfessionalSyncToolbar from '@/components/shared/ProfessionalSyncToolbar';
import SettlementRequestsDialog from '@/components/dialogs/SettlementRequestsDialog';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';

const EmployeeFollowUpPage = () => {
  const navigate = useNavigate();
  const { allUsers, user } = useAuth();
  const { hasPermission, isAdmin, isDepartmentManager } = usePermissions();
  
  const { syncVisibleOrdersBatch } = useAlWaseet();
  const { autoSyncVisibleOrders } = useUnifiedAutoSync();
  
  const [syncing, setSyncing] = useState(false);
  const [syncingEmployee, setSyncingEmployee] = useState(null);
  const [supervisedEmployeeIds, setSupervisedEmployeeIds] = useState([]);
  
  const { 
    orders, 
    loading, 
    calculateManagerProfit, 
    calculateProfit, 
    updateOrder, 
    refreshOrders,
    refetchProducts, 
    settlementInvoices, 
    deleteOrders,
    expenses,
    profits,
    settleEmployeeProfits
  } = useInventory();
  
  // جلب طلبات التحاسب من ProfitsContext
  const { settlementRequests, fetchProfitsData } = useProfits();
  
  // حالة معالجة التسوية
  const [isSettlementProcessing, setIsSettlementProcessing] = useState(false);
  
  // جلب الموظفين الذين يشرف عليهم مدير القسم
  useEffect(() => {
    const fetchSupervisedEmployees = async () => {
      if (!isDepartmentManager || !user?.id) return;
      
      try {
        const { data, error } = await supabase
          .from('employee_supervisors')
          .select('employee_id')
          .eq('supervisor_id', user.id)
          .eq('is_active', true);
        
        if (error) {
          console.error('خطأ في جلب الموظفين المشرف عليهم:', error);
          return;
        }
        
        if (data && data.length > 0) {
          setSupervisedEmployeeIds(data.map(d => d.employee_id));
        }
      } catch (err) {
        console.error('خطأ:', err);
      }
    };
    
    fetchSupervisedEmployees();
  }, [isDepartmentManager, user?.user_id]);
  
  const [searchParams] = useSearchParams();
  
  // استخراج المعاملات من URL مباشرة
  const employeeFromUrl = searchParams.get('employee');
  const ordersFromUrl = searchParams.get('orders');
  const highlightFromUrl = searchParams.get('highlight');
  const orderNumberFromUrl = searchParams.get('order');
  
  // الفلاتر - تطبيق URL فوراً إذا كان من التحاسب وإضافة فلتر الفترة
  const [filters, setFilters] = useState({
    status: 'all',
    archived: false,
    employeeId: (employeeFromUrl && highlightFromUrl === 'settlement') ? employeeFromUrl : 'all',
    profitStatus: (employeeFromUrl && highlightFromUrl === 'settlement') ? 'pending' : 'all',
    timePeriod: 'all'
  });
  
  const [selectedOrders, setSelectedOrders] = useState(() => {
    const initialSelectedOrders = ordersFromUrl && highlightFromUrl === 'settlement' ? ordersFromUrl.split(',') : [];
    console.log('🎯 تهيئة selectedOrders:', {
      ordersFromUrl,
      highlightFromUrl,
      initialSelectedOrders,
      ordersCount: initialSelectedOrders.length
    });
    return initialSelectedOrders;
  });

  // ربط الدوال بالواجهة القديمة
  const syncEmployeeOrders = async (employeeId, employeeName) => {
    setSyncingEmployee(employeeId);
    try {
      const employeeOrders = filteredOrders.filter(o => o.created_by === employeeId);
      await syncVisibleOrdersBatch(employeeOrders);
      await refreshOrders();
      toast({
        title: "✅ تمت المزامنة",
        description: `تم مزامنة طلبات ${employeeName}`,
      });
    } finally {
      setSyncingEmployee(null);
    }
  };
  
  // ✅ Aliases للدوال المطلوبة في ProfessionalSyncToolbar
  const syncSpecificEmployee = syncEmployeeOrders;
  const syncSpecificEmployeeSmart = syncEmployeeOrders;

  const syncAllEmployeesOrders = async () => {
    // ✅ تعديل: السماح لمدير القسم أيضاً (يزامن فقط طلبات موظفيه)
    if (!isAdmin && !isDepartmentManager) return;
    
    const currentFilteredOrders = filteredOrders || [];
    
    const description = isDepartmentManager && !isAdmin 
      ? "جاري مزامنة طلبات الموظفين تحت إشرافك..."
      : "جاري مزامنة الفواتير والطلبات لجميع الموظفين...";
    
    toast({
      title: "بدء المزامنة الشاملة",
      description,
    });
    
    setSyncing(true);
    try {
      // ✅ المدير العام فقط: مزامنة الفواتير عبر Edge Function
      if (isAdmin) {
        const { data: invoiceSyncResult, error: invoiceError } = await supabase.functions.invoke('smart-invoice-sync', {
          body: { 
            mode: 'comprehensive',
            sync_invoices: true,
            sync_orders: true,
            force_refresh: true
          }
        });
        
        if (invoiceError) {
          console.error('❌ خطأ في مزامنة الفواتير:', invoiceError);
        } else {
          console.log('✅ نتيجة مزامنة الفواتير:', invoiceSyncResult);
        }
      }
      
      // ✅ 2. مزامنة حالات الطلبات من API (للجميع)
      await syncVisibleOrdersBatch(currentFilteredOrders);
      await refreshOrders();
      
      // ✅ 3. إرسال حدث لتحديث الفواتير في الواجهات الأخرى
      window.dispatchEvent(new CustomEvent('invoicesSynced'));
      
      const successMsg = isDepartmentManager && !isAdmin
        ? `تم تحديث ${currentFilteredOrders.length} طلب لموظفيك`
        : `تم تحديث الفواتير والطلبات`;
      
      toast({
        title: "✅ اكتملت المزامنة الشاملة",
        description: successMsg,
      });
    } catch (error) {
      toast({
        title: "خطأ في المزامنة",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSyncing(false);
    }
  };

  // دالة مزامنة الطلبات المرئية الجديدة - سريعة وذكية
  const syncVisibleOrders = async () => {
    const currentFilteredOrders = filteredOrders || [];
    
    if (currentFilteredOrders.length === 0) {
      toast({
        title: "لا توجد طلبات",
        description: "لا توجد طلبات مرئية للمزامنة",
        variant: "default"
      });
      return;
    }

    toast({
      title: "بدء المزامنة الذكية",
      description: `مزامنة ${currentFilteredOrders.length} طلب مرئي...`,
      variant: "default"
    });

    try {
      const result = await syncVisibleOrdersBatch(currentFilteredOrders, (progress) => {
        console.log(`📊 تقدم المزامنة: ${progress.processed}/${progress.total} موظفين، ${progress.updated} طلب محدث`);
      });

      if (result.success) {
        await refreshOrders();
        toast({
          title: "تمت المزامنة بنجاح",
          description: `تم تحديث ${result.updatedCount} طلب من ${currentFilteredOrders.length} طلب مرئي`,
          variant: "default"
        });
      } else {
        toast({
          title: "خطأ في المزامنة",
          description: result.error || "حدث خطأ غير متوقع",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('خطأ في مزامنة الطلبات المرئية:', error);
      toast({
        title: "خطأ في المزامنة",
        description: error.message,
        variant: "destructive"
      });
    }
  };
  
  // ✅ تعريف smartSync كـ alias لـ syncVisibleOrders
  const smartSync = syncVisibleOrders;
  
  const [selectedOrderDetails, setSelectedOrderDetails] = useState(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isDuesDialogOpen, setIsDuesDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('orders');
  const [isUnifiedSyncSettingsOpen, setIsUnifiedSyncSettingsOpen] = useState(false);
  const [isSettlementRequestsDialogOpen, setIsSettlementRequestsDialogOpen] = useState(false);
  
  // دالة معالجة التسوية من Dialog
  const handleProcessSettlement = async (selectedOrderIds) => {
    if (!selectedOrderIds || selectedOrderIds.length === 0) {
      toast({ title: 'لم يتم تحديد طلبات', variant: 'destructive' });
      return;
    }
    
    setIsSettlementProcessing(true);
    
    try {
      // جلب معلومات الموظف من الإشعار
      const notification = settlementRequests?.find(n => 
        n.data?.order_ids?.some(id => selectedOrderIds.includes(id))
      );
      
      const employeeId = notification?.data?.employee_id;
      const employeeName = notification?.data?.employee_name || 'غير محدد';
      const totalAmount = notification?.data?.total_profit || 0;
      
      if (!employeeId) {
        toast({ title: 'لم يتم تحديد الموظف', variant: 'destructive' });
        return;
      }
      
      // استدعاء settleEmployeeProfits
      const result = await settleEmployeeProfits(employeeId, totalAmount, employeeName, selectedOrderIds);
      
      if (result.success) {
        // إرسال إشعار للموظف
        await supabase
          .from('notifications')
          .insert({
            user_id: employeeId,
            type: 'settlement_completed',
            title: 'تمت تسوية مستحقاتك 💰',
            message: `تم دفع مبلغ ${result.actualAmount?.toLocaleString() || 0} دينار - فاتورة رقم ${result.invoiceNumber}`,
            data: {
              invoice_number: result.invoiceNumber,
              amount: result.actualAmount,
              original_amount: result.originalAmount,
              deductions_applied: result.deductionsApplied,
              order_count: selectedOrderIds.length,
              settled_at: new Date().toISOString()
            },
            is_read: false
          });
        
        // حذف إشعار طلب التحاسب الأصلي
        if (notification?.id) {
          await supabase
            .from('notifications')
            .delete()
            .eq('id', notification.id);
        }
        
        // تحديث البيانات
        await fetchProfitsData?.();
        await refreshOrders?.();
        
        // إعادة تعيين التحديد وإغلاق النافذة
        setSelectedOrders([]);
        setIsSettlementRequestsDialogOpen(false);
        
        toast({
          title: 'تمت التسوية بنجاح ✅',
          description: `تم دفع ${result.actualAmount?.toLocaleString()} دينار للموظف ${employeeName}`,
          variant: 'success'
        });
      }
    } catch (error) {
      console.error('خطأ في معالجة التسوية:', error);
      toast({ title: 'خطأ في التسوية', description: error.message, variant: 'destructive' });
    } finally {
      setIsSettlementProcessing(false);
    }
  };
  
  const ITEMS_PER_PAGE = 15;
  const [currentPage, setCurrentPage] = useState(1);
  // إزالة الحالة القديمة - استخدام النظام الجديد
  const [lastComprehensiveSync, setLastComprehensiveSync] = useState(() => 
    localStorage.getItem('last-comprehensive-sync')
  );
  
  // ✅ مزامنة الطلبات الظاهرة النشطة فقط - مرة واحدة عند الدخول
  useEffect(() => {
    const performInitialSync = async () => {
      // انتظار تحميل الطلبات أولاً
      if (loading || !filteredOrders || filteredOrders.length === 0) {
        console.log('⏳ [EmployeeFollowUp] انتظار تحميل الطلبات المفلترة...');
        return;
      }
      
      // ✅ فلترة الطلبات النشطة فقط (ليست نهائية)
      const activeOrders = filteredOrders.filter(order => {
        return order.status !== 'completed' && 
               order.status !== 'returned_in_stock' && 
               order.delivery_status !== '17';
      });
      
      if (activeOrders.length === 0) {
        console.log('⏭️ [EmployeeFollowUp] لا توجد طلبات نشطة ظاهرة للمزامنة');
        return;
      }
      
      console.log(`🔄 [EmployeeFollowUp] مزامنة أولية: ${activeOrders.length} طلب ظاهر نشط`);
      try {
        await comprehensiveSync(activeOrders, syncVisibleOrdersBatch);
        console.log('✅ [EmployeeFollowUp] تمت المزامنة الأولية للطلبات الظاهرة النشطة');
      } catch (error) {
        console.error('❌ [EmployeeFollowUp] خطأ في المزامنة:', error);
      }
    };

    performInitialSync();
  }, []); // ✅ dependencies فارغة = مرة واحدة فقط عند الدخول للصفحة
  
  
  console.log('🔍 بيانات الصفحة DEEP DEBUG:', {
    ordersCount: orders?.length || 0,
    ordersData: orders,
    usersCount: allUsers?.length || 0,
    profitsCount: profits?.length || 0,
    loading,
    filters,
    employeeFromUrl,
    ordersFromUrl,
    highlightFromUrl,
    isOrdersArray: Array.isArray(orders),
    isOrdersLoaded: !!orders
  });
  
  // إعداد محسن لـ URL parameters - منع التحميل المتكرر
  useEffect(() => {
    // تشغيل المعالجة فقط مرة واحدة عند توفر البيانات
    if (loading || !orders || !allUsers || orders.length === 0) return;
    
    console.log('🔄 URL Parameters:', { 
      highlightFromUrl, 
      employeeFromUrl, 
      ordersFromUrl,
      ordersLoaded: !!orders?.length,
      usersLoaded: !!allUsers?.length
    });
    
    if (highlightFromUrl === 'settlement' && employeeFromUrl && ordersFromUrl) {
      // طلب تحاسب محدد من الإشعار
      console.log('⚡ معالجة طلب التحاسب من الإشعار');
      processSettlementRequest();
    } else if (highlightFromUrl === 'settlement') {
      // إشعار عام للتحاسب
      console.log('🔔 إشعار تحاسب عام');
      setTimeout(() => {
        toast({
          title: "طلبات تحاسب متاحة",
          description: "راجع طلبات التحاسب في صفحة متابعة الموظفين واختر الطلبات المطلوبة لكل موظف",
          variant: "default",
          duration: 6000
        });
      }, 1000);
    }
    
    function processSettlementRequest() {
      // تعيين فلاتر محددة للتحاسب
      setFilters(prev => ({ 
        ...prev, 
        employeeId: employeeFromUrl,
        profitStatus: 'pending',
        status: 'all',
        archived: false
      }));
      
      // تحديد الطلبات المطلوب تسويتها
      const orderList = ordersFromUrl.split(',');
      setSelectedOrders(orderList);
      
      console.log('✅ تم تعيين:', {
        employeeId: employeeFromUrl,
        orders: orderList,
        ordersCount: orderList.length
      });
      
      // تم إزالة toast المضلل - الإشعار الوحيد يجب أن يكون من ProfitsContext
      
      // التمرير للكارت مع تأثير بصري - محسن
      setTimeout(() => {
        const element = document.querySelector(`[data-employee-id="${employeeFromUrl}"]`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.style.transform = "scale(1.05)";
          element.style.border = "3px solid #10b981";
          element.style.borderRadius = "16px";
          element.style.boxShadow = "0 0 30px rgba(16, 185, 129, 0.5)";
          element.style.background = "linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(5, 150, 105, 0.1))";
          
          setTimeout(() => {
            element.style.transform = "";
            element.style.border = "";
            element.style.borderRadius = "";
            element.style.boxShadow = "";
            element.style.background = "";
          }, 5000);
        }
      }, 2000);
    }
  }, [highlightFromUrl, employeeFromUrl, ordersFromUrl, loading, orders, allUsers]); // تحسين dependencies

  // تعطيل Real-time updates لتحسين الأداء والاعتماد على المزامنة المجدولة
  // المزامنة ستتم تلقائياً مرتين يومياً ولا حاجة للتحديث المستمر

  // معرف المدير الرئيسي - تصفية طلباته
  const ADMIN_ID = '91484496-b887-44f7-9e5d-be9db5567604';

  // قائمة الموظفين النشطين - تفلتر حسب المشرف لمدير القسم
  const employees = useMemo(() => {
    if (!allUsers || !Array.isArray(allUsers)) return [];
    
    // ✅ المدير العام: يرى جميع الموظفين النشطين
    if (isAdmin) {
      return allUsers.filter(u => u && u.status === 'active' && u.user_id !== ADMIN_ID);
    }
    
    // ✅ مدير القسم: يرى فقط الموظفين المشرف عليهم (وليس نفسه)
    if (isDepartmentManager) {
      if (supervisedEmployeeIds.length > 0) {
        return allUsers.filter(u => 
          u && 
          u.status === 'active' && 
          u.user_id !== user?.user_id && // استبعاد نفسه
          supervisedEmployeeIds.includes(u.user_id)
        );
      }
      // مدير قسم بدون موظفين تحت إشرافه
      return [];
    }
    
    return [];
  }, [allUsers, isAdmin, isDepartmentManager, supervisedEmployeeIds, user?.user_id]);

  // خريطة الموظفين للأسماء
  const usersMap = useMemo(() => {
    const map = new Map();
    if (allUsers && Array.isArray(allUsers)) {
      allUsers.forEach(u => {
        if (u && u.user_id) {
          map.set(u.user_id, u.full_name || u.name || 'غير معروف');
        }
      });
    }
    return map;
  }, [allUsers]);

  // حالة أرشيف التسوية المنفصلة
  const [showSettlementArchive, setShowSettlementArchive] = useState(false);

// الطلبات المفلترة مع تحديث منطق الأرشيف
const filteredOrders = useMemo(() => {
  const effectiveEmployeeId = employeeFromUrl || filters.employeeId;
  
  console.log('🔄 تفلتر الطلبات DETAILED:', { 
    ordersLength: orders?.length, 
    filters,
    showSettlementArchive,
    effectiveEmployeeId,
    ordersArray: Array.isArray(orders),
    ordersDataSample: orders?.slice(0, 3)?.map(o => ({ id: o.id, created_by: o.created_by, status: o.status }))
  });
  
  if (!orders || !Array.isArray(orders)) {
    console.log('❌ لا توجد طلبات في البيانات');
    return [];
  }

  // بناء خرائط مساعدة
  const employeeIdSelected = effectiveEmployeeId && effectiveEmployeeId !== 'all' ? effectiveEmployeeId : null;
  const employeeCodeMap = new Map((employees || []).map(e => [e.user_id, e.employee_code]));
  const selectedEmployeeCode = employeeIdSelected ? employeeCodeMap.get(employeeIdSelected) : null;

  // فلتر الفترة الزمنية
  const filterByTimePeriod = (order) => {
    if (filters.timePeriod === 'all') return true;
    const orderDate = new Date(order.created_at);
    const now = new Date();
    switch (filters.timePeriod) {
      case 'today':
        return orderDate.toDateString() === now.toDateString();
      case 'week':
        return orderDate >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'month':
        return orderDate >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case '3months':
        return orderDate >= new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      default:
        return true;
    }
  };

  const filtered = orders.filter(order => {
    if (!order) return false;

    const isAdminCreated = order.created_by === ADMIN_ID;

    // فلتر الفترة الزمنية
    if (!filterByTimePeriod(order)) return false;

    // ✅ طلبات الربح الصفري تظهر فقط في أرشيف التسوية
    const profitRecord = profits?.find(p => p.order_id === order.id);
    const isZeroProfitSettled = profitRecord?.status === 'no_rule_archived' || profitRecord?.status === 'no_rule_settled';
    if (isZeroProfitSettled && !showSettlementArchive) {
      return false;
    }

    // ربط الطلب بالموظف عبر created_by أو عبر سجل الأرباح
    let employeeMatch = true;
    if (employeeIdSelected) {
      const byCreator = (order.created_by === employeeIdSelected) || (order.created_by === selectedEmployeeCode);
      const byProfit = profits?.some(p => p.order_id === order.id && (p.employee_id === employeeIdSelected || p.employee_id === selectedEmployeeCode));
      employeeMatch = byCreator || byProfit;
    } else {
      // ✅ عند عدم تحديد موظف معين (جميع الموظفين)
      // استبعاد طلبات المدير نهائياً
      if (isAdminCreated) return false;
      
      // ✅ مدير القسم: يرى فقط طلبات الموظفين تحت إشرافه (وليس طلباته)
      if (isDepartmentManager && !isAdmin) {
        // استبعاد طلبات مدير القسم نفسه
        if (order.created_by === user?.user_id) return false;
        // فقط طلبات الموظفين تحت إشرافه
        if (!supervisedEmployeeIds.includes(order.created_by)) return false;
      }
    }

    // استبعاد طلبات المدير فقط إذا لم تكن مرتبطة بالموظف عبر الأرباح (للموظف المحدد)
    if (employeeIdSelected && isAdminCreated && !employeeMatch) return false;

    // فلتر الحالة - خاص للمرتجعة بناءً على delivery_status
    let statusMatch = true;
    if (filters.status === 'returned') {
      // ✅ فلتر الطلبات المرتجعة بناءً على delivery_status = '17' فقط
      statusMatch = order.delivery_status === '17';
    } else if (filters.status === 'all') {
      // ✅ إجمالي الطلبات يستبعد فقط الطلبات المرتجعة (delivery_status='17')
      statusMatch = order.delivery_status !== '17';
    } else {
      statusMatch = order.status === filters.status;
    }

    // فلتر حالة الربح - محدث لدعم كل الحالات
    let profitStatusMatch = true;
    if (filters.profitStatus !== 'all') {
      if (filters.profitStatus === 'settlement_requested') {
        profitStatusMatch = profitRecord?.status === 'settlement_requested';
      } else if (filters.profitStatus === 'settled') {
        profitStatusMatch = profitRecord?.status === 'settled';
      } else if (filters.profitStatus === 'invoice_received') {
        profitStatusMatch = profitRecord?.status === 'invoice_received';
      } else if (filters.profitStatus === 'pending') {
        // ✅ مستحقات معلقة: فقط الطلبات التي فيها ربح للموظف > 0
        profitStatusMatch = profitRecord?.status === 'pending' && 
                           profitRecord?.employee_profit > 0 &&
                           order.receipt_received === true;
      }
    }

    // فلتر الأرشيف والتسوية
    const isManuallyArchived = ((order.isarchived === true || order.isArchived === true || order.is_archived === true) && order.status !== 'completed');
    const isSettled = profitRecord?.status === 'settled';
    
    // ✅ طلبات "تم طلب التحاسب" تظهر دائماً للمدير حتى لو مؤرشفة
    const isAwaitingSettlement = profitRecord?.status === 'settlement_requested';

    let archiveMatch;
    if (showSettlementArchive) {
      archiveMatch = isSettled;
    } else if (filters.archived) {
      archiveMatch = isManuallyArchived;
    } else {
      // إظهار طلبات التحاسب المعلقة حتى لو مؤرشفة
      archiveMatch = (!isManuallyArchived && !isSettled) || isAwaitingSettlement;
    }

    // ✅ الطلبات المرتجعة تتجاوز شرط archiveMatch لأنها تعتبر أرشيف مستقل
    if (filters.status === 'returned') {
      return employeeMatch && statusMatch && profitStatusMatch;
    }

    return employeeMatch && statusMatch && profitStatusMatch && archiveMatch;
  }).map(order => ({
    ...order,
    created_by_name: usersMap.get(order.created_by) || 'غير معروف'
  }));

  console.log('✅ الطلبات المفلترة النهائية:', {
    count: filtered.length,
    showSettlementArchive,
    orders: filtered.map(o => ({ id: o.id, number: o.order_number, status: o.status }))
  });
  
  return filtered;
}, [orders, filters, usersMap, profits, showSettlementArchive, employees, employeeFromUrl, supervisedEmployeeIds, isDepartmentManager, isAdmin, user?.user_id]);

// إعادة تعيين الصفحة عند تغيير الفلاتر
useEffect(() => {
  setCurrentPage(1);
}, [filters]);

// حساب الصفحات للطلبات
const totalPagesOrders = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE);
const startIndexOrders = (currentPage - 1) * ITEMS_PER_PAGE;
const paginatedOrders = filteredOrders.slice(startIndexOrders, startIndexOrders + ITEMS_PER_PAGE);

// ✅ الطلبات القابلة للمزامنة - فقط النشطة (ليست مكتملة أو مرجعة)
const syncableOrders = useMemo(() => {
  if (!filteredOrders || !Array.isArray(filteredOrders)) return [];
  
  return filteredOrders.filter(order => {
    // فقط طلبات الوسيط
    if (order.delivery_partner !== 'alwaseet') return false;
    
    // استبعاد الطلبات المرجعة فقط (delivery_status = 17) - النهائية الوحيدة
    // الحالة 4 (تم التسليم) ليست نهائية - قد يحدث إرجاع أو تسليم جزئي بعدها
    if (order.delivery_status === '17') return false;
    
    return true;
  });
}, [filteredOrders]);

// المزامنة الذكية للطلبات الظاهرة فقط عند فتح الصفحة - مرة واحدة
const hasSyncedOnLoad = useRef(false);

useEffect(() => {
  if (syncableOrders && syncableOrders.length > 0 && !hasSyncedOnLoad.current) {
    const performSmartSync = async () => {
      try {
        console.log(`🔄 مزامنة ذكية تلقائية: ${syncableOrders.length} طلب نشط من ${filteredOrders?.length || 0} ظاهر...`);
        
        // استخدام autoSyncVisibleOrders من useUnifiedAutoSync
        const result = await autoSyncVisibleOrders(syncableOrders);
        
        if (result?.success) {
          console.log(`✅ مزامنة ذكية: ${result.updatedCount || 0} طلب محدث`);
        }
      } catch (err) {
        console.warn('⚠️ تعذرت المزامنة الذكية:', err);
      }
    };
    
    // تأخير 3 ثواني بعد فتح الصفحة
    const timer = setTimeout(() => {
      performSmartSync();
      hasSyncedOnLoad.current = true;
    }, 3000);
    
    return () => clearTimeout(timer);
  }
}, []); // تشغيل مرة واحدة عند فتح الصفحة

  // تحديد وإبراز طلب عند الوصول من الإشعار برقم الطلب
  useEffect(() => {
    if (!orderNumberFromUrl || !Array.isArray(orders) || orders.length === 0) return;
    const found = orders.find(o => o?.order_number === orderNumberFromUrl || o?.id === orderNumberFromUrl);
    if (found) {
      setSelectedOrders(prev => (prev.includes(found.id) ? prev : [...prev, found.id]));
      setTimeout(() => {
        const el = document.querySelector(`[data-order-id="${found.id}"]`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  }, [orderNumberFromUrl, orders]);

  // الإحصائيات
  const stats = useMemo(() => {
    if (!orders || !Array.isArray(orders)) {
      return {
        totalOrders: 0,
        totalSales: 0,
        totalManagerProfits: 0,
        pendingDues: 0,
        paidDues: 0,
        settledOrdersCount: 0,
        settlementRequestsCount: 0
      };
    }

    // فلتر الطلبات حسب الموظف والفترة للإحصائيات
    const effectiveEmployeeId = employeeFromUrl || filters.employeeId;
    
    // فلتر الفترة الزمنية
    const filterByTimePeriod = (order) => {
      if (filters.timePeriod === 'all') return true;
      
      const orderDate = new Date(order.created_at);
      const now = new Date();
      
      switch (filters.timePeriod) {
        case 'today':
          return orderDate.toDateString() === now.toDateString();
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return orderDate >= weekAgo;
        case 'month':
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          return orderDate >= monthAgo;
        case '3months':
          const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          return orderDate >= threeMonthsAgo;
        default:
          return true;
      }
    };

    // تصفية الطلبات للإحصائيات (كل الطلبات المسلمة والمكتملة بغض النظر عن الأرشيف)
    const statsOrders = orders.filter(order => {
      if (!order) return false;
      
      // استبعاد طلبات المدير
      if (order.created_by === ADMIN_ID) return false;
      
      // ✅ مدير القسم: فقط طلبات الموظفين تحت إشرافه (وليس طلباته)
      if (isDepartmentManager && !isAdmin) {
        // استبعاد طلبات مدير القسم نفسه
        if (order.created_by === user?.user_id) return false;
        // فقط طلبات الموظفين تحت إشرافه
        if (!supervisedEmployeeIds.includes(order.created_by)) return false;
      }
      
      // فلتر الموظف المحدد
      let employeeMatch = true;
      if (effectiveEmployeeId && effectiveEmployeeId !== 'all') {
        employeeMatch = order.created_by === effectiveEmployeeId;
      }
      
      // فلتر الفترة
      if (!filterByTimePeriod(order)) return false;
      
      // فقط الطلبات المسلمة والمكتملة
      const statusMatch = order.status === 'delivered' || order.status === 'completed';
      
      return employeeMatch && statusMatch;
    });
    
    console.log('📊 الطلبات للإحصائيات:', {
      filteredOrdersCount: filteredOrders.length,
      statsOrdersCount: statsOrders.length,
      statusBreakdown: statsOrders.reduce((acc, o) => {
        acc[o.status] = (acc[o.status] || 0) + 1;
        return acc;
      }, {})
    });
    
    // إجمالي المبيعات بدون أجور التوصيل (من جميع الطلبات المسلمة والمكتملة)
    const totalSales = statsOrders.reduce((sum, order) => {
      const totalWithDelivery = order?.final_amount || order?.total_amount || 0;
      const deliveryFee = order?.delivery_fee || 0;
      const totalWithoutDelivery = Math.max(0, totalWithDelivery - deliveryFee);
      return sum + totalWithoutDelivery;
    }, 0);
    
    // أرباح المدير من الموظفين - استخدام البيانات الحقيقية من جدول profits
    const totalManagerProfits = statsOrders.reduce((sum, order) => {
      // البحث عن سجل الربح الحقيقي
      const profitRecord = profits?.find(p => p.order_id === order.id);
      if (profitRecord) {
        // ربح النظام = إجمالي الربح - ربح الموظف
        const systemProfit = (profitRecord.profit_amount || 0) - (profitRecord.employee_profit || 0);
        return sum + systemProfit;
      }
      return sum;
    }, 0);

    // المستحقات المدفوعة - مفلترة حسب الفترة الزمنية والموظفين المشرف عليهم
    // ✅ لمدير القسم: نستخدم settlement_invoices للحصول على employee_id
    let paidDues = 0;
    if (isDepartmentManager && !isAdmin && supervisedEmployeeIds?.length > 0) {
      // مدير القسم: فقط تسويات موظفيه المشرف عليهم
      const supervisedSettlements = settlementInvoices?.filter(si => 
        supervisedEmployeeIds.includes(si.employee_id)
      ) || [];
      paidDues = supervisedSettlements
        .filter(si => {
          if (filters.timePeriod === 'all') return true;
          const createdAt = si.created_at;
          if (!createdAt) return false;
          const settlementDate = new Date(createdAt);
          const now = new Date();
          switch (filters.timePeriod) {
            case 'today':
              return settlementDate.toDateString() === now.toDateString();
            case 'week':
              return settlementDate >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            case 'month':
              return settlementDate >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            case '3months':
              return settlementDate >= new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            default:
              return true;
          }
        })
        .reduce((sum, si) => sum + (Number(si.total_amount) || 0), 0);
    } else {
      // المدير العام: كل المستحقات المدفوعة
      paidDues = expenses && Array.isArray(expenses)
        ? expenses.filter(expense => {
            const isPaidDues = (
              expense.category === 'مستحقات الموظفين' &&
              expense.expense_type === 'system' &&
              expense.status === 'approved'
            );
            if (!isPaidDues) return false;

            if (filters.timePeriod === 'all') return true;
            const createdAt = expense.created_at || expense.date || expense.expense_date;
            if (!createdAt) return false;
            const expenseDate = new Date(createdAt);
            const now = new Date();
            switch (filters.timePeriod) {
              case 'today':
                return expenseDate.toDateString() === now.toDateString();
              case 'week':
                return expenseDate >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
              case 'month':
                return expenseDate >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
              case '3months':
                return expenseDate >= new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
              default:
                return true;
            }
          }).reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0)
        : 0;
    }

    // المستحقات المعلقة - أرباح الموظفين من الطلبات المستلمة فواتيرها ولم تُسوى
    // ✅ إصلاح: استثناء الطلبات التي employee_profit = 0 (لا يوجد قاعدة ربح)
    const pendingDues = statsOrders
      .filter(order => order.receipt_received === true)
      .reduce((sum, order) => {
        // البحث عن سجل الربح
        const profitRecord = profits?.find(p => p.order_id === order.id);
        let employeeProfit = 0;
        
        if (profitRecord && isPendingStatus(profitRecord.status)) {
          // إذا كان هناك سجل ربح غير مُسوى وربح الموظف > 0
          employeeProfit = profitRecord.employee_profit || 0;
        }
        // ✅ إزالة: لا نحسب ربح تلقائي للطلبات بدون سجل (تعني لا قاعدة ربح)
        
        return sum + employeeProfit;
      }, 0);

    console.log('📊 الإحصائيات:', {
      totalOrders: filteredOrders.length,
      deliveredOrders: statsOrders.length,
      totalSales,
      totalManagerProfits,
      pendingDues,
      paidDues
    });

    // عدد الطلبات المسواة (في الأرشيف) - يجب أن تظهر الطلبات المسدودة مستحقاتها ولا تحسب المدير
    const safeOrders = Array.isArray(orders) ? orders : [];
    const settledOrdersCount = safeOrders.filter(o => {
      if (!o) return false;
      
      // استبعاد طلبات المدير من الحساب
      if (o.created_by === ADMIN_ID) return false;
      
      // ✅ لمدير القسم: فقط طلبات موظفيه المشرف عليهم
      if (isDepartmentManager && !isAdmin && supervisedEmployeeIds?.length > 0) {
        if (!supervisedEmployeeIds.includes(o.created_by)) return false;
      }
      
      // فلتر الموظف
      let employeeMatch = true;
      if (effectiveEmployeeId && effectiveEmployeeId !== 'all') {
        employeeMatch = o.created_by === effectiveEmployeeId;
      }
      
      // فلتر الفترة
      if (!filterByTimePeriod(o)) return false;
      
      // الطلبات المكتملة والمدفوعة مستحقاتها (التي لها سجل في profits مع status = 'settled')
      const profitRecord = profits?.find(p => p.order_id === o.id);
      return employeeMatch && profitRecord?.status === 'settled';
    }).length;

    // ✅ عدد طلبات التحاسب المعلقة - من settlementRequests مباشرة (نفس مصدر النافذة)
    let settlementRequestsCount = 0;
    if (settlementRequests && settlementRequests.length > 0) {
      // لمدير القسم: فقط طلبات موظفيه المشرف عليهم
      if (isDepartmentManager && !isAdmin && supervisedEmployeeIds?.length > 0) {
        settlementRequestsCount = settlementRequests.filter(req => 
          supervisedEmployeeIds.includes(req.data?.employee_id)
        ).length;
      } else {
        settlementRequestsCount = settlementRequests.length;
      }
    }

    // ✅ عدد الطلبات المرتجعة (delivery_status = '17') - من orders مباشرة
    const returnedOrdersCount = orders?.filter(o => 
      o.delivery_status === '17' && 
      o.created_by !== ADMIN_ID
    ).length || 0;

    // ✅ إجمالي الطلبات يستبعد المرتجعة (delivery_status=17) لأنها في كارت منفصل
    const totalOrdersExcludingReturned = filteredOrders.filter(o => o.delivery_status !== '17').length;

    return {
      totalOrders: totalOrdersExcludingReturned,
      totalSales,
      totalManagerProfits,
      pendingDues,
      paidDues,
      settledOrdersCount,
      settlementRequestsCount,
      returnedOrdersCount
    };
  }, [filteredOrders, orders, filters, profits, calculateProfit, expenses, employeeFromUrl, settlementRequests, isDepartmentManager, isAdmin, supervisedEmployeeIds]);

  // معالج تغيير الفلاتر
  const handleFilterChange = (name, value) => {
    console.log('🔧 تغيير الفلتر:', { name, value });
    setFilters(prev => ({ ...prev, [name]: value }));
  };
  
  // معالج النقر على كارت الإحصائيات - ✅ إعادة تعيين جميع الفلاتر
  const handleStatCardClick = (filterType) => {
    // ✅ إعادة تعيين أرشيف التسوية عند الضغط على أي كارت
    setShowSettlementArchive(false);
    
    if (filterType === 'returned') {
      // فلتر الطلبات المرتجعة بناءً على delivery_status = '17'
      setFilters(prev => ({ ...prev, profitStatus: 'all', status: 'returned', archived: false }));
    } else {
      setFilters(prev => ({ ...prev, profitStatus: filterType, status: 'all', archived: false }));
    }
  };

  // معالج عرض تفاصيل الطلب
  const handleViewOrder = (order) => {
    setSelectedOrderDetails(order);
    setIsDetailsDialogOpen(true);
  };

  // معالج استلام الطلبات الراجعة
  const handleReceiveReturned = async () => {
    if (selectedOrders.length === 0) {
      toast({ title: "خطأ", description: "الرجاء تحديد طلبات راجعة أولاً.", variant: "destructive" });
      return;
    }
    
    try {
      for (const orderId of selectedOrders) {
        await updateOrder(orderId, { status: 'returned_in_stock', isArchived: true });
      }
      toast({ 
        title: "تم الاستلام", 
        description: `تم استلام ${selectedOrders.length} طلبات راجعة في المخزن وأرشفتها.` 
      });
      await refetchProducts();
      setSelectedOrders([]);
    } catch (error) {
      console.error('خطأ في استلام الطلبات الراجعة:', error);
      toast({ 
        title: "خطأ", 
        description: "حدث خطأ أثناء استلام الطلبات الراجعة.", 
        variant: "destructive" 
      });
    }
  };

  // معالج تحديث حالة الطلب
  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      await updateOrder(orderId, { status: newStatus });
      toast({ title: "تم التحديث", description: "تم تحديث حالة الطلب بنجاح." });
    } catch (error) {
      console.error('خطأ في تحديث حالة الطلب:', error);
      toast({ 
        title: "خطأ", 
        description: "حدث خطأ أثناء تحديث حالة الطلب.", 
        variant: "destructive" 
      });
    }
  };

  // معالج حذف الطلب
  const handleDeleteOrder = async (order) => {
    try {
      await deleteOrders([order.id]);
      toast({ 
        title: "تم الحذف", 
        description: `تم حذف الطلب ${order.tracking_number || order.order_number} وإرجاع المخزون المحجوز.` 
      });
      await refetchProducts();
    } catch (error) {
      console.error('خطأ في حذف الطلب:', error);
      toast({ 
        title: "خطأ في الحذف", 
        description: "حدث خطأ أثناء حذف الطلب.", 
        variant: "destructive" 
      });
    }
  };

  // إيجاد الطلبات المحددة كـ objects بدلاً من ids
  const selectedOrdersData = useMemo(() => {
    return filteredOrders.filter(order => selectedOrders.includes(order.id));
  }, [filteredOrders, selectedOrders]);

  // تجميع الطلبات المحددة حسب الموظف للتحاسب
  const employeesWithSelectedOrders = useMemo(() => {
    const employeeGroups = {};
    
    console.log('🧮 بناء employeesWithSelectedOrders:', {
      selectedOrdersDataLength: selectedOrdersData.length,
      employeesLength: employees.length,
      selectedOrdersDataSample: selectedOrdersData.slice(0, 2).map(o => ({ id: o.id, created_by: o.created_by })),
      employeesSample: employees.slice(0, 2).map(e => ({ user_id: e.user_id, name: e.full_name }))
    });
    
    selectedOrdersData.forEach(order => {
      if (!employeeGroups[order.created_by]) {
        const employee = employees.find(emp => emp.user_id === order.created_by);
        console.log('🔍 البحث عن الموظف:', { 
          orderCreatedBy: order.created_by, 
          employeeFound: !!employee, 
          employeeName: employee?.full_name 
        });
        if (employee) {
          employeeGroups[order.created_by] = {
            employee,
            orders: []
          };
        }
      }
      if (employeeGroups[order.created_by]) {
        employeeGroups[order.created_by].orders.push(order);
      }
    });
    
    const result = Object.values(employeeGroups);
    console.log('✅ النتيجة النهائية employeesWithSelectedOrders:', {
      count: result.length,
      details: result.map(g => ({ 
        employeeName: g.employee.full_name, 
        ordersCount: g.orders.length 
      }))
    });
    
    return result;
  }, [selectedOrdersData, employees]);

  // معالج إلغاء تحديد الطلبات
  const handleClearSelection = () => {
    setSelectedOrders([]);
  };

  // معالج الانتقال لتحاسب من الإشعار
  const handleNavigateToSettlement = (employeeId, orderIds) => {
    console.log('🔄 handleNavigateToSettlement called:', { employeeId, orderIds });
    
    if (!employeeId || !orderIds || orderIds.length === 0) {
      console.warn('⚠️ بيانات غير مكتملة للتحاسب');
      toast({
        title: "تنبيه",
        description: "بيانات طلب التحاسب غير مكتملة",
        variant: "destructive"
      });
      return;
    }
    
    // تعيين فلتر الموظف والحالة
    setFilters(prev => ({ 
      ...prev, 
      employeeId,
      profitStatus: 'pending', // فلترة الأرباح المعلقة فقط
      status: 'all' // إظهار كل الحالات
    }));
    
    // تحديد الطلبات المطلوب تسويتها
    setSelectedOrders(orderIds);
    
    console.log('✅ تم تعيين الفلاتر والطلبات:', { employeeId, orderIds });
    
    // toast لتوضيح الإجراء
    toast({
      title: "طلبات التحاسب جاهزة",
      description: `تم تحديد ${orderIds.length} طلب للتحاسب. اضغط على "دفع المستحقات" أدناه.`,
      variant: "default"
    });
    
    // التمرير للكارت مع تأثير بصري
    setTimeout(() => {
      const element = document.querySelector(`[data-employee-id="${employeeId}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // تأثير بصري
        element.style.border = "3px solid #3b82f6";
        element.style.borderRadius = "12px";
        element.style.boxShadow = "0 0 20px rgba(59, 130, 246, 0.5)";
        setTimeout(() => {
          element.style.border = "";
          element.style.borderRadius = "";
          element.style.boxShadow = "";
        }, 4000);
      }
    }, 1000);
  };

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>متابعة الموظفين - RYUS</title>
        <meta name="description" content="متابعة أداء وطلبات الموظفين" />
      </Helmet>
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-6"
      >
        {/* العنوان الرئيسي */}
        {/* العنوان الرئيسي */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold gradient-text">متابعة الموظفين</h1>
            <p className="text-muted-foreground">نظرة شاملة على أداء فريق العمل وإدارة المزامنة الذكية.</p>
          </div>
        </div>

        {/* شريط الأدوات الاحترافي للمزامنة */}
                <ProfessionalSyncToolbar
                  syncing={syncing}
                  syncingEmployee={syncingEmployee}
                  smartSync={smartSync}
                  syncSpecificEmployee={syncSpecificEmployee}
                  syncSpecificEmployeeSmart={syncSpecificEmployeeSmart}
                  comprehensiveSync={syncAllEmployeesOrders}
                  syncOrdersOnly={syncVisibleOrders}
                  lastComprehensiveSync={lastComprehensiveSync}
                  isAdmin={isAdmin}
                  hideDeliveryManagement={true}
                  employees={employees}
                  onOpenSyncSettings={() => setIsUnifiedSyncSettingsOpen(true)}
                />

        {/* الفلاتر */}
        <Card>
          <CardContent className="p-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 items-center">
            <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="الحالة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                <SelectItem value="pending">قيد التجهيز</SelectItem>
                <SelectItem value="shipped">تم الشحن</SelectItem>
                <SelectItem value="delivery">قيد التوصيل</SelectItem>
                <SelectItem value="delivered">تم التسليم</SelectItem>
                <SelectItem value="completed">مكتمل</SelectItem>
                <SelectItem value="returned">راجع</SelectItem>
                <SelectItem value="cancelled">ملغي</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={filters.employeeId} onValueChange={(value) => handleFilterChange('employeeId', value)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="الموظف" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الموظفين</SelectItem>
                {employees.map(emp => (
                  <SelectItem key={emp.user_id} value={emp.user_id}>
                    {emp.full_name || emp.name || 'غير معروف'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.profitStatus} onValueChange={(value) => handleFilterChange('profitStatus', value)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="الأرباح" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأرباح</SelectItem>
                <SelectItem value="pending">بانتظار الفاتورة</SelectItem>
                <SelectItem value="invoice_received">جاهز للتحاسب</SelectItem>
                <SelectItem value="settlement_requested">🔔 تم طلب التحاسب</SelectItem>
                <SelectItem value="settled">مسواة</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.timePeriod} onValueChange={(value) => handleFilterChange('timePeriod', value)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="الفترة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الفترات</SelectItem>
                <SelectItem value="today">اليوم</SelectItem>
                <SelectItem value="week">أسبوع</SelectItem>
                <SelectItem value="month">شهر</SelectItem>
                <SelectItem value="3months">3 أشهر</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* تنبيه طلبات التحاسب المعلقة - تصميم احترافي */}
        {stats.settlementRequestsCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Card className="overflow-hidden border-0 shadow-lg">
              <div className="bg-gradient-to-l from-orange-500 via-amber-500 to-yellow-500 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                      <Bell className="w-7 h-7 text-white animate-pulse" />
                    </div>
                    <div className="text-white">
                      <h3 className="text-lg font-bold">طلبات تحاسب جديدة!</h3>
                      <p className="text-white/90 text-sm">
                        {stats.settlementRequestsCount} طلب من الموظفين ينتظر الموافقة والتسوية
                      </p>
                    </div>
                  </div>
                  <Button 
                    size="lg" 
                    className="group bg-gradient-to-l from-amber-50 to-orange-100 text-orange-700 hover:from-orange-100 hover:to-amber-100 hover:scale-105 font-bold shadow-xl transition-all duration-300 border-2 border-orange-200/80 px-6"
                    onClick={() => setIsSettlementRequestsDialogOpen(true)}
                  >
                    <Sparkles className="w-4 h-4 ml-2 group-hover:animate-spin text-amber-600" />
                    عرض التفاصيل
                    <ChevronLeft className="w-4 h-4 mr-1 group-hover:-translate-x-1 transition-transform text-orange-600" />
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* الإحصائيات */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <StatCard 
            title="إجمالي الطلبات" 
            value={stats.totalOrders} 
            icon={ShoppingCart} 
            colors={['blue-500', 'sky-500']} 
            onClick={() => {
              setShowSettlementArchive(false);
              setFilters(prev => ({ ...prev, status: 'all', profitStatus: 'all', archived: false }));
            }}
          />
          <StatCard 
            title="إجمالي المبيعات" 
            value={stats.totalSales} 
            icon={DollarSign} 
            colors={['purple-500', 'violet-500']} 
            format="currency" 
          />
          {/* ✅ عرض بطاقة أرباح المدير للمدير العام فقط */}
          {isAdmin && (
            <ManagerProfitsCard 
              orders={orders || []}
              allUsers={allUsers || []}
              calculateProfit={calculateProfit}
              profits={profits || []}
              timePeriod={filters.timePeriod}
            />
          )}
          <div 
            className="relative cursor-pointer group"
            onClick={() => setIsSettlementRequestsDialogOpen(true)}
          >
            {stats.settlementRequestsCount > 0 && (
              <div className="absolute -top-2 -right-2 z-10 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center animate-bounce shadow-lg shadow-red-500/50">
                <span className="text-white text-xs font-bold">{stats.settlementRequestsCount}</span>
              </div>
            )}
            <StatCard 
              title="طلبات تحاسب" 
              value={stats.settlementRequestsCount || 0}
              icon={Wallet} 
              colors={['orange-500', 'amber-500']} 
              format="number"
              description="ينتظر التسوية"
            />
          </div>
          <StatCard 
            title="مستحقات معلقة" 
            value={stats.pendingDues} 
            icon={Hourglass} 
            colors={['yellow-500', 'amber-500']} 
            format="currency" 
            onClick={() => handleStatCardClick('pending')} 
          />
          <StatCard 
            title="مستحقات مدفوعة" 
            value={stats.paidDues} 
            icon={CheckCircle} 
            colors={['teal-500', 'cyan-500']} 
            format="currency" 
            onClick={() => setIsDuesDialogOpen(true)} 
          />
          <StatCard 
            title="أرشيف التسوية" 
            value={stats.settledOrdersCount || 0}
            icon={Archive} 
            colors={['gray-500', 'slate-500']} 
            format="number"
            onClick={() => {
              // ✅ إعادة تعيين الفلاتر الأخرى عند تفعيل الأرشيف
              setFilters(prev => ({ ...prev, profitStatus: 'all', status: 'all', archived: false }));
              setShowSettlementArchive(!showSettlementArchive);
            }} 
            description="الطلبات المسواة"
          />
          <StatCard 
            title="طلبات مرتجعة" 
            value={stats.returnedOrdersCount || 0}
            icon={RotateCcw} 
            colors={['red-500', 'rose-500']} 
            format="number"
            onClick={() => handleStatCardClick('returned')} 
            description="تم الإرجاع للتاجر"
          />
        </div>

        {/* كارت تسوية المستحقات للطلبات المحددة - فوق قائمة الطلبات */}
        {employeesWithSelectedOrders.length > 0 && (
          <div className="space-y-4 mb-6">
            <h3 className="text-lg font-semibold">تسوية المستحقات</h3>
            {employeesWithSelectedOrders.map(({ employee, orders }) => (
              <EmployeeSettlementCard
                key={employee.user_id}
                employee={employee}
                selectedOrders={orders}
                onClearSelection={handleClearSelection}
                calculateProfit={calculateProfit}
              />
            ))}
          </div>
        )}

        {/* التبويبات الرئيسية */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 gap-2 bg-muted/50 p-1">
            <TabsTrigger 
              value="orders" 
              className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <ShoppingCart className="h-4 w-4" />
              الطلبات ({filteredOrders.length})
            </TabsTrigger>
            <TabsTrigger 
              value="invoices" 
              className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <FileText className="h-4 w-4" />
              فواتير الموظفين
            </TabsTrigger>
          </TabsList>

          {/* تبويب الطلبات */}
          <TabsContent value="orders" className="mt-6">
            <div className="bg-card p-4 rounded-xl border">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">
                  قائمة الطلبات ({filteredOrders.length})
                </h2>
              </div>


              {/* قائمة الطلبات */}
              <OrderList 
                orders={paginatedOrders} 
                isLoading={loading} 
                onViewOrder={handleViewOrder}
                onUpdateStatus={handleUpdateStatus}
                onDeleteOrder={handleDeleteOrder}
                selectedOrders={selectedOrders}
                setSelectedOrders={setSelectedOrders}
                calculateProfit={calculateProfit}
                profits={profits}
                viewMode="grid"
                showEmployeeName={filters.employeeId === 'all'}
              />
              
              <SmartPagination
                currentPage={currentPage}
                totalPages={totalPagesOrders}
                onPageChange={setCurrentPage}
                totalItems={filteredOrders.length}
                itemsPerPage={ITEMS_PER_PAGE}
              />
            </div>
          </TabsContent>

          {/* تبويب فواتير الموظفين */}
          <TabsContent value="invoices" className="mt-6">
            <div className="bg-card p-4 rounded-xl border">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">
                  فواتير شركة التوصيل
                </h2>
              </div>
              <EmployeeDeliveryInvoicesTab employeeId={filters.employeeId} />
            </div>
          </TabsContent>
        </Tabs>

        {/* نوافذ حوارية */}
        <OrderDetailsDialog
          order={selectedOrderDetails}
          open={isDetailsDialogOpen}
          onOpenChange={setIsDetailsDialogOpen}
          onUpdate={updateOrder}
          canEditStatus={hasPermission('manage_orders')}
          sellerName={selectedOrderDetails ? usersMap.get(selectedOrderDetails.created_by) : null}
        />
        
        <UnifiedSettledDuesDialog
          open={isDuesDialogOpen}
          onOpenChange={setIsDuesDialogOpen}
          invoices={settlementInvoices || []} // ✅ توحيد استخدام settlementInvoices
          allUsers={allUsers}
          profits={profits || []} // تمرير بيانات الأرباح
          orders={filteredOrders || orders || []} // تمرير بيانات الطلبات
          timePeriod={filters.timePeriod} // تمرير فلتر الفترة
          supervisedEmployeeIds={supervisedEmployeeIds} // تمرير الموظفين المشرف عليهم
          isDepartmentManager={isDepartmentManager && !isAdmin} // تمرير حالة مدير القسم
        />

        {/* إعدادات المزامنة التلقائية الموحدة */}
        <UnifiedSyncSettings
          open={isUnifiedSyncSettingsOpen}
          onOpenChange={setIsUnifiedSyncSettingsOpen}
        />

        {/* Dialog طلبات التحاسب */}
        <SettlementRequestsDialog
          open={isSettlementRequestsDialogOpen}
          onOpenChange={setIsSettlementRequestsDialogOpen}
          profits={profits || []}
          orders={orders || []}
          allUsers={allUsers || []}
          selectedOrderIds={selectedOrders}
          onSelectOrders={setSelectedOrders}
          settlementRequests={settlementRequests || []}
          onProcessSettlement={handleProcessSettlement}
          isProcessing={isSettlementProcessing}
        />

      </motion.div>
    </>
  );
};

export default EmployeeFollowUpPage;