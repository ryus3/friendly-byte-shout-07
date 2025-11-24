import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

Deno.serve(async (req) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    console.log('🔧 بدء إصلاح شامل لنظام حركات النقد...');

    // المرحلة 1: حذف الحركات الخاطئة (31 حركة اليوم)
    const { data: incorrectMovements, error: fetchError } = await supabaseClient.rpc('exec_sql', {
      sql_query: `
        SELECT cm.id, cm.description, cm.amount,
               o.final_amount, o.delivery_fee,
               (o.final_amount - COALESCE(o.delivery_fee, 0)) as correct_amount
        FROM cash_movements cm
        JOIN orders o ON cm.reference_id::uuid = o.id
        WHERE cm.reference_type = 'order'
          AND cm.movement_type = 'in'
          AND DATE(cm.created_at) = '2025-11-24'
          AND cm.amount = o.final_amount
          AND o.delivery_fee > 0
      `
    });

    if (fetchError) {
      console.error('❌ فشل جلب الحركات الخاطئة:', fetchError);
      throw fetchError;
    }

    const movementIds = incorrectMovements?.map((m: any) => m.id) || [];
    console.log(`📋 عدد الحركات الخاطئة: ${movementIds.length}`);

    if (movementIds.length > 0) {
      const { error: deleteError } = await supabaseClient
        .from('cash_movements')
        .delete()
        .in('id', movementIds);

      if (deleteError) {
        console.error('❌ فشل حذف الحركات الخاطئة:', deleteError);
        throw deleteError;
      }
      console.log(`✅ تم حذف ${movementIds.length} حركة خاطئة`);
    }

    // المرحلة 2: إعادة إنشاء الحركات الصحيحة
    const { data: todaysInvoices } = await supabaseClient
      .from('orders')
      .select('id, tracking_number, order_number, final_amount, delivery_fee, receipt_received_at, receipt_received_by, created_by')
      .eq('receipt_received', true)
      .gte('receipt_received_at', '2025-11-24')
      .lt('receipt_received_at', '2025-11-25');

    const { data: mainCash } = await supabaseClient
      .from('cash_sources')
      .select('id')
      .eq('name', 'القاصة الرئيسية')
      .single();

    if (!mainCash) {
      throw new Error('لم يتم العثور على القاصة الرئيسية');
    }

    if (todaysInvoices && todaysInvoices.length > 0) {
      const correctMovements = todaysInvoices.map(invoice => ({
        cash_source_id: mainCash.id,
        amount: invoice.final_amount - (invoice.delivery_fee || 0),
        movement_type: 'in',
        reference_type: 'order',
        reference_id: invoice.id,
        description: `إيراد بيع طلب ${invoice.tracking_number || invoice.order_number}`,
        created_by: invoice.receipt_received_by || invoice.created_by,
        effective_at: invoice.receipt_received_at,
        created_at: invoice.receipt_received_at,
        balance_before: 0,
        balance_after: 0
      }));

      const { error: insertError } = await supabaseClient
        .from('cash_movements')
        .insert(correctMovements);

      if (insertError && !insertError.message.includes('duplicate')) {
        console.error('❌ فشل إعادة إنشاء الحركات:', insertError);
        throw insertError;
      }
      console.log(`✅ تم إعادة إنشاء ${correctMovements.length} حركة صحيحة`);
    }

    // المرحلة 3: إعادة حساب جميع الأرصدة
    const { data: allMovements } = await supabaseClient
      .from('cash_movements')
      .select('*')
      .order('effective_at', { ascending: true })
      .order('created_at', { ascending: true })
      .order('id', { ascending: true });

    if (allMovements) {
      let runningBalance = 0;
      const updates = allMovements.map(movement => {
        const balanceBefore = runningBalance;
        runningBalance += movement.movement_type === 'in' ? movement.amount : -movement.amount;
        return {
          id: movement.id,
          balance_before: balanceBefore,
          balance_after: runningBalance
        };
      });

      // تحديث كل حركة
      for (const update of updates) {
        await supabaseClient
          .from('cash_movements')
          .update({
            balance_before: update.balance_before,
            balance_after: update.balance_after
          })
          .eq('id', update.id);
      }

      console.log(`✅ تم إعادة حساب ${updates.length} رصيد`);

      // المرحلة 4: تحديث رصيد القاصة الرئيسية
      const finalBalance = updates[updates.length - 1]?.balance_after || 0;
      const { error: updateCashError } = await supabaseClient
        .from('cash_sources')
        .update({ current_balance: finalBalance, updated_at: new Date().toISOString() })
        .eq('name', 'القاصة الرئيسية');

      if (updateCashError) {
        console.error('❌ فشل تحديث رصيد القاصة:', updateCashError);
        throw updateCashError;
      }
      console.log(`✅ الرصيد النهائي للقاصة الرئيسية: ${finalBalance.toLocaleString('ar-IQ')} د.ع`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        deletedCount: movementIds.length,
        recreatedCount: todaysInvoices?.length || 0,
        finalBalance: allMovements?.[allMovements.length - 1]?.balance_after || 0
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ خطأ في إصلاح حركات النقد:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
