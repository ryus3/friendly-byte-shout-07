import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, Truck, Home, RotateCcw } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

const TrackingTimeline = ({ order }) => {
  const timelineSteps = [
    { 
      status: 'pending', 
      label: 'قيد التحضير', 
      icon: Package,
      completed: order.status === 'pending' || order.status === 'shipped' || order.status === 'in_delivery' || order.status === 'delivered' || order.status === 'completed'
    },
    { 
      status: 'shipped', 
      label: 'تم الشحن', 
      icon: Truck,
      completed: order.status === 'shipped' || order.status === 'in_delivery' || order.status === 'delivered' || order.status === 'completed'
    },
    { 
      status: 'in_delivery', 
      label: 'قيد التوصيل', 
      icon: Truck,
      completed: order.status === 'in_delivery' || order.status === 'delivered' || order.status === 'completed'
    },
    { 
      status: 'delivered', 
      label: 'تم التسليم', 
      icon: Home,
      completed: order.status === 'delivered' || order.status === 'completed'
    }
  ];

  // حساب نسبة التقدم
  const completedSteps = timelineSteps.filter(step => step.completed).length;
  const progressPercentage = (completedSteps / timelineSteps.length) * 100;

  // إذا كان الطلب راجع
  if (order.status === 'returned' || order.status === 'returned_in_stock') {
    return (
      <Card className="border-2 border-orange-200 dark:border-orange-800">
        <CardHeader className="p-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <RotateCcw className="w-4 h-4" />
            حالة الطلب
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          <div className="flex flex-col items-center gap-2 p-4 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 rounded-lg">
            <RotateCcw className="w-8 h-8 text-orange-500" />
            <p className="text-sm font-medium text-orange-700 dark:text-orange-400">طلب راجع</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-violet-200 dark:border-violet-800">
      <CardHeader className="p-3">
        <CardTitle className="text-base">تتبع الطلب</CardTitle>
      </CardHeader>
      <CardContent className="p-3">
        {/* شريط التقدم */}
        <div className="mb-4">
          <Progress value={progressPercentage} className="h-1.5" />
          <p className="text-xs text-center mt-1 text-muted-foreground">{Math.round(progressPercentage)}%</p>
        </div>

        {/* Timeline */}
        <div className="space-y-3">
          {timelineSteps.map((step, index) => {
            const Icon = step.icon;
            const isActive = order.status === step.status;
            const isCompleted = step.completed && !isActive;
            
            return (
              <div key={step.status} className="relative">
                <div className="flex items-center gap-3">
                  {/* الأيقونة */}
                  <div className={`
                    w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all duration-300
                    ${isActive ? 'bg-gradient-to-br from-violet-500 to-purple-600 scale-110 shadow-lg' : ''}
                    ${isCompleted ? 'bg-green-500' : ''}
                    ${!step.completed ? 'bg-gray-300 dark:bg-gray-700' : ''}
                  `}>
                    <Icon className={`w-5 h-5 ${step.completed ? 'text-white' : 'text-gray-500'}`} />
                  </div>

                  {/* النص */}
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${isActive ? 'text-violet-600 dark:text-violet-400' : step.completed ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {step.label}
                    </p>
                    {isActive && (
                      <p className="text-xs text-violet-500 dark:text-violet-400">الحالة الحالية</p>
                    )}
                    {isCompleted && (
                      <p className="text-xs text-green-600 dark:text-green-400">✓ مكتمل</p>
                    )}
                  </div>
                </div>

                {/* خط الربط */}
                {index < timelineSteps.length - 1 && (
                  <div className={`
                    w-0.5 h-6 mr-5 mt-1 transition-colors duration-300
                    ${timelineSteps[index + 1].completed ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-700'}
                  `} />
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default TrackingTimeline;
