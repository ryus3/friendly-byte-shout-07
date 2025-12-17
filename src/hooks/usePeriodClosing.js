import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { startOfMonth, endOfMonth, startOfYear, endOfYear, startOfQuarter, endOfQuarter, format, subMonths } from 'date-fns';
import { ar } from 'date-fns/locale';

/**
 * Hook لإدارة إغلاق الفترات المالية
 */
export const usePeriodClosing = () => {
  const { toast } = useToast();
  const [closedPeriods, setClosedPeriods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  // جلب الفترات المغلقة
  const fetchClosedPeriods = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('closed_periods')
        .select('*')
        .order('end_date', { ascending: false });

      if (error) throw error;
      setClosedPeriods(data || []);
    } catch (error) {
      console.error('Error fetching closed periods:', error);
      toast({
        title: 'خطأ',
        description: 'فشل في جلب الفترات المغلقة',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchClosedPeriods();
  }, [fetchClosedPeriods]);

  // حساب التواريخ حسب نوع الفترة
  const getPeriodDates = (periodType, customRange = null) => {
    const now = new Date();
    let startDate, endDate, periodName;

    switch (periodType) {
      case 'current_month':
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        periodName = format(now, 'MMMM yyyy', { locale: ar });
        break;
      case 'last_month':
        const lastMonth = subMonths(now, 1);
        startDate = startOfMonth(lastMonth);
        endDate = endOfMonth(lastMonth);
        periodName = format(lastMonth, 'MMMM yyyy', { locale: ar });
        break;
      case 'current_quarter':
        startDate = startOfQuarter(now);
        endDate = endOfQuarter(now);
        const quarterNum = Math.ceil((now.getMonth() + 1) / 3);
        periodName = `الربع ${quarterNum} - ${now.getFullYear()}`;
        break;
      case 'current_year':
        startDate = startOfYear(now);
        endDate = endOfYear(now);
        periodName = `سنة ${now.getFullYear()}`;
        break;
      case 'custom':
        if (!customRange?.from || !customRange?.to) {
          throw new Error('يرجى تحديد نطاق التواريخ');
        }
        startDate = customRange.from;
        endDate = customRange.to;
        periodName = `${format(startDate, 'dd/MM/yyyy')} - ${format(endDate, 'dd/MM/yyyy')}`;
        break;
      default:
        throw new Error('نوع الفترة غير معروف');
    }

    return { startDate, endDate, periodName };
  };

  // حساب بيانات الفترة من الطلبات والحركات
  const calculatePeriodData = async (startDate, endDate) => {
    const start = startDate.toISOString();
    const end = endDate.toISOString();

    // جلب الطلبات المستلمة فاتورتها في الفترة
    const { data: orders } = await supabase
      .from('orders')
      .select(`
        id, final_amount, delivery_fee, status, delivery_status,
        order_items (quantity, unit_price, cost_price),
        profits (employee_profit)
      `)
      .eq('receipt_received', true)
      .gte('receipt_received_at', start)
      .lte('receipt_received_at', end);

    // جلب المصاريف في الفترة
    const { data: expenses } = await supabase
      .from('expenses')
      .select('*')
      .gte('created_at', start)
      .lte('created_at', end);

    // جلب رصيد القاصة في بداية ونهاية الفترة
    const { data: cashSources } = await supabase
      .from('cash_sources')
      .select('current_balance')
      .eq('is_active', true);

    // حسابات الإيرادات
    const deliveredOrders = (orders || []).filter(o => 
      ['delivered', 'completed'].includes(o.status) || o.delivery_status === '4'
    );
    const returnedOrders = (orders || []).filter(o => o.delivery_status === '17');

    const totalRevenue = deliveredOrders.reduce((sum, o) => sum + (o.final_amount || 0), 0);
    const totalDeliveryFees = deliveredOrders.reduce((sum, o) => sum + (o.delivery_fee || 0), 0);
    const salesWithoutDelivery = totalRevenue - totalDeliveryFees;

    // حساب COGS
    let totalCogs = 0;
    deliveredOrders.forEach(order => {
      (order.order_items || []).forEach(item => {
        totalCogs += (item.cost_price || 0) * (item.quantity || 1);
      });
    });

    // حساب ربح الموظفين
    let totalEmployeeProfit = 0;
    deliveredOrders.forEach(order => {
      const profit = order.profits?.[0]?.employee_profit || 0;
      totalEmployeeProfit += profit;
    });

    // حساب المصاريف (باستثناء مستحقات الموظفين والمشتريات)
    const generalExpenses = (expenses || [])
      .filter(e => e.category !== 'مستحقات الموظفين' && e.category !== 'شراء بضاعة')
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    const employeeDuesPaid = (expenses || [])
      .filter(e => e.category === 'مستحقات الموظفين')
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    // الأرباح
    const grossProfit = salesWithoutDelivery - totalCogs;
    const netProfit = grossProfit - generalExpenses;

    // النسب
    const grossProfitMargin = salesWithoutDelivery > 0 ? (grossProfit / salesWithoutDelivery) * 100 : 0;
    const netProfitMargin = salesWithoutDelivery > 0 ? (netProfit / salesWithoutDelivery) * 100 : 0;

    // الرصيد الحالي
    const closingCashBalance = (cashSources || []).reduce((sum, s) => sum + (s.current_balance || 0), 0);

    return {
      total_revenue: totalRevenue,
      total_delivery_fees: totalDeliveryFees,
      sales_without_delivery: salesWithoutDelivery,
      total_cogs: totalCogs,
      total_general_expenses: generalExpenses,
      total_employee_dues_paid: employeeDuesPaid,
      gross_profit: grossProfit,
      net_profit: netProfit,
      gross_profit_margin: grossProfitMargin,
      net_profit_margin: netProfitMargin,
      total_orders: (orders || []).length,
      delivered_orders: deliveredOrders.length,
      returned_orders: returnedOrders.length,
      total_employee_profit: totalEmployeeProfit,
      closing_cash_balance: closingCashBalance
    };
  };

  // معاينة ذكية قبل الإنشاء
  const previewPeriod = async (periodType, customRange = null) => {
    setPreviewing(true);
    try {
      const { startDate, endDate, periodName } = getPeriodDates(periodType, customRange);
      const periodData = await calculatePeriodData(startDate, endDate);
      
      return {
        periodName,
        startDate,
        endDate,
        ...periodData,
        isEmpty: periodData.delivered_orders === 0 && periodData.total_orders === 0
      };
    } catch (error) {
      console.error('Error previewing period:', error);
      return null;
    } finally {
      setPreviewing(false);
    }
  };

  // إنشاء فترة جديدة
  const createPeriod = async (periodType = 'current_month', customRange = null) => {
    setCreating(true);
    try {
      const { startDate, endDate, periodName } = getPeriodDates(periodType, customRange);

      // التحقق من عدم وجود فترة متداخلة
      const { data: existing } = await supabase
        .from('closed_periods')
        .select('id')
        .or(`and(start_date.lte.${endDate.toISOString()},end_date.gte.${startDate.toISOString()})`);

      if (existing && existing.length > 0) {
        throw new Error('توجد فترة متداخلة مع التواريخ المحددة');
      }

      // حساب البيانات المالية
      const periodData = await calculatePeriodData(startDate, endDate);

      // جلب رصيد الإفتتاح من الفترة السابقة
      const { data: previousPeriod } = await supabase
        .from('closed_periods')
        .select('closing_cash_balance')
        .lt('end_date', startDate.toISOString())
        .order('end_date', { ascending: false })
        .limit(1)
        .single();

      const openingBalance = previousPeriod?.closing_cash_balance || 0;

      // إنشاء الفترة
      const { data: newPeriod, error } = await supabase
        .from('closed_periods')
        .insert({
          period_name: periodName,
          period_type: periodType,
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          opening_cash_balance: openingBalance,
          ...periodData,
          status: 'open',
          created_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'تم إنشاء الفترة',
        description: `تم إنشاء فترة "${periodName}" بنجاح`,
      });

      await fetchClosedPeriods();
      return newPeriod;
    } catch (error) {
      console.error('Error creating period:', error);
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في إنشاء الفترة',
        variant: 'destructive'
      });
      return null;
    } finally {
      setCreating(false);
    }
  };

  // إغلاق فترة
  const closePeriod = async (periodId) => {
    try {
      const { error } = await supabase
        .from('closed_periods')
        .update({
          status: 'closed',
          closed_at: new Date().toISOString(),
          closed_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('id', periodId);

      if (error) throw error;

      toast({
        title: 'تم إغلاق الفترة',
        description: 'تم إغلاق الفترة بنجاح',
      });

      await fetchClosedPeriods();
    } catch (error) {
      console.error('Error closing period:', error);
      toast({
        title: 'خطأ',
        description: 'فشل في إغلاق الفترة',
        variant: 'destructive'
      });
    }
  };

  // قفل فترة (لا يمكن التعديل بعدها)
  const lockPeriod = async (periodId) => {
    try {
      const { error } = await supabase
        .from('closed_periods')
        .update({ status: 'locked' })
        .eq('id', periodId);

      if (error) throw error;

      toast({
        title: 'تم قفل الفترة',
        description: 'تم قفل الفترة نهائياً - لا يمكن التعديل عليها',
      });

      await fetchClosedPeriods();
    } catch (error) {
      console.error('Error locking period:', error);
      toast({
        title: 'خطأ',
        description: 'فشل في قفل الفترة',
        variant: 'destructive'
      });
    }
  };

  // حذف فترة (فقط إذا كانت مفتوحة)
  const deletePeriod = async (periodId) => {
    try {
      const { error } = await supabase
        .from('closed_periods')
        .delete()
        .eq('id', periodId)
        .eq('status', 'open');

      if (error) throw error;

      toast({
        title: 'تم حذف الفترة',
        description: 'تم حذف الفترة بنجاح',
      });

      await fetchClosedPeriods();
    } catch (error) {
      console.error('Error deleting period:', error);
      toast({
        title: 'خطأ',
        description: 'فشل في حذف الفترة - تأكد أنها مفتوحة',
        variant: 'destructive'
      });
    }
  };

  // تحديث ملاحظات الفترة
  const updatePeriodNotes = async (periodId, notes) => {
    try {
      const { error } = await supabase
        .from('closed_periods')
        .update({ notes })
        .eq('id', periodId);

      if (error) throw error;

      toast({
        title: 'تم الحفظ',
        description: 'تم حفظ الملاحظات',
      });

      await fetchClosedPeriods();
    } catch (error) {
      console.error('Error updating notes:', error);
    }
  };

  return {
    closedPeriods,
    loading,
    creating,
    previewing,
    fetchClosedPeriods,
    previewPeriod,
    createPeriod,
    closePeriod,
    lockPeriod,
    deletePeriod,
    updatePeriodNotes
  };
};
