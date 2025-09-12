// دالة مساعدة - تم دمجها في الملف الرئيسي
async function completeOrderWithSelectedRegion(chatId: number, selectedRegion: any, pendingSelection: any) {
  try {
    // إعادة معالجة الطلب الأصلي مع المنطقة المختارة
    const originalText = pendingSelection.original_text;
    
    // استخراج بيانات العميل من النص الأصلي
    const lines = originalText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    let customerName = '';
    let customerPhone = '';
    
    // استخراج اسم العميل (السطر الأول عادة)
    if (lines.length > 0) {
      customerName = lines[0].replace(/[^\u0600-\u06FF\s]/g, '').trim();
    }
    
    // استخراج رقم الهاتف
    for (const line of lines) {
      const phoneMatch = line.match(/[\d\s\-\+\(\)]{8,}/);
      if (phoneMatch) {
        customerPhone = phoneMatch[0].replace(/\s/g, '');
        break;
      }
    }
    
    // استخراج المنتجات
    const foundProducts = [];
    let totalAmount = 0;
    
    for (const line of lines) {
      if (isProductLine(line)) {
        const product = await findProductInLine(line);
        if (product.found) {
          foundProducts.push(product);
          totalAmount += product.total_price;
        }
      }
    }
    
    if (foundProducts.length === 0) {
      await sendTelegramMessage(chatId, 'لم يتم العثور على منتجات صحيحة في طلبك.');
      return;
    }
    
    // تشكيل بيانات الطلب مع المنطقة المختارة
    const orderData = {
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_city: pendingSelection.city_name,
      customer_address: selectedRegion.name,
      customer_province: pendingSelection.city_name === 'بغداد' ? 'بغداد' : pendingSelection.city_name,
      items: foundProducts,
      total_amount: totalAmount,
      source: 'telegram',
      telegram_chat_id: chatId,
      created_by: pendingSelection.employee_code || 'EMP001', // استخدام كود الموظف من الحالة المحفوظة
      original_text: originalText
    };
    
    // حفظ الطلب في ai_orders
    const { data: savedOrder, error: saveError } = await supabaseClient
      .from('ai_orders')
      .insert(orderData)
      .select()
      .single();
    
    if (saveError) {
      console.error('Error saving order with selected region:', saveError);
      await sendTelegramMessage(chatId, 'حدث خطأ في حفظ الطلب. يرجى المحاولة مرة أخرى.');
      return;
    }
    
    // إرسال رسالة تأكيد
    let confirmationMessage = `✅ تم استلام طلبك بنجاح!\n\n`;
    confirmationMessage += `👤 العميل: ${customerName}\n`;
    confirmationMessage += `📱 الهاتف: ${customerPhone}\n`;
    confirmationMessage += `🏙️ العنوان: ${pendingSelection.city_name} - ${selectedRegion.name}\n\n`;
    confirmationMessage += `📦 المنتجات:\n`;
    
    foundProducts.forEach(product => {
      confirmationMessage += `• ${product.product_name}`;
      if (product.color) confirmationMessage += ` - ${product.color}`;
      if (product.size) confirmationMessage += ` - ${product.size}`;
      confirmationMessage += ` (${product.quantity}x) = ${product.total_price.toLocaleString()} د.ع\n`;
    });
    
    confirmationMessage += `\n💰 المجموع: ${totalAmount.toLocaleString()} د.ع`;
    confirmationMessage += `\n\n⏳ سيتم مراجعة طلبك قريباً...`;
    
    await sendTelegramMessage(chatId, confirmationMessage);
    
  } catch (error) {
    console.error('Error completing order with selected region:', error);
    await sendTelegramMessage(chatId, 'حدث خطأ في معالجة طلبك. يرجى إعادة إرسال الطلب.');
  }
}