import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wallet, CreditCard, PiggyBank, HelpCircle } from 'lucide-react';

const PaymentSourceSummary = ({ purchases = [] }) => {
  // حساب التكاليف حسب مصدر الدفع
  const paymentSourceStats = React.useMemo(() => {
    const stats = purchases.reduce((acc, purchase) => {
      const metadata = purchase.metadata || {};
      const source = metadata.payment_source || 'capital'; // افتراضي رأس المال
      
      const total = (purchase.total_amount || 0) + 
                   (purchase.shipping_cost || 0) + 
                   (purchase.transfer_cost || 0);
      
      if (!acc[source]) {
        acc[source] = {
          total: 0,
          count: 0,
          purchases: []
        };
      }
      
      acc[source].total += total;
      acc[source].count += 1;
      acc[source].purchases.push(purchase);
      
      return acc;
    }, {});
    
    return stats;
  }, [purchases]);

  const getSourceIcon = (source) => {
    switch (source) {
      case 'capital': return <PiggyBank className="h-5 w-5" />;
      case 'cash': return <Wallet className="h-5 w-5" />;
      case 'loan': return <CreditCard className="h-5 w-5" />;
      default: return <HelpCircle className="h-5 w-5" />;
    }
  };

  const getSourceName = (source) => {
    switch (source) {
      case 'capital': return 'رأس المال';
      case 'cash': return 'القاصة النقدية';
      case 'loan': return 'قرض/تمويل خارجي';
      case 'other': return 'مصدر آخر';
      default: return 'غير محدد';
    }
  };

  const getSourceColor = (source) => {
    switch (source) {
      case 'capital': return 'bg-green-100 text-green-800 border-green-300';
      case 'cash': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'loan': return 'bg-orange-100 text-orange-800 border-orange-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const totalSpent = Object.values(paymentSourceStats).reduce((sum, stat) => sum + stat.total, 0);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          ملخص مصادر التمويل
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* الإجمالي العام */}
          <div className="p-4 bg-slate-50 rounded-lg border">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">إجمالي المصاريف</span>
              <span className="text-lg font-bold text-foreground">
                {totalSpent.toLocaleString()} د.ع
              </span>
            </div>
          </div>

          {/* تفصيل المصادر */}
          <div className="grid gap-3">
            {Object.entries(paymentSourceStats).map(([source, stats]) => (
              <div key={source} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  {getSourceIcon(source)}
                  <div>
                    <div className="font-medium">{getSourceName(source)}</div>
                    <div className="text-sm text-muted-foreground">
                      {stats.count} فاتورة
                    </div>
                  </div>
                </div>
                <div className="text-left">
                  <div className="font-bold text-lg">
                    {stats.total.toLocaleString()} د.ع
                  </div>
                  <Badge variant="outline" className={getSourceColor(source)}>
                    {((stats.total / totalSpent) * 100).toFixed(1)}%
                  </Badge>
                </div>
              </div>
            ))}
          </div>

          {/* رسالة إرشادية */}
          {Object.keys(paymentSourceStats).length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Wallet className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>لا توجد مشتريات لعرض ملخص التمويل</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default PaymentSourceSummary;