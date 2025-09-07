import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
// import removed to avoid circular dependency with SuperProvider
import { useAuth } from './UnifiedAuthContext';
import { useUnifiedUserData } from '@/hooks/useUnifiedUserData';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';

// إعادة توجيه ProfitsContext للنظام الموحد

const ProfitsContext = createContext();

export const useProfits = () => {
  const context = useContext(ProfitsContext);
  if (!context) throw new Error('useProfits must be used within a ProfitsProvider');
  return context;
};

export const ProfitsProvider = ({ children }) => {
  const { user } = useAuth();
  const { userUUID, isAdmin, canViewAllData } = useUnifiedUserData();
  const [profits, setProfits] = useState([]);
  const [settlementRequests, setSettlementRequests] = useState([]);
  const [settlementInvoices, setSettlementInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  // حساب الأرباح عند إنشاء طلب
  const calculateOrderProfit = useCallback(async (order) => {
    try {
      const currentUserId = userUUID;
      let totalProfit = 0;
      const profitDetails = [];

      for (const item of order.items) {
        const profit = (item.price * item.quantity) - (item.cost_price * item.quantity);
        totalProfit += profit;
        profitDetails.push({
          product_id: item.productId,
          product_name: item.productName,
          variant_sku: item.sku,
          quantity: item.quantity,
          selling_price: item.price,
          cost_price: item.cost_price,
          profit_per_unit: item.price - item.cost_price,
          total_profit: profit
        });
      }

      const profitRecord = {
        order_id: order.id,
        employee_id: order.created_by || currentUserId,
        total_profit: totalProfit,
        profit_details: profitDetails,
        status: 'pending', // قيد التجهيز
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('profits')
        .insert([{
          order_id: order.id,
          employee_id: order.created_by || currentUserId,
          total_revenue: order.total_amount || 0,
          total_cost: order.cost_amount || 0,
          profit_amount: totalProfit,
          employee_percentage: 10, // نسبة افتراضية
          employee_profit: totalProfit * 0.1,
          status: 'pending'
        }])
        .select()
        .single();

      if (error) throw error;

      setProfits(prev => [...prev, data]);
      return data;
    } catch (error) {
      console.error('Error calculating order profit:', error);
      toast({
        title: "خطأ في حساب الأرباح",
        description: error.message,
        variant: "destructive"
      });
      return null;
    }
  }, [userUUID, isAdmin]);

  // تحديث حالة الربح بناءً على حالة الطلب
  const updateProfitStatus = useCallback(async (orderId, orderStatus, invoiceReceived = false) => {
    try {
      let profitStatus = 'pending';
      let updateData = { status: profitStatus };

      switch (orderStatus) {
        case 'shipped':
          profitStatus = 'sales_pending'; // مبيعات معلقة
          break;
        case 'delivered':
          profitStatus = 'profits_pending'; // أرباح معلقة
          break;
        case 'returned':
        case 'cancelled':
          profitStatus = 'cancelled';
          break;
      }

      if (invoiceReceived && orderStatus === 'delivered') {
        profitStatus = 'invoice_received'; // استُلمت الفاتورة
        updateData.invoice_received_at = new Date().toISOString();
      }

      updateData.status = profitStatus;

      const { data, error } = await supabase
        .from('profits')
        .update(updateData)
        .eq('order_id', orderId)
        .select()
        .single();

      if (error) throw error;

      setProfits(prev => prev.map(p => 
        p.order_id === orderId ? { ...p, ...updateData } : p
      ));

      return data;
    } catch (error) {
      console.error('Error updating profit status:', error);
      return null;
    }
  }, []);

  // طلب تحاسب من الموظف - النظام الموحد
  const createSettlementRequest = useCallback(async (orderIds, notes = '') => {
    try {
      // التحقق من صحة orderIds
      const validOrderIds = orderIds.filter(id => id != null && id !== '');
      if (validOrderIds.length === 0) {
        throw new Error('لا توجد معرفات طلبات صالحة');
      }

      // الحصول على المستخدم الحالي من auth مباشرة
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !authUser) {
        console.error('مشكلة في المصادقة:', authError);
        throw new Error('يجب تسجيل الدخول أولاً');
      }

      const currentUserId = authUser.id;
      
      console.log('🔍 طلب التحاسب - التحقق من المصادقة:', { 
        authUserId: currentUserId,
        userUUID,
        orderIds: validOrderIds,
        isAdmin
      });

      // التحقق من صحة UUID
      if (!currentUserId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(currentUserId)) {
        throw new Error('معرف المستخدم غير صحيح');
      }

      // جلب أرباح الموظف مع فلترة صريحة (تجاوز RLS)
      const { data: freshProfits, error: profitsError } = await supabase
        .from('profits')
        .select('*')
        .in('order_id', validOrderIds)
        .eq('employee_id', currentUserId); // فلترة صريحة للأمان

      if (profitsError) {
        console.error('خطأ في جلب بيانات الأرباح:', profitsError);
        throw new Error(`فشل في جلب بيانات الأرباح: ${profitsError.message}`);
      }

      console.log('📊 الأرباح المجلبة:', { 
        ordersRequested: validOrderIds.length,
        profitsFound: freshProfits?.length || 0,
        profits: freshProfits 
      });

      // التحقق من أن جميع الطلبات مؤهلة للتحاسب
      const eligibleProfits = freshProfits.filter(p => 
        validOrderIds.includes(p.order_id) && 
        (p.status === 'invoice_received' || p.status === 'pending') && // قبول كلا الحالتين
        p.employee_id === currentUserId
      );

      console.log('✅ الأرباح المؤهلة للتحاسب:', eligibleProfits);

      if (eligibleProfits.length === 0) {
        throw new Error('لا توجد أرباح مؤهلة للتحاسب في الطلبات المحددة');
      }

      // التحقق التفصيلي للطلبات غير المؤهلة
      const ineligibleOrders = validOrderIds.filter(orderId => {
        const profit = freshProfits.find(p => p.order_id === orderId);
        return !profit || 
               !['invoice_received', 'pending'].includes(profit.status) || 
               profit.employee_id !== currentUserId;
      });

      if (ineligibleOrders.length > 0) {
        const ineligibleMessages = ineligibleOrders.map(orderId => {
          const profit = freshProfits.find(p => p.order_id === orderId);
          if (!profit) return `الطلب ${orderId}: لم يتم العثور على سجل أرباح`;
          if (profit.employee_id !== currentUserId) return `الطلب ${orderId}: ليس ملكك`;
          return `الطلب ${orderId}: الحالة ${profit.status} - غير مؤهل للتحاسب`;
        }).join('\n');
        
        console.warn('⚠️ طلبات غير مؤهلة:', ineligibleMessages);
        throw new Error(`بعض الطلبات غير مؤهلة للتحاسب:\n${ineligibleMessages}`);
      }

      const totalProfit = eligibleProfits.reduce((sum, p) => sum + (p.employee_profit ?? p.profit_amount ?? 0), 0);

      console.log('💰 إجمالي الأرباح للتحاسب:', totalProfit);

      const requestData = {
        employee_id: currentUserId,
        order_ids: validOrderIds,
        total_profit: totalProfit,
        status: 'pending',
        notes,
        requested_at: new Date().toISOString()
      };

      // تسجيل الطلب في الإشعارات
      const { data: notificationData, error: notificationError } = await supabase
        .from('notifications')
        .insert([{
          type: 'settlement_request',
          title: 'طلب تحاسب',
          message: `طلب تحاسب بقيمة ${totalProfit} دينار`,
          data: requestData
        }])
        .select()
        .single();

      if (notificationError) {
        console.error('خطأ في تسجيل الإشعار:', notificationError);
        throw notificationError;
      }

      // تحديث حالة الأرباح إلى طلب تحاسب
      const { error: updateError } = await supabase
        .from('profits')
        .update({ status: 'settlement_requested' })
        .in('order_id', validOrderIds)
        .eq('employee_id', currentUserId); // التأكد من التحديث للموظف الصحيح

      if (updateError) {
        console.error('خطأ في تحديث حالة الأرباح:', updateError);
        // لا نرمي خطأ هنا لأن الطلب تم تسجيله بنجاح
      }

      // تحديث الحالة المحلية
      setSettlementRequests(prev => [...prev, notificationData]);
      setProfits(prev => prev.map(p => 
        validOrderIds.includes(p.order_id) && p.employee_id === currentUserId
          ? { ...p, status: 'settlement_requested' }
          : p
      ));

      toast({
        title: "تم إرسال طلب التحاسب",
        description: `طلب تحاسب بقيمة ${totalProfit.toLocaleString()} د.ع للطلبات: ${eligibleProfits.length}`,
        variant: "success"
      });

      return notificationData;
    } catch (error) {
      console.error('❌ خطأ في طلب التحاسب:', error);
      toast({
        title: "خطأ في طلب التحاسب",
        description: error.message,
        variant: "destructive"
      });
      return null;
    }
  }, [userUUID, isAdmin]);

  // موافقة المدير على طلب التحاسب
  const approveSettlementRequest = useCallback(async (requestId, paymentMethod = 'cash') => {
    try {
      const currentUserId = userUUID;
      const request = settlementRequests.find(r => r.id === requestId);
      if (!request) throw new Error('طلب التحاسب غير موجود');

      // تحديث حالة الطلب في الإشعارات
      const { data: updatedRequest, error: requestError } = await supabase
        .from('notifications')
        .update({
          data: {
            ...request,
            status: 'approved',
            approved_by: currentUserId,
            approved_at: new Date().toISOString(),
            payment_method: paymentMethod
          }
        })
        .eq('id', requestId)
        .select()
        .single();

      if (requestError) throw requestError;

      // إنشاء فاتورة التحاسب
      const invoiceNumber = `INV-${Date.now()}`;
      const invoiceData = {
        request_id: requestId,
        employee_id: request.employee_id,
        invoice_number: invoiceNumber,
        total_amount: request.total_profit,
        order_ids: request.order_ids,
        payment_method: paymentMethod,
        generated_at: new Date().toISOString(),
        generated_by: currentUserId
      };

      // تسجيل التسوية في الإشعارات بدلاً من جدول منفصل
      const { data: invoice, error: invoiceError } = await supabase
        .from('notifications')
        .insert([{
          type: 'settlement_invoice',
          title: 'فاتورة تسوية',
          message: `تم إنشاء فاتورة تسوية للموظف`,
          data: invoiceData
        }])
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // تحديث حالة الأرباح إلى مدفوعة
      await supabase
        .from('profits')
        .update({ 
          status: 'settled',
          settled_at: new Date().toISOString()
        })
        .in('order_id', request.order_ids);

      // أرشفة الطلبات
      await supabase
        .from('orders')
        .update({ isarchived: true })
        .in('id', request.order_ids);

      setSettlementRequests(prev => prev.map(r => 
        r.id === requestId ? updatedRequest : r
      ));
      setSettlementInvoices(prev => [...prev, invoice]);
      setProfits(prev => prev.map(p => 
        request.order_ids.includes(p.order_id)
          ? { ...p, status: 'settled', settled_at: new Date().toISOString() }
          : p
      ));

      toast({
        title: "تم الموافقة على التحاسب",
        description: `فاتورة رقم ${invoiceNumber}`,
        variant: "success"
      });

      return { request: updatedRequest, invoice };
    } catch (error) {
      console.error('Error approving settlement:', error);
      toast({
        title: "خطأ في الموافقة",
        description: error.message,
        variant: "destructive"
      });
      return null;
    }
  }, [settlementRequests, userUUID, isAdmin]);

  // تسجيل استلام الفاتورة للطلبات المحلية
  const markInvoiceReceived = useCallback(async (orderId, amountReceived = null) => {
    try {
      const profitRecord = profits.find(p => p.order_id === orderId);
      if (!profitRecord) {
        throw new Error('سجل الربح غير موجود لهذا الطلب');
      }

      const updateData = {
        status: 'settled',
        settled_at: new Date().toISOString()
      };

      // إذا كان مبلغ مختلف عن المتوقع، نسجله
      if (amountReceived && amountReceived !== profitRecord.profit_amount) {
        updateData.actual_amount_received = amountReceived;
      }

      const { data, error } = await supabase
        .from('profits')
        .update(updateData)
        .eq('order_id', orderId)
        .select()
        .single();

      if (error) throw error;

      setProfits(prev => prev.map(p => 
        p.order_id === orderId ? { ...p, ...updateData } : p
      ));

      toast({
        title: "تم تسجيل استلام الفاتورة",
        description: `تم تحويل الربح إلى مستلم`,
        variant: "success"
      });

      return data;
    } catch (error) {
      console.error('Error marking invoice received:', error);
      toast({
        title: "خطأ في تسجيل الاستلام",
        description: error.message,
        variant: "destructive"
      });
      return null;
    }
  }, [profits]);

  // رفض طلب التحاسب
  const rejectSettlementRequest = useCallback(async (requestId, reason = '') => {
    try {
      const currentUserId = userUUID;
      const request = settlementRequests.find(r => r.id === requestId);
      if (!request) throw new Error('طلب التحاسب غير موجود');

      const { data, error } = await supabase
        .from('notifications')
        .update({
          data: {
            ...request,
            status: 'rejected',
            rejected_by: currentUserId,
            rejected_at: new Date().toISOString(),
            rejection_reason: reason
          }
        })
        .eq('id', requestId)
        .select()
        .single();

      if (error) throw error;

      // إرجاع حالة الأرباح
      await supabase
        .from('profits')
        .update({ status: 'pending' })
        .in('order_id', request.order_ids);

      setSettlementRequests(prev => prev.map(r => 
        r.id === requestId ? data : r
      ));
      setProfits(prev => prev.map(p => 
        request.order_ids.includes(p.order_id)
          ? { ...p, status: 'invoice_received' }
          : p
      ));

      toast({
        title: "تم رفض طلب التحاسب",
        description: reason || "بدون سبب محدد",
        variant: "destructive"
      });

      return data;
    } catch (error) {
      console.error('Error rejecting settlement:', error);
      return null;
    }
  }, [settlementRequests, userUUID, isAdmin]);

  // جلب البيانات - النظام الموحد
  const fetchProfitsData = useCallback(async () => {
    if (!userUUID) return;

    try {
      setLoading(true);

      const [profitsRes] = await Promise.all([
        supabase.from('profits').select('*').order('created_at', { ascending: false })
      ]);

      if (profitsRes.error) throw profitsRes.error;

      setProfits(profitsRes.data || []);
      setSettlementRequests([]); // مؤقتاً حتى يتم تطوير النظام
      setSettlementInvoices([]);  // مؤقتاً حتى يتم تطوير النظام
    } catch (error) {
      console.error('Error fetching profits data:', error);
      toast({
        title: "خطأ في جلب البيانات",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [userUUID]);

  // تحديث البيانات بدون loading spinner - النظام الموحد
  const refreshProfitsData = useCallback(async () => {
    if (!userUUID) return;

    try {
      const [profitsRes] = await Promise.all([
        supabase.from('profits').select('*').order('created_at', { ascending: false })
      ]);

      if (profitsRes.error) throw profitsRes.error;
      setProfits(profitsRes.data || []);
    } catch (error) {
      console.error('Error refreshing profits data:', error);
    }
  }, [userUUID]);

  useEffect(() => {
    fetchProfitsData();
  }, [fetchProfitsData]);

  const value = {
    profits,
    settlementRequests,
    settlementInvoices,
    loading,
    calculateOrderProfit,
    updateProfitStatus,
    createSettlementRequest,
    approveSettlementRequest,
    rejectSettlementRequest,
    markInvoiceReceived,
    fetchProfitsData,
    refreshProfitsData
  };

  return (
    <ProfitsContext.Provider value={value}>
      {children}
    </ProfitsContext.Provider>
  );
};