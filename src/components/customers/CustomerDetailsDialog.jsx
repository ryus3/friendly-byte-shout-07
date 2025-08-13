import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Star, 
  Package, 
  Calendar, 
  MapPin, 
  Phone, 
  Mail,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  Award,
  MessageCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

const CustomerDetailsDialog = ({ customer, open, onOpenChange }) => {
  if (!customer) return null;

  const loyalty = customer.customer_loyalty;
  const tier = loyalty?.loyalty_tiers;
  const orders = customer.completedOrders || [];
  const pointsHistory = customer.pointsHistory || [];

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ar-IQ').format(amount) + ' د.ع';
  };

  // تنسيق رقم الواتساب
  const formatWhatsAppNumber = (phone) => {
    if (!phone) return null;
    
    // إزالة كل شيء عدا الأرقام
    let cleanNumber = phone.replace(/\D/g, '');
    
    // إذا بدأ بـ 07 (الصيغة المحلية العراقية)
    if (cleanNumber.startsWith('07') && cleanNumber.length === 11) {
      return '964' + cleanNumber.substring(1); // نزيل الصفر ونضيف كود الدولة
    }
    
    // إذا بدأ بـ 7 فقط وطوله 10 أرقام
    if (cleanNumber.startsWith('7') && cleanNumber.length === 10) {
      return '964' + cleanNumber;
    }
    
    // إذا بدأ بـ 964 مسبقاً
    if (cleanNumber.startsWith('964')) {
      return cleanNumber;
    }
    
    // إذا بدأ بـ 00964
    if (cleanNumber.startsWith('00964')) {
      return cleanNumber.substring(2); // نزيل الـ 00
    }
    
    // إذا لم يطابق أي صيغة، نحاول إضافة كود الدولة للأرقام التي تبدأ بـ 7
    if (cleanNumber.match(/^7\d{9}$/)) {
      return '964' + cleanNumber;
    }
    
    return cleanNumber.startsWith('964') ? cleanNumber : '964' + cleanNumber.replace(/^0/, '');
  };

  // حساب تاريخ انتهاء صلاحية النقاط الافتراضي (سنة من تاريخ آخر طلب)
  const getDefaultPointsExpiry = () => {
    if (loyalty?.last_order_date) {
      const lastOrderDate = new Date(loyalty.last_order_date);
      const expiryDate = new Date(lastOrderDate);
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);
      return expiryDate;
    }
    return null;
  };

  const pointsExpiryDate = loyalty?.points_expiry_date 
    ? new Date(loyalty.points_expiry_date)
    : getDefaultPointsExpiry();

  const whatsappNumber = formatWhatsAppNumber(customer.phone);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            تفاصيل العميل - {customer.name}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[calc(90vh-120px)]">
          <div className="space-y-6 p-1">
            {/* معلومات العميل الأساسية */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-4 w-4" />
                  المعلومات الأساسية
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 justify-between">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">الهاتف:</span>
                      <span>{customer.phone || 'غير متوفر'}</span>
                    </div>
                    {whatsappNumber && (
                      <a
                        href={`https://wa.me/${whatsappNumber}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
                      >
                        <MessageCircle className="h-3 w-3" />
                        واتساب
                      </a>
                    )}
                  </div>
                  
                  {customer.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">الإيميل:</span>
                      <span>{customer.email}</span>
                    </div>
                  )}
                  
                  {(customer.city || customer.province) && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">الموقع:</span>
                      <span>{[customer.city, customer.province].filter(Boolean).join(', ')}</span>
                    </div>
                  )}
                </div>
                
                 <div className="space-y-3">
                   <div className="flex items-center gap-2">
                     <Calendar className="h-4 w-4 text-muted-foreground" />
                     <span className="font-medium">تاريخ الانضمام:</span>
                     <span>{format(new Date(customer.created_at), 'd MMM yyyy', { locale: ar })}</span>
                   </div>
                   
                   {tier && (
                     <div className="flex items-center gap-2">
                       <Award className="h-4 w-4 text-muted-foreground" />
                       <span className="font-medium">المستوى:</span>
                       <Badge variant="secondary">{tier.name}</Badge>
                     </div>
                   )}
                   
                    {/* صلاحية النقاط */}
                    {loyalty?.total_points > 0 && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">صلاحية النقاط:</span>
                        <Badge 
                          className={`
                            ${pointsExpiryDate && pointsExpiryDate <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                              ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400' 
                              : 'bg-green-50 text-green-600 border-green-200 dark:bg-green-900/20 dark:text-green-400'
                            } border
                          `}
                        >
                          {pointsExpiryDate 
                            ? format(pointsExpiryDate, 'd MMM yyyy', { locale: ar })
                            : 'سنة واحدة من آخر طلب'
                          }
                        </Badge>
                      </div>
                    )}
                 </div>
              </CardContent>
            </Card>

            {/* إحصائيات الولاء */}
            {loyalty && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    إحصائيات الولاء
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{loyalty.total_points?.toLocaleString('ar')}</div>
                      <div className="text-sm text-muted-foreground">النقاط الحالية</div>
                    </div>
                    
                    <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{loyalty.total_orders}</div>
                      <div className="text-sm text-muted-foreground">عدد الطلبات</div>
                    </div>
                    
                    <div className="text-center p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg">
                      <div className="text-xl font-bold text-purple-600">{formatCurrency(loyalty.total_spent || 0)}</div>
                      <div className="text-sm text-muted-foreground">إجمالي المشتريات</div>
                    </div>
                    
                    <div className="text-center p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
                      <div className="text-xl font-bold text-orange-600">{formatCurrency(customer.totalSalesWithoutDelivery || 0)}</div>
                      <div className="text-sm text-muted-foreground">المبيعات (بدون توصيل)</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* الطلبات المكتملة */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  الطلبات المكتملة ({orders.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {orders.length > 0 ? (
                  <div className="space-y-4">
                    {orders.slice(0, 5).map((order) => (
                      <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="space-y-1">
                          <div className="font-medium">طلب #{order.order_number}</div>
                          <div className="text-sm text-muted-foreground">
                            {format(new Date(order.created_at), 'd MMM yyyy', { locale: ar })}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {order.order_items?.length || 0} صنف
                          </div>
                        </div>
                        <div className="text-right space-y-1">
                          <div className="font-bold">{formatCurrency(order.final_amount)}</div>
                          {order.delivery_fee > 0 && (
                            <div className="text-xs text-muted-foreground">
                              التوصيل: {formatCurrency(order.delivery_fee)}
                            </div>
                          )}
                          <div className="text-sm font-medium text-green-600">
                            صافي: {formatCurrency(order.final_amount - (order.delivery_fee || 0))}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {orders.length > 5 && (
                      <div className="text-center text-muted-foreground text-sm">
                        وعدد {orders.length - 5} طلب آخر...
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>لا توجد طلبات مكتملة</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* تاريخ النقاط */}
            {pointsHistory.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="h-4 w-4" />
                    تاريخ النقاط
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {pointsHistory.slice(0, 10).map((point) => (
                      <div key={point.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="space-y-1">
                          <div className="text-sm font-medium">{point.description || point.transaction_type}</div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(point.created_at), 'd MMM yyyy', { locale: ar })}
                          </div>
                        </div>
                        <div className="text-right">
                          {point.points_earned > 0 && (
                            <div className="text-green-600 font-bold">+{point.points_earned}</div>
                          )}
                          {point.points_used > 0 && (
                            <div className="text-red-600 font-bold">-{point.points_used}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default CustomerDetailsDialog;