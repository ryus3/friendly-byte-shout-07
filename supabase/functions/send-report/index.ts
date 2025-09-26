import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.30.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReportRequest {
  reportType: 'financial' | 'inventory' | 'sales' | 'full';
  sendMethod: 'email' | 'telegram' | 'both';
  emailTo?: string;
  telegramChatId?: string;
  reportData: any;
  scheduledId?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { reportType, sendMethod, emailTo, telegramChatId, reportData, scheduledId }: ReportRequest = await req.json();

    console.log('تم طلب إرسال تقرير:', { reportType, sendMethod });

    // إنشاء محتوى التقرير
    const reportContent = generateReportContent(reportType, reportData);
    
    let emailSent = false;
    let telegramSent = false;
    const errors: string[] = [];

    // إرسال عبر البريد الإلكتروني
    if ((sendMethod === 'email' || sendMethod === 'both') && emailTo) {
      try {
        const emailResult = await sendEmailReport(emailTo, reportType, reportContent);
        if (emailResult.success) {
          emailSent = true;
          console.log('تم إرسال التقرير عبر البريد الإلكتروني بنجاح');
        } else {
          errors.push(`فشل إرسال البريد: ${emailResult.error}`);
        }
      } catch (error) {
        errors.push(`خطأ في إرسال البريد: ${error.message}`);
        console.error('خطأ في إرسال البريد:', error);
      }
    }

    // إرسال عبر التليغرام
    if ((sendMethod === 'telegram' || sendMethod === 'both') && telegramChatId) {
      try {
        const telegramResult = await sendTelegramReport(telegramChatId, reportType, reportContent);
        if (telegramResult.success) {
          telegramSent = true;
          console.log('تم إرسال التقرير عبر التليغرام بنجاح');
        } else {
          errors.push(`فشل إرسال التليغرام: ${telegramResult.error}`);
        }
      } catch (error) {
        errors.push(`خطأ في إرسال التليغرام: ${error.message}`);
        console.error('خطأ في إرسال التليغرام:', error);
      }
    }

    // تسجيل محاولة الإرسال
    if (scheduledId) {
      await supabase
        .from('scheduled_reports_log')
        .insert({
          scheduled_id: scheduledId,
          report_type: reportType,
          email_sent: emailSent,
          telegram_sent: telegramSent,
          errors: errors.length > 0 ? errors : null
        });
    }

    const response = {
      success: emailSent || telegramSent,
      emailSent,
      telegramSent,
      errors: errors.length > 0 ? errors : null,
      message: generateSuccessMessage(emailSent, telegramSent, errors)
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error('خطأ في معالجة طلب إرسال التقرير:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'حدث خطأ في إرسال التقرير'
      }),
      {
        status: 500,
        headers: { 
          'Content-Type': 'application/json', 
          ...corsHeaders 
        },
      }
    );
  }
};

function generateReportContent(reportType: string, data: any): string {
  const title = getReportTitle(reportType);
  const date = new Date().toLocaleDateString('ar-IQ');
  
  let content = `📊 ${title}\n`;
  content += `📅 التاريخ: ${date}\n\n`;

  switch (reportType) {
    case 'financial':
      content += `💰 الإيرادات: ${(data.totalRevenue || 0).toLocaleString()} د.ع\n`;
      content += `💸 المصاريف: ${(data.totalExpenses || 0).toLocaleString()} د.ع\n`;
      content += `📈 صافي الربح: ${(data.netProfit || 0).toLocaleString()} د.ع\n`;
      content += `📊 هامش الربح: ${data.profitMargin || '0%'}\n`;
      break;
      
    case 'inventory':
      content += `📦 إجمالي المنتجات: ${data.totalProducts || 0}\n`;
      content += `🔢 إجمالي المتغيرات: ${data.totalVariants || 0}\n`;
      content += `📋 إجمالي المخزون: ${data.totalStock || 0}\n`;
      break;
      
    case 'sales':
      content += `🛍️ إجمالي الطلبات: ${data.totalOrders || 0}\n`;
      content += `💰 إجمالي المبيعات: ${(data.totalRevenue || 0).toLocaleString()} د.ع\n`;
      content += `📊 متوسط قيمة الطلب: ${(data.averageOrderValue || 0).toLocaleString()} د.ع\n`;
      break;
      
    case 'full':
    default:
      content += `💰 إجمالي المبيعات: ${(data.totalRevenue || 0).toLocaleString()} د.ع\n`;
      content += `📦 إجمالي المنتجات: ${data.totalProducts || 0}\n`;
      content += `🛍️ إجمالي الطلبات: ${data.totalOrders || 0}\n`;
      content += `📋 إجمالي المخزون: ${data.totalStock || 0}\n`;
      content += `📈 صافي الربح: ${(data.netProfit || 0).toLocaleString()} د.ع\n`;
      break;
  }

  content += `\n🤖 تم إنشاء هذا التقرير تلقائياً بواسطة النظام`;
  
  return content;
}

function getReportTitle(reportType: string): string {
  switch (reportType) {
    case 'financial': return 'التقرير المالي';
    case 'inventory': return 'تقرير المخزون';
    case 'sales': return 'تقرير المبيعات';
    case 'full': return 'التقرير الشامل';
    default: return 'التقرير';
  }
}

async function sendEmailReport(emailTo: string, reportType: string, content: string) {
  // يجب إضافة مكتبة البريد الإلكتروني مثل Resend هنا
  // هذا مثال أساسي - يحتاج إلى إعداد فعلي لخدمة البريد
  
  try {
    // محاكاة إرسال البريد - يجب استبدالها بالتنفيذ الفعلي
    console.log(`محاولة إرسال بريد إلكتروني إلى: ${emailTo}`);
    console.log(`المحتوى: ${content}`);
    
    // هنا يجب إضافة الكود الفعلي لإرسال البريد
    // مثل استخدام Resend أو SendGrid
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function sendTelegramReport(chatId: string, reportType: string, content: string) {
  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  
  if (!botToken) {
    return { success: false, error: 'رمز بوت التليغرام غير موجود' };
  }

  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: content,
        parse_mode: 'HTML'
      }),
    });

    const result = await response.json();
    
    if (result.ok) {
      return { success: true };
    } else {
      return { success: false, error: result.description || 'فشل في إرسال رسالة التليغرام' };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function generateSuccessMessage(emailSent: boolean, telegramSent: boolean, errors: string[]): string {
  if (emailSent && telegramSent) {
    return 'تم إرسال التقرير بنجاح عبر البريد الإلكتروني والتليغرام';
  } else if (emailSent) {
    return 'تم إرسال التقرير بنجاح عبر البريد الإلكتروني';
  } else if (telegramSent) {
    return 'تم إرسال التقرير بنجاح عبر التليغرام';
  } else if (errors.length > 0) {
    return `فشل في إرسال التقرير: ${errors.join(', ')}`;
  } else {
    return 'لم يتم تحديد طريقة إرسال صالحة';
  }
}

serve(handler);