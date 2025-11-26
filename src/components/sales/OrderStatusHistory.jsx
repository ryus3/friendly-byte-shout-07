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
        setHistory(data || []);
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
    if (!statusConfig) return <Package className="w-4 h-4" />;

    const iconName = statusConfig.icon;
    switch (iconName) {
      case 'CheckCircle':
        return <CheckCircle className="w-4 h-4" />;
      case 'XCircle':
        return <XCircle className="w-4 h-4" />;
      case 'AlertCircle':
        return <AlertCircle className="w-4 h-4" />;
      case 'ArrowLeft':
        return <ArrowLeft className="w-4 h-4" />;
      case 'Truck':
        return <Truck className="w-4 h-4" />;
      case 'Package':
      default:
        return <Package className="w-4 h-4" />;
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
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-lg">سجل حركات الطلب</h3>
      </div>

      <div className="relative">
        {/* خط Timeline العمودي */}
        <div className="absolute right-[15px] top-8 bottom-8 w-0.5 bg-gradient-to-b from-primary/50 via-primary/30 to-primary/10"></div>

        {/* عناصر Timeline */}
        <div className="space-y-4">
          {history.map((record, index) => {
            const isFirst = index === 0;
            const isLast = index === history.length - 1;
            const statusId = record.new_delivery_status ? parseInt(record.new_delivery_status) : null;
            const statusColor = getStatusColor(statusId);
            const statusText = getStatusText(statusId, record.new_status);
            const statusIcon = getStatusIcon(statusId);

            return (
              <div key={record.id} className="flex items-start gap-4 relative">
                {/* نقطة الحالة */}
                <div className={`relative z-10 flex-shrink-0 w-8 h-8 rounded-full ${statusColor} flex items-center justify-center text-white shadow-lg ${isFirst ? 'ring-4 ring-primary/20' : ''}`}>
                  {statusIcon}
                </div>

                {/* محتوى الحالة */}
                <div className={`flex-1 pb-4 ${!isLast ? 'border-b border-border/50' : ''}`}>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <p className="font-medium text-foreground">{statusText}</p>
                      {record.old_status && (
                        <p className="text-xs text-muted-foreground mt-1">
                          من: {getStatusText(record.old_delivery_status ? parseInt(record.old_delivery_status) : null, record.old_status)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="w-3.5 h-3.5" />
                      <span className="font-mono">{formatDateTime(record.changed_at)}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* إحصائية سريعة */}
      <div className="mt-6 p-4 bg-muted/30 rounded-lg border border-border/50">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">إجمالي التغييرات:</span>
          <span className="font-semibold text-foreground">{history.length} تغيير</span>
        </div>
        {history[history.length - 1] && (
          <div className="flex items-center justify-between text-sm mt-2">
            <span className="text-muted-foreground">تاريخ الإنشاء:</span>
            <span className="font-mono text-xs text-foreground">
              {formatDateTime(history[history.length - 1].changed_at)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderStatusHistory;
