import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package } from 'lucide-react';

const TrackingInfo = ({ order }) => {
  return (
    <Card className="border-2 shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Package className="w-5 h-5 text-primary" />
          معلومات الطلب
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* رقم التتبع */}
        <div className="flex justify-between items-center pb-2 border-b">
          <span className="text-sm text-muted-foreground">رقم التتبع</span>
          <span className="font-bold text-base">{order.tracking_number}</span>
        </div>

        {/* المنتجات */}
        <div className="space-y-2">
          <p className="text-sm font-semibold">المنتجات:</p>
          {order.items?.map((item, index) => (
            <div key={index} className="flex justify-between items-center text-sm bg-muted/30 p-2 rounded">
              <div className="flex items-center gap-2">
                <span className="font-bold text-primary">{item.quantity}x</span>
                <span className="font-medium">{item.product?.name || item.product_name || 'منتج'}</span>
              </div>
              <span className="text-muted-foreground">
                {Number(item.unit_price || item.price || 0).toLocaleString()} د.ع
              </span>
            </div>
          ))}
        </div>

        {/* المبلغ الإجمالي */}
        <div className="flex justify-between items-center pt-3 border-t-2 border-primary/20">
          <div className="flex flex-col">
            <span className="font-medium text-sm">المبلغ الإجمالي</span>
            <span className="text-xs text-muted-foreground">(شامل التوصيل)</span>
          </div>
          <span className="text-xl font-bold text-primary">
            {Number(order.total_amount || 0).toLocaleString()} د.ع
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

export default TrackingInfo;
