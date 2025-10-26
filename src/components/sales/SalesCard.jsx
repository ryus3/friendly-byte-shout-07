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

  // Use tracking number or fallback to order number
  const displayNumber = order.tracking_number || order.delivery_partner_order_id || order.order_number;

  return (
    <Card 
      className="relative overflow-hidden rounded-xl border border-border/50 bg-card hover:border-primary/40 hover:shadow-lg transition-all duration-300 cursor-pointer"
      onClick={handleViewDetails}
    >
      {/* Top subtle gradient line */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary/60 via-purple-500/40 to-blue-500/60" />
      
      <CardContent className="p-4 space-y-3">
        
        {/* Header: Tracking Number + Amount */}
        <div className="flex items-start justify-between gap-3">
          {/* Tracking Number */}
          <div>
            <div className="text-xs text-muted-foreground mb-0.5">رقم التتبع</div>
            <h3 className="font-bold text-lg text-foreground" dir="ltr">
              #{displayNumber}
            </h3>
          </div>
          
          {/* Total Amount */}
          <div className="text-left">
            <div className="text-xs text-muted-foreground mb-0.5">المبلغ</div>
            <div className="font-bold text-lg text-primary" dir="ltr">
              {parseFloat(order.final_amount || 0).toLocaleString()} <span className="text-sm">د.ع</span>
            </div>
          </div>
        </div>

        {/* Status Badges */}
        <div className="flex items-center gap-2">
          {statusInfo.badge}
          {receiptInfo.badge}
        </div>

        {/* Customer Info: Name + Phone */}
        <div className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg bg-muted/30 border border-border/30">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="font-medium text-sm text-foreground truncate">{order.customer_name}</span>
          </div>
          
          {order.customer_phone && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-mono text-xs text-foreground" dir="ltr">{order.customer_phone}</span>
            </div>
          )}
        </div>

        {/* Address */}
        {(order.customer_city || order.customer_province) && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">
              {order.customer_city}
              {order.customer_province && ` - ${order.customer_province}`}
            </span>
          </div>
        )}

        {/* Products */}
        {orderProducts && orderProducts.length > 0 && (
          <div className="space-y-1.5">
            {orderProducts.slice(0, 2).map((item, index) => (
              <div key={index} className="flex items-center justify-between text-sm">
                <span className="text-foreground truncate flex-1">{item.product_name}</span>
                <Badge variant="secondary" className="mr-2 text-xs">×{item.quantity}</Badge>
              </div>
            ))}
            {orderProducts.length > 2 && (
              <div className="text-xs text-muted-foreground">
                +{orderProducts.length - 2} منتجات أخرى
              </div>
            )}
          </div>
        )}

        {/* Footer: Date/Time + Delivery Partner */}
        <div className="flex items-center justify-between pt-2 border-t border-border/30">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span>{format(new Date(order.created_at), 'dd/MM/yyyy')}</span>
            <Clock className="h-3 w-3 mr-1" />
            <span>{format(new Date(order.created_at), 'p', { locale: ar })}</span>
          </div>
          
          {order.delivery_partner && (
            <Badge variant="outline" className="text-xs flex items-center gap-1">
              <Truck className="h-3 w-3" />
              {order.delivery_partner === 'alwaseet' ? 'alwaseet' : order.delivery_partner}
            </Badge>
          )}
        </div>

        {/* Employee (if shown) */}
        {showEmployee && employee && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
            <User className="h-3 w-3" />
            <span>الموظف: {employee.full_name}</span>
          </div>
        )}

      </CardContent>
    </Card>
  );
};

export default memo(SalesCard);