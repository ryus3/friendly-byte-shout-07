import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Eye, DollarSign } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { ar } from 'date-fns/locale';
import { getStatusInfo, canRequestSettlement } from '@/utils/profitStatusHelper';

const ProfitDetailsTable = ({
  orders,
  canViewAll,
  canRequestSettlement,
  selectedOrders,
  onSelectOrder,
  onSelectAll,
  onViewOrder,
  onViewInvoice,
  onMarkReceived,
  showManagerProfit = false, // ✅ فقط المدير العام يرى ربح المدير
}) => {
  const allPendingSelectable = orders.filter(p => getStatusInfo(p.profitStatus).canSelect);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {canRequestSettlement && (
            <TableHead>
              <Checkbox
                checked={selectedOrders.length > 0 && selectedOrders.length === allPendingSelectable.length}
                onCheckedChange={onSelectAll}
                disabled={allPendingSelectable.length === 0}
              />
            </TableHead>
          )}
          <TableHead>رقم التتبع</TableHead>
          <TableHead>الزبون</TableHead>
          {canViewAll && <TableHead>الموظف</TableHead>}
          <TableHead>تاريخ التسليم</TableHead>
          <TableHead>فاتورة التحاسب</TableHead>
          <TableHead>ربح الموظف</TableHead>
          {showManagerProfit && <TableHead>ربح المدير</TableHead>}
          <TableHead>حالة الربح</TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.length > 0 ? (
          orders.map(order => {
            const deliveryDate = order.created_at ? parseISO(order.created_at) : null;
            const statusInfo = getStatusInfo(order.profitStatus);
            const canSelect = canRequestSettlement && statusInfo.canSelect;
            return (
              <TableRow key={order.id} data-state={selectedOrders.includes(order.id) ? 'selected' : ''}>
                {canRequestSettlement && (
                  <TableCell>
                    {canSelect && (
                      <Checkbox
                        checked={selectedOrders.includes(order.id)}
                        onCheckedChange={() => onSelectOrder(order.id)}
                      />
                    )}
                  </TableCell>
                )}
                <TableCell>{order.tracking_number || order.order_number || 'لا يوجد رقم'}</TableCell>
                <TableCell>{order.customer_name || 'غير معروف'}</TableCell>
                {canViewAll && <TableCell>{order.employeeName}</TableCell>}
                <TableCell>
                  {deliveryDate && isValid(deliveryDate) ? format(deliveryDate, 'd MMM yyyy', { locale: ar }) : 'غير محدد'}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {order.settlement_invoice_id ? (
                    <Button variant="link" className="p-0 h-auto" onClick={() => onViewInvoice(order.settlement_invoice_id)}>
                      INV-{order.settlement_invoice_id}
                    </Button>
                  ) : 'N/A'}
                </TableCell>
                <TableCell className="text-blue-400 font-semibold">{order.profit.toLocaleString()} د.ع</TableCell>
                {showManagerProfit && <TableCell className="text-green-400 font-semibold">{order.managerProfitShare.toLocaleString()} د.ع</TableCell>}
                <TableCell>
                  <Badge variant={statusInfo.variant}>
                    {statusInfo.text}
                  </Badge>
                </TableCell>
                <TableCell>
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
                </TableCell>
              </TableRow>
            );
          })
        ) : (
          <TableRow>
            <TableCell colSpan={showManagerProfit ? 9 : (canViewAll ? 8 : (canRequestSettlement ? 7 : 6))} className="text-center h-24">
              لا توجد أرباح تطابق الفلاتر المحددة.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
};

export default ProfitDetailsTable;