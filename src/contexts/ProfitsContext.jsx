import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from './UnifiedAuthContext';
import { toast } from '@/components/ui/use-toast';

const ProfitsContext = createContext();

export const useProfits = () => {
  const context = useContext(ProfitsContext);
  if (!context) throw new Error('useProfits must be used within a ProfitsProvider');
  return context;
};

export const ProfitsProvider = ({ children }) => {
  const { user } = useAuth();
  const [profits, setProfits] = useState([]);
  const [settlementRequests, setSettlementRequests] = useState([]);
  const [settlementInvoices, setSettlementInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  // حساب الأرباح عند إنشاء طلب
  const calculateOrderProfit = useCallback(async (order) => {
    try {
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
        employee_id: order.created_by || user?.id,
        total_profit: totalProfit,
        profit_details: profitDetails,
        status: 'pending', // قيد التجهيز
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('profits')
        .insert([{
          order_id: order.id,
          employee_id: order.created_by || user?.id,
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
  }, [user?.id]);

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

  // طلب تحاسب من الموظف
  const createSettlementRequest = useCallback(async (orderIds, notes = '') => {
    try {
      // التحقق من أن جميع الطلبات مؤهلة للتحاسب
      const eligibleProfits = profits.filter(p => 
        orderIds.includes(p.order_id) && 
        p.status === 'invoice_received' &&
        p.employee_id === user?.id
      );

      if (eligibleProfits.length !== orderIds.length) {
        throw new Error('بعض الطلبات غير مؤهلة للتحاسب');
      }

      const totalProfit = eligibleProfits.reduce((sum, p) => sum + p.total_profit, 0);

      const requestData = {
        employee_id: user?.id,
        order_ids: orderIds,
        total_profit: totalProfit,
        status: 'pending',
        notes,
        requested_at: new Date().toISOString()
      };

      // تسجيل الطلب في الإشعارات مؤقتاً
      const { data, error } = await supabase
        .from('notifications')
        .insert([{
          type: 'settlement_request',
          title: 'طلب تحاسب',
          message: `طلب تحاسب بقيمة ${totalProfit} دينار`,
          data: requestData
        }])
        .select()
        .single();

      if (error) throw error;

      // تحديث حالة الأرباح إلى طلب تحاسب
      await supabase
        .from('profits')
        .update({ status: 'settlement_requested' })
        .in('order_id', orderIds);

      setSettlementRequests(prev => [...prev, data]);
      setProfits(prev => prev.map(p => 
        orderIds.includes(p.order_id) 
          ? { ...p, status: 'settlement_requested' }
          : p
      ));

      toast({
        title: "تم إرسال طلب التحاسب",
        description: `طلب تحاسب بقيمة ${totalProfit.toLocaleString()} د.ع`,
        variant: "success"
      });

      return data;
    } catch (error) {
      console.error('Error creating settlement request:', error);
      toast({
        title: "خطأ في طلب التحاسب",
        description: error.message,
        variant: "destructive"
      });
      return null;
    }
  }, [profits, user?.id]);

  // موافقة المدير على طلب التحاسب
  const approveSettlementRequest = useCallback(async (requestId, paymentMethod = 'cash') => {
    try {
      const request = settlementRequests.find(r => r.id === requestId);
      if (!request) throw new Error('طلب التحاسب غير موجود');

      // تحديث حالة الطلب في الإشعارات
      const { data: updatedRequest, error: requestError } = await supabase
        .from('notifications')
        .update({
          data: {
            ...request,
            status: 'approved',
            approved_by: user?.id,
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
        generated_by: user?.id
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
        .update({ is_archived: true })
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
  }, [settlementRequests, user?.id]);

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
      const request = settlementRequests.find(r => r.id === requestId);
      if (!request) throw new Error('طلب التحاسب غير موجود');

      const { data, error } = await supabase
        .from('notifications')
        .update({
          data: {
            ...request,
            status: 'rejected',
            rejected_by: user?.id,
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
  }, [settlementRequests, user?.id]);

  // جلب البيانات
  const fetchProfitsData = useCallback(async () => {
    if (!user?.id) return;

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
  }, [user?.id]);

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
    fetchProfitsData
  };

  return (
    <ProfitsContext.Provider value={value}>
      {children}
    </ProfitsContext.Provider>
  );
};