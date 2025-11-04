import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, Package, DollarSign, Calendar, Database, Wifi, WifiOff, User, Building } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';

const AlWaseetInvoicesList = ({ 
  invoices, 
  onViewInvoice, 
  loading,
  showEmployeeName = false
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
          showEmployeeName={showEmployeeName}
        />
      ))}
    </div>
  );
};

const InvoiceCard = ({ invoice, onView, showEmployeeName = false }) => {
  const [dbStatus, setDbStatus] = useState('saved'); // افتراض الحفظ للفواتير الداخلية
  const [linkedOrdersCount, setLinkedOrdersCount] = useState(0);
  
  // معالجة محسنة للبيانات سواء من API أو قاعدة البيانات
  const isReceived = invoice.received || invoice.received_flag || invoice.status === 'تم الاستلام من قبل التاجر';
  const amount = parseFloat(invoice.amount || invoice.merchant_price) || 0;
  const ordersCount = parseInt(invoice.linked_orders_count || invoice.orders_count || invoice.delivered_orders_count) || 0;
  const calculatedLinkedOrders = invoice.linked_orders?.length || invoice.delivery_invoice_orders?.length || 0;
  
  // تحديث عدد الطلبات المربوطة من البيانات المحملة
  useEffect(() => {
    if (invoice.linked_orders_count !== undefined) {
      setLinkedOrdersCount(invoice.linked_orders_count);
      setDbStatus('saved');
    } else if (invoice.delivery_invoice_orders) {
      setLinkedOrdersCount(invoice.delivery_invoice_orders.length);
      setDbStatus('saved');
    } else if (invoice.id && !invoice.external_id) {
      // هذه فاتورة داخلية من قاعدة البيانات
      setDbStatus('saved');
      setLinkedOrdersCount(ordersCount);
    } else {
      // فحص الحالة للفواتير الخارجية فقط
      const checkDbStatus = async () => {
        try {
          const { data: dbInvoice, error } = await supabase
            .from('delivery_invoices')
            .select('id, delivery_invoice_orders(count)')
            .eq('external_id', invoice.external_id || invoice.id)
            .eq('partner', 'alwaseet')
            .maybeSingle();

          if (error) {
            setDbStatus('not_saved');
          } else if (dbInvoice) {
            setDbStatus('saved');
            setLinkedOrdersCount(dbInvoice.delivery_invoice_orders?.[0]?.count || 0);
          } else {
            setDbStatus('not_saved');
          }
        } catch (e) {
          setDbStatus('not_saved');
        }
      };

      checkDbStatus();
    }
  }, [invoice.id, invoice.external_id, invoice.linked_orders_count, ordersCount]);
  
  const getStatusVariant = (status) => {
    if (status === 'تم الاستلام من قبل التاجر') return 'success';
    return 'secondary';
  };

  const getDbStatusIcon = () => {
    switch (dbStatus) {
      case 'saved':
        return <Database className="h-3 w-3 text-green-600" title="محفوظ في النظام" />;
      case 'not_saved':
        return <WifiOff className="h-3 w-3 text-orange-500" title="عرض مباشر فقط" />;
      default:
        return <Wifi className="h-3 w-3 text-gray-400 animate-pulse" title="جاري التحقق..." />;
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow" dir="rtl">
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg text-left">فاتورة #{invoice.external_id || invoice.id}</h3>
              {getDbStatusIcon()}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={getStatusVariant(invoice.status)} className={`${
                isReceived 
                  ? 'bg-green-500 hover:bg-green-600 text-white border-green-500' 
                  : 'bg-orange-500 hover:bg-orange-600 text-white border-orange-500'
              }`}>
                {isReceived ? 'مُستلمة' : 'معلقة'}
              </Badge>
            </div>
          </div>

          {/* ✅ المرحلة 3: عرض اسم الحساب وشركة التوصيل */}
          {(invoice.account_username || invoice.partner_name_ar) && (
            <div className="flex items-center justify-start gap-2 pb-2 border-b">
              <Building className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">
                {invoice.partner_name_ar || 'الوسيط'} - {invoice.account_username || 'حساب رئيسي'}
              </span>
            </div>
          )}

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
              {linkedOrdersCount || ordersCount} طلب مُسلم
            </span>
          </div>

          {/* Employee name if needed */}
          {showEmployeeName && invoice.employee_name && (
            <div className="flex items-center justify-start gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-blue-600">
                {invoice.employee_name}
                {invoice.employee_code && ` (${invoice.employee_code})`}
              </span>
            </div>
          )}

          {/* Date */}
          <div className="flex items-center justify-start gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {(invoice.issued_at || invoice.updated_at || invoice.created_at) && formatDistanceToNow(
                new Date(invoice.issued_at || invoice.updated_at || invoice.created_at), 
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
            
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AlWaseetInvoicesList;