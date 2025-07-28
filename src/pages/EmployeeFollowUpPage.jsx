import React, { useState, useMemo, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useInventory } from '@/contexts/InventoryContext';
import { useProfits } from '@/contexts/ProfitsContext';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import OrderList from '@/components/orders/OrderList';
import Loader from '@/components/ui/loader';
import { ShoppingCart, DollarSign, Users, Hourglass, CheckCircle, RefreshCw, Loader2, Archive, Bell } from 'lucide-react';

import OrderDetailsDialog from '@/components/orders/OrderDetailsDialog';
import StatCard from '@/components/dashboard/StatCard';
import SettledDuesDialog from '@/components/accounting/SettledDuesDialog';
import EmployeeSettlementCard from '@/components/orders/EmployeeSettlementCard';
import PendingSettlementRequestsDialog from '@/components/dashboard/PendingSettlementRequestsDialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';

const EmployeeFollowUpPage = () => {
  const navigate = useNavigate();
  const { allUsers } = useAuth();
  const { hasPermission } = usePermissions();
  const { 
    orders, 
    loading, 
    calculateManagerProfit, 
    calculateProfit, 
    updateOrder, 
    refetchProducts, 
    settlementInvoices, 
    deleteOrders 
  } = useInventory();
  const { profits } = useProfits();
  const [searchParams] = useSearchParams();
  
  // استخراج parameters من URL - مع دعم أفضل للـ parameters
  const [employeeFromUrl, setEmployeeFromUrl] = useState(null);
  const [ordersFromUrl, setOrdersFromUrl] = useState(null);  
  const [highlightFromUrl, setHighlightFromUrl] = useState(null);
  const filterFromUrl = searchParams.get('filter');
  
  // استخراج المعاملات من URL - بدون تطبيق فوري
  useEffect(() => {
    const employeeParam = searchParams.get('employee');
    const ordersParam = searchParams.get('orders');
    const highlightParam = searchParams.get('highlight');
    
    console.log('🔔 URL parameters extracted:', {
      employeeParam,
      ordersParam,
      highlightParam
    });
    
    setEmployeeFromUrl(employeeParam);
    setOrdersFromUrl(ordersParam);
    setHighlightFromUrl(highlightParam);
  }, [searchParams]);

  // تطبيق الفلترة بعد تحميل البيانات
  useEffect(() => {
    if (orders && employeeFromUrl && highlightFromUrl === 'settlement') {
      console.log('✅ تطبيق فلترة التحاسب بعد تحميل البيانات');
      
      setFilters({
        status: 'all',
        archived: false,
        employeeId: employeeFromUrl,
        profitStatus: 'pending'
      });
      
      if (ordersFromUrl) {
        const ordersList = ordersFromUrl.split(',');
        setSelectedOrders(ordersList);
        
        setTimeout(() => {
          toast({
            title: "طلب تحاسب",
            description: `تم فلترة الطلبات للموظف. يمكنك الآن دفع المستحقات.`,
            duration: 4000
          });
        }, 1000);
      }
    }
  }, [orders, employeeFromUrl, ordersFromUrl, highlightFromUrl]); // تطبيق الفلترة عندما تتوفر البيانات
  
  const [filters, setFilters] = useState({
    status: 'all',
    employeeId: 'all', // سيتم تحديثه عبر useEffect
    archived: false,
    profitStatus: 'all', // سيتم تحديثه عبر useEffect
  });
  
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isDuesDialogOpen, setIsDuesDialogOpen] = useState(false);
  const [isSettlementRequestsOpen, setIsSettlementRequestsOpen] = useState(false);
  
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
  
  // إعداد تأثير URL parameters
  useEffect(() => {
    console.log('🔄 URL Parameters:', { 
      highlightFromUrl, 
      employeeFromUrl, 
      ordersFromUrl,
      filterFromUrl,
      allParamsReceived: !!(highlightFromUrl && employeeFromUrl && ordersFromUrl)
    });
    
    if (highlightFromUrl === 'settlement') {
      if (employeeFromUrl && ordersFromUrl) {
        // طلب تحاسب محدد من الإشعار
        console.log('⚡ معالجة طلب التحاسب من الإشعار');
        
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
        
        // إضافة toast لتوضيح الإجراء المطلوب
        setTimeout(() => {
          toast({
            title: "طلب تحاسب جاهز!",
            description: `تم تحديد ${orderList.length} طلب للموظف. ستجد كارت التحاسب أدناه - اضغط "دفع المستحقات" لإكمال العملية.`,
            variant: "default",
            duration: 8000
          });
        }, 1500);
        
        // التمرير للكارت مع تأثير بصري قوي
        setTimeout(() => {
          const element = document.querySelector(`[data-employee-id="${employeeFromUrl}"]`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // تأثير بصري مميز
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
          } else {
            console.warn('⚠️ لم يتم العثور على كارت الموظف');
          }
        }, 2000);
      } else {
        // إشعار عام للتحاسب - فتح نافذة طلبات التحاسب
        console.log('🔔 فتح نافذة طلبات التحاسب من الإشعار');
        setTimeout(() => {
          setIsSettlementRequestsOpen(true);
        }, 1000);
      }
    }
  }, [highlightFromUrl, employeeFromUrl, ordersFromUrl, filterFromUrl]);

  // قائمة الموظفين النشطين
  const employees = useMemo(() => {
    if (!allUsers || !Array.isArray(allUsers)) return [];
    return allUsers.filter(u => u && u.status === 'active');
  }, [allUsers]);

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

  // معرف المدير الرئيسي - تصفية طلباته
  const ADMIN_ID = '91484496-b887-44f7-9e5d-be9db5567604';

  // الطلبات المفلترة
  const filteredOrders = useMemo(() => {
    // استخدام employeeFromUrl إذا كان متوفراً، وإلا استخدام الفلتر العادي
    const effectiveEmployeeId = employeeFromUrl || filters.employeeId;
    
    console.log('🔄 تفلتر الطلبات:', { 
      ordersLength: orders?.length, 
      filters,
      employeeFromUrl,
      ordersFromUrl,
      highlightFromUrl,
      effectiveEmployeeId // الموظف المؤثر الفعلي
    });
    
    if (!orders || !Array.isArray(orders)) {
      console.log('❌ لا توجد طلبات في البيانات');
      return [];
    }

    console.log('📊 إجمالي الطلبات المتاحة:', orders.length);
    console.log('🎯 الموظف المطلوب:', effectiveEmployeeId);

    const filtered = orders.filter(order => {
      if (!order) {
        console.log('❌ طلب فارغ تم تجاهله');
        return false;
      }
      
      console.log(`🔍 فحص الطلب ${order.order_number || order.id}:`, {
        order_id: order.id,
        created_by: order.created_by,
        effectiveEmployeeId,
        status: order.status,
        isArchived: order.isarchived || order.isArchived,
        hasMatchingEmployee: order.created_by === effectiveEmployeeId
      });
      
      // استبعاد طلبات المدير الرئيسي من الظهور في متابعة الموظفين
      if (order.created_by === ADMIN_ID) {
        console.log(`⚠️ استبعاد طلب المدير: ${order.order_number}`);
        return false;
      }
      
      // فلتر الموظف - استخدام effectiveEmployeeId
      const employeeMatch = effectiveEmployeeId === 'all' || order.created_by === effectiveEmployeeId;
      
      // فلتر الحالة
      const statusMatch = filters.status === 'all' || order.status === filters.status;
      
      // فلتر حالة الربح
      let profitStatusMatch = true;
      if (filters.profitStatus !== 'all') {
        const profitRecord = profits?.find(p => p.order_id === order.id);
        const profitStatus = profitRecord ? (profitRecord.settled_at ? 'settled' : 'pending') : 'pending';
        profitStatusMatch = profitStatus === filters.profitStatus;
      }
      
      // فلتر الأرشيف - إصلاح المنطق
      // المؤرشفة يدوياً فقط، وليس التلقائية
      const isManuallyArchived = order.isarchived === true || order.isArchived === true;
      let archiveMatch;
      
      if (filters.archived) {
        // إذا اختار عرض الأرشيف، اعرض المؤرشفة يدوياً فقط
        archiveMatch = isManuallyArchived;
      } else {
        // إذا لم يختر الأرشيف، اعرض غير المؤرشفة يدوياً (تشمل completed و returned_in_stock)
        archiveMatch = !isManuallyArchived;
      }
      
      const matchResult = employeeMatch && statusMatch && profitStatusMatch && archiveMatch;
      
      // تفصيل كامل لكل طلب
      if (order.created_by === effectiveEmployeeId || effectiveEmployeeId === 'all') {
        console.log(`🔍 طلب ${order.order_number}:`, {
          id: order.id,
          employeeMatch,
          statusMatch, 
          profitStatusMatch,
          archiveMatch,
          isManuallyArchived,
          status: order.status,
          created_by: order.created_by,
          effectiveEmployeeId: effectiveEmployeeId,
          finalMatch: matchResult
        });
      }
      
      return matchResult;
    }).map(order => ({
      ...order,
      created_by_name: usersMap.get(order.created_by) || 'غير معروف'
    }));

    console.log('✅ الطلبات المفلترة النهائية:', {
      count: filtered.length,
      orders: filtered.map(o => ({ id: o.id, number: o.order_number, status: o.status }))
    });
    
    return filtered;
  }, [orders, filters, usersMap, profits]);

  // الإحصائيات
  const stats = useMemo(() => {
    if (!filteredOrders || !Array.isArray(filteredOrders)) {
      return {
        totalOrders: 0,
        totalSales: 0,
        totalManagerProfits: 0,
        pendingDues: 0,
        paidDues: 0
      };
    }

    // الطلبات المسلمة أو المكتملة للإحصائيات
    const deliveredOrders = filteredOrders.filter(o => 
      o && (o.status === 'delivered' || o.status === 'completed')
    );
    
    console.log('📊 الطلبات للإحصائيات:', {
      filteredOrdersCount: filteredOrders.length,
      deliveredOrdersCount: deliveredOrders.length,
      statusBreakdown: filteredOrders.reduce((acc, o) => {
        acc[o.status] = (acc[o.status] || 0) + 1;
        return acc;
      }, {})
    });
    
    const totalSales = deliveredOrders.reduce((sum, order) => 
      sum + (order?.final_amount || order?.total_amount || 0), 0
    );
    
    // أرباح المدير من الموظفين
    const totalManagerProfits = deliveredOrders.reduce((sum, order) => {
      if (calculateManagerProfit && typeof calculateManagerProfit === 'function') {
        return sum + (calculateManagerProfit(order) || 0);
      }
      return sum;
    }, 0);

    // المستحقات المدفوعة (من جدول التسويات)
    const paidDues = settlementInvoices && Array.isArray(settlementInvoices)
      ? settlementInvoices.reduce((sum, inv) => sum + (inv?.total_amount || 0), 0)
      : 0;

    // المستحقات المعلقة - أرباح الموظفين من الطلبات المستلمة فواتيرها ولم تُسوى
    const pendingDues = deliveredOrders
      .filter(order => order.receipt_received === true)
      .reduce((sum, order) => {
        // البحث عن سجل الربح
        const profitRecord = profits?.find(p => p.order_id === order.id);
        let employeeProfit = 0;
        
        if (profitRecord && !profitRecord.settled_at) {
          // إذا كان هناك سجل ربح غير مُسوى
          employeeProfit = profitRecord.employee_profit || 0;
        } else if (!profitRecord) {
          // إذا لم يكن هناك سجل ربح، احسب الربح
          employeeProfit = (order.items || []).reduce((itemSum, item) => {
            return itemSum + (calculateProfit ? calculateProfit(item, order.created_by) : 0);
          }, 0);
        }
        
        return sum + employeeProfit;
      }, 0);

    console.log('📊 الإحصائيات:', {
      totalOrders: filteredOrders.length,
      deliveredOrders: deliveredOrders.length,
      totalSales,
      totalManagerProfits,
      pendingDues,
      paidDues
    });

    return {
      totalOrders: filteredOrders.length,
      totalSales,
      totalManagerProfits,
      pendingDues,
      paidDues
    };
  }, [filteredOrders, calculateManagerProfit, settlementInvoices, profits, calculateProfit]);

  // معالج تغيير الفلاتر
  const handleFilterChange = (name, value) => {
    console.log('🔧 تغيير الفلتر:', { name, value });
    setFilters(prev => ({ ...prev, [name]: value }));
  };
  
  // معالج النقر على كارت الإحصائيات
  const handleStatCardClick = (profitStatus) => {
    setFilters(prev => ({ ...prev, profitStatus, status: 'all' }));
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
        description: `تم حذف الطلب ${order.order_number} وإرجاع المخزون المحجوز.` 
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
    
    selectedOrdersData.forEach(order => {
      if (!employeeGroups[order.created_by]) {
        const employee = employees.find(emp => emp.user_id === order.created_by);
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
    
    return Object.values(employeeGroups);
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
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold gradient-text">متابعة الموظفين</h1>
            <p className="text-muted-foreground">نظرة شاملة على أداء فريق العمل.</p>
          </div>
          
          {/* زر طلبات التحاسب */}
          <Button 
            onClick={() => setIsSettlementRequestsOpen(true)}
            className="relative bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-600 hover:via-teal-600 hover:to-cyan-600 text-white font-bold shadow-2xl hover:shadow-emerald-500/25 transform hover:scale-110 transition-all duration-500 border-0 gap-2 px-6 py-3 rounded-xl overflow-hidden group"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/20 via-teal-400/20 to-cyan-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <Bell className="h-5 w-5 relative z-10 group-hover:animate-pulse" />
            <span className="relative z-10">طلبات التحاسب</span>
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 rounded-full animate-pulse"></div>
          </Button>
        </div>

        {/* الفلاتر */}
        <Card>
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-center">
            <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
              <SelectTrigger>
                <SelectValue placeholder="فلترة حسب الحالة" />
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
              <SelectTrigger>
                <SelectValue placeholder="اختر موظف" />
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
              <SelectTrigger>
                <SelectValue placeholder="حالة الربح" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأرباح</SelectItem>
                <SelectItem value="pending">معلقة</SelectItem>
                <SelectItem value="settled">مسواة</SelectItem>
              </SelectContent>
            </Select>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="archived" 
                checked={filters.archived} 
                onCheckedChange={(checked) => handleFilterChange('archived', checked)} 
              />
              <Label htmlFor="archived" className="cursor-pointer">عرض الأرشيف</Label>
            </div>
          </CardContent>
        </Card>

        {/* الإحصائيات */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <StatCard 
            title="إجمالي الطلبات" 
            value={stats.totalOrders} 
            icon={ShoppingCart} 
            colors={['blue-500', 'sky-500']} 
          />
          <StatCard 
            title="إجمالي المبيعات" 
            value={stats.totalSales} 
            icon={DollarSign} 
            colors={['purple-500', 'violet-500']} 
            format="currency" 
          />
          <StatCard 
            title="أرباحي من الموظفين" 
            value={stats.totalManagerProfits} 
            icon={Users} 
            colors={['green-500', 'emerald-500']} 
            format="currency" 
          />
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

        {/* قائمة الطلبات */}
        <div className="bg-card p-4 rounded-xl border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">
              قائمة الطلبات ({filteredOrders.length})
            </h2>
          </div>

          {/* تنبيه للطلبات الراجعة */}
          {filters.status === 'returned' && !filters.archived && (
            <Card className="mb-4 p-4 bg-secondary rounded-lg border">
              <div className="flex items-center justify-between">
                <p className="font-medium">
                  {selectedOrders.length} طلبات راجعة محددة
                </p>
                <Button onClick={handleReceiveReturned} disabled={selectedOrders.length === 0}>
                  <Archive className="w-4 h-4 ml-2" />
                  استلام الراجع في المخزن
                </Button>
              </div>
            </Card>
          )}

          {/* قائمة الطلبات */}
          <OrderList 
            orders={filteredOrders} 
            isLoading={loading} 
            onViewOrder={handleViewOrder}
            onUpdateStatus={handleUpdateStatus}
            selectedOrders={selectedOrders}
            setSelectedOrders={setSelectedOrders}
            onDeleteOrder={handleDeleteOrder}
            showEmployeeName={filters.employeeId === 'all'}
          />
        </div>

        {/* نوافذ حوارية */}
        <OrderDetailsDialog
          order={selectedOrderDetails}
          open={isDetailsDialogOpen}
          onOpenChange={setIsDetailsDialogOpen}
          onUpdate={updateOrder}
          canEditStatus={hasPermission('manage_orders')}
          sellerName={selectedOrderDetails ? usersMap.get(selectedOrderDetails.created_by) : null}
        />
        
        <SettledDuesDialog
          open={isDuesDialogOpen}
          onOpenChange={setIsDuesDialogOpen}
          invoices={settlementInvoices}
          allUsers={allUsers}
        />
        
        <PendingSettlementRequestsDialog
          open={isSettlementRequestsOpen}
          onClose={() => setIsSettlementRequestsOpen(false)}
          onNavigateToSettlement={handleNavigateToSettlement}
        />
      </motion.div>
    </>
  );
};

export default EmployeeFollowUpPage;