import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './UnifiedAuthContext';
import { useUnifiedUserData } from '@/hooks/useUnifiedUserData';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { linkReturnToOriginalOrder, getOriginalOrderForReturn } from '@/utils/return-order-linker';
import devLog from '@/lib/devLogger';

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

      const { data, error } = await supabase
        .from('profits')
        .insert([{
          order_id: order.id,
          employee_id: order.created_by || currentUserId,
          total_revenue: order.total_amount || 0,
          total_cost: order.cost_amount || 0,
          profit_amount: totalProfit,
          employee_percentage: 10,
          employee_profit: totalProfit * 0.1,
          status: 'pending'
        }])
        .select()
        .single();

      if (error) throw error;

      setProfits(prev => [...prev, data]);
      return data;
    } catch (error) {
      devLog.error('Error calculating order profit:', error);
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

      // جلب سجل الربح الحالي للتحقق من قيمة employee_profit
      const { data: currentProfit } = await supabase
        .from('profits')
        .select('employee_profit')
        .eq('order_id', orderId)
        .maybeSingle();

      switch (orderStatus) {
        case 'shipped':
          profitStatus = 'sales_pending';
          break;
        case 'delivered':
          // ✅ إذا كان ربح الموظف = 0 → أرشفة مباشرة فوراً عند التسليم (بدون انتظار الفاتورة)
          if (currentProfit?.employee_profit === 0) {
            profitStatus = 'no_rule_archived';
            updateData.settled_at = new Date().toISOString();
          } else {
            profitStatus = 'profits_pending';
          }
          break;
        case 'returned':
        case 'cancelled':
          profitStatus = 'cancelled';
          break;
      }

      // ✅ عند استلام الفاتورة والتسليم: تحقق إضافي
      if (invoiceReceived && orderStatus === 'delivered') {
        if (currentProfit?.employee_profit === 0) {
          // لا يوجد قاعدة ربح للموظف - أرشفة تلقائية
          profitStatus = 'no_rule_archived';
          updateData.settled_at = new Date().toISOString();
        } else {
          profitStatus = 'invoice_received';
          // ✅ لا نكتب invoice_received_at لأنه غير موجود في جدول profits
        }
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
      devLog.error('Error updating profit status:', error);
      return null;
    }
  }, []);

  // طلب تحاسب من الموظف - النظام الموحد
  const createSettlementRequest = useCallback(async (orderIds, notes = '') => {
    try {
      const validOrderIds = orderIds.filter(id => id != null && id !== '');
      if (validOrderIds.length === 0) {
        throw new Error('لا توجد معرفات طلبات صالحة');
      }

      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !authUser) {
        devLog.error('مشكلة في المصادقة:', authError);
        throw new Error('يجب تسجيل الدخول أولاً');
      }

      const currentUserId = authUser.id;
      
      devLog.log('🔍 طلب التحاسب - المعرفات الواردة:', { 
        authUserId: currentUserId,
        userUUID,
        orderIds: validOrderIds,
        isAdmin
      });

      if (!currentUserId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(currentUserId)) {
        throw new Error('معرف المستخدم غير صحيح');
      }

      let orderUUIDs = [];
      
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const hasUUIDs = validOrderIds.some(id => uuidRegex.test(id));
      const hasOrderNumbers = validOrderIds.some(id => !uuidRegex.test(id));

      if (hasOrderNumbers || !hasUUIDs) {
        const { data: ordersData, error: ordersError } = await supabase
          .from('orders')
          .select('id, order_number')
          .in('order_number', validOrderIds)
          .eq('created_by', currentUserId);

        if (ordersError) {
          devLog.error('خطأ في جلب الطلبات:', ordersError);
          throw new Error(`فشل في العثور على الطلبات: ${ordersError.message}`);
        }

        orderUUIDs = ordersData.map(order => order.id);
        
        devLog.log('🔄 تحويل order numbers إلى UUIDs:', {
          input: validOrderIds,
          output: orderUUIDs,
          ordersFound: ordersData.length
        });

        if (orderUUIDs.length === 0) {
          throw new Error('لم يتم العثور على طلبات تطابق الأرقام المرسلة');
        }
      } else {
        orderUUIDs = validOrderIds;
      }

      const { data: freshProfits, error: profitsError } = await supabase
        .from('profits')
        .select('*')
        .in('order_id', orderUUIDs)
        .eq('employee_id', currentUserId);

      if (profitsError) {
        devLog.error('خطأ في جلب بيانات الأرباح:', profitsError);
        throw new Error(`فشل في جلب بيانات الأرباح: ${profitsError.message}`);
      }

      devLog.log('📊 الأرباح المجلبة:', { 
        orderUUIDs: orderUUIDs,
        profitsFound: freshProfits?.length || 0,
        profits: freshProfits 
      });

      const eligibleProfits = freshProfits.filter(p => 
        orderUUIDs.includes(p.order_id) &&
        (p.status === 'invoice_received' || p.status === 'settlement_requested') &&
        p.employee_id === currentUserId
      );

      devLog.log('✅ الأرباح المؤهلة للتحاسب:', eligibleProfits);
      const eligibleOrderIds = eligibleProfits.map(p => p.order_id);

      if (eligibleProfits.length === 0) {
        devLog.warn('⚠️ لا توجد أرباح مؤهلة للتحاسب في الطلبات المحددة');
        return { success: false, message: 'لا توجد أرباح مؤهلة للتحاسب في الطلبات المحددة' };
      }

      const ineligibleOrders = orderUUIDs.filter(orderId => {
        const profit = freshProfits.find(p => p.order_id === orderId);
        return !profit || 
               (profit.status !== 'invoice_received' && profit.status !== 'settlement_requested') || 
               profit.employee_id !== currentUserId;
      });

      if (ineligibleOrders.length > 0) {
        const ineligibleMessages = ineligibleOrders.map(orderId => {
          const profit = freshProfits.find(p => p.order_id === orderId);
          if (!profit) return `الطلب ${orderId}: لم يتم العثور على سجل أرباح`;
          if (profit.employee_id !== currentUserId) return `الطلب ${orderId}: ليس ملكك`;
          return `الطلب ${orderId}: الحالة ${profit.status} - غير مؤهل للتحاسب`;
        }).join('\n');
        
        devLog.warn('⚠️ طلبات غير مؤهلة:', ineligibleMessages);
        throw new Error(`بعض الطلبات غير مؤهلة للتحاسب:\n${ineligibleMessages}`);
      }

      const totalProfit = eligibleProfits.reduce((sum, p) => sum + (p.employee_profit ?? p.profit_amount ?? 0), 0);

      devLog.log('💰 إجمالي الأرباح للتحاسب:', totalProfit);

      // ✅ منع خلط ملاك مختلفين في طلب تحاسب واحد
      const { data: orderItems, error: orderItemsError } = await supabase
        .from('orders')
        .select('id, items')
        .in('id', eligibleOrderIds);

      if (!orderItemsError && orderItems) {
        // استخراج product_ids من كل الطلبات
        const allProductIds = new Set();
        orderItems.forEach(o => {
          if (Array.isArray(o.items)) {
            o.items.forEach(item => {
              if (item.product_id) allProductIds.add(item.product_id);
              if (item.productId) allProductIds.add(item.productId);
            });
          }
        });

        if (allProductIds.size > 0) {
          const { data: productsData } = await supabase
            .from('products')
            .select('id, owner_user_id')
            .in('id', [...allProductIds]);

          if (productsData) {
            const owners = new Set(productsData.map(p => p.owner_user_id || 'system'));
            devLog.log('🏷️ ملاك المنتجات في طلب التحاسب:', [...owners]);
            
            if (owners.size > 1) {
              throw new Error('لا يمكن تقديم طلب تحاسب واحد لطلبات تخص ملاك مختلفين. الرجاء تحديد طلبات تخص نفس المالك المالي (النظام أو مدير قسم واحد).');
            }
          }
        }
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', currentUserId)
        .single();

      let notifResult = null;
      try {
        const { data: notifData, error: notifError } = await supabase
          .rpc('upsert_settlement_request_notification', {
            p_employee_id: currentUserId,
            p_order_ids: eligibleOrderIds,
            p_total_profit: totalProfit,
          });

        if (notifError) {
          devLog.warn('⚠️ فشل استدعاء دالة إشعار التحاسب:', notifError.message || notifError);
        } else {
          notifResult = notifData;
        }
      } catch (e) {
        devLog.warn('⚠️ تعذر إنشاء/تحديث إشعار طلب التحاسب:', e?.message || e);
      }

      const { error: updateError } = await supabase
        .from('profits')
        .update({ status: 'settlement_requested' })
        .in('order_id', eligibleOrderIds)
        .eq('employee_id', currentUserId);

      if (updateError) {
        devLog.error('خطأ في تحديث حالة الأرباح:', updateError);
      }

      setProfits(prev => prev.map(p => 
        eligibleOrderIds.includes(p.order_id) && p.employee_id === currentUserId
          ? { ...p, status: 'settlement_requested' }
          : p
      ));

      // تحديث قائمة طلبات التحاسب لتظهر الطلب الجديد
      if (notifResult?.notification) {
        setSettlementRequests(prev => [...prev, notifResult.notification]);
      }

      toast({
        title: "تم إرسال طلب التحاسب",
        description: `طلب تحاسب بقيمة ${totalProfit.toLocaleString()} د.ع للطلبات: ${eligibleProfits.length}`,
        variant: "success"
      });

      return { success: true, notification: notifResult?.notification ?? null };
    } catch (error) {
      devLog.error('❌ خطأ في طلب التحاسب:', error);
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

      await supabase
        .from('profits')
        .update({ 
          status: 'settled',
          settled_at: new Date().toISOString()
        })
        .in('order_id', request.order_ids);

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
      devLog.error('Error approving settlement:', error);
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
      devLog.error('Error marking invoice received:', error);
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

      const { data: updatedRequest, error } = await supabase
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

      await supabase
        .from('profits')
        .update({ status: 'invoice_received' })
        .in('order_id', request.order_ids);

      setSettlementRequests(prev => prev.map(r => 
        r.id === requestId ? updatedRequest : r
      ));
      setProfits(prev => prev.map(p => 
        request.order_ids.includes(p.order_id)
          ? { ...p, status: 'invoice_received' }
          : p
      ));

      toast({
        title: "تم رفض طلب التحاسب",
        description: reason || "تم إرجاع الأرباح إلى حالة الانتظار",
        variant: "default"
      });

      return updatedRequest;
    } catch (error) {
      devLog.error('Error rejecting settlement:', error);
      toast({
        title: "خطأ في الرفض",
        description: error.message,
        variant: "destructive"
      });
      return null;
    }
  }, [settlementRequests, userUUID]);

  // جلب بيانات الأرباح وطلبات التحاسب
  const fetchProfitsData = useCallback(async () => {
    if (!userUUID) return;

    try {
      setLoading(true);

      let profitsQuery = supabase.from('profits').select('*');
      
      if (!canViewAllData) {
        profitsQuery = profitsQuery.eq('employee_id', userUUID);
      }

      const { data: profitsData, error: profitsError } = await profitsQuery;

      if (profitsError) throw profitsError;

      setProfits(profitsData || []);

      let notificationsQuery = supabase
        .from('notifications')
        .select('*')
        .in('type', ['settlement_request', 'settlement_invoice'])
        .order('created_at', { ascending: false });

      // غير المدير يرى فقط الإشعارات الموجهة له
      if (!canViewAllData) {
        notificationsQuery = notificationsQuery.eq('user_id', user?.id || userUUID);
      }

      const { data: notificationsData, error: notificationsError } = await notificationsQuery;

      if (notificationsError) throw notificationsError;

      const requests = (notificationsData || []).filter(n => n.type === 'settlement_request');
      const invoices = (notificationsData || []).filter(n => n.type === 'settlement_invoice');

      setSettlementRequests(requests);
      setSettlementInvoices(invoices);

    } catch (error) {
      devLog.error('Error fetching profits data:', error);
    } finally {
      setLoading(false);
    }
  }, [userUUID, canViewAllData]);

  useEffect(() => {
    fetchProfitsData();
  }, [fetchProfitsData]);

  // Real-time subscription للإشعارات
  useEffect(() => {
    if (!userUUID) return;

    const channel = supabase
      .channel('settlement-notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: canViewAllData ? `type=eq.settlement_request` : `type=eq.settlement_request,user_id=eq.${user?.id || userUUID}`
        },
        (payload) => {
          // ✅ إضافة طلب التحاسب الجديد فوراً للقائمة
          setSettlementRequests(prev => {
            if (prev.some(r => r.id === payload.new.id)) return prev;
            return [payload.new, ...prev];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `type=eq.settlement_completed`
        },
        (payload) => {
          // عرض toast للموظف فوراً
          if (payload.new?.user_id === userUUID) {
            toast({
              title: payload.new?.title || 'تمت تسوية مستحقاتك 💰',
              description: payload.new?.message,
              variant: 'success'
            });
          }
          // تحديث قائمة الإشعارات
          fetchProfitsData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `type=eq.settlement_request`
        },
        () => {
          // تحديث طلبات التحاسب عند حذف إشعار
          fetchProfitsData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userUUID, fetchProfitsData]);

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
    refreshProfits: fetchProfitsData,
    fetchProfitsData, // تصدير مباشر للاستخدام في الصفحات
    linkReturnToOriginalOrder,
    getOriginalOrderForReturn
  };

  return (
    <ProfitsContext.Provider value={value}>
      {children}
    </ProfitsContext.Provider>
  );
};
