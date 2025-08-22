import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Info,
  ArrowRight,
  CheckCircle,
  Clock,
  Truck,
  XCircle,
  RotateCcw,
  Package
} from 'lucide-react';

// خريطة حالات الطلبات بين الوسيط والنظام المحلي
const STATUS_MAPPING = {
  // حالات شركة الوسيط والحالة المقابلة في نظامنا
  deliveryStatuses: {
    'في انتظار استلام المندوب': { local: 'pending', icon: Clock, color: 'yellow' },
    'تم الاستلام من قبل المندوب': { local: 'shipped', icon: Package, color: 'blue' },
    'جاري التوصيل': { local: 'delivery', icon: Truck, color: 'orange' },
    'تم التسليم': { local: 'delivered', icon: CheckCircle, color: 'green' },
    'تم التسليم والمصادقة المالية': { local: 'completed', icon: CheckCircle, color: 'green' },
    'مرجع من العميل': { local: 'returned', icon: RotateCcw, color: 'purple' },
    'ملغي': { local: 'cancelled', icon: XCircle, color: 'red' },
    'لا يمكن الوصول للعميل': { local: 'pending', icon: Clock, color: 'yellow' },
    'مؤجل': { local: 'pending', icon: Clock, color: 'yellow' }
  },
  
  // الحالات المحلية في نظامنا
  localStatuses: {
    'pending': { name: 'قيد التجهيز', icon: Clock, color: 'yellow' },
    'shipped': { name: 'تم الشحن', icon: Package, color: 'blue' },
    'delivery': { name: 'قيد التوصيل', icon: Truck, color: 'orange' },
    'delivered': { name: 'تم التوصيل', icon: CheckCircle, color: 'green' },
    'completed': { name: 'مكتمل', icon: CheckCircle, color: 'green' },
    'returned': { name: 'مُرجع', icon: RotateCcw, color: 'purple' },
    'cancelled': { name: 'ملغي', icon: XCircle, color: 'red' },
    'returned_in_stock': { name: 'راجع للمخزون', icon: RotateCcw, color: 'purple' }
  }
};

const DeliveryStatusMapping = () => {
  const [expandedSection, setExpandedSection] = useState(null);

  const getStatusColor = (color) => {
    const colors = {
      yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      blue: 'bg-blue-100 text-blue-800 border-blue-200',
      orange: 'bg-orange-100 text-orange-800 border-orange-200',
      green: 'bg-green-100 text-green-800 border-green-200',
      purple: 'bg-purple-100 text-purple-800 border-purple-200',
      red: 'bg-red-100 text-red-800 border-red-200'
    };
    return colors[color] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const StatusIcon = ({ status, className = "h-4 w-4" }) => {
    const IconComponent = status.icon;
    return <IconComponent className={className} />;
  };

  return (
    <div className="space-y-4">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          هذه هي الحالات التي ترسلها شركة التوصيل (الوسيط) وكيف يتم تحويلها في نظامنا
        </AlertDescription>
      </Alert>

      {/* خريطة تحويل الحالات من الوسيط لنظامنا */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5 text-primary" />
            تحويل حالات شركة التوصيل
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(STATUS_MAPPING.deliveryStatuses).map(([waseetStatus, mapping]) => (
              <div 
                key={waseetStatus}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <StatusIcon status={mapping} />
                  <span className="font-medium">{waseetStatus}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <Badge className={getStatusColor(mapping.color)}>
                    {STATUS_MAPPING.localStatuses[mapping.local]?.name || mapping.local}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* حالات النظام المحلي */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            حالات النظام المحلي
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Object.entries(STATUS_MAPPING.localStatuses).map(([key, status]) => (
              <div 
                key={key}
                className="flex items-center gap-3 p-3 border rounded-lg"
              >
                <StatusIcon status={status} />
                <div>
                  <div className="font-medium">{status.name}</div>
                  <div className="text-sm text-muted-foreground">({key})</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* معلومات المزامنة */}
      <Card>
        <CardHeader>
          <CardTitle>كيفية عمل المزامنة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-primary mt-2"></div>
              <p><strong>المزامنة التلقائية:</strong> يقوم النظام بالمزامنة التلقائية كل 15 ثانية</p>
            </div>
            
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-primary mt-2"></div>
              <p><strong>المزامنة السريعة:</strong> تفحص الطلبات المعلقة فقط (pending, delivery, shipped, returned)</p>
            </div>
            
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-primary mt-2"></div>
              <p><strong>المزامنة الشاملة:</strong> تفحص جميع الطلبات وتحدث الحالات</p>
            </div>
            
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-primary mt-2"></div>
              <p><strong>ربط المعرفات:</strong> يتم ربط طلبات النظام مع طلبات شركة التوصيل باستخدام tracking_number</p>
            </div>
            
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-primary mt-2"></div>
              <p><strong>تحديث الرسوم:</strong> يتم تحديث رسوم التوصيل تلقائياً من شركة التوصيل</p>
            </div>
            
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-primary mt-2"></div>
              <p><strong>تأكيد الاستلام المالي:</strong> يتم تحديث حالة استلام الإيصال المالي تلقائياً</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DeliveryStatusMapping;