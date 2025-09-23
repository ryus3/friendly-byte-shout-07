import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  CreditCard,
  Tag,
  ExternalLink
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

  const getStatusInfo = (order) => {
    if (order.status === 'completed') {
      return {
        badge: <Badge className="bg-gradient-to-r from-emerald-500 to-green-600 text-white border-0 shadow-md"><CheckCircle className="w-3 h-3 mr-1" />مكتمل</Badge>,
        color: 'from-emerald-50 to-green-50',
        borderColor: 'border-emerald-200'
      };
    }
    if (order.status === 'delivered') {
      return {
        badge: <Badge className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-0 shadow-md"><Package className="w-3 h-3 mr-1" />مُسلم</Badge>,
        color: 'from-blue-50 to-indigo-50',
        borderColor: 'border-blue-200'
      };
    }
    return {
      badge: <Badge variant="outline">{order.status}</Badge>,
      color: 'from-gray-50 to-slate-50',
      borderColor: 'border-gray-200'
    };
  };

  const getReceiptInfo = (received) => {
    if (received) {
      return {
        badge: <Badge className="bg-gradient-to-r from-teal-500 to-cyan-600 text-white border-0 shadow-sm"><Receipt className="w-3 h-3 mr-1" />مستلمة</Badge>,
        icon: <Receipt className="w-4 h-4 text-teal-600" />
      };
    }
    return {
      badge: <Badge className="bg-gradient-to-r from-amber-500 to-orange-600 text-white border-0 shadow-sm"><Clock className="w-3 h-3 mr-1" />في الانتظار</Badge>,
      icon: <Clock className="w-4 h-4 text-amber-600" />
    };
  };

  const statusInfo = getStatusInfo(order);
  const receiptInfo = getReceiptInfo(order.receipt_received);

  const primaryId = order.tracking_number || order.delivery_partner_order_id || order.order_number;
  const hasTrackingNumber = order.tracking_number || order.delivery_partner_order_id;

  return (
    <Card 
      className={`
        relative overflow-hidden transition-all duration-300 cursor-pointer group
        ${isHovered ? 'scale-[1.02] shadow-2xl shadow-primary/20' : 'shadow-lg hover:shadow-xl'}
        bg-gradient-to-br ${statusInfo.color} ${statusInfo.borderColor}
        border-2 hover:border-primary/30
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onViewDetails?.(order)}
    >
      {/* Floating Action Button */}
      <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <Button 
          size="sm" 
          className="w-8 h-8 p-0 bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-700 shadow-lg"
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
      }`} />

      <CardContent className="p-6 space-y-4">
        {/* Header Section */}
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {hasTrackingNumber ? (
                  <Tag className="w-4 h-4 text-primary" />
                ) : (
                  <Package className="w-4 h-4 text-muted-foreground" />
                )}
                <h3 className="font-bold text-lg text-foreground">
                  {hasTrackingNumber ? `#${primaryId}` : `#${order.order_number}`}
                </h3>
              </div>
              {hasTrackingNumber && (
                <ExternalLink className="w-3 h-3 text-muted-foreground" />
              )}
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              {statusInfo.badge}
              {receiptInfo.badge}
            </div>
          </div>

          <div className="text-left">
            <div className="text-2xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
              {formatCurrency(order.final_amount || order.total_amount || 0)}
            </div>
            <div className="text-xs text-muted-foreground">إجمالي المبلغ</div>
          </div>
        </div>

        {/* Customer & Location Info */}
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-white/60 rounded-lg border border-white/40">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-100 to-pink-100 flex items-center justify-center">
              <User className="w-4 h-4 text-purple-600" />
            </div>
            <div className="flex-1">
              <div className="font-medium text-foreground">
                {order.customer_name || 'عميل غير محدد'}
              </div>
              {order.customer_phone && (
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {order.customer_phone}
                </div>
              )}
            </div>
          </div>

          {order.customer_city && (
            <div className="flex items-center gap-3 p-3 bg-white/60 rounded-lg border border-white/40">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-green-100 to-emerald-100 flex items-center justify-center">
                <MapPin className="w-4 h-4 text-green-600" />
              </div>
              <div className="flex-1">
                <div className="font-medium text-foreground">{order.customer_city}</div>
                {order.customer_address && (
                  <div className="text-xs text-muted-foreground line-clamp-1">
                    {order.customer_address}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Products Preview */}
        {order.order_items && order.order_items.length > 0 && (
          <div className="p-3 bg-gradient-to-r from-slate-50 to-gray-50 rounded-lg border border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-4 h-4 text-slate-600" />
              <span className="font-medium text-slate-700">المنتجات ({order.order_items.length})</span>
            </div>
            <div className="space-y-1">
              {order.order_items.slice(0, 3).map((item, index) => (
                <div key={index} className="flex justify-between items-center text-sm">
                  <span className="text-slate-600 font-medium">
                    {item.product_name || 'منتج غير محدد'}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {item.quantity}x
                  </Badge>
                </div>
              ))}
              {order.order_items.length > 3 && (
                <div className="text-xs text-muted-foreground text-center pt-1">
                  +{order.order_items.length - 3} منتجات أخرى
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer Section */}
        <div className="space-y-3 pt-2 border-t border-white/40">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Calendar className="w-3 h-3" />
              {format(new Date(order.created_at), 'dd MMM yyyy', { locale: ar })}
            </div>
            {order.delivery_partner && (
              <div className="flex items-center gap-1">
                <Truck className="w-3 h-3 text-blue-600" />
                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                  {order.delivery_partner}
                </Badge>
              </div>
            )}
          </div>

          {showEmployee && employee && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-white/40 p-2 rounded-md">
              <User className="w-3 h-3" />
              <span className="font-medium">الموظف:</span>
              <span>{employee.full_name || employee.email || 'غير محدد'}</span>
            </div>
          )}

          {/* Payment & Delivery Info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {receiptInfo.icon}
              {order.delivery_fee > 0 && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <CreditCard className="w-3 h-3" />
                  توصيل: {formatCurrency(order.delivery_fee)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Hover Effect Overlay */}
        <div className={`
          absolute inset-0 bg-gradient-to-r from-primary/5 to-blue-600/5 opacity-0 
          ${isHovered ? 'opacity-100' : ''} transition-opacity duration-300 pointer-events-none
        `} />
      </CardContent>
    </Card>
  );
};

export default SalesCard;