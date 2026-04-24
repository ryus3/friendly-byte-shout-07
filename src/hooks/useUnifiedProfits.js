import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useSuper } from '@/contexts/SuperProvider';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { useUnifiedPermissionsSystem as usePermissions } from '@/hooks/useUnifiedPermissionsSystem.jsx';
import { parseISO, isValid, startOfMonth, endOfMonth, startOfWeek, startOfYear, subDays, startOfDay, endOfDay } from 'date-fns';
import { isPendingStatus } from '@/utils/profitStatusHelper';
import devLog from '@/lib/devLogger';

/**
 * هوك موحد لجلب بيانات الأرباح - يستخدم نفس منطق AccountingPage
 * يضمن عرض نفس البيانات بطريقتين مختلفتين في التصميم
 */
export const useUnifiedProfits = (timePeriod = 'all', supervisedEmployeeIds = []) => {
  const { orders, accounting, products, profits: contextProfits } = useSuper();
  const { user: currentUser, allUsers } = useAuth();
  const { isAdmin, isDepartmentManager } = usePermissions();
  const [profitData, setProfitData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [allProfits, setAllProfits] = useState([]);

  // دالة للحصول على ربح النظام من الطلب
  const getSystemProfitFromOrder = (orderId, allProfits) => {
    const orderProfits = allProfits?.find(p => p.order_id === orderId);
    if (!orderProfits) return 0;
    return (orderProfits.profit_amount || 0) - (orderProfits.employee_profit || 0);
  };

  const fetchUnifiedProfitData = async () => {
    try {
      setLoading(true);
      setError(null);

      // جلب بيانات الأرباح: استخدم بيانات المزود الموحد أولاً لتفادي قيود RLS، ثمFallback إلى Supabase
      let profitsData = Array.isArray(contextProfits) ? contextProfits : [];
      if (!profitsData || profitsData.length === 0) {
        const { data } = await supabase
          .from('profits')
          .select(`
            *,
            order:orders(order_number, status, receipt_received),
            employee:profiles!employee_id(full_name)
          `);
        profitsData = data || [];
      }
      setAllProfits(profitsData || []);
      // استخدام نفس منطق AccountingPage
      if (!orders || !Array.isArray(orders)) {
        devLog.warn('⚠️ لا توجد بيانات طلبات');
        setProfitData({
          totalRevenue: 0,
          deliveryFees: 0, 
          salesWithoutDelivery: 0,
          cogs: 0,
          grossProfit: 0,
          netProfit: 0,
          employeeSettledDues: 0,
          managerSales: 0,
          employeeSales: 0,
          chartData: []
        });
        return;
      }

      const safeOrders = Array.isArray(orders) ? orders : [];
      const safeExpenses = Array.isArray(accounting?.expenses) ? accounting.expenses : [];

      // ✅ فلترة الطلبات حسب الصلاحيات أولاً
      let permissionFilteredOrders = safeOrders;
      if (!isAdmin) {
        if (isDepartmentManager && supervisedEmployeeIds.length > 0) {
          // مدير القسم: طلباته + طلبات موظفيه
          permissionFilteredOrders = safeOrders.filter(o => 
            o.created_by === currentUser?.id || supervisedEmployeeIds.includes(o.created_by)
          );
        } else {
          // الموظف العادي: طلباته فقط
          permissionFilteredOrders = safeOrders.filter(o => o.created_by === currentUser?.id);
        }
      }
      // المدير العام يرى الكل (isAdmin = true)

      // تطبيق فلتر الفترة الزمنية
      const now = new Date();
      let dateFrom, dateTo;
      
      switch (timePeriod) {
        case 'today':
          dateFrom = startOfDay(now);
          dateTo = endOfDay(now);
          break;
        case 'week':
          dateFrom = startOfWeek(now, { weekStartsOn: 1 });
          dateTo = now;
          break;
        case 'month':
          dateFrom = startOfMonth(now);
          dateTo = endOfMonth(now);
          break;
        case 'year':
          dateFrom = startOfYear(now);
          dateTo = now;
          break;
        default:
          dateFrom = null;
          dateTo = null;
      }

      devLog.log(`📅 تطبيق فلتر الفترة: ${timePeriod}`, { dateFrom, dateTo });

      const filterByDate = (dateStr) => {
        if (!dateFrom || !dateTo || !dateStr) return true;
        try {
          const itemDate = parseISO(dateStr);
          return isValid(itemDate) && itemDate >= dateFrom && itemDate <= dateTo;
        } catch (e) {
          return true;
        }
      };

      // الطلبات المُستلمة الفواتير وضمن الفترة المحددة
      // ✅ استخدام الطلبات المفلترة حسب الصلاحيات
      const deliveredOrders = permissionFilteredOrders.filter(o => {
        const isDeliveredStatus = o && (o.status === 'delivered' || o.status === 'completed');
        const isReceiptReceived = o.receipt_received === true;
        const isInDateRange = filterByDate(o.updated_at || o.created_at);
        
        return isDeliveredStatus && isReceiptReceived && isInDateRange;
      });

      devLog.log('🔍 Unified Profits - Delivered Orders:', deliveredOrders.length, '(filtered by permissions)');

      const expensesInRange = safeExpenses.filter(e => filterByDate(e.transaction_date)); // فلترة المصاريف حسب الفترة

      // حساب إجمالي الإيرادات
      const totalRevenue = deliveredOrders.reduce((sum, o) => {
        const amount = o.final_amount || o.total_amount || 0;
        return sum + amount;
      }, 0);

      const deliveryFees = deliveredOrders.reduce((sum, o) => sum + (o.delivery_fee || 0), 0);
      const salesWithoutDelivery = totalRevenue - deliveryFees;

      // حساب تكلفة البضاعة المباعة
      const cogs = deliveredOrders.reduce((sum, o) => {
        if (!o.order_items || !Array.isArray(o.order_items)) return sum;
        
        const orderCogs = o.order_items.reduce((itemSum, item) => {
          const costPrice = item.product_variants?.cost_price || item.products?.cost_price || 0;
          const quantity = item.quantity || 0;
          return itemSum + (costPrice * quantity);
        }, 0);
        return sum + orderCogs;
      }, 0);

      const grossProfit = salesWithoutDelivery - cogs;

      // حساب ربح النظام (نفس منطق AccountingPage)
      const managerOrdersInRange = deliveredOrders.filter(o => !o.created_by || o.created_by === currentUser?.id);
      const employeeOrdersInRange = deliveredOrders.filter(o => o.created_by && o.created_by !== currentUser?.id);

      const managerTotalProfit = managerOrdersInRange.reduce((sum, order) => {
        if (!order.order_items || !Array.isArray(order.order_items)) return sum;
        const orderProfit = order.order_items.reduce((itemSum, item) => {
          const sellPrice = item.unit_price || 0;
          const costPrice = item.product_variants?.cost_price || item.products?.cost_price || 0;
          const quantity = item.quantity || 0;
          return itemSum + ((sellPrice - costPrice) * quantity);
        }, 0);
        return sum + orderProfit;
      }, 0);

      // حساب ربح النظام من طلبات الموظفين
      const employeeSystemProfit = employeeOrdersInRange.reduce((sum, order) => {
        return sum + getSystemProfitFromOrder(order.id, profitsData || []);
      }, 0);

      const systemProfit = managerTotalProfit + employeeSystemProfit;

      // المصاريف العامة - مع استثناء مصاريف أصحاب المراكز المالية
      const financialCenterUserIds = allUsers?.filter(u => u.has_financial_center).map(u => u.user_id || u.id) || [];
      const generalExpenses = expensesInRange.filter(e => {
        const isSystem = e.expense_type === 'system';
        const isEmployeeDue = (
          e.category === 'مستحقات الموظفين' ||
          e.related_data?.category === 'مستحقات الموظفين' ||
          e.metadata?.category === 'مستحقات الموظفين'
        );
        const isPurchaseRelated = (
          e.related_data?.category === 'شراء بضاعة' ||
          e.metadata?.category === 'شراء بضاعة'
        );
        if (isSystem) return false;
        if (isEmployeeDue) return false;
        if (isPurchaseRelated) return false;
        // استثناء مصاريف الموظفين أصحاب المراكز المالية
        if (financialCenterUserIds.includes(e.created_by)) return false;
        return true;
      }).reduce((sum, e) => sum + (e.amount || 0), 0);

      // مستحقات الموظفين المسددة
      const employeeSettledDues = expensesInRange.filter(e => {
        const isEmployeeDue = (
          e.category === 'مستحقات الموظفين' ||
          e.related_data?.category === 'مستحقات الموظفين' ||
          e.metadata?.category === 'مستحقات الموظفين'
        );
        const isApproved = e.status ? e.status === 'approved' : true;
        return isApproved && isEmployeeDue;
      }).reduce((sum, e) => sum + (e.amount || 0), 0);

      // مستحقات الموظفين المعلقة من جدول الأرباح - للموظف الحالي فقط
      const employeePendingDues = profitsData.filter(profit => {
        // استخدام دالة موحدة لفحص الحالات المعلقة
        if (!isPendingStatus(profit.status)) return false;
        
        // فقط أرباح الموظف الحالي
        if (profit.employee_id !== currentUser?.id && profit.employee_id !== currentUser?.user_id) return false;
        
        // تطبيق فلترة الفترة الزمنية
        const orderFromAll = safeOrders.find(o => o.id === profit.order_id);
        const isInDateRange = orderFromAll && filterByDate(orderFromAll.updated_at || orderFromAll.created_at);
        
        // التأكد من أن الطلب مسلم وضمن الفترة الزمنية
        const order = deliveredOrders.find(o => o.id === profit.order_id);
        return (order || (orderFromAll && 
          (orderFromAll.status === 'delivered' || orderFromAll.status === 'completed'))) && isInDateRange;
      }).reduce((sum, profit) => sum + (profit.employee_profit || 0), 0);

      // حساب أرباح المدير المعلقة من جدول الأرباح
      const managerPendingProfits = profitsData.filter(profit => {
        // فقط الأرباح المعلقة أو المستلمة الفواتير (غير المسوّاة)
        const isPendingOrInvoiceReceived = profit.status === 'pending' || profit.status === 'invoice_received';
        if (!isPendingOrInvoiceReceived) return false;

        // فقط أرباح المدير (employee_percentage = 0)
        if (profit.employee_percentage !== 0) return false;

        // تطبيق فلترة الفترة الزمنية
        const orderFromAll = safeOrders.find(o => o.id === profit.order_id);
        const isInDateRange = orderFromAll && filterByDate(orderFromAll.updated_at || orderFromAll.created_at);
        
        // التأكد من أن الطلب مسلم ومستلم الفاتورة (أو معلق) وضمن الفترة الزمنية
        const order = deliveredOrders.find(o => o.id === profit.order_id);
        return (order || (orderFromAll && 
          (orderFromAll.status === 'delivered' || orderFromAll.status === 'completed'))) && isInDateRange;
      }).reduce((sum, profit) => sum + (profit.profit_amount || 0), 0);

      // حساب أرباح النظام المعلقة من طلبات الموظفين
      const employeeSystemPendingProfits = profitsData.filter(profit => {
        // فقط الأرباح المعلقة أو المستلمة الفواتير (غير المسوّاة)
        const isPendingOrInvoiceReceived = profit.status === 'pending' || profit.status === 'invoice_received';
        if (!isPendingOrInvoiceReceived) return false;

        // فقط أرباح الموظفين (employee_percentage > 0)
        if (profit.employee_percentage === 0) return false;

        // تطبيق فلترة الفترة الزمنية
        const orderFromAll = safeOrders.find(o => o.id === profit.order_id);
        const isInDateRange = orderFromAll && filterByDate(orderFromAll.updated_at || orderFromAll.created_at);
        
        // التأكد من أن الطلب مسلم ومستلم الفاتورة (أو معلق) وضمن الفترة الزمنية
        const order = deliveredOrders.find(o => o.id === profit.order_id);
        return (order || (orderFromAll && 
          (orderFromAll.status === 'delivered' || orderFromAll.status === 'completed'))) && isInDateRange;
      }).reduce((sum, profit) => {
        // ربح النظام = إجمالي الربح - ربح الموظف
        return sum + ((profit.profit_amount || 0) - (profit.employee_profit || 0));
      }, 0);

      // إجمالي الأرباح المعلقة للنظام (موظفين + مدير)
      const totalSystemPendingProfits = employeePendingDues + managerPendingProfits + employeeSystemPendingProfits;

      // صافي الربح
      const netProfit = systemProfit - generalExpenses;

      // مبيعات المدير والموظفين
      const managerSales = managerOrdersInRange.reduce((sum, o) => {
        const orderTotal = o.final_amount || o.total_amount || 0;
        const deliveryFee = o.delivery_fee || 0;
        return sum + (orderTotal - deliveryFee);
      }, 0);

      const employeeSales = employeeOrdersInRange.reduce((sum, o) => {
        const orderTotal = o.final_amount || o.total_amount || 0;
        const deliveryFee = o.delivery_fee || 0;
        return sum + (orderTotal - deliveryFee);
      }, 0);

      // بيانات الرسم البياني
      const chartData = [
        { name: 'الإيرادات', value: totalRevenue },
        { name: 'التكاليف', value: cogs + generalExpenses },
        { name: 'صافي الربح', value: netProfit }
      ];

      const resultData = {
        totalRevenue,
        deliveryFees,
        salesWithoutDelivery,
        cogs,
        grossProfit,
        netProfit,
        generalExpenses, // إضافة المصاريف العامة
        employeeSettledDues,
        employeePendingDues, // أرباح الموظفين المعلقة فقط
        managerPendingProfits, // أرباح المدير المعلقة
        totalSystemPendingProfits, // إجمالي أرباح النظام المعلقة
        managerSales,
        employeeSales,
        chartData
      };

      devLog.log('💰 Unified Profits Result:', resultData);
      devLog.log('💰 Net Profit Value:', netProfit);
      setProfitData(resultData);

    } catch (error) {
      console.error('Error fetching unified profit data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orders && Array.isArray(orders) && orders.length > 0) {
      fetchUnifiedProfitData();
    }
  }, [orders, accounting, currentUser?.id, timePeriod, contextProfits, isAdmin, isDepartmentManager, supervisedEmployeeIds]);

  // دالة لإعادة تحميل البيانات
  const refreshData = () => {
    fetchUnifiedProfitData();
  };

  return {
    profitData,
    loading,
    error,
    refreshData,
    allProfits
  };
};

export default useUnifiedProfits;