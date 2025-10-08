import React, { useState, useMemo } from 'react';
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
        relative overflow-hidden transition-all duration-300 cursor-pointer group
        ${isHovered ? 'scale-[1.02] shadow-2xl shadow-primary/20 dark:shadow-primary/10' : 'shadow-lg hover:shadow-xl dark:shadow-lg dark:hover:shadow-xl'}
        bg-gradient-to-br ${statusInfo.color} ${statusInfo.borderColor}
        border-2 hover:border-primary/40 dark:hover:border-primary/60
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onViewDetails?.(order)}
    >
      {/* Floating Action Button */}
      <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
        <Button 
          size="sm" 
          className="w-8 h-8 p-0 bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-700 shadow-lg hover:shadow-xl transition-all"
          onClick={(e) => {
            e.stopPropagation();
            onViewDetails?.(order);
          }}
        >
          <Eye className="w-4 h-4" />
        </Button>
      </div>

      {/* Status Indicator Strip */}
      <div className={`absolute top-0 right-0 w-1 h-full bg-gradient-to-b ${
        order.status === 'completed' ? 'from-emerald-400 to-green-600' : 
        order.status === 'delivered' ? 'from-blue-400 to-indigo-600' : 'from-gray-400 to-slate-600'
      } opacity-80`} />

      <CardContent className="p-6 space-y-4">
        {/* Header Section */}
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {hasTrackingNumber ? (
                  <Tag className="w-4 h-4 text-primary dark:text-primary-foreground" />
                ) : (
                  <Package className="w-4 h-4 text-muted-foreground" />
                )}
                <h3 className="font-bold text-lg text-foreground dark:text-foreground">
                  {hasTrackingNumber ? `#${primaryId}` : `#${order.order_number}`}
                </h3>
              </div>
              {hasTrackingNumber && (
                <ExternalLink className="w-3 h-3 text-muted-foreground opacity-60" />
              )}
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              {statusInfo.badge}
              {receiptInfo.badge}
            </div>
          </div>

          <div className="text-left">
            <div className="text-2xl font-bold text-primary dark:text-primary-foreground" dir="ltr">
              {formatCurrency(parseFloat((order.final_amount || 0) - (order.delivery_fee || 0))).replace(/[٠-٩]/g, (d) => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)])}
            </div>
            <div className="text-xs text-muted-foreground">مبلغ البيع</div>
          </div>
        </div>

        {/* Customer & Location Info */}
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-white/60 dark:bg-white/5 rounded-lg border border-white/40 dark:border-white/10 backdrop-blur-sm">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/50 dark:to-pink-900/50 flex items-center justify-center">
              <User className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="flex-1">
              <div className="font-medium text-foreground dark:text-foreground">
                {order.customer_name || 'عميل غير محدد'}
              </div>
            </div>
            {order.customer_phone && (
              <div className="text-xs text-muted-foreground" dir="ltr">
                {order.customer_phone}
              </div>
            )}
          </div>

          {(order.customer_city || order.customer_province) && (
            <div className="flex items-center gap-3 p-3 bg-white/60 dark:bg-white/5 rounded-lg border border-white/40 dark:border-white/10 backdrop-blur-sm">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/50 dark:to-emerald-900/50 flex items-center justify-center">
                <MapPin className="w-4 h-4 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1">
                <div className="font-medium text-foreground dark:text-foreground">
                  {order.customer_city}
                  {order.customer_province && ` - ${order.customer_province}`}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Products Preview */}
        {orderProducts && orderProducts.length > 0 && (
          <div className="p-3 bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-800/50 dark:to-gray-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <ShoppingBag className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              <span className="font-medium text-slate-700 dark:text-slate-300">المنتجات ({orderProducts.length})</span>
            </div>
            <div className="space-y-1">
              {orderProducts.slice(0, 3).map((item, index) => (
                <div key={index} className="flex justify-between items-center text-sm">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">
                    {item.product_name}
                  </span>
                   <Badge variant="secondary" className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" dir="ltr">
                     {item.quantity.toLocaleString('en-US')}x
                   </Badge>
                </div>
              ))}
              {orderProducts.length > 3 && (
                <div className="text-xs text-muted-foreground text-center pt-1">
                  +{orderProducts.length - 3} منتجات أخرى
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer Section */}
        <div className="space-y-3 pt-2 border-t border-white/40 dark:border-white/10">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Calendar className="w-3 h-3" />
              {format(new Date(order.created_at), 'dd/MM/yyyy')}
            </div>
            {order.delivery_partner && (
              <div className="flex items-center gap-1">
                <Truck className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700">
                  {order.delivery_partner}
                </Badge>
              </div>
            )}
          </div>

          {showEmployee && employee && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-white/40 dark:bg-white/5 p-2 rounded-md">
              <User className="w-3 h-3" />
              <span className="font-medium">الموظف:</span>
              <span>{employee.full_name || employee.username || employee.email || 'غير محدد'}</span>
            </div>
          )}
        </div>

        {/* Hover Effect Overlay */}
        <div className={`
          absolute inset-0 bg-gradient-to-r from-primary/5 to-blue-600/5 dark:from-primary/10 dark:to-blue-600/10 opacity-0 
          ${isHovered ? 'opacity-100' : ''} transition-opacity duration-300 pointer-events-none
        `} />
      </CardContent>
    </Card>
  );
};

export default SalesCard;