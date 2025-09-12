import { useState, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/hooks/use-toast';

/**
 * Hook للمزامنة الذكية والمحسنة
 */
export const useSmartSync = () => {
  const [syncing, setSyncing] = useState(false);
  const [syncingEmployee, setSyncingEmployee] = useState(null);

  // مزامنة ذكية سريعة - فواتير جديدة فقط
  const smartSync = useCallback(async () => {
    setSyncing(true);
    const startTime = Date.now();
    
    try {
      console.log('🚀 بدء المزامنة الذكية...');
      
      const { data, error } = await supabase.functions.invoke('smart-invoice-sync', {
        body: { 
          mode: 'smart',
          sync_invoices: true,
          sync_orders: false, // فقط الفواتير للسرعة
          force_refresh: false
        }
      });

      if (error) throw error;

      const duration = Math.round((Date.now() - startTime) / 1000);
      
      toast({
        title: "✅ مزامنة ذكية مكتملة",
        description: data.invoices_synced > 0 
          ? `تم جلب ${data.invoices_synced} فاتورة جديدة في ${duration} ثانية فقط${data.needs_login?.length > 0 ? ` | ${data.needs_login.length} موظف يحتاج إعادة تسجيل دخول` : ''}`
          : `لا توجد فواتير جديدة - آخر تحديث في ${duration} ثانية${data.needs_login?.length > 0 ? ` | ${data.needs_login.length} موظف يحتاج إعادة تسجيل دخول` : ''}`,
        variant: data.invoices_synced > 0 ? "default" : "secondary",
        duration: 6000
      });

      return { success: true, data };

    } catch (error) {
      console.error('خطأ في المزامنة الذكية:', error);
      toast({
        title: "خطأ في المزامنة الذكية",
        description: error.message,
        variant: "destructive"
      });
      return { success: false, error };
    } finally {
      setSyncing(false);
    }
  }, []);

  // مزامنة موظف محدد ذكية (بدون force refresh)
  const syncSpecificEmployeeSmart = useCallback(async (employeeId, employeeName) => {
    setSyncingEmployee(employeeId);
    const startTime = Date.now();
    
    try {
      console.log(`🚀 بدء المزامنة الذكية للموظف: ${employeeName}`);
      
      const { data, error } = await supabase.functions.invoke('smart-invoice-sync', {
        body: { 
          mode: 'specific_employee',
          employee_id: employeeId,
          sync_invoices: true,
          sync_orders: true,
          force_refresh: false
        }
      });

      if (error) throw error;

      const duration = Math.round((Date.now() - startTime) / 1000);
      
      if (data.needs_login?.includes(employeeName)) {
        toast({
          title: "يحتاج تسجيل دخول",
          description: `${employeeName} يحتاج تسجيل دخول في الوسيط`,
          variant: "destructive"
        });
      } else {
        toast({
          title: "✅ مزامنة ذكية للموظف مكتملة",
          description: `${employeeName}: ${data.invoices_synced} فاتورة جديدة | ${data.orders_updated} طلب محدث في ${duration} ثانية`,
          variant: "default",
          duration: 7000
        });
      }

      return { success: true, data };

    } catch (error) {
      console.error(`خطأ في المزامنة الذكية للموظف ${employeeName}:`, error);
      toast({
        title: "خطأ في المزامنة الذكية للموظف",
        description: `${employeeName}: ${error.message}`,
        variant: "destructive"
      });
      return { success: false, error };
    } finally {
      setSyncingEmployee(null);
    }
  }, []);

  // فحص إمكانية الحذف التلقائي مع دعم الحسابات المتعددة
  const canAutoDeleteOrder = useCallback(async (orderNumber, employeeUserId) => {
    try {
      // البحث في جميع الحسابات المرتبطة بالمستخدم
      const { data: accounts } = await supabase
        .from('delivery_settings')
        .select('token, account_name')
        .eq('user_id', employeeUserId)
        .eq('partner', 'alwaseet')
        .eq('is_active', true);

      if (!accounts || accounts.length === 0) return false;

      // فحص وجود الطلب في أي من الحسابات
      for (const account of accounts) {
        const { data, error } = await supabase.functions.invoke('alwaseet-proxy', {
          body: {
            endpoint: 'merchant-orders',
            method: 'GET',
            token: account.token,
            queryParams: { search: orderNumber }
          }
        });

        if (!error && data?.data?.some(order => 
          order.order_number === orderNumber || 
          order.tracking_number === orderNumber
        )) {
          return false; // الطلب موجود، لا تحذف
        }
      }

      return true; // الطلب غير موجود في أي حساب، يمكن الحذف
    } catch (error) {
      console.error('خطأ في فحص إمكانية الحذف:', error);
      return false; // في حالة الخطأ، لا تحذف
    }
  }, []);

  // مزامنة أوامر محددة من مصفوفة الطلبات المرئية
  const syncVisibleOrdersBatch = useCallback(async (orders = [], showToast = true) => {
    if (!Array.isArray(orders) || orders.length === 0) {
      if (showToast) {
        toast({
          title: "لا توجد طلبات للمزامنة",
          description: "قائمة الطلبات المرئية فارغة",
          variant: "secondary"
        });
      }
      return { success: true, data: { orders_updated: 0 } };
    }

    let updatedCount = 0;
    let deletedCount = 0;
    const startTime = Date.now();

    try {
      console.log(`🔄 بدء مزامنة ${orders.length} طلب مرئي...`);

      // مزامنة كل طلب بتوكن منشئه
      for (const order of orders) {
        try {
          const createdBy = order.created_by;
          if (!createdBy) continue;

          // الحصول على التوكن الخاص بمنشئ الطلب
          const { data: deliverySettings } = await supabase
            .from('delivery_settings')
            .select('token, account_name')
            .eq('user_id', createdBy)
            .eq('partner', 'alwaseet')
            .eq('is_active', true)
            .maybeSingle();

          if (!deliverySettings?.token) {
            console.log(`⏭️ تخطي الطلب ${order.order_number} - لا يوجد توكن للمستخدم ${createdBy}`);
            continue;
          }

          // البحث عن الطلب في الوسيط
          const { data: searchResult, error } = await supabase.functions.invoke('alwaseet-proxy', {
            body: {
              endpoint: 'merchant-orders',
              method: 'GET',
              token: deliverySettings.token,
              queryParams: {
                search: order.tracking_number || order.order_number
              }
            }
          });

          if (error) {
            console.error(`خطأ في البحث عن الطلب ${order.order_number}:`, error);
            continue;
          }

          const externalOrders = searchResult?.data || [];
          const foundOrder = externalOrders.find(ext => 
            ext.order_number === order.order_number || 
            ext.tracking_number === order.tracking_number ||
            ext.tracking_number === order.order_number
          );

          if (foundOrder) {
            // تحديث حالة الطلب
            const { error: updateError } = await supabase
              .from('orders')
              .update({
                delivery_status: foundOrder.state_id?.toString() || foundOrder.status,
                updated_at: new Date().toISOString()
              })
              .eq('id', order.id);

            if (!updateError) {
              updatedCount++;
              console.log(`✅ تحديث الطلب ${order.order_number} - الحالة: ${foundOrder.state_id || foundOrder.status}`);
            }
          } else {
            // الطلب غير موجود في حساب منشئه - فحص إمكانية الحذف التلقائي
            console.log(`🔍 الطلب ${order.order_number} غير موجود في حساب منشئه، فحص الحذف التلقائي...`);
            
            // فحص الحذف فقط للطلبات الخارجية وليس المحلية
            if (order.delivery_partner?.toLowerCase() === 'alwaseet') {
              const { canDeleteOrder } = await import('@/lib/order-deletion-utils.js');
              
              if (canDeleteOrder(order)) {
                const canDelete = await canAutoDeleteOrder(order.order_number, createdBy);
                
                if (canDelete) {
                  // حذف الطلب تلقائياً
                  const { error: deleteError } = await supabase
                    .from('orders')
                    .delete()
                    .eq('id', order.id);

                  if (!deleteError) {
                    deletedCount++;
                    console.log(`🗑️ حذف تلقائي للطلب ${order.order_number} - غير موجود في الوسيط`);
                  }
                } else {
                  console.log(`⚠️ لم يتم حذف الطلب ${order.order_number} - موجود في حساب آخر للمستخدم`);
                }
              }
            }
          }
        } catch (orderError) {
          console.error(`خطأ في معالجة الطلب ${order.order_number}:`, orderError);
        }
      }

      const duration = Math.round((Date.now() - startTime) / 1000);
      
      if (showToast) {
        const message = `${updatedCount} طلب محدث${deletedCount > 0 ? ` | ${deletedCount} طلب محذوف` : ''} في ${duration} ثانية`;
        toast({
          title: "✅ مزامنة الطلبات المرئية",
          description: message,
          variant: "default",
          duration: 5000
        });
      }

      return { success: true, data: { orders_updated: updatedCount, orders_deleted: deletedCount } };

    } catch (error) {
      console.error('خطأ في مزامنة الطلبات المرئية:', error);
      if (showToast) {
        toast({
          title: "خطأ في مزامنة الطلبات المرئية",
          description: error.message,
          variant: "destructive"
        });
      }
      return { success: false, error };
    }
  }, [canAutoDeleteOrder]);

  // مزامنة موظف محدد شاملة (مع force refresh)
  const syncSpecificEmployee = useCallback(async (employeeId, employeeName) => {
    setSyncingEmployee(employeeId);
    const startTime = Date.now();
    
    try {
      console.log(`🚀 بدء المزامنة الشاملة للموظف: ${employeeName}`);
      
      const { data, error } = await supabase.functions.invoke('smart-invoice-sync', {
        body: { 
          mode: 'specific_employee',
          employee_id: employeeId,
          sync_invoices: true,
          sync_orders: true,
          force_refresh: true
        }
      });

      if (error) throw error;

      const duration = Math.round((Date.now() - startTime) / 1000);
      
      if (data.needs_login?.includes(employeeName)) {
        toast({
          title: "يحتاج تسجيل دخول",
          description: `${employeeName} يحتاج تسجيل دخول في الوسيط`,
          variant: "destructive"
        });
      } else {
        toast({
          title: "✅ مزامنة شاملة للموظف مكتملة",
          description: `${employeeName}: ${data.invoices_synced} فاتورة | ${data.orders_updated} طلب محدث في ${duration} ثانية`,
          variant: "default",
          duration: 7000
        });
      }

      return { success: true, data };

    } catch (error) {
      console.error(`خطأ في المزامنة الشاملة للموظف ${employeeName}:`, error);
      toast({
        title: "خطأ في المزامنة الشاملة للموظف",
        description: `${employeeName}: ${error.message}`,
        variant: "destructive"
      });
      return { success: false, error };
    } finally {
      setSyncingEmployee(null);
    }
  }, []);

  // مزامنة شاملة ذكية - الطلبات الظاهرة أولاً ثم الفواتير الجديدة
  const comprehensiveSync = useCallback(async (visibleOrders = null, syncVisibleOrdersBatchFn = null) => {
    setSyncing(true);
    const startTime = Date.now();
    
    try {
      console.log('🚀 بدء المزامنة الشاملة الذكية...');
      
      // استخدام الطلبات الظاهرة كحالة افتراضية مع fallback للمزامنة التقليدية
      const shouldUseSmart = visibleOrders && Array.isArray(visibleOrders) && visibleOrders.length > 0 && syncVisibleOrdersBatchFn;
      
      if (shouldUseSmart) {
        console.log(`📋 استخدام المزامنة الذكية للطلبات الظاهرة: ${visibleOrders.length} طلب`);
        
        // مزامنة الطلبات الظاهرة فقط
        await syncVisibleOrdersBatchFn(visibleOrders, false);
        
        // ثم جلب الفواتير الجديدة
        const { data: invoiceData } = await supabase.functions.invoke('smart-invoice-sync', {
          body: { 
            mode: 'smart',
            sync_invoices: true,
            sync_orders: false,
            force_refresh: false
          }
        });
        
        const duration = Math.round((Date.now() - startTime) / 1000);
        
        toast({
          title: "🎉 مزامنة شاملة ذكية مكتملة",
          description: `${visibleOrders.length} طلب مرئي مزامن | ${invoiceData?.invoices_synced || 0} فاتورة جديدة في ${duration} ثانية`,
          variant: "default",
          duration: 8000
        });
        
        return { success: true, data: { ...invoiceData, smart_mode: true } };
      }
      
      // المزامنة التقليدية كـ fallback
      console.log('📋 استخدام المزامنة الشاملة التقليدية');
      
      const { data, error } = await supabase.functions.invoke('smart-invoice-sync', {
        body: { 
          mode: 'comprehensive',
          sync_invoices: true,
          sync_orders: true,
          force_refresh: true
        }
      });

      if (error) throw error;

      const duration = Math.round((Date.now() - startTime) / 1000);
      
      toast({
        title: "🎉 مزامنة شاملة مكتملة",
        description: `تمت معالجة ${data.employees_processed} موظف | ${data.invoices_synced} فاتورة جديدة | ${data.orders_updated} طلب محدث في ${duration} ثانية${data.needs_login?.length > 0 ? ` | ${data.needs_login.length} موظف يحتاج إعادة تسجيل دخول` : ''}`,
        variant: "default",
        duration: 10000
      });

      return { success: true, data };

    } catch (error) {
      console.error('خطأ في المزامنة الشاملة:', error);
      toast({
        title: "خطأ في المزامنة الشاملة",
        description: error.message,
        variant: "destructive"
      });
      return { success: false, error };
    } finally {
      setSyncing(false);
    }
  }, [syncVisibleOrdersBatch]);

  // مزامنة سريعة للطلبات فقط
  const syncOrdersOnly = useCallback(async (employeeId = null) => {
    const isSingleEmployee = !!employeeId;
    if (isSingleEmployee) setSyncingEmployee(employeeId);
    else setSyncing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('smart-invoice-sync', {
        body: { 
          mode: isSingleEmployee ? 'specific_employee' : 'smart',
          employee_id: employeeId,
          sync_invoices: false,
          sync_orders: true,
          force_refresh: false
        }
      });

      if (error) throw error;

      toast({
        title: "تحديث حالات الطلبات",
        description: `تم تحديث ${data.orders_updated} طلب`,
        variant: "default"
      });

      return { success: true, data };

    } catch (error) {
      console.error('خطأ في مزامنة الطلبات:', error);
      toast({
        title: "خطأ في تحديث الطلبات",
        description: error.message,
        variant: "destructive"
      });
      return { success: false, error };
    } finally {
      if (isSingleEmployee) setSyncingEmployee(null);
      else setSyncing(false);
    }
  }, []);

  return {
    syncing,
    syncingEmployee,
    smartSync,
    syncSpecificEmployee,
    syncSpecificEmployeeSmart,
    comprehensiveSync,
    syncOrdersOnly,
    syncVisibleOrdersBatch
  };
};