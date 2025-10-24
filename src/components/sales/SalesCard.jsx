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
        relative overflow-hidden rounded-2xl
        bg-gradient-to-br from-card via-card/95 to-card/90
        border-2 transition-all duration-500 ease-out cursor-pointer
        shadow-xl shadow-black/10 hover:shadow-2xl hover:shadow-primary/25
        dark:shadow-white/5 dark:hover:shadow-primary/15
        ${isHovered ? 'border-primary ring-4 ring-primary/20 shadow-2xl shadow-primary/30' : 'border-border/30 hover:border-primary/50'}
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleViewDetails}
    >
      {/* Top Gradient Line */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-purple-500 to-blue-500 opacity-60" />
      
      {/* Hover Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 hover:opacity-100 transition-all duration-500" />

      <CardContent className="relative p-4">
        <div className="space-y-3">
          
          {/* Header: Status Badges (left) & Order Number (right) */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              {statusInfo.badge}
              {receiptInfo.badge}
            </div>
            
            <div className="flex items-center gap-2">
              <h3 className="font-black text-lg text-foreground tracking-wide tabular-nums" dir="ltr">
                {order.order_number}
              </h3>
            </div>
          </div>

          {/* Main Content Grid - 3 columns */}
          <div className="bg-gradient-to-r from-muted/20 via-muted/10 to-transparent rounded-xl p-3 border border-muted/30 relative">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
              
              {/* Column 1 (left): Date, Time, Employee, Delivery Partner */}
              <div className="space-y-1 text-left order-1 sm:order-1">
                <div className="flex items-center gap-2 justify-start">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span className="text-sm font-bold text-foreground">
                    {format(new Date(order.created_at), 'dd/MM/yyyy')}
                  </span>
                </div>
                <div className="flex items-center gap-2 justify-start">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(order.created_at), 'p', { locale: ar })}
                  </span>
                </div>
                {showEmployee && employee && (
                  <div className="flex items-center gap-2 justify-start">
                    <span className="text-xs font-bold text-primary bg-gradient-to-r from-primary/10 to-primary/20 px-3 py-1.5 rounded-full border border-primary/20 shadow-sm backdrop-blur-sm">
                      <User className="h-3 w-3 inline-block ml-1" />
                      {employee.full_name}
                    </span>
                  </div>
                )}
                
                {/* Delivery Partner - في العمود الأيسر */}
                {order.delivery_partner && order.delivery_partner !== 'محلي' && (
                  <div className="flex flex-col gap-1 items-start">
                    <div className="flex justify-start w-full">
                      <Badge className="bg-gradient-to-r from-blue-400 via-blue-500 to-cyan-500 text-white border border-blue-300/50 shadow-lg shadow-blue-400/40 font-bold px-2 py-1 text-xs rounded-full min-w-[90px] flex items-center justify-center gap-1 h-6">
                        <Truck className="h-3 w-3" />
                        <span className="truncate">
                          {order.delivery_partner === 'alwaseet' ? 'AL WASEET' : order.delivery_partner.toUpperCase()}
                        </span>
                      </Badge>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Column 2 (center): View Details Button */}
              <div className="flex items-center justify-center gap-1 order-3 sm:order-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleViewDetails}
                  className="h-8 w-8 p-0 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary hover:scale-110 transition-all duration-300 shadow-md"
                  title="معاينة"
                >
                  <Eye className="h-3.5 w-3.5" />
                </Button>
              </div>
              
              {/* Column 3 (right): Customer Name, Phone, City */}
              <div className="space-y-1 text-left order-2 sm:order-3">
                <div className="flex items-center gap-2 flex-row-reverse">
                  <User className="h-4 w-4 text-primary" />
                  <span className="font-bold text-foreground text-sm">{order.customer_name}</span>
                </div>
                {order.customer_phone && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground flex-row-reverse">
                    <Phone className="h-3 w-3" />
                    <span dir="ltr">{order.customer_phone}</span>
                  </div>
                )}
                {(order.customer_city || order.customer_province) && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground flex-row-reverse">
                    <MapPin className="h-3 w-3 flex-shrink-0" />
                    <span className="text-right">
                      {order.customer_city}
                      {order.customer_province && ` – ${order.customer_province}`}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Products & Amount Row */}
          <div className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-xl p-3 border border-primary/20">
            <div className="flex items-center justify-between">
              {/* Products - Right */}
              <div className="flex-1">
                {orderProducts && orderProducts.length > 0 && (
                  <div className="space-y-1">
                    {orderProducts.slice(0, 2).map((item, index) => (
                      <div key={index} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Package className="h-3 w-3 text-primary" />
                          <span className="font-medium">{item.product_name}</span>
                        </div>
                        <Badge variant="secondary" className="mr-2">x{item.quantity}</Badge>
                      </div>
                    ))}
                    {orderProducts.length > 2 && (
                      <span className="text-xs text-muted-foreground">
                        +{orderProducts.length - 2} منتجات أخرى
                      </span>
                    )}
                  </div>
                )}
              </div>
              
              {/* Amount - Left */}
              <div className="flex items-center gap-2 text-right">
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-primary/70 font-bold">د.ع</span>
                    <span className="font-bold text-lg text-primary" dir="ltr">
                      {parseFloat(order.final_amount || 0).toLocaleString()}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">
                    شامل التوصيل
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default memo(SalesCard);