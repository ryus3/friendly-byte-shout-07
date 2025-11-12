import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, Truck, MapPin, CheckCircle, XCircle } from 'lucide-react';
import { ALWASEET_STATUS_DEFINITIONS } from '@/lib/alwaseet-statuses';
import { cn } from '@/lib/utils';

const TrackingTimeline = ({ order }) => {
  // خطوات التتبع الأساسية
  const timelineSteps = [
    {
      status: 'pending',
      label: 'قيد المعالجة',
      icon: Package,
      completed: ['pending', 'shipped', 'in_delivery', 'delivered'].includes(order.status)
    },
    {
      status: 'shipped',
      label: 'تم الشحن',
      icon: Truck,
      completed: ['shipped', 'in_delivery', 'delivered'].includes(order.status)
    },
    {
      status: 'in_delivery',
      label: 'قيد التوصيل',
      icon: MapPin,
      completed: ['in_delivery', 'delivered'].includes(order.status)
    },
    {
      status: 'delivered',
      label: 'تم التسليم',
      icon: CheckCircle,
      completed: order.status === 'delivered'
    }
  ];

  // حساب نسبة التقدم
  const completedSteps = timelineSteps.filter(step => step.completed).length;
  const progressPercentage = (completedSteps / timelineSteps.length) * 100;

  // حالة خاصة للطلبات المرتجعة
  if (order.status === 'returned' || order.status === 'returned_in_stock') {
    return (
      <Card className="border-2 border-red-500/50 shadow-lg">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-red-600 text-lg">
            <XCircle className="w-5 h-5" />
            طلب مرتجع
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            تم إرجاع هذا الطلب إلى التاجر
          </p>
        </CardContent>
      </Card>
    );
  }

  // الحصول على وصف الحالة الحالية من التعريفات
  const currentStatusDef = ALWASEET_STATUS_DEFINITIONS[order.delivery_status];
  const currentStatusText = currentStatusDef?.text || order.status;

  return (
    <Card className="border-2 shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">تتبع الطلب</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* شريط التقدم */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>التقدم</span>
            <span className="font-bold">{Math.round(progressPercentage)}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-1.5 shadow-inner">
            <div
              className="bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500 h-1.5 rounded-full transition-all duration-500 shadow-sm"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        {/* الحالة الحالية */}
        <div className="p-2.5 bg-gradient-to-r from-primary/10 to-violet-500/10 rounded-lg border border-primary/30 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground">الحالة الحالية:</p>
          <p className="text-sm font-bold text-primary">{currentStatusText}</p>
        </div>

        {/* Timeline */}
        <div className="space-y-3">
          {timelineSteps.map((step, index) => {
            const Icon = step.icon;
            const isActive = order.status === step.status;
            const isCompleted = step.completed;

            return (
              <div key={step.status} className="flex items-center gap-2.5">
                {/* Icon */}
                <div
                  className={cn(
                    'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all',
                    isCompleted
                      ? 'bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md'
                      : 'bg-muted/50 text-muted-foreground'
                  )}
                >
                  <Icon className="w-4 h-4" />
                </div>

                {/* Label */}
                <div className="flex-1">
                  <p
                    className={cn(
                      'text-sm font-medium transition-colors',
                      isCompleted ? 'text-foreground' : 'text-muted-foreground',
                      isActive && 'text-primary font-bold'
                    )}
                  >
                    {step.label}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default TrackingTimeline;
