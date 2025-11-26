import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { ALWASEET_STATUS_DEFINITIONS } from '@/lib/alwaseet-statuses';
import { Clock } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

/**
 * مكون لعرض سجل حركات الطلب المفصل مع الأوقات والألوان المميزة
 * يجلب البيانات من order_status_history ويعرضها بشكل Timeline أنيق
 */
const OrderStatusHistory = ({ orderId }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // دالة لتحويل القيمة إلى ID
  const getStatusIdFromValue = (value) => {
    if (!value) return null;
    
    // إذا كان رقم
    const parsed = parseInt(value);
    if (!isNaN(parsed)) return parsed;
    
    // إذا كان نص - البحث في التعريفات عن نص مطابق
    for (const [id, config] of Object.entries(ALWASEET_STATUS_DEFINITIONS)) {
      if (config.text === value) return parseInt(id);
    }
    
    return null;
  };

  useEffect(() => {
    const fetchHistory = async () => {
      if (!orderId) return;

      try {
        const { data, error } = await supabase
          .from('order_status_history')
          .select('*')
          .eq('order_id', orderId)
          .order('changed_at', { ascending: false });

        if (error) throw error;
        
        // إزالة التكرارات المتتالية بشكل صحيح
        const uniqueHistory = [];
        for (const record of (data || [])) {
          const statusId = getStatusIdFromValue(record.new_delivery_status);
          const lastId = uniqueHistory.length > 0 
            ? getStatusIdFromValue(uniqueHistory[uniqueHistory.length - 1].new_delivery_status)
            : null;
          
          if (statusId !== lastId && statusId !== null) {
            uniqueHistory.push(record);
          }
        }
        
        setHistory(uniqueHistory);
      } catch (error) {
        console.error('Error fetching order status history:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [orderId]);

  const getStatusColor = (statusId) => {
    const statusConfig = ALWASEET_STATUS_DEFINITIONS[statusId];
    if (!statusConfig) return 'bg-gray-500';
    
    // استخراج اللون الأساسي من الـ gradient class
    const colorClass = statusConfig.color;
    
    // البحث عن اللون الأساسي (from-COLOR-500 or via-COLOR-500 or to-COLOR-500)
    const colorMatch = colorClass.match(/(?:from|via|to)-(\w+)-\d+/);
    if (colorMatch) {
      const baseColor = colorMatch[1]; // green, blue, yellow, etc.
      return `bg-${baseColor}-500`; // مثال: bg-green-500
    }
    
    return 'bg-gray-500';
  };

  const getStatusText = (statusId) => {
    const statusConfig = ALWASEET_STATUS_DEFINITIONS[statusId];
    return statusConfig?.text || `حالة ${statusId}`;
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return format(date, 'dd/MM - hh:mm a', { locale: ar });
    } catch (error) {
      return dateString;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>لا يوجد سجل حركات لهذا الطلب</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-2">
        <Clock className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">سجل حركات الطلب</h3>
      </div>

      {/* منطقة التمرير الداخلي - ارتفاع محدد لعرض 3-4 حالات */}
      <ScrollArea className="h-32">
        <div className="space-y-1 pr-2">
          {history.map((record, index) => {
            const statusId = getStatusIdFromValue(record.new_delivery_status);
            const statusColor = getStatusColor(statusId);
            const statusText = getStatusText(statusId);

            return (
              <div key={record.id} className="flex items-center gap-2 py-0.5">
                {/* نقطة ملونة صغيرة */}
                <div className={`w-3 h-3 rounded-full ${statusColor} shadow-sm flex-shrink-0`} />
                
                {/* اسم الحالة */}
                <span className="text-xs font-medium flex-1">{statusText}</span>
                
                {/* التاريخ بخط صغير رمادي */}
                <span className="text-[10px] text-muted-foreground font-mono whitespace-nowrap">
                  {formatDateTime(record.changed_at)}
                </span>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};

export default OrderStatusHistory;
