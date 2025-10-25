import React, { useState, useMemo, memo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSuper } from '@/contexts/SuperProvider';
import { 
  Eye, 
  Package, 
  User, 
  MapPin, 
  Calendar, 
  Receipt,
  Truck,
  CheckCircle,
  Clock,
  Phone,
  Tag,
  ExternalLink,
  ShoppingBag,
  Building
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

const SalesCard = ({ 
  order, 
  formatCurrency, 
  employee, 
  onViewDetails,
  showEmployee = false 
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const { products, orderItems } = useSuper();

  const handleViewDetails = useCallback((e) => {
    if (e) e.stopPropagation();
    onViewDetails?.(order);
  }, [order, onViewDetails]);

  const getStatusInfo = (order) => {
    if (order.status === 'completed') {
      return {
        badge: <Badge className="bg-gradient-to-r from-emerald-500 to-green-600 text-white border-0 shadow-md hover:shadow-lg transition-all"><CheckCircle className="w-3 h-3 mr-1" />مكتمل</Badge>,
        color: 'from-emerald-50 to-green-50 dark:from-emerald-950/50 dark:to-green-950/50',
        borderColor: 'border-emerald-200 dark:border-emerald-800'
      };
    }
    if (order.status === 'delivered') {
      return {
        badge: <Badge className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-0 shadow-md hover:shadow-lg transition-all"><Package className="w-3 h-3 mr-1" />مُسلم</Badge>,
        color: 'from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50',
        borderColor: 'border-blue-200 dark:border-blue-800'
      };
    }
    return {
      badge: <Badge variant="outline" className="bg-gradient-to-r from-gray-100 to-slate-100 dark:from-gray-800 dark:to-slate-800">{order.status}</Badge>,
      color: 'from-gray-50 to-slate-50 dark:from-gray-900/50 dark:to-slate-900/50',
      borderColor: 'border-gray-200 dark:border-gray-800'
    };
  };

  const getReceiptInfo = (received) => {
    if (received) {
      return {
        badge: <Badge className="bg-gradient-to-r from-teal-500 to-cyan-600 text-white border-0 shadow-sm hover:shadow-md transition-all"><Receipt className="w-3 h-3 mr-1" />مستلمة</Badge>,
        icon: <Receipt className="w-4 h-4 text-teal-600 dark:text-teal-400" />
      };
    }
    return {
      badge: <Badge className="bg-gradient-to-r from-amber-500 to-orange-600 text-white border-0 shadow-sm hover:shadow-md transition-all"><Clock className="w-3 h-3 mr-1" />في الانتظار</Badge>,
      icon: <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
    };
  };

  // Get order products with names
  const orderProducts = useMemo(() => {
    if (!orderItems || !products || !order.id) return [];
    
    const items = orderItems.filter(item => item.order_id === order.id);
    return items.map(item => {
      const product = products.find(p => p.id === item.product_id);
      return {
        ...item,
        product_name: product?.name || 'منتج غير محدد',
        product: product
      };
    });
  }, [orderItems, products, order.id]);

  const statusInfo = getStatusInfo(order);
  const receiptInfo = getReceiptInfo(order.receipt_received);

  const primaryId = order.tracking_number || order.delivery_partner_order_id || order.order_number;
  const hasTrackingNumber = order.tracking_number || order.delivery_partner_order_id;

  return (
    <Card 
      className={`
        group relative overflow-hidden rounded-3xl
        bg-gradient-to-br from-card/95 via-card to-card/90
        border transition-all duration-700 ease-out cursor-pointer
        backdrop-blur-xl
        ${isHovered 
          ? 'border-primary/60 shadow-2xl shadow-primary/30 scale-[1.02] -translate-y-1' 
          : 'border-border/40 shadow-lg shadow-black/5 hover:border-primary/40'
        }
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleViewDetails}
    >
      {/* Animated Gradient Background */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-purple-500/5 to-blue-500/5 animate-gradient" />
      </div>

      {/* Top Decorative Elements */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-purple-500 to-blue-500 opacity-80" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      
      {/* Corner Accent */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/10 to-transparent rounded-bl-full opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
      
      {/* Floating Action Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleViewDetails}
        className={`
          absolute top-4 left-4 z-20 
          h-10 w-10 p-0 rounded-2xl
          bg-gradient-to-br from-primary/20 to-primary/10
          backdrop-blur-md border border-primary/30
          text-primary
          transition-all duration-500
          ${isHovered 
            ? 'scale-110 shadow-lg shadow-primary/40 rotate-12' 
            : 'hover:scale-105'
          }
        `}
        title="معاينة التفاصيل"
      >
        <Eye className="h-4 w-4" />
      </Button>

      <CardContent className="relative p-6 space-y-5">
        
        {/* Header Section */}
        <div className="flex items-start justify-between gap-4">
          {/* Order Number with Icon */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 backdrop-blur-sm border border-primary/20">
              <ShoppingBag className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground font-medium mb-0.5">رقم الطلب</div>
              <h3 className="font-black text-xl text-foreground tracking-tight" dir="ltr">
                #{order.order_number}
              </h3>
            </div>
          </div>
          
          {/* Status Badges */}
          <div className="flex flex-col gap-2 items-end">
            {statusInfo.badge}
            {receiptInfo.badge}
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="relative rounded-2xl bg-gradient-to-br from-muted/30 via-muted/10 to-transparent p-5 border border-muted/40 backdrop-blur-sm">
          {/* Decorative dot pattern */}
          <div className="absolute inset-0 opacity-5" style={{
            backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)',
            backgroundSize: '16px 16px'
          }} />
          
          <div className="relative grid grid-cols-1 sm:grid-cols-2 gap-6">
            
            {/* Customer Information */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider mb-3">
                <div className="h-px flex-1 bg-gradient-to-r from-primary/50 to-transparent" />
                <span>معلومات العميل</span>
                <div className="h-px w-8 bg-primary/50" />
              </div>
              
              <div className="flex items-start gap-3 group/item">
                <div className="p-2 rounded-lg bg-primary/10 group-hover/item:bg-primary/20 transition-colors">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground mb-1">اسم العميل</div>
                  <div className="font-bold text-foreground text-sm truncate">{order.customer_name}</div>
                </div>
              </div>
              
              {order.customer_phone && (
                <div className="flex items-start gap-3 group/item">
                  <div className="p-2 rounded-lg bg-primary/10 group-hover/item:bg-primary/20 transition-colors">
                    <Phone className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground mb-1">رقم الهاتف</div>
                    <div className="font-mono text-sm text-foreground" dir="ltr">{order.customer_phone}</div>
                  </div>
                </div>
              )}
              
              {(order.customer_city || order.customer_province) && (
                <div className="flex items-start gap-3 group/item">
                  <div className="p-2 rounded-lg bg-primary/10 group-hover/item:bg-primary/20 transition-colors">
                    <MapPin className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground mb-1">العنوان</div>
                    <div className="text-sm text-foreground">
                      {order.customer_city}
                      {order.customer_province && ` – ${order.customer_province}`}
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Order Details */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider mb-3">
                <div className="h-px w-8 bg-primary/50" />
                <span>تفاصيل الطلب</span>
                <div className="h-px flex-1 bg-gradient-to-l from-primary/50 to-transparent" />
              </div>
              
              <div className="flex items-start gap-3 group/item">
                <div className="p-2 rounded-lg bg-primary/10 group-hover/item:bg-primary/20 transition-colors">
                  <Calendar className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground mb-1">التاريخ</div>
                  <div className="font-bold text-foreground text-sm">
                    {format(new Date(order.created_at), 'dd/MM/yyyy')}
                  </div>
                </div>
              </div>
              
              <div className="flex items-start gap-3 group/item">
                <div className="p-2 rounded-lg bg-primary/10 group-hover/item:bg-primary/20 transition-colors">
                  <Clock className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground mb-1">الوقت</div>
                  <div className="font-medium text-foreground text-sm">
                    {format(new Date(order.created_at), 'p', { locale: ar })}
                  </div>
                </div>
              </div>
              
              {showEmployee && employee && (
                <div className="flex items-start gap-3 group/item">
                  <div className="p-2 rounded-lg bg-primary/10 group-hover/item:bg-primary/20 transition-colors">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground mb-1">الموظف</div>
                    <div className="font-medium text-foreground text-sm">{employee.full_name}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Delivery Partner Badge */}
        {order.delivery_partner && order.delivery_partner !== 'محلي' && (
          <div className="flex justify-center">
            <div className="relative group/delivery">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-cyan-500 rounded-full blur-md opacity-50 group-hover/delivery:opacity-75 transition-opacity" />
              <Badge className="relative bg-gradient-to-r from-blue-400 via-blue-500 to-cyan-500 text-white border-0 shadow-lg shadow-blue-500/30 font-bold px-4 py-2 text-sm rounded-full flex items-center gap-2">
                <Truck className="h-4 w-4" />
                <span>
                  {order.delivery_partner === 'alwaseet' ? 'AL WASEET' : order.delivery_partner.toUpperCase()}
                </span>
              </Badge>
            </div>
          </div>
        )}

        {/* Products & Amount Section */}
        <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 backdrop-blur-sm">
          {/* Shine effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
          
          <div className="relative p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              
              {/* Products List */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-3">
                  <Package className="h-4 w-4 text-primary" />
                  <span className="text-xs font-bold text-primary uppercase tracking-wider">المنتجات</span>
                </div>
                
                {orderProducts && orderProducts.length > 0 && (
                  <div className="space-y-2">
                    {orderProducts.slice(0, 2).map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-card/50 border border-border/30 backdrop-blur-sm">
                        <span className="font-medium text-sm text-foreground truncate flex-1">
                          {item.product_name}
                        </span>
                        <Badge variant="secondary" className="mr-2 font-bold">
                          ×{item.quantity}
                        </Badge>
                      </div>
                    ))}
                    {orderProducts.length > 2 && (
                      <div className="text-xs text-muted-foreground text-center py-1">
                        +{orderProducts.length - 2} منتجات إضافية
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Total Amount */}
              <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30">
                <div className="text-xs font-bold text-primary uppercase tracking-wider mb-2">
                  المبلغ الإجمالي
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black text-primary tabular-nums" dir="ltr">
                    {parseFloat(order.final_amount || 0).toLocaleString()}
                  </span>
                  <span className="text-lg font-bold text-primary/70">د.ع</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1 font-medium">
                  شامل التوصيل
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Decorative Line */}
        <div className="flex items-center gap-3 opacity-30">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
        </div>

      </CardContent>
    </Card>
  );
};

export default memo(SalesCard);