import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, DollarSign } from 'lucide-react';

const TrackingInfo = ({ order }) => {
  return (
    <Card className="border-2 border-violet-200 dark:border-violet-800">
      <CardHeader className="p-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Package className="w-4 h-4" />
          معلومات الطلب
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 space-y-3">
        {/* رقم الطلب */}
        <div className="flex items-center justify-between p-2 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20 rounded-lg">
          <span className="text-xs text-muted-foreground">رقم الطلب</span>
          <span className="text-sm font-bold text-violet-600 dark:text-violet-400">{order.tracking_number}</span>
        </div>

        {/* المنتجات */}
        {order.items && order.items.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">المنتجات:</p>
            <div className="space-y-1">
              {order.items.map((item, index) => (
                <div key={index} className="flex justify-between items-center p-2 bg-muted/50 rounded text-xs">
                  <span className="font-medium">{item.product_name}</span>
                  <span className="text-muted-foreground">× {item.quantity}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* السعر الكلي */}
        <div className="flex items-center justify-between p-2 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 rounded-lg border border-green-200 dark:border-green-800">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-green-600 dark:text-green-400" />
            <span className="text-xs text-muted-foreground">المبلغ الإجمالي</span>
          </div>
          <span className="text-sm font-bold text-green-600 dark:text-green-400">
            {Number(order.total_amount || 0).toLocaleString()} د.ع
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

export default TrackingInfo;
