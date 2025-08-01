import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Receipt, Calendar, User, CreditCard, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

/**
 * نافذة تفاصيل الأرباح المستلمة للموظف
 * تعرض قائمة الفواتير المدفوعة مع التفاصيل
 */
const EmployeeReceivedProfitsDialog = ({
  isOpen,
  onClose,
  invoices = [],
  totalAmount = 0,
  employeeName,
  employeeCode,
  allUsers = []
}) => {

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ar-IQ', {
      style: 'currency',
      currency: 'IQD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const getPayerName = (createdBy) => {
    const payer = allUsers.find(u => u.id === createdBy);
    return payer ? payer.full_name : 'غير محدد';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Receipt className="w-6 h-6 text-blue-600" />
            أرباحي المستلمة
          </DialogTitle>
          <DialogDescription>
            تفاصيل جميع الأرباح التي تم دفعها لك من خلال فواتير التسوية
          </DialogDescription>
        </DialogHeader>

        {/* ملخص الأرباح المستلمة */}
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" />
              ملخص الأرباح المستلمة
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-3 bg-white rounded-lg border">
                <div className="text-2xl font-bold text-blue-600">
                  {formatCurrency(totalAmount)}
                </div>
                <div className="text-sm text-muted-foreground">إجمالي المستلم</div>
              </div>
              <div className="text-center p-3 bg-white rounded-lg border">
                <div className="text-2xl font-bold text-green-600">
                  {invoices.length}
                </div>
                <div className="text-sm text-muted-foreground">عدد الفواتير</div>
              </div>
              <div className="text-center p-3 bg-white rounded-lg border">
                <div className="text-lg font-semibold text-gray-700">
                  {employeeName}
                </div>
                <div className="text-sm text-muted-foreground">
                  {employeeCode && `كود: ${employeeCode}`}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* قائمة الفواتير */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="w-5 h-5" />
            تفاصيل الفواتير ({invoices.length})
          </h3>

          {invoices.length === 0 ? (
            <Card className="p-8 text-center border-dashed">
              <Receipt className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">لم يتم دفع أي أرباح بعد</p>
            </Card>
          ) : (
            <div className="grid gap-4">
              {invoices
                .sort((a, b) => new Date(b.settlement_date) - new Date(a.settlement_date))
                .map((invoice) => (
                <Card key={invoice.id} className="border-l-4 border-l-green-500">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Receipt className="w-4 h-4 text-green-600" />
                        فاتورة رقم: {invoice.invoice_number}
                      </CardTitle>
                      <Badge variant="success" className="bg-green-100 text-green-800">
                        مدفوعة
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* تفاصيل الفاتورة */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-green-600" />
                        <span className="font-medium">المبلغ:</span>
                        <span className="font-bold text-green-600">
                          {formatCurrency(invoice.total_amount)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-blue-600" />
                        <span className="font-medium">تاريخ الدفع:</span>
                        <span>
                          {format(new Date(invoice.settlement_date), 'dd/MM/yyyy', { locale: ar })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-purple-600" />
                        <span className="font-medium">دفع بواسطة:</span>
                        <span>{getPayerName(invoice.created_by)}</span>
                      </div>
                    </div>

                    {/* الوصف والملاحظات */}
                    {invoice.description && (
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="text-sm">
                          <span className="font-medium text-gray-700">الوصف: </span>
                          <span className="text-gray-600">{invoice.description}</span>
                        </div>
                      </div>
                    )}

                    {invoice.notes && (
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <div className="text-sm">
                          <span className="font-medium text-blue-700">ملاحظات: </span>
                          <span className="text-blue-600">{invoice.notes}</span>
                        </div>
                      </div>
                    )}

                    {/* تفاصيل الطلبات */}
                    {invoice.order_ids && invoice.order_ids.length > 0 && (
                      <div className="bg-green-50 p-3 rounded-lg">
                        <div className="text-sm">
                          <span className="font-medium text-green-700">
                            الطلبات المشمولة ({invoice.order_ids.length}):
                          </span>
                          <div className="mt-1 text-green-600">
                            {invoice.order_ids.slice(0, 5).map((orderId, index) => (
                              <span key={orderId}>
                                {orderId.slice(0, 8)}...
                                {index < Math.min(invoice.order_ids.length, 5) - 1 && ', '}
                              </span>
                            ))}
                            {invoice.order_ids.length > 5 && ` و ${invoice.order_ids.length - 5} آخرين`}
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EmployeeReceivedProfitsDialog;