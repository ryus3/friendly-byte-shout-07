import { ALWASEET_STATUS_DEFINITIONS } from '@/lib/alwaseet-statuses';
import { CheckCircle, Circle, Clock, Package, Truck, Home } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

const TrackingTimeline = ({ order }) => {
  const currentStatus = order.delivery_status || '1';
  
  // الحالات الرئيسية للـ Timeline
  const timelineSteps = [
    { status: '1', label: 'قيد التجهيز', icon: Package, completed: true },
    { status: '2', label: 'تم الشحن', icon: Truck, completed: ['2', '3', '4', '7', '14', '22', '24', '44'].includes(currentStatus) },
    { status: '3', label: 'قيد التوصيل', icon: Truck, completed: ['3', '4', '14', '22', '24', '44'].includes(currentStatus) },
    { status: '4', label: 'تم التسليم', icon: Home, completed: currentStatus === '4' }
  ];

  const completedSteps = timelineSteps.filter(s => s.completed).length;
  const progress = (completedSteps / timelineSteps.length) * 100;

  return (
    <Card className="border-2 border-violet-200 dark:border-violet-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          تتبع الطلب
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm font-medium">
            <span>التقدم</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Timeline */}
        <div className="space-y-6">
          {timelineSteps.map((step, index) => {
            const StatusIcon = step.icon;
            const isActive = currentStatus === step.status;
            const isCompleted = step.completed;
            
            return (
              <div key={step.status} className="flex items-start gap-4">
                {/* Icon */}
                <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                  isCompleted 
                    ? 'bg-green-500 text-white shadow-lg scale-110' 
                    : isActive 
                    ? 'bg-blue-500 text-white animate-pulse shadow-lg' 
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
                }`}>
                  {isCompleted ? <CheckCircle className="w-6 h-6" /> : <StatusIcon className="w-6 h-6" />}
                </div>

                {/* Content */}
                <div className="flex-1 pt-2">
                  <h3 className={`font-bold text-lg ${
                    isActive ? 'text-blue-600 dark:text-blue-400' : 'text-foreground'
                  }`}>
                    {step.label}
                  </h3>
                  {isActive && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <Clock className="w-3 h-3" />
                      الحالة الحالية
                    </p>
                  )}
                  {isCompleted && !isActive && (
                    <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                      ✓ مكتمل
                    </p>
                  )}
                </div>

                {/* Connector Line */}
                {index < timelineSteps.length - 1 && (
                  <div className={`absolute right-[1.4rem] mt-14 w-0.5 h-12 -z-10 ${
                    timelineSteps[index + 1].completed ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'
                  }`} />
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
