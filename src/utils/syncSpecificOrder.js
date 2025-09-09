// أداة سريعة لمزامنة طلب محدد مع الوسيط
import { supabase } from '@/integrations/supabase/client';
import * as AlWaseetAPI from '@/lib/alwaseet-api';

export const syncSpecificOrder = async (qrId, token) => {
  try {
    console.log(`🔄 مزامنة عاجلة للطلب ${qrId}...`);
    
    // جلب الطلب من الوسيط
    const waseetOrder = await AlWaseetAPI.getOrderByQR(token, qrId);
    if (!waseetOrder) {
      console.warn(`❌ لم يتم العثور على الطلب ${qrId} في الوسيط`);
      return null;
    }

    console.log('📋 بيانات الطلب الحالية من الوسيط:', waseetOrder);

    // تحديد الحالة المحلية الصحيحة بناء على نص الحالة
    const waseetStatusText = waseetOrder.status || waseetOrder.status_text || waseetOrder.status_name || '';
    const statusLower = String(waseetStatusText || '').toLowerCase();
    
    // تطبيع حالة التوصيل: تفضيل المعرّف الرقمي، وإلا تحويل النص 'تم التسليم للزبون' إلى '4'
    const waseetStatusId = waseetOrder.status_id || waseetOrder.state_id || waseetOrder.statusId || waseetOrder.stateId;
    const normalizedDeliveryStatus = String(waseetStatusId || '').trim() || (waseetStatusText === 'تم التسليم للزبون' ? '4' : waseetStatusText);
    
    let correctLocalStatus = 'pending';
    if (statusLower.includes('تسليم') || statusLower.includes('مسلم')) {
      correctLocalStatus = 'delivered';
    } else if (statusLower.includes('ملغي') || statusLower.includes('إلغاء') || statusLower.includes('رفض')) {
      correctLocalStatus = 'cancelled';
    } else if (statusLower.includes('راجع')) {
      correctLocalStatus = 'returned';
    } else if (statusLower.includes('مندوب') || statusLower.includes('استلام')) {
      correctLocalStatus = 'shipped';
    } else if (statusLower.includes('جاري') || statusLower.includes('توصيل') || statusLower.includes('في الطريق')) {
      correctLocalStatus = 'delivery';
    }

    // جلب الطلب المحلي
    const { data: localOrder, error: localErr } = await supabase
      .from('orders')
      .select('*')
      .eq('tracking_number', qrId)
      .maybeSingle();

    if (localErr) {
      console.error('❌ خطأ في جلب الطلب المحلي:', localErr);
      return null;
    }

    if (!localOrder) {
      console.warn(`❌ لم يتم العثور على الطلب ${qrId} محلياً`);
      return null;
    }

    console.log(`📊 الحالة المحلية الحالية: ${localOrder.status}, الحالة الصحيحة: ${correctLocalStatus}`);
    console.log(`📊 حالة الوسيط الحالية: ${localOrder.delivery_status}, الحالة الجديدة: ${waseetStatusText}`);

    // تحضير التحديثات
    const updates = {
      status: correctLocalStatus,
      delivery_status: normalizedDeliveryStatus,
      delivery_partner_order_id: String(waseetOrder.id),
      updated_at: new Date().toISOString()
    };

    // تحديث رسوم التوصيل
    if (waseetOrder.delivery_price) {
      const deliveryPrice = parseInt(String(waseetOrder.delivery_price)) || 0;
      if (deliveryPrice >= 0) {
        updates.delivery_fee = deliveryPrice;
      }
    }

    // تحديث حالة استلام الإيصال
    if (waseetOrder.deliver_confirmed_fin === 1 || correctLocalStatus === 'delivered') {
      updates.receipt_received = true;
    }

    // تطبيق التحديثات
    const { error: updateErr } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', localOrder.id);

    if (updateErr) {
      console.error('❌ خطأ في تحديث الطلب:', updateErr);
      return null;
    }

    console.log(`✅ تم تحديث الطلب ${qrId} بنجاح:`);
    console.log(`   - الحالة: ${localOrder.status} → ${correctLocalStatus}`);
    console.log(`   - حالة التوصيل: ${localOrder.delivery_status} → ${waseetStatusText}`);
    console.log(`   - معرف الوسيط: ${waseetOrder.id}`);
    
    return {
      success: true,
      needs_update: localOrder.status !== correctLocalStatus || localOrder.delivery_status !== waseetStatusText,
      updates,
      waseet_order: waseetOrder,
      local_order: { ...localOrder, ...updates }
    };

  } catch (error) {
    console.error(`❌ خطأ في مزامنة الطلب ${qrId}:`, error);
    throw error;
  }
};

// مزامنة سريعة للطلب 98713588
export const syncOrder98713588 = async () => {
  try {
    // يمكن استخدام هذا التوكن الثابت للمزامنة السريعة
    const token = "7ed481be5a53bf1c12a77fbb9384b9b6";
    const result = await syncSpecificOrder("98713588", token);
    
    if (result && result.success) {
      console.log('🎯 تمت مزامنة الطلب 98713588 بنجاح');
      alert(`تمت مزامنة الطلب 98713588 بنجاح!\nالحالة الجديدة: ${result.updates.status}\nحالة الوسيط: ${result.updates.delivery_status}`);
      window.location.reload();
    } else {
      console.warn('⚠️ لم تتم المزامنة أو لم تكن مطلوبة');
      alert('لم تكن هناك حاجة للمزامنة أو حدث خطأ');
    }
  } catch (error) {
    console.error('❌ خطأ في مزامنة الطلب 98713588:', error);
    alert(`خطأ في المزامنة: ${error.message}`);
  }
};

// تجعل الدالة متاحة في النافذة للاستخدام السريع
if (typeof window !== 'undefined') {
  window.syncOrder98713588 = syncOrder98713588;
}