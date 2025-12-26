import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Eye, DollarSign } from 'lucide-react';
import { getStatusInfo, canRequestSettlement } from '@/utils/profitStatusHelper';

const ProfitDetailsMobile = ({
  orders,
  canViewAll,
  canRequestSettlement,
  selectedOrders,
  onSelectOrder,
  onViewOrder,
  onMarkReceived,
  showManagerProfit = false, // ✅ فقط المدير العام يرى ربح المدير
}) => {
  return (
    <div className="space-y-4">
      {orders.length > 0 ? (
        orders.map(order => {
          const statusInfo = getStatusInfo(order.profitStatus);
          const canSelect = canRequestSettlement && statusInfo.canSelect;
          return (
            <Card key={order.id} className="p-4">
              <div className="flex justify-between items-start">
                <div className="flex items-start gap-2">
                  {canSelect && (
                    <Checkbox
                      className="mt-1"
                      checked={selectedOrders.includes(order.id)}
                      onCheckedChange={() => onSelectOrder(order.id)}
                    />
                  )}
                  <div>
                    <p className="font-semibold">{order.customer_name || 'غير معروف'}</p>
                    <p className="text-xs text-muted-foreground">{order.tracking_number || order.order_number || 'لا يوجد رقم'}</p>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">حالة الربح</p>
                  <Badge variant={statusInfo.variant}>
                    {statusInfo.text}
                  </Badge>
                </div>
              </div>
              {canViewAll && <div className="text-xs text-muted-foreground mt-2">{order.employeeName}</div>}
              <div className="flex justify-between items-end mt-2 pt-2 border-t">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">ربح الموظف</p>
                  <p className="font-bold text-sm text-blue-400">{order.profit.toLocaleString()} د.ع</p>
                </div>
                {/* ✅ فقط المدير العام يرى ربح المدير - إخفاءه عن مديري الأقسام والموظفين */}
                {showManagerProfit && (
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">ربح المدير</p>
                    <p className="font-bold text-sm text-green-400">{order.managerProfitShare.toLocaleString()} د.ع</p>
                  </div>
                )}
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => onViewOrder(order)}>
                    <Eye className="w-4 h-4" />
                  </Button>
                  {statusInfo.canSelect && canViewAll && onMarkReceived && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => onMarkReceived(order.id)}
                      className="text-xs"
                    >
                      <DollarSign className="w-3 h-3 ml-1" />
                      استلام
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })
      ) : (
        <p className="text-center py-8 text-muted-foreground">لا توجد أرباح تطابق الفلاتر.</p>
      )}
    </div>
  );
};

export default ProfitDetailsMobile;