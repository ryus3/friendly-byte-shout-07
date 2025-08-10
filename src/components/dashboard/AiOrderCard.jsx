import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Bot, 
  MessageSquare, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Send, 
  Eye,
  AlertTriangle,
  User,
  Calendar,
  Hash,
  Smartphone,
  Zap,
  Trash2,
  X as XIcon,
  Edit,
  ShoppingCart,
  Package
} from 'lucide-react';
import { cn } from '@/lib/utils';

const AiOrderCard = ({ order }) => {
  const [showDetails, setShowDetails] = useState(false);
  const displayId = order?.order_number || order?.order_data?.trackingNumber || order?.order_data?.order_code || (order?.id ? String(order.id).split('-')[0].toUpperCase() : '');

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return {
          gradient: 'bg-gradient-to-br from-orange-500 to-orange-700'
        };
      case 'processing':
        return {
          gradient: 'bg-gradient-to-br from-blue-500 to-blue-700'
        };
      case 'completed':
        return {
          gradient: 'bg-gradient-to-br from-emerald-500 to-teal-600'
        };
      case 'needs_review':
        return {
          gradient: 'bg-gradient-to-br from-red-500 to-red-700'
        };
      case 'failed':
        return {
          gradient: 'bg-gradient-to-br from-gray-500 to-gray-700'
        };
      default:
        return {
          gradient: 'bg-gradient-to-br from-slate-500 to-slate-700'
        };
    }
  };

  const getSourceIcon = (source) => {
    switch (source) {
      case 'telegram':
        return {
          icon: MessageSquare,
          label: 'تليغرام'
        };
      case 'ai_chat':
        return {
          icon: Bot,
          label: 'ذكاء اصطناعي'
        };
      case 'web':
        return {
          icon: Smartphone,
          label: 'الموقع'
        };
      default:
        return {
          icon: MessageSquare,
          label: 'غير محدد'
        };
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending': return 'قيد الانتظار';
      case 'processing': return 'قيد المعالجة';
      case 'completed': return 'مكتمل';
      case 'needs_review': return 'يحتاج مراجعة';
      case 'failed': return 'فشل';
      default: return 'غير محدد';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return <Clock className="w-3 h-3 mr-1" />;
      case 'processing': return <Zap className="w-3 h-3 mr-1" />;
      case 'completed': return <CheckCircle2 className="w-3 h-3 mr-1" />;
      case 'needs_review': return <AlertTriangle className="w-3 h-3 mr-1" />;
      case 'failed': return <XCircle className="w-3 h-3 mr-1" />;
      default: return <AlertTriangle className="w-3 h-3 mr-1" />;
    }
  };

  return (
    <Card className={cn(
      "relative overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-lg border-0 shadow-md",
      "bg-gradient-to-br from-white via-slate-50 to-blue-50/30 dark:from-slate-800 dark:via-slate-700 dark:to-blue-900/20"
    )} dir="rtl">
      <CardContent className="p-3">
        <div className={cn(
          "relative rounded-lg p-3 text-white overflow-hidden",
          getStatusColor(order.status).gradient
        )}>
          {/* Background decoration */}
          <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-white/5 rounded-full"></div>
          <div className="absolute -top-1 -left-1 w-6 h-6 bg-white/5 rounded-full"></div>
          
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-white/10 rounded-lg backdrop-blur-sm">
                {React.createElement(getSourceIcon(order.source).icon, {
                  className: "w-4 h-4 text-white"
                })}
              </div>
              <div>
                <h4 className="font-bold text-sm">طلب {displayId ? `#${displayId}` : ''}</h4>
                <p className="text-xs opacity-90">{getSourceIcon(order.source).label}</p>
              </div>
            </div>
            
            <Badge className="bg-white/20 text-white border-0 text-xs">
              {getStatusIcon(order.status)}
              {getStatusText(order.status)}
            </Badge>
          </div>

          {/* Customer Info */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1">
              <User className="w-3 h-3" />
              <span className="text-xs font-medium truncate max-w-[120px]">
                {order.customer_name || order.order_data?.customer_name || 'غير محدد'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span className="text-xs opacity-90">
                {new Date(order.created_at).toLocaleDateString('ar-EG')}
              </span>
            </div>
          </div>

          {/* Order Details */}
          {order.order_data && (
            <div className="bg-white/10 rounded-md p-2 mb-3 backdrop-blur-sm">
              <div className="flex items-center gap-1 mb-1">
                <Package className="w-3 h-3" />
                <span className="text-xs font-medium">تفاصيل الطلب:</span>
              </div>
              {order.order_data.items && order.order_data.items.length > 0 ? (
                <div className="space-y-1">
                  {order.order_data.items.slice(0, 2).map((item, index) => (
                    <div key={index} className="text-xs bg-white/10 rounded px-2 py-1">
                      <span className="font-medium">{item.product_name || item.name}</span>
                      {item.quantity && <span className="mr-2">الكمية: {item.quantity}</span>}
                      {item.price && <span className="mr-2">{item.price} د.ع</span>}
                    </div>
                  ))}
                  {order.order_data.items.length > 2 && (
                    <div className="text-xs opacity-80">
                      +{order.order_data.items.length - 2} منتج آخر
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs leading-relaxed line-clamp-2">
                  {order.message || order.order_data.raw_message || 'لا توجد تفاصيل متاحة'}
                </p>
              )}
              
              {/* Total Amount */}
              {order.order_data.total_amount && (
                <div className="mt-2 pt-2 border-t border-white/20">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium">المجموع:</span>
                    <span className="text-sm font-bold">{order.order_data.total_amount} د.ع</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Contact Info */}
          {order.customer_phone && (
            <div className="bg-white/10 rounded-md p-2 mb-3 backdrop-blur-sm">
              <div className="flex items-center gap-1">
                <Smartphone className="w-3 h-3" />
                <span className="text-xs font-medium">الهاتف:</span>
                <span className="text-xs">{order.customer_phone}</span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-4 gap-1">
            <Button 
              size="sm" 
              variant="secondary"
              className="h-7 text-xs bg-white/20 hover:bg-white/30 text-white border-0 px-2"
              onClick={() => setShowDetails(!showDetails)}
            >
              <Eye className="w-3 h-3" />
            </Button>
            
            <Button 
              size="sm"
              className="h-7 text-xs bg-emerald-500/30 hover:bg-emerald-500/50 text-white border-0 px-2"
            >
              <CheckCircle2 className="w-3 h-3" />
            </Button>
            
            <Button 
              size="sm"
              className="h-7 text-xs bg-blue-500/30 hover:bg-blue-500/50 text-white border-0 px-2"
            >
              <Edit className="w-3 h-3" />
            </Button>
            
            <Button 
              size="sm"
              className="h-7 text-xs bg-red-500/30 hover:bg-red-500/50 text-white border-0 px-2"
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>

        {/* Expanded Details */}
        {showDetails && (
          <div className="mt-3 space-y-2">
            {order.order_data?.shipping_address && (
              <div className="bg-slate-100 dark:bg-slate-700 rounded-md p-2">
                <div className="flex items-center gap-2 text-xs">
                  <Package className="w-3 h-3 text-blue-600" />
                  <span className="font-medium">عنوان التوصيل:</span>
                  <span className="text-muted-foreground">{order.order_data.shipping_address}</span>
                </div>
              </div>
            )}
            
            {order.ai_response && (
              <div className="bg-blue-50 dark:bg-blue-900/30 rounded-md p-2">
                <h5 className="font-medium text-xs mb-1 text-blue-800 dark:text-blue-200 flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  رد الذكاء الاصطناعي:
                </h5>
                <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                  {order.ai_response}
                </p>
              </div>
            )}
            
            {order.error_message && (
              <div className="bg-red-50 dark:bg-red-900/30 rounded-md p-2">
                <h5 className="font-medium text-xs mb-1 text-red-800 dark:text-red-200 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  رسالة خطأ:
                </h5>
                <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">
                  {order.error_message}
                </p>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-100 dark:bg-slate-700 rounded-md p-2">
                <span className="font-medium text-xs block">وقت الإنشاء:</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(order.created_at).toLocaleTimeString('ar-EG')}
                </span>
              </div>
              <div className="bg-slate-100 dark:bg-slate-700 rounded-md p-2">
                <span className="font-medium text-xs block">آخر تحديث:</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(order.updated_at || order.created_at).toLocaleTimeString('ar-EG')}
                </span>
              </div>
            </div>

            {/* Full Order Data Debug */}
            {order.order_data && (
              <details className="bg-slate-100 dark:bg-slate-700 rounded-md p-2">
                <summary className="font-medium text-xs cursor-pointer">عرض البيانات الكاملة</summary>
                <pre className="text-xs mt-2 overflow-auto max-h-32 bg-slate-200 dark:bg-slate-600 p-2 rounded">
                  {JSON.stringify(order, null, 2)}
                </pre>
              </details>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AiOrderCard;