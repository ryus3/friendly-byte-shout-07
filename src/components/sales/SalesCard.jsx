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
  ShoppingBag
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
          
          {/* Header: Order Number & Status */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-black text-lg text-foreground tracking-wide tabular-nums" dir="ltr">
                {order.order_number}
              </h3>
            </div>
            
            <div className="flex items-center gap-2">
              {statusInfo.badge}
              {receiptInfo.badge}
            </div>
          </div>

          {/* Main Content Grid - 3 columns on desktop, 1 on mobile */}
          <div className="bg-gradient-to-r from-muted/20 via-muted/10 to-transparent rounded-xl p-3 border border-muted/30">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Left Column (RTL): Date & Location */}
              <div className="space-y-2 order-3 md:order-1">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  <span className="text-sm font-bold text-foreground">
                    {format(new Date(order.created_at), 'dd/MM/yyyy')}
                  </span>
                </div>
                
                {(order.customer_city || order.customer_province) && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    <span className="text-sm text-foreground">
                      {order.customer_city}
                      {order.customer_province && ` - ${order.customer_province}`}
                    </span>
                  </div>
                )}
                
                {order.delivery_partner && (
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-primary" />
                    <Badge variant="outline" className="font-bold text-xs">
                      {order.delivery_partner}
                    </Badge>
                  </div>
                )}
              </div>
              
              {/* Middle Column: Customer & Products */}
              <div className="space-y-3 order-1 md:order-2">
                {/* Customer */}
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-foreground">{order.customer_name}</span>
                    {order.customer_phone && (
                      <span className="text-xs text-muted-foreground mr-2" dir="ltr">
                        {order.customer_phone}
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Products */}
                {orderProducts && orderProducts.length > 0 && (
                  <div className="space-y-1">
                    {orderProducts.slice(0, 2).map((item, index) => (
                      <div key={index} className="text-sm flex justify-between items-center">
                        <span className="text-foreground truncate">{item.product_name}</span>
                        <Badge variant="secondary" className="mr-2 flex-shrink-0">
                          {item.quantity}x
                        </Badge>
                      </div>
                    ))}
                    {orderProducts.length > 2 && (
                      <div className="text-xs text-muted-foreground">
                        +{orderProducts.length - 2} آخرين
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Right Column (RTL): Amount & Employee */}
              <div className="space-y-2 order-2 md:order-3 text-right">
                <div>
                  <div className="text-2xl font-bold text-primary tabular-nums" dir="ltr">
                    {formatCurrency(parseFloat(order.final_amount || 0))}
                  </div>
                  <div className="text-xs text-muted-foreground">المبلغ</div>
                </div>
                
                {showEmployee && employee && (
                  <div className="text-xs text-muted-foreground">
                    <User className="w-3 h-3 inline ml-1" />
                    {employee.full_name}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Footer: View Details Button */}
          <div className="flex justify-end pt-3 border-t border-muted/30">
            <Button 
              size="sm" 
              onClick={handleViewDetails}
              className="hover:scale-105 transition-transform"
            >
              <Eye className="w-4 h-4 ml-2" />
              عرض التفاصيل
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default memo(SalesCard);