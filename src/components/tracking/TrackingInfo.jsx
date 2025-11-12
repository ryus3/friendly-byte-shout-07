import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, MapPin, Phone, User, Calendar, Hash } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

const TrackingInfo = ({ order }) => {
  return (
    <Card className="border-2 border-violet-200 dark:border-violet-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="w-5 h-5" />
          معلومات الطلب
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-3 p-3 bg-violet-50 dark:bg-violet-950/20 rounded-lg">
            <Hash className="w-5 h-5 text-violet-600" />
            <div>
              <p className="text-xs text-muted-foreground">رقم الطلب</p>
              <p className="font-bold">{order.tracking_number}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
            <Calendar className="w-5 h-5 text-blue-600" />
            <div>
              <p className="text-xs text-muted-foreground">تاريخ الطلب</p>
              <p className="font-bold">
                {format(new Date(order.created_at), 'dd MMMM yyyy', { locale: ar })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
            <User className="w-5 h-5 text-green-600" />
            <div>
              <p className="text-xs text-muted-foreground">اسم العميل</p>
              <p className="font-bold">{order.customer_name}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
            <Phone className="w-5 h-5 text-orange-600" />
            <div>
              <p className="text-xs text-muted-foreground">رقم الهاتف</p>
              <p className="font-bold">{order.customer_phone}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg md:col-span-2">
            <MapPin className="w-5 h-5 text-purple-600" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">العنوان</p>
              <p className="font-bold">
                {order.customer_address}, {order.customer_city || order.customer_governorate}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TrackingInfo;
