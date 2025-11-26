import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { ALWASEET_STATUS_DEFINITIONS } from '@/lib/alwaseet-statuses';
import { Clock, Package, CheckCircle, XCircle, AlertCircle, ArrowLeft, Truck } from 'lucide-react';

/**
 * مكون لعرض سجل حركات الطلب المفصل مع الأوقات والألوان المميزة
 * يجلب البيانات من order_status_history ويعرضها بشكل Timeline أنيق
 */
const OrderStatusHistory = ({ orderId }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

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
        
        // إزالة التكرارات - الاحتفاظ فقط بالحالات المختلفة المتتالية
        const filteredData = (data || []).filter((record, index) => {
          if (index === 0) return true;
          const prevRecord = data[index - 1];
          return record.new_delivery_status !== prevRecord.new_delivery_status;
        });
        
        setHistory(filteredData);
      } catch (error) {
        console.error('Error fetching order status history:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [orderId]);

  const getStatusIcon = (statusId) => {
    const statusConfig = ALWASEET_STATUS_DEFINITIONS[statusId];
    if (!statusConfig) return <Package className="w-3 h-3" />;

    const iconName = statusConfig.icon;
    switch (iconName) {
      case 'CheckCircle':
        return <CheckCircle className="w-3 h-3" />;
      case 'XCircle':
        return <XCircle className="w-3 h-3" />;
      case 'AlertCircle':
        return <AlertCircle className="w-3 h-3" />;
      case 'ArrowLeft':
        return <ArrowLeft className="w-3 h-3" />;
      case 'Truck':
        return <Truck className="w-3 h-3" />;
      case 'Package':
      default:
        return <Package className="w-3 h-3" />;
    }
  };

  const getStatusColor = (statusId) => {
    const statusConfig = ALWASEET_STATUS_DEFINITIONS[statusId];
    if (!statusConfig) return 'bg-gray-500';

    // تحويل اسم اللون إلى class Tailwind
    const colorMap = {
      'green': 'bg-green-500',
      'blue': 'bg-blue-500',
      'yellow': 'bg-yellow-500',
      'red': 'bg-red-500',
      'purple': 'bg-purple-500',
      'orange': 'bg-orange-500',
      'gray': 'bg-gray-500',
      'emerald': 'bg-emerald-500',
      'cyan': 'bg-cyan-500',
      'pink': 'bg-pink-500',
      'indigo': 'bg-indigo-500'
    };

    return colorMap[statusConfig.color] || 'bg-gray-500';
  };

  const getStatusText = (statusId, statusText) => {
    const statusConfig = ALWASEET_STATUS_DEFINITIONS[statusId];
    return statusConfig?.text || statusText || `حالة ${statusId}`;
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
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">سجل حركات الطلب</h3>
      </div>

      <div className="relative">
        {/* خط Timeline العمودي */}
        <div className="absolute right-[9px] top-3 bottom-3 w-px bg-gradient-to-b from-primary/40 via-primary/20 to-transparent"></div>

        {/* عناصر Timeline */}
        <div className="space-y-2">
          {history.map((record, index) => {
            const isFirst = index === 0;
            const statusId = record.new_delivery_status ? parseInt(record.new_delivery_status) : null;
            const statusColor = getStatusColor(statusId);
            const statusText = getStatusText(statusId, record.new_status);
            const statusIcon = getStatusIcon(statusId);

            return (
              <div key={record.id} className="flex items-center gap-3 relative">
                {/* نقطة الحالة */}
                <div className={`relative z-10 flex-shrink-0 w-5 h-5 rounded-full ${statusColor} flex items-center justify-center text-white shadow-md ${isFirst ? 'ring-2 ring-primary/30' : ''}`}>
                  {statusIcon}
                </div>

                {/* محتوى الحالة - سطر واحد */}
                <div className="flex-1 flex items-center justify-between py-1">
                  <p className="text-sm font-medium text-foreground">{statusText}</p>
                  <span className="text-xs text-muted-foreground font-mono">
                    {formatDateTime(record.changed_at)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default OrderStatusHistory;
