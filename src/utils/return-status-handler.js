import { supabase } from '@/lib/customSupabaseClient';

/**
 * معالجة المخزون والماليات التلقائية لطلبات الإرجاع عند تغيير الحالة
 * @param {string} orderId - معرف الطلب
 * @param {number|string} newDeliveryStatus - الحالة الجديدة للتوصيل
 * @returns {Promise<{success: boolean, processed?: number, cancelled?: boolean, skipped?: boolean, error?: string}>}
 */
export const handleReturnStatusChange = async (orderId, newDeliveryStatus) => {
  try {
    console.log('🔄 بدء معالجة حالة الإرجاع:', { orderId, newDeliveryStatus });

    // جلب الطلب
    const { data: order, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (error || !order) {
      console.error('❌ خطأ في جلب الطلب:', error);
      return { success: false, error: error?.message };
    }

    // ✅ حماية partial_delivery - نعالج فقط الحالة 17 للمنتجات pending_return
    const isPartialDelivery = order.order_type === 'partial_delivery';
    const isReturnOrder = order.order_type === 'return';
    
    if (!isPartialDelivery && !isReturnOrder) {
      console.log('⏭️ ليس طلب إرجاع أو تسليم جزئي، تخطي المعالجة');
      return { success: true, skipped: true };
    }

    // ✅ الحالة 21: تم دفع المبلغ للزبون واستلام المنتج من قبل المندوب
    if (newDeliveryStatus === '21' || newDeliveryStatus === 21) {
      console.log('💰 الحالة 21: تم دفع المبلغ للزبون واستلام المنتج من المندوب');
      
      // تحديث حالة الطلب إلى "return_pending" (بانتظار استلام المنتج من المندوب)
      await supabase
        .from('orders')
        .update({ 
          order_status: 'return_pending',
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);
      
      console.log('✅ تم تحديث حالة الطلب إلى return_pending - بانتظار استلام المنتج من المندوب');
      return { success: true, statusUpdated: 'return_pending' };
    }

    // ✅ الحالة 17: استلام المنتج من المندوب (إضافة للمخزون + معالجة مالية)
    if (newDeliveryStatus === '17' || newDeliveryStatus === 17) {
      console.log('📦 الحالة 17: استلام المنتج المُرجع من المندوب');
      
      // ✅ حماية partial_delivery: معالجة خاصة - لا نغير status للطلب أبداً
      if (isPartialDelivery) {
        console.log('🔒 partial_delivery: معالجة المنتجات pending_return فقط');
        
        // جلب فقط المنتجات pending_return
        const { data: items, error: itemsError } = await supabase
          .from('order_items')
          .select('*, product_variants(id, product_id)')
          .eq('order_id', orderId)
          .eq('item_status', 'pending_return');
      
        if (itemsError || !items || items.length === 0) {
          console.log('⏭️ لا توجد منتجات pending_return للإرجاع في هذا التسليم الجزئي');
          return { success: true, skipped: true };
        }

        // ✅ معالجة كل منتج pending_return
        for (const item of items) {
          try {
            // استخدام RPC لإرجاع المنتج للمخزون
            const { error: rpcError } = await supabase.rpc('return_item_to_stock', {
              p_variant_id: item.variant_id,
              p_quantity: item.quantity,
              p_user_id: order.created_by
            });

            if (rpcError) {
              console.error(`❌ خطأ في return_item_to_stock للـ variant ${item.variant_id}:`, rpcError);
              continue;
            }

            // تحديث item_status إلى returned_in_stock
            await supabase
              .from('order_items')
              .update({ item_status: 'returned_in_stock' })
              .eq('id', item.id);

            console.log(`✅ تم إرجاع ${item.quantity} من variant ${item.variant_id} للمخزون`);
          } catch (err) {
            console.error(`❌ خطأ في معالجة المنتج ${item.id}:`, err);
          }
        }

        console.log('✅ تمت معالجة جميع المنتجات pending_return - لا تغيير لـ status الطلب');
        return { success: true, processed: items.length, partialDelivery: true };
      }
      
      // ✅ معالجة الإرجاع الكامل (return orders فقط)
      const { data: items, error: itemsError } = await supabase
        .from('order_items')
        .select('*, product_variants(id, product_id)')
        .eq('order_id', orderId);

      if (itemsError || !items || items.length === 0) {
        console.error('❌ خطأ في جلب order_items:', itemsError);
        return { success: false, error: 'لا توجد منتجات للإرجاع' };
      }

      // في حالة return: كل المنتجات ترجع
      const pendingReturnItems = items;
      
      // معالجة الإرجاع الكامل (return orders)
      console.log(`📦 إرجاع ${pendingReturnItems.length} منتج كاملاً إلى المخزون`);

      for (const item of pendingReturnItems) {
        // استخدام RPC لإرجاع المنتج للمخزون
        const { error: rpcError } = await supabase.rpc('return_item_to_stock', {
          p_variant_id: item.variant_id,
          p_quantity: item.quantity,
          p_user_id: order.created_by
        });

        if (rpcError) {
          console.error(`❌ خطأ في return_item_to_stock للـ variant ${item.variant_id}:`, rpcError);
          continue;
        }

        // تحديث item_status
        await supabase
          .from('order_items')
          .update({ item_status: 'returned_in_stock' })
          .eq('id', item.id);
      }
      
      // ✅ معالجة طلبات الإرجاع الكاملة (التحقق من المرور بالحالة 21)
      if (order.order_type === 'return' && order.order_status !== 'return_pending') {
        console.log('⚠️ لم يتم المرور بالحالة 21 أولاً - إلغاء طلب الإرجاع');
        
        // إلغاء الطلب
        await supabase
          .from('orders')
          .update({ 
            order_status: 'cancelled',
            merchant_notes: (order.merchant_notes || '') + '\n[تلقائي] تم إلغاء الطلب - لم يتم استلام المنتج من الزبون',
            updated_at: new Date().toISOString()
          })
          .eq('id', orderId);
        
        console.log('❌ تم إلغاء طلب الإرجاع - لم يمر بالحالة 21');
        return { success: true, cancelled: true, reason: 'لم يتم المرور بالحالة 21' };
      }

      // ✅ معالجة طلبات الإرجاع الكاملة - إرجاع المخزون
      console.log(`📦 جلب ${items.length} منتج للإرجاع الكامل`);

      // ✅ إرجاع المنتجات للمخزون الفعلي
      let stockUpdatedCount = 0;
      for (const item of items) {
        try {
          const { data: stockResult, error: stockError } = await supabase.rpc('update_variant_stock', {
            p_variant_id: item.variant_id,
            p_quantity_change: item.quantity,
            p_reason: `إرجاع للمخزون - ${order.tracking_number || orderId}`
          });

          if (stockError) {
            console.error(`❌ فشل إرجاع ${item.variant_id}:`, stockError);
          } else {
            stockUpdatedCount++;
            console.log(`✅ تم إرجاع ${item.quantity} من المنتج ${item.variant_id} للمخزون`);
          }
        } catch (err) {
          console.error(`❌ خطأ في إرجاع ${item.variant_id}:`, err);
        }
      }

      if (stockUpdatedCount === 0) {
        console.error('❌ فشل إرجاع جميع المنتجات للمخزون');
        return { success: false, error: 'فشل إرجاع المنتجات للمخزون' };
      }

      console.log(`✅ تم إرجاع ${stockUpdatedCount} من ${items.length} منتج للمخزون`);

      // ✅ تسجيل حركة نقد (سحب من القاصة الرئيسية)
      try {
        const { data: mainCashSource } = await supabase
          .from('cash_sources')
          .select('id, current_balance')
          .eq('name', 'القاصة الرئيسية')
          .maybeSingle();
        
        if (mainCashSource && order.total_amount > 0) {
          const refundAmount = Math.abs(order.total_amount);
          const newBalance = mainCashSource.current_balance - refundAmount;
          
          // إنشاء حركة نقد (سحب)
          const { error: cashError } = await supabase
            .from('cash_movements')
            .insert({
              cash_source_id: mainCashSource.id,
              movement_type: 'out',
              amount: refundAmount,
              balance_before: mainCashSource.current_balance,
              balance_after: newBalance,
              description: `دفع إرجاع للزبون - طلب #${order.order_number || 'غير معروف'}`,
              reference_type: 'return_order',
              reference_id: orderId,
              created_by: order.created_by,
              effective_at: new Date().toISOString()
            });
          
          if (!cashError) {
            // تحديث رصيد القاصة
            await supabase
              .from('cash_sources')
              .update({ current_balance: newBalance })
              .eq('id', mainCashSource.id);
            
            console.log('✅ تم تسجيل حركة نقد للإرجاع:', refundAmount);
          } else {
            console.error('❌ خطأ في تسجيل حركة النقد:', cashError);
          }
        }
      } catch (cashErr) {
        console.error('❌ خطأ في معالجة حركة النقد:', cashErr);
      }

      // ✅ معالجة الماليات (خصم من الطلب الأصلي)
      let financialResult = null;
      let lossAmount = 0;
      let isLoss = false;

      if (order.original_order_id) {
        const refundAmount = Math.abs(order.final_amount || 0);
        
        // جلب الطلب الأصلي لمعرفة قيمته
        const { data: originalOrder } = await supabase
          .from('orders')
          .select('final_amount, total_amount')
          .eq('id', order.original_order_id)
          .single();

        const originalAmount = originalOrder?.final_amount || originalOrder?.total_amount || 0;
        
        // ✅ حالة الخسارة: مبلغ الإرجاع > الطلب الأصلي
        if (refundAmount > originalAmount) {
          isLoss = true;
          lossAmount = refundAmount - originalAmount;
          console.log(`⚠️ خسارة: مبلغ الإرجاع (${refundAmount}) > الطلب الأصلي (${originalAmount})`);
          console.log(`💸 مبلغ الخسارة: ${lossAmount}`);
        }

        try {
          const { data: profitResult, error: profitError } = await supabase.rpc('adjust_profit_for_return_v2', {
            p_original_order_id: order.original_order_id,
            p_refund_amount: refundAmount,
            p_product_profit: 0,
            p_return_order_id: order.id
          });

          if (profitError) {
            console.error('❌ خطأ في معالجة الأرباح:', profitError);
          } else {
            financialResult = profitResult;
            console.log('✅ تمت معالجة الأرباح:', profitResult);
          }
        } catch (err) {
          console.error('❌ خطأ في adjust_profit_for_return_v2:', err);
        }

        // ✅ تسجيل الخسارة في accounting إذا وجدت
        if (isLoss && lossAmount > 0) {
          try {
            const { error: accountingError } = await supabase
              .from('accounting')
              .insert({
                transaction_type: 'expense',
                amount: lossAmount,
                category: 'return_loss',
                description: `خسارة إرجاع - الفرق بين مبلغ الإرجاع (${refundAmount}) والطلب الأصلي (${originalAmount})`,
                related_order_id: order.id,
                employee_id: order.created_by,
                created_at: new Date().toISOString()
              });

            if (accountingError) {
              console.error('❌ خطأ في تسجيل الخسارة:', accountingError);
            } else {
              console.log(`✅ تم تسجيل خسارة بمبلغ ${lossAmount} في المحاسبة`);
            }
          } catch (err) {
            console.error('❌ خطأ في تسجيل الخسارة:', err);
          }
        }
      } else {
        console.log('⚠️ لا يوجد original_order_id - تخطي المعالجة المالية');
      }

      // ✅ تحديث حالة الطلب إلى "completed"
      const notesAddition = isLoss 
        ? `\n[تلقائي] تم إرجاع ${stockUpdatedCount} منتج للمخزون ومعالجة الأرباح. خسارة: ${lossAmount} دينار`
        : `\n[تلقائي] تم إرجاع ${stockUpdatedCount} منتج للمخزون ومعالجة الأرباح`;

      await supabase
        .from('orders')
        .update({ 
          order_status: 'completed',
          merchant_notes: (order.merchant_notes || '') + notesAddition,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      console.log('✅ اكتملت معالجة طلب الإرجاع بنجاح');
      
      return { 
        success: true, 
        processed: stockUpdatedCount,
        financialResult,
        isLoss,
        lossAmount: isLoss ? lossAmount : 0
      };
    }

  } catch (error) {
    console.error('❌ خطأ في معالجة حالة الإرجاع:', error);
    return { success: false, error: error.message };
  }
};
