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
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';

const AiOrderCard = ({ order }) => {
  const [showDetails, setShowDetails] = useState(false);

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return {
          gradient: 'bg-gradient-to-br from-yellow-500 to-orange-600'
        };
      case 'processing':
        return {
          gradient: 'bg-gradient-to-br from-blue-500 to-blue-700'
        };
      case 'completed':
        return {
          gradient: 'bg-gradient-to-br from-emerald-500 to-teal-600'
        };
      case 'failed':
        return {
          gradient: 'bg-gradient-to-br from-red-500 to-red-700'
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
      case 'failed': return 'فشل';
      default: return 'غير محدد';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return <Clock className="w-3 h-3 mr-1" />;
      case 'processing': return <Zap className="w-3 h-3 mr-1" />;
      case 'completed': return <CheckCircle2 className="w-3 h-3 mr-1" />;
      case 'failed': return <XCircle className="w-3 h-3 mr-1" />;
      default: return <AlertTriangle className="w-3 h-3 mr-1" />;
    }
  };

  return (
    <Card className={cn(
      "relative overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-lg border-0 shadow-md",
      "bg-gradient-to-br from-white via-slate-50 to-blue-50/30 dark:from-slate-800 dark:via-slate-700 dark:to-blue-900/20"
    )}>
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
                <h4 className="font-bold text-sm">طلب #{order.id}</h4>
                <p className="text-xs opacity-90">{getSourceIcon(order.source).label}</p>
              </div>
            </div>
            
            <Badge className="bg-white/20 text-white border-0 text-xs">
              {getStatusText(order.status)}
            </Badge>
          </div>

          {/* Customer Info */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1">
              <User className="w-3 h-3" />
              <span className="text-xs font-medium truncate max-w-[100px]">
                {order.customer_name || 'غير محدد'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span className="text-xs opacity-90">
                {new Date(order.created_at).toLocaleDateString('ar-EG')}
              </span>
            </div>
          </div>

          {/* Message Preview */}
          <div className="bg-white/10 rounded-md p-2 mb-3 backdrop-blur-sm">
            <p className="text-xs leading-relaxed line-clamp-2">
              {order.message || 'لا توجد تفاصيل متاحة'}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Button 
              size="sm" 
              variant="secondary"
              className="flex-1 h-7 text-xs bg-white/20 hover:bg-white/30 text-white border-0"
              onClick={() => setShowDetails(!showDetails)}
            >
              <Eye className="w-3 h-3 mr-1" />
              {showDetails ? 'إخفاء' : 'عرض'}
            </Button>
            
            <Button 
              size="sm"
              className="flex-1 h-7 text-xs bg-white/30 hover:bg-white/40 text-white border-0"
            >
              <Send className="w-3 h-3 mr-1" />
              {order.status === 'pending' ? 'معالجة' : 'رد'}
            </Button>
          </div>
        </div>

        {/* Expanded Details */}
        {showDetails && (
          <div className="mt-3 space-y-2">
            {order.customer_phone && (
              <div className="bg-slate-100 dark:bg-slate-700 rounded-md p-2">
                <div className="flex items-center gap-2 text-xs">
                  <Smartphone className="w-3 h-3 text-green-600" />
                  <span className="font-medium">الهاتف:</span>
                  <span className="text-muted-foreground">{order.customer_phone}</span>
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
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AiOrderCard;