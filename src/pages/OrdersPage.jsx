import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Helmet } from 'react-helmet-async';
import { useSuper } from '@/contexts/SuperProvider';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { useUnifiedProfits } from '@/hooks/useUnifiedProfits';
import { useUnifiedUserData } from '@/hooks/useUnifiedUserData';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { ArrowRight, DollarSign, RefreshCw, Loader2, Archive, Users, ShoppingCart, Trash2, Building, Edit, CheckCircle, FileText } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { scrollToTopInstant } from '@/utils/scrollToTop';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import devLog from '@/lib/devLogger';

import OrdersHeader from '@/components/orders/OrdersHeader';
import OrdersStats from '@/components/orders/OrdersStats';
import OrdersToolbar from '@/components/orders/OrdersToolbar';
import OrderList from '@/components/orders/OrderList';
import OrderDetailsDialog from '@/components/orders/OrderDetailsDialog';
import EditOrderDialog from '@/components/orders/EditOrderDialog';
import QuickOrderDialog from '@/components/quick-order/QuickOrderDialog';
import AiOrdersManager from '@/components/dashboard/AiOrdersManager';
import StatCard from '@/components/dashboard/StatCard';
import { filterOrdersByPeriod } from '@/lib/dashboard-helpers';
import { Card, CardContent } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import ReturnReceiptDialog from '@/components/orders/ReturnReceiptDialog';
import AlWaseetInvoicesTab from '@/components/orders/AlWaseetInvoicesTab';
import * as ModonAPI from '@/lib/modon-api';
import { Activity } from 'lucide-react';



const OrdersPage = () => {
  const { orders, aiOrders, loading: inventoryLoading, calculateProfit, updateOrder, deleteOrders: deleteOrdersContext, refetchProducts, refreshOrders } = useSuper();
  // ✅ إضافة syncVisibleOrdersBatch للمزامنة الدُفعية
  const { syncAndApplyOrders, syncOrderByTracking, fastSyncPendingOrders, performDeletionPassAfterStatusSync, autoSyncEnabled, setAutoSyncEnabled, correctionComplete, syncVisibleOrdersBatch } = useAlWaseet();
  const { user, allUsers } = useAuth();
  const { hasPermission } = usePermissions();
  const { profitData, allProfits } = useUnifiedProfits();
  const { userUUID } = useUnifiedUserData();
  const navigate = useNavigate();
  const location = useLocation();
  
  // دالة مساعدة لترجمة حالات الطلبات - تحريك للأعلى قبل الاستخدام
  const getStatusLabel = useCallback((status) => {
    const statusLabels = {
      'pending': 'قيد الانتظار',
      'shipped': 'تم الشحن',
      'delivery': 'قيد التوصيل',
      'delivered': 'تم التسليم',
      'cancelled': 'ملغي',
      'returned': 'مرجع',
      'completed': 'مكتمل',
      'returned_in_stock': 'راجع للمخزن'
    };
    return statusLabels[status] || status;
  }, []);
  
  // جلب أسماء المستخدمين لعرض اسم صاحب الطلب - تحريك هذا للأعلى قبل الاستخدام
  const usersMap = useMemo(() => {
    const map = new Map();
    (allUsers || []).forEach(u => {
      if (u && u.user_id) {
        // استخدام user_id للربط مع created_by
        map.set(u.user_id, u.full_name || u.name || 'غير معروف');
      }
    });
    return map;
  }, [allUsers]);
  
  const [filters, setFilters] = useLocalStorage('ordersFilters', { searchTerm: '', status: 'all', period: 'all', archiveSubStatus: 'all' });
  const [viewMode, setViewMode] = useLocalStorage('ordersViewMode', 'grid');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [dialogs, setDialogs] = useState({
    details: false,
    edit: false,
    quickOrder: false,
    aiManager: false,
    deleteAlert: false,
    archiveAlert: false,
    returnReceipt: false,
  });
  const [syncing, setSyncing] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [userEmployeeCode, setUserEmployeeCode] = useState(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('all');
  const [activeTab, setActiveTab] = useLocalStorage('ordersActiveTab', 'orders');

  // Scroll to top when page loads
  useEffect(() => {
    scrollToTopInstant();
  }, []);

  // ✅ مزامنة تلقائية للطلبات المعلقة عند الدخول - مرة واحدة فقط
  const hasSyncedRef = useRef(false);
  
  useEffect(() => {
    // منع التكرار - المزامنة مرة واحدة فقط
    if (hasSyncedRef.current) {
      devLog.log('⏭️ تم تخطي المزامنة - تمت بالفعل');
      return;
    }
    
    const performInitialSync = async () => {
      // انتظار تحميل الطلبات أولاً
      if (inventoryLoading || !orders || orders.length === 0) {
        devLog.log('⏳ انتظار تحميل الطلبات في OrdersPage...');
        return;
      }
      
      // تأكيد أن المزامنة تمت
      hasSyncedRef.current = true;
      
      // جلب الطلبات النشطة بما فيها delivered (للتسليم الجزئي)
      const activeExternalOrders = orders.filter(o => 
        ['pending', 'shipped', 'delivery', 'delivered'].includes(o.status) &&
        o.delivery_partner && 
        ['alwaseet', 'modon'].includes(o.delivery_partner) &&
        o.delivery_status !== '17' // ✅ استثناء الحالة 17 (راجع للتاجر)
      );
      
      if (activeExternalOrders.length === 0) {
        devLog.log('ℹ️ لا توجد طلبات خارجية نشطة للمزامنة');
        return;
      }
      
      devLog.log(`🔄 [OrdersPage] مزامنة تلقائية لـ ${activeExternalOrders.length} طلب نشط (بما فيها delivered للتسليم الجزئي)...`);
      
      
      try {
        const result = await syncVisibleOrdersBatch(activeExternalOrders);
        
        if (result && result.updatedCount > 0) {
          await refreshOrders();
        }

        // ✅ مزامنة الفواتير المستلمة تلقائياً
        try {
          const { data: syncRes, error: syncErr } = await supabase.rpc('sync_recent_received_invoices');
          if (syncRes?.updated_orders_count > 0) {
            devLog.log(`✅ تم تحديث ${syncRes.updated_orders_count} طلب من الفواتير`);
          }
        } catch (e) {
          console.warn('⚠️ خطأ في مزامنة الفواتير:', e);
        }

        // ✅ الحذف التلقائي الآمن بعد مزامنة الحالات
        await performDeletionPassAfterStatusSync();

      } catch (error) {
        // Error silently
      }
    };

    // تأخير 3 ثواني قبل المزامنة (لضمان تحميل الطلبات)
    const timer = setTimeout(() => {
      performInitialSync();
    }, 3000);

    return () => clearTimeout(timer);
  }, []); // ✅ dependencies فارغة = مرة واحدة فقط عند تحميل الصفحة

  // ❌ تعطيل Fast Sync مؤقتاً للاختبار - الاعتماد فقط على Smart Sync
  /*
  useEffect(() => {
    const timer = setTimeout(() => {
      if (fastSyncPendingOrders) {
        devLog.log('🔄 تشغيل مزامنة سريعة تلقائية عند دخول صفحة الطلبات...');
        fastSyncPendingOrders(false).then(result => {
          devLog.log('✅ نتيجة المزامنة السريعة التلقائية:', result);
        }).catch(error => {
          console.error('❌ خطأ في المزامنة السريعة التلقائية:', error);
        });
      }
    }, 3000); // بعد 3 ثواني من دخول الصفحة
    
    return () => clearTimeout(timer);
  }, []); // تشغيل مرة واحدة عند دخول الصفحة
  */

  // إشعارات للطلبات الجديدة والمحدثة - SuperProvider يتولى التحديثات الفورية
  useEffect(() => {
    const channel = supabase
      .channel('orders-realtime-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders'
        },
        (payload) => {
          const newOrder = payload.new;
          devLog.log('📢 إشعار طلب جديد:', newOrder.qr_id || newOrder.order_number);
          
          // إشعار فوري عند إنشاء طلب جديد فقط
          toast({
            title: (
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                تم إنشاء طلب جديد بنجاح
              </div>
            ),
            description: (
              <div className="space-y-1">
                <p><strong>رقم الطلب:</strong> {newOrder.qr_id || newOrder.order_number}</p>
                <p><strong>العميل:</strong> {newOrder.customer_name}</p>
                <p><strong>المبلغ:</strong> {(newOrder.final_amount || 0).toLocaleString()} د.ع</p>
              </div>
            ),
            variant: "success",
            duration: 5000
          });

          // تم حذف كود الإشعارات المتضارب - الإشعارات تأتي الآن من NotificationsHandler.jsx فقط
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders'
        },
        (payload) => {
          const updatedOrder = payload.new;
          const oldOrder = payload.old;
          
          devLog.log('🔄 تحديث طلب فوري:', {
            id: updatedOrder.id,
            old_status: oldOrder?.status,
            new_status: updatedOrder.status,
            old_delivery_id: oldOrder?.delivery_partner_order_id,
            new_delivery_id: updatedOrder.delivery_partner_order_id,
            tracking_number: updatedOrder.tracking_number
          });
          
          // إشعار فقط للتحديثات المهمة (تغيير الحالة أو ربط معرف التوصيل)
          if (oldOrder?.status !== updatedOrder.status) {
            toast({
              title: (
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-blue-500" />
                  تم تحديث حالة الطلب
                </div>
              ),
              description: (
                <div className="space-y-1">
                  <p><strong>رقم الطلب:</strong> {updatedOrder.qr_id || updatedOrder.order_number}</p>
                  <p><strong>الحالة الجديدة:</strong> {getStatusLabel(updatedOrder.status)}</p>
                </div>
              ),
              variant: "info",
              duration: 4000
            });
          }
          
          if (!oldOrder?.delivery_partner_order_id && updatedOrder.delivery_partner_order_id) {
            devLog.log('✅ تم ربط معرف شركة التوصيل:', updatedOrder.delivery_partner_order_id);
            toast({
              title: "تم ربط الطلب مع شركة التوصيل",
              description: `الطلب ${updatedOrder.qr_id || updatedOrder.order_number} مرتبط الآن مع معرف التوصيل: ${updatedOrder.delivery_partner_order_id}`,
              variant: "success",
              duration: 4000
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [hasPermission, getStatusLabel]);

  // Real-time listeners محسن للطلبات مع منع العودة المضمون
  const deletedOrdersSet = useRef(new Set());
  
  useEffect(() => {

    const handleOrderDeleted = (event) => {
      const orderId = event.detail?.id;
      if (orderId) {
        devLog.log('🗑️ OrdersPage: حذف طلب فوري:', orderId, 'confirmed:', event.detail?.confirmed);
        
        // تسجيل كمحذوف نهائياً
        deletedOrdersSet.current.add(orderId);
        
        // إزالة فورية من القوائم
        setSelectedOrders(prev => prev.filter(id => id !== orderId));
      }
    };

    const handleAiOrderDeleted = (event) => {
      const deletedAiOrderId = event.detail?.id;
      if (deletedAiOrderId) {
        devLog.log('🗑️ OrdersPage: حذف طلب ذكي فوري:', deletedAiOrderId);
        deletedOrdersSet.current.add(deletedAiOrderId);
        setSelectedOrders(prev => prev.filter(id => id !== deletedAiOrderId));
      }
    };

    // مستمعات Real-time للتأكيد النهائي
    const handleOrderDeletedConfirmed = (event) => {
      const deletedOrderId = event.detail?.id;
      if (deletedOrderId) {
        devLog.log('✅ OrdersPage: تأكيد نهائي حذف طلب:', deletedOrderId);
        deletedOrdersSet.current.add(deletedOrderId);
        setSelectedOrders(prev => prev.filter(id => id !== deletedOrderId));
        
        if (event.detail?.final) {
          devLog.log('🔒 طلب محذوف نهائياً - منع العودة:', deletedOrderId);
        }
      }
    };

    const handleAiOrderDeletedConfirmed = (event) => {
      const deletedAiOrderId = event.detail?.id;
      if (deletedAiOrderId) {
        devLog.log('✅ OrdersPage: تأكيد نهائي حذف طلب ذكي:', deletedAiOrderId);
        setSelectedOrders(prev => prev.filter(id => id !== deletedAiOrderId));
      }
    };

    // مستمع لتحديثات الطلبات من QuickOrderContent
    const handleOrderUpdated = (event) => {
      const { id: orderId, updates, timestamp } = event.detail || {};
      if (orderId && updates) {
        devLog.log('🔄 OrdersPage: استلام تحديث طلب:', { orderId, updates, timestamp });
        // تحديث فوري للواجهة عن طريق استدعاء refreshOrders
        if (refreshOrders) {
          devLog.log('🔄 OrdersPage: تنشيط تحديث البيانات');
          refreshOrders();
        }
      }
    };

    // تسجيل المستمعات
    window.addEventListener('orderDeleted', handleOrderDeleted);
    window.addEventListener('aiOrderDeleted', handleAiOrderDeleted);
    window.addEventListener('orderDeletedConfirmed', handleOrderDeletedConfirmed);
    window.addEventListener('aiOrderDeletedConfirmed', handleAiOrderDeletedConfirmed);
    window.addEventListener('orderUpdated', handleOrderUpdated);

    return () => {
      window.removeEventListener('orderDeleted', handleOrderDeleted);
      window.removeEventListener('aiOrderDeleted', handleAiOrderDeleted);
      window.removeEventListener('orderDeletedConfirmed', handleOrderDeletedConfirmed);
      window.removeEventListener('aiOrderDeletedConfirmed', handleAiOrderDeletedConfirmed);
      window.removeEventListener('orderUpdated', handleOrderUpdated);
    };
  }, []);

    useEffect(() => {
    const params = new URLSearchParams(location.search);
    const statusFilter = params.get('status');
    const trackingNumber = params.get('trackingNumber');
    const highlightOrder = params.get('highlight');
    const pendingSalesParam = params.get('pendingSales');
    
    if (statusFilter) {
      setFilters(prev => ({ ...prev, status: statusFilter, period: 'all', archiveSubStatus: 'all' }));
    }
    if (trackingNumber) {
      setFilters(prev => ({ ...prev, searchTerm: trackingNumber, period: 'all', status: 'all', archiveSubStatus: 'all' }));
    }
    if (pendingSalesParam === '1') {
      setFilters(prev => ({ ...prev, status: 'pendingSales', period: 'all', archiveSubStatus: 'all' }));
    }
    
    if (highlightOrder && orders) {
      // البحث عن الطلب المحدد وتعيينه كمحدد
      const order = orders.find(o => o.id === highlightOrder);
      if (order) {
        setSelectedOrder(order);
        setDialogs(prev => ({ ...prev, details: true }));
        // إزالة parameter من URL
        const newParams = new URLSearchParams(location.search);
        newParams.delete('highlight');
        navigate(`${location.pathname}?${newParams.toString()}`, { replace: true });
      }
    }
  }, [location.search, orders, navigate, location.pathname]);

  const pageConfig = {
    title: 'متابعة الطلبات',
    description: 'إدارة ومتابعة جميع الطلبات والشحنات.',
    icon: ShoppingCart,
    permission: 'view_orders',
  };

  // تم تحريك usersMap للأعلى لتجنب مشكلة "Cannot access uninitialized variable"

  // جلب رمز الموظف لفلترة طلبات الذكاء الاصطناعي للموظف
  useEffect(() => {
    const fetchEmployeeCode = async () => {
      if (!userUUID || hasPermission('view_all_orders')) return;
      try {
        const { data } = await supabase
          .from('employee_telegram_codes')
          .select('telegram_code')
          .eq('user_id', userUUID)
          .single();
        if (data?.telegram_code) setUserEmployeeCode(String(data.telegram_code).toUpperCase());
      } catch (err) {
        console.error('Error fetching employee telegram_code:', err);
      }
    };
    fetchEmployeeCode();
  }, [user?.user_id, hasPermission]);

  // خيارات الموظفين للمدير
  const employeeOptions = useMemo(() => {
    if (!hasPermission('view_all_orders')) return [];
    const opts = (allUsers || []).map(u => ({ value: u.user_id, label: u.full_name || u.name || u.email || 'مستخدم' }));
    return [{ value: 'all', label: 'كل الموظفين' }, ...opts];
  }, [allUsers, hasPermission]);

  // معرف المدير الرئيسي
  const ADMIN_ID = '91484496-b887-44f7-9e5d-be9db5567604';

  const userOrders = useMemo(() => {
    if (!Array.isArray(orders)) return [];
    
    // للمدير: إظهار طلباته الشخصية فقط في صفحة /my-orders (استبعاد طلبات الموظفين)
    if (hasPermission('view_all_orders')) {
      if (selectedEmployeeId && selectedEmployeeId !== 'all') {
        return orders.filter(order => order.created_by === selectedEmployeeId);
      }
      // فلترة طلبات المدير الشخصية فقط - استبعاد طلبات الموظفين
      return orders.filter(order => order.created_by === ADMIN_ID);
    }
    
    // للموظفين: إظهار طلباتهم فقط
    return orders.filter(order => order.created_by === userUUID);
  }, [orders, userUUID, hasPermission, selectedEmployeeId]);
  
  const userAiOrders = useMemo(() => {
    if (!Array.isArray(aiOrders)) return [];
    if (hasPermission('view_all_orders')) return aiOrders;
    const norm = (v) => (v ?? '').toString().trim().toLowerCase();
    const ids = [userEmployeeCode, user?.employee_code, userUUID, user?.user_id, user?.id].filter(Boolean).map(norm);
    if (ids.length === 0) return [];
    return aiOrders.filter(order => {
      const by = order?.created_by ?? order?.user_id ?? order?.created_by_employee_code ?? order?.order_data?.created_by;
      return ids.includes(norm(by));
    });
  }, [aiOrders, userEmployeeCode, user?.employee_code, hasPermission, user?.user_id, user?.id]);

  const filteredOrders = useMemo(() => {
    let tempOrders;
    if (filters.status === 'archived') {
      // في الأرشيف، إظهار فقط:
      // 1. الطلبات المؤرشفة حقاً 
      // 2. الطلبات المكتملة مع استلام فاتورة (محلية أو خارجية)
      // 3. الطلبات الراجعة للمخزن
      tempOrders = userOrders.filter(o => {
        const isLocalOrder = !o.tracking_number || o.tracking_number.startsWith('RYUS-') || o.delivery_partner === 'محلي';
        const isExplicitlyArchived = o.isArchived === true || o.is_archived === true || o.isarchived === true;
        const isCompletedWithReceipt = o.status === 'completed' && o.receipt_received === true;
        const isReturnedToStock = o.status === 'returned_in_stock';
        
        // شركة التوصيل: أرشفة فقط عند completed + receipt_received
        // لا تؤرشف الطلبات المُسلّمة بدون استلام فاتورة
        const isExternalArchived = !isLocalOrder && isCompletedWithReceipt;
        
        return isExplicitlyArchived || isCompletedWithReceipt || isReturnedToStock || isExternalArchived;
      });
      
      devLog.log('🗂️ تشخيص الأرشيف - العدد:', tempOrders.length, 'الطلبات:', tempOrders.map(o => ({
        orderNumber: o.order_number,
        status: o.status,
        deliveryStatus: o.delivery_status,
        receiptReceived: o.receipt_received,
        isLocalOrder: !o.tracking_number || o.tracking_number.startsWith('RYUS-') || o.delivery_partner === 'محلي'
      })));
    } else {
      // إخفاء الطلبات المؤرشفة والمكتملة مع فاتورة والراجعة للمخزن من القائمة العادية
      tempOrders = userOrders.filter(o => {
        const isLocalOrder = !o.tracking_number || o.tracking_number.startsWith('RYUS-') || o.delivery_partner === 'محلي';
        const isExplicitlyArchived = o.isArchived === true || o.is_archived === true || o.isarchived === true;
        const isCompletedWithReceipt = o.status === 'completed' && o.receipt_received === true;
        const isReturnedToStock = o.status === 'returned_in_stock';
        
        // شركة التوصيل: إخفاء الطلبات المكتملة مع فاتورة فقط
        // الطلبات المُسلّمة بدون فاتورة تبقى في القائمة العادية
        const isExternalArchived = !isLocalOrder && isCompletedWithReceipt;
        
        return !isExplicitlyArchived && !isCompletedWithReceipt && !isReturnedToStock && !isExternalArchived;
      });
    }

    // تطبيق فلتر الوقت أولاً
    if (filters.period !== 'all') {
      tempOrders = filterOrdersByPeriod(tempOrders, filters.period);
    }
    
    return tempOrders.filter(order => {
      const { searchTerm, status, archiveSubStatus } = filters;
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      const customerInfo = order.customerinfo || {
        name: order.customer_name,
        phone: order.customer_phone
      };
      const matchesSearch = (
        (customerInfo.name || order.customer_name || '').toLowerCase().includes(lowerCaseSearchTerm) ||
        (order.tracking_number || '').toLowerCase().includes(lowerCaseSearchTerm) ||
        (order.trackingnumber || '').toLowerCase().includes(lowerCaseSearchTerm) ||
        (order.qr_id || '').toLowerCase().includes(lowerCaseSearchTerm) ||
        (order.order_number || '').toLowerCase().includes(lowerCaseSearchTerm) ||
        (customerInfo.phone || order.customer_phone || '').includes(searchTerm)
      );
      
      // Helpers لمنطق المبيعات المعلقة
      const isExternal = (o) => o?.tracking_number && !String(o.tracking_number).startsWith('RYUS-') && o?.delivery_partner !== 'محلي';
      const isDeliveredExternal = (o) => {
        const s = (o?.delivery_status || '').toString().toLowerCase();
        return /تسليم|مسلم|deliver/i.test(s) || o?.status === 'delivered' || o?.status === 'completed';
      };
      const isCancelledExternal = (o) => /رفض|ملغي|إلغاء|reject|cancel/i.test((o?.delivery_status||'')) || o?.status === 'cancelled';
      const isReturnFinalExternal = (o) => /راجع|مرجع|إرجاع|return/i.test((o?.delivery_status||'')) || o?.status === 'returned' || o?.status === 'returned_in_stock';
      const isPendingSale = (o) => {
        if (isExternal(o)) {
          if (isDeliveredExternal(o) || isCancelledExternal(o) || isReturnFinalExternal(o)) return false;
          if (o?.status === 'pending') return false; // استبعاد قيد التجهيز
          return true; // أي حالة قبل التسليم تعتبر معلّقة
        }
        return o?.status === 'shipped' || o?.status === 'delivery';
      };

      let matchesStatus = true;
      
      if (status === 'archived') {
        // في الأرشيف، تطبيق فلتر فرعي للحالة داخل الطلبات المؤرشفة فقط
        if (archiveSubStatus === 'all') {
          matchesStatus = true; // إظهار جميع الطلبات المؤرشفة
        } else {
          matchesStatus = order.status === archiveSubStatus;
        }
      } else if (status === 'all') {
        // إظهار جميع الطلبات في الحالة المحددة (أرشيف أم لا)
        matchesStatus = true;
      } else if (status === 'pendingSales') {
        matchesStatus = isPendingSale(order);
      } else {
        // فلترة حسب الحالة المحددة - فقط للطلبات غير المؤرشفة
        matchesStatus = order.status === status;
      }

      return matchesSearch && matchesStatus;
    }).map(order => ({
      ...order,
      created_by_name: usersMap.get(order.created_by) || 'غير معروف'
    }));
  }, [userOrders, filters, usersMap]);

  // ✅ الطلبات القابلة للمزامنة - فقط النشطة (ليست مكتملة أو مرجعة)
  const syncableOrders = useMemo(() => {
    if (!filteredOrders || !Array.isArray(filteredOrders)) return [];
    
    return filteredOrders.filter(order => {
      // فقط طلبات الوسيط
      if (order.delivery_partner !== 'alwaseet') return false;
      
      // ✅ استبعاد الحالات النهائية
      const terminalStatuses = ['completed', 'returned_in_stock'];
      if (terminalStatuses.includes(order.status)) return false;
      
      // ✅ استبعاد delivery_status = '17' فقط (راجع للتاجر) - النهائية الوحيدة
      // الحالة 4 (تم التسليم) ليست نهائية - قد يحدث إرجاع أو تسليم جزئي بعدها
      if (order.delivery_status === '17') return false;
      
      return true;
    });
  }, [filteredOrders]);

  // ✅ مزامنة مرة واحدة فقط عند فتح الصفحة - للطلبات الظاهرة فقط
  useEffect(() => {
    const performInitialSync = async () => {
      if (!syncableOrders || syncableOrders.length === 0) {
        devLog.log('⏭️ [OrdersPage] لا توجد طلبات ظاهرة نشطة للمزامنة');
        return;
      }
      
      // ✅ تم إزالة syncAndApplyOrders لأنه يسبب حذف خاطئ
      // المزامنة تتم الآن عبر syncVisibleOrdersBatch فقط في useEffect أعلاه
      devLog.log(`✅ [OrdersPage] تم تحميل ${syncableOrders.length} طلب ظاهر نشط`);
    };
    
    // مزامنة مرة واحدة فقط عند تحميل الصفحة
    performInitialSync();
  }, []); // ✅ dependencies فارغة = مرة واحدة فقط عند فتح الصفحة

  // ✅ المرحلة 4: تخزين الطلبات الظاهرة في window للوصول إليها من performSyncWithCountdown
  useEffect(() => {
    if (activeTab === 'orders' && syncableOrders && syncableOrders.length > 0) {
      // تخزين الطلبات الظاهرة في window لاستخدامها في المزامنة
      window.__visibleOrdersForSync = syncableOrders;
      devLog.log(`✅ [OrdersPage] حفظ ${syncableOrders.length} طلب ظاهر للمزامنة`);
    } else {
      // مسح الطلبات الظاهرة عند مغادرة تبويب الطلبات
      window.__visibleOrdersForSync = null;
    }
    
    return () => {
      // تنظيف عند unmount
      window.__visibleOrdersForSync = null;
    };
  }, [syncableOrders, activeTab]);


  const myProfits = useMemo(() => {
    if (hasPermission('view_all_data')) {
      // للمديرين: إظهار صافي الربح للنظام من الطلبات المكتملة
      return profitData?.netProfit || 0;
    } else {
      // للموظفين: إظهار إجمالي الأرباح الشخصية من الطلبات المكتملة (تعديل: استخدام البيانات الصحيحة)
      return profitData?.totalPersonalProfit || profitData?.personalTotalProfit || 0;
    }
  }, [profitData, hasPermission]);

  // حساب الأرباح الحقيقية للموظف من جدول profits مباشرة
  const userActualProfits = useMemo(() => {
    if (hasPermission('view_all_data')) {
      return profitData?.netProfit || 0;
    } else {
      // للموظفين: حساب الأرباح الحقيقية من UnifiedProfitDisplay (تعديل: استخدام البيانات الصحيحة)
      return profitData?.totalPersonalProfit || profitData?.personalTotalProfit || 0;
    }
  }, [profitData, hasPermission]);
  

  const handleViewOrder = useCallback((order) => {
    setSelectedOrder(order);
    setDialogs(d => ({ ...d, details: true }));
  }, []);

  const handleEditOrder = useCallback((order) => {
    setSelectedOrder(order);
    setDialogs(d => ({ ...d, edit: true }));
  }, []);

  const handleUpdateOrderStatus = useCallback(async (orderId, newStatus) => {
    await updateOrder(orderId, { status: newStatus });
  }, [updateOrder]);
  
  const handleArchiveSelected = async () => {
    for (const orderId of selectedOrders) {
      await updateOrder(orderId, { isArchived: true });
    }
    toast({ title: 'تمت الأرشفة', description: `تمت أرشفة ${selectedOrders.length} طلبات.`, variant: 'success' });
    setSelectedOrders([]);
    setDialogs(d => ({ ...d, archiveAlert: false }));
  }

  const handleDeleteSelected = useCallback(async (ordersToDelete) => {
    if(!hasPermission('delete_local_orders')) {
      toast({ title: 'خطأ في الصلاحيات', description: 'لا تمتلك صلاحية حذف الطلبات.', variant: 'destructive' });
      return;
    }

    // تطبيع المدخلات للتأكد من أنها مصفوفة من IDs
    const normalizeToIds = (input) => {
      if (!input) return [];
      if (Array.isArray(input)) {
        return input.filter(item => {
          if (typeof item === 'string') return true;
          if (typeof item === 'object' && item?.id) return true;
          return false;
        }).map(item => typeof item === 'string' ? item : item.id);
      }
      if (typeof input === 'string') return [input];
      if (typeof input === 'object' && input?.id) return [input.id];
      return [];
    };

    const orderIds = normalizeToIds(ordersToDelete);
    devLog.log('🗑️ معرفات الطلبات المطلوب حذفها:', orderIds);
    
    const ordersToDeleteFiltered = orderIds.filter(id => 
      !deletedOrdersSet.current.has(id) && 
      orders.some(o => o.id === id)
    );
    
    if (ordersToDeleteFiltered.length === 0) {
      devLog.log('⚠️ لا توجد طلبات صالحة للحذف');
      toast({ title: 'لا توجد طلبات صالحة للحذف', variant: 'destructive' });
      return;
    }
    
    // Optimistic UI فوري
    setSelectedOrders([]);
    setDialogs(d => ({ ...d, deleteAlert: false }));
    
    // إشعار فوري للمستخدم
    toast({
        title: 'جاري الحذف...',
        description: `حذف ${ordersToDeleteFiltered.length} طلب فورياً`,
        variant: 'success'
    });
    
    try {
        // حذف الطلبات مع نظام الحذف المضمون الجديد
        const result = await deleteOrdersContext(ordersToDeleteFiltered);
        
        if (result && result.success) {
            devLog.log('✅ حذف طلبات مكتمل بنجاح');
            toast({
                title: 'تم الحذف بنجاح',
                description: `تم حذف ${ordersToDeleteFiltered.length} طلب نهائياً وتحرير المخزون.`,
                variant: 'success'
            });
        } else {
            throw new Error(result?.error || 'فشل الحذف');
        }
    } catch (error) {
        console.error('💥 خطأ في حذف الطلبات:', error);
        toast({
            title: 'خطأ في الحذف',
            description: 'حدث خطأ أثناء حذف الطلبات. يتم المحاولة مرة أخرى...',
            variant: 'destructive'
        });
        
        // استعادة محدودة في حالة الفشل
        try {
            await refetchProducts();
        } catch (refreshError) {
            console.error('فشل استعادة البيانات:', refreshError);
        }
    }
  }, [hasPermission, orders, deleteOrdersContext]);

  const handleStatCardClick = useCallback((status, period) => {
    setFilters(prev => ({ ...prev, status, period: period || 'all' }));
  }, []);
  
  const handleToolbarFilterChange = useCallback((newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  const handleViewModeChange = useCallback((newViewMode) => {
    setViewMode(newViewMode);
  }, []);

  const handleReceiveReturn = useCallback((order) => {
    setSelectedOrder(order);
    setDialogs(d => ({ ...d, returnReceipt: true }));
  }, []);


  const profitsPagePath = '/profits-summary';

  return (
    <>
      <Helmet>
        <title>{pageConfig.title} - نظام RYUS</title>
        <meta name="description" content={pageConfig.description} />
      </Helmet>

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <OrdersHeader title={pageConfig.title} description={pageConfig.description} icon={pageConfig.icon} />
            
        </div>
        
         <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-6">
           <div className="col-span-1 lg:col-span-3">
             <OrdersStats 
                orders={userOrders} 
                aiOrders={userAiOrders} 
                onAiOrdersClick={() => setDialogs(d => ({ ...d, aiManager: true }))}
                onStatCardClick={handleStatCardClick}
                globalPeriod={filters.period}
             />
           </div>
              {hasPermission('view_all_data') && user?.id !== '91484496-b887-44f7-9e5d-be9db5567604' && (
                <div className="col-span-1 lg:col-span-1">
                  <StatCard 
                    title="صافي ربح النظام"
                    value={userActualProfits || myProfits}
                    format="currency"
                    icon={DollarSign} 
                    colors={['green-500', 'emerald-500']}
                    onClick={() => navigate(profitsPagePath)}
                    periods={{ all: 'الطلبات المكتملة' }}
                    currentPeriod="all"
                  />
                </div>
              )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="orders">الطلبات</TabsTrigger>
            <TabsTrigger value="invoices">فواتير شركة التوصيل</TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="space-y-6">
            <OrdersToolbar
              filters={filters} 
              onFiltersChange={handleToolbarFilterChange}
              viewMode={viewMode}
              onViewModeChange={handleViewModeChange}
              onOrderFound={(foundOrder) => {
                setSelectedOrder(foundOrder);
                setDialogs(prev => ({ ...prev, details: true }));
              }}
              onUpdateOrderStatus={handleUpdateOrderStatus}
              employeeOptions={employeeOptions}
              selectedEmployeeId={selectedEmployeeId}
              onEmployeeChange={setSelectedEmployeeId}
            />
            
            {selectedOrders.length > 0 && hasPermission('manage_orders') && (
              <Card className="p-3 sm:p-4 bg-card rounded-lg border">
                <CardContent className="p-0 flex flex-col sm:flex-row items-start sm:items-center justify-between w-full gap-2">
                  <p className="font-medium text-sm">
                    {selectedOrders.length} طلبات محددة
                  </p>
                  <div className="flex gap-2 w-full sm:w-auto">
                    {filters.status !== 'archived' && (
                      <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={() => setDialogs(d => ({ ...d, archiveAlert: true }))}>
                        <Archive className="w-4 h-4 ml-2" />
                        أرشفة
                      </Button>
                    )}
                    {hasPermission('delete_local_orders') && (
                        <Button variant="destructive" size="sm" className="flex-1 sm:flex-none" onClick={() => setDialogs(d => ({ ...d, deleteAlert: true }))}>
                          <Trash2 className="w-4 h-4 ml-2" />
                          حذف
                        </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <OrderList
              orders={filteredOrders}
              isLoading={inventoryLoading}
              onViewOrder={handleViewOrder}
              onEditOrder={handleEditOrder}
              onUpdateStatus={handleUpdateOrderStatus}
              onReceiveReturn={handleReceiveReturn}
              selectedOrders={selectedOrders}
              setSelectedOrders={setSelectedOrders}
              onDeleteOrder={handleDeleteSelected}
              profits={allProfits || []}
              viewMode={viewMode}
            />
          </TabsContent>

          <TabsContent value="invoices">
            <AlWaseetInvoicesTab />
          </TabsContent>

          <TabsContent value="integration">
            <div className="p-8 text-center">
              <div className="max-w-md mx-auto space-y-4">
                <div className="text-6xl mb-4">🚀</div>
                <h3 className="text-xl font-semibold text-foreground">مزامنة محسّنة</h3>
                <p className="text-muted-foreground">
                  تم نقل المزامنة إلى الشريط العلوي لتجربة أفضل. 
                  ستجد زر المزامنة الشامل الجديد في أعلى الصفحة.
                </p>
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-sm">
                  <p className="font-medium text-primary mb-2">المزايا الجديدة:</p>
                  <ul className="text-right text-muted-foreground space-y-1">
                    <li>• مزامنة شاملة لجميع حالات الطلبات</li>
                    <li>• مزامنة تلقائية كل 15 ثانية</li>
                    <li>• تصميم احترافي متقدم</li>
                    <li>• بدون إشعارات مزعجة</li>
                  </ul>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="status-mapping">
            <div className="p-4 text-center text-muted-foreground">
              قريباً - خريطة حالات التوصيل
            </div>
          </TabsContent>
        </Tabs>

        <OrderDetailsDialog
          order={selectedOrder}
          open={dialogs.details}
          onOpenChange={(open) => setDialogs(d => ({ ...d, details: open }))}
          onUpdate={updateOrder}
          onEditOrder={handleEditOrder}
          canEditStatus={hasPermission('manage_orders') || (selectedOrder?.created_by === user?.id)}
          sellerName={selectedOrder ? usersMap.get(selectedOrder.created_by) : null}
        />

        <EditOrderDialog
          order={selectedOrder}
          open={dialogs.edit}
          onOpenChange={(open) => setDialogs(d => ({ ...d, edit: open }))}
          onOrderUpdated={async () => {
            setDialogs(d => ({ ...d, edit: false }));
            await refetchProducts();
          }}
        />
        
        <QuickOrderDialog
          open={dialogs.quickOrder}
          onOpenChange={(open) => setDialogs(d => ({ ...d, quickOrder: open }))}
          onOrderCreated={async () => {
              setDialogs(d => ({ ...d, quickOrder: false }));
              await refetchProducts();
          }}
        />
        
        <AnimatePresence>
          {dialogs.aiManager && (
            <AiOrdersManager onClose={() => setDialogs(d => ({ ...d, aiManager: false }))} />
          )}
        </AnimatePresence>

        <AlertDialog open={dialogs.deleteAlert} onOpenChange={(open) => setDialogs(d => ({...d, deleteAlert: open}))}>
            <AlertDialogTrigger asChild><span/></AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
                    <AlertDialogDescription>
                        هذا الإجراء سيقوم بحذف الطلبات المحددة نهائياً. لا يمكن التراجع عن هذا الإجراء.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDeleteSelected(selectedOrders)}>حذف</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        <AlertDialog open={dialogs.archiveAlert} onOpenChange={(open) => setDialogs(d => ({...d, archiveAlert: open}))}>
            <AlertDialogTrigger asChild><span/></AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
                    <AlertDialogDescription>
                        سيتم أرشفة الطلبات المحددة وإخفاؤها من القائمة الرئيسية. يمكنك عرضها من خلال فلتر "المؤرشفة".
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={handleArchiveSelected}>أرشفة</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <ReturnReceiptDialog
          open={dialogs.returnReceipt}
          onClose={() => setDialogs(d => ({ ...d, returnReceipt: false }))}
          order={selectedOrder}
          onSuccess={async () => {
            await refetchProducts();
            toast({
              title: "تم استلام الراجع",
              description: "تم إرجاع المنتجات إلى المخزون بنجاح",
              variant: "success"
            });
          }}
        />

      </div>
    </>
  );
};

export default OrdersPage;