import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, CheckCircle, Package, DollarSign, Calendar } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

const AlWaseetInvoicesList = ({ 
  invoices, 
  onViewInvoice, 
  onReceiveInvoice, 
  loading 
}) => {
  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="h-4 bg-muted rounded w-1/2"></div>
                <div className="h-3 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!invoices || invoices.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">لا توجد فواتير</h3>
          <p className="text-muted-foreground">
            لم يتم العثور على أي فواتير من شركة التوصيل حتى الآن
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {invoices.map((invoice) => (
        <InvoiceCard
          key={invoice.id}
          invoice={invoice}
          onView={() => onViewInvoice(invoice)}
          onReceive={() => onReceiveInvoice(invoice.id)}
        />
      ))}
    </div>
  );
};

const InvoiceCard = ({ invoice, onView, onReceive }) => {
  const isReceived = invoice.status === 'تم الاستلام من قبل التاجر';
  const amount = parseFloat(invoice.merchant_price) || 0;
  const ordersCount = parseInt(invoice.delivered_orders_count) || 0;
  
  const getStatusVariant = (status) => {
    if (status === 'تم الاستلام من قبل التاجر') return 'success';
    return 'secondary';
  };

  return (
    <Card className="hover:shadow-md transition-shadow" dir="rtl">
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg text-left">فاتورة #{invoice.id}</h3>
            <Badge variant={getStatusVariant(invoice.status)}>
              {isReceived ? 'مُستلمة' : 'معلقة'}
            </Badge>
          </div>

          {/* Amount */}
          <div className="flex items-center justify-start gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold text-primary">
              {amount.toLocaleString()} د.ع
            </span>
          </div>

          {/* Orders count */}
          <div className="flex items-center justify-start gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {ordersCount} طلب مُسلم
            </span>
          </div>

          {/* Date */}
          <div className="flex items-center justify-start gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {invoice.updated_at && formatDistanceToNow(
                new Date(invoice.updated_at), 
                { addSuffix: true, locale: ar }
              )}
            </span>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onView}
              className="flex-1"
            >
              عرض التفاصيل
              <Eye className="h-4 w-4 ml-2" />
            </Button>
            
            {!isReceived && (
              <Button
                variant="default"
                size="sm"
                onClick={onReceive}
                className="flex-1"
              >
                تأكيد الاستلام
                <CheckCircle className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AlWaseetInvoicesList;