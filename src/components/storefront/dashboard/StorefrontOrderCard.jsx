import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import GradientButton from '@/components/storefront/ui/GradientButton';
import { Check, X, Eye, Package, MapPin, Phone } from 'lucide-react';

const StorefrontOrderCard = ({ order, onApprove, onReject }) => {
  const getStatusBadge = (status) => {
    const configs = {
      'pending_approval': { variant: 'secondary', label: 'بانتظار الموافقة', gradient: 'from-orange-500 to-red-500' },
      'approved': { variant: 'default', label: 'تمت الموافقة', gradient: 'from-emerald-500 to-teal-500' },
      'rejected': { variant: 'destructive', label: 'مرفوض', gradient: 'from-red-500 to-pink-500' }
    };
    
    const config = configs[status] || configs['pending_approval'];
    return (
      <Badge className={`bg-gradient-to-r ${config.gradient} text-white border-0`}>
        {config.label}
      </Badge>
    );
  };

  return (
    <Card className="overflow-hidden hover:shadow-2xl transition-all duration-300 border-2">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/10 dark:to-pink-950/10 opacity-50" />
      
      <CardHeader className="relative z-10">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">
              طلب #{order.id.substring(0, 8)}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {new Date(order.created_at).toLocaleString('ar-IQ')}
            </p>
          </div>
          {getStatusBadge(order.status)}
        </div>
      </CardHeader>
      
      <CardContent className="relative z-10 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Phone className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="font-semibold">{order.customer_name}</p>
                <p className="text-muted-foreground" dir="ltr">{order.customer_phone}</p>
              </div>
            </div>
            
            <div className="flex items-start gap-2 text-sm">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <MapPin className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-muted-foreground flex-1">{order.customer_address}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <Package className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="font-semibold">{order.items?.length || 0} منتج</p>
                <p className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600">
                  {order.total_amount?.toLocaleString('ar-IQ')} IQD
                </p>
              </div>
            </div>
          </div>
        </div>

        {order.notes && (
          <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 rounded-xl border-2 border-amber-200 dark:border-amber-800">
            <p className="text-sm font-semibold mb-1 text-amber-900 dark:text-amber-100">📝 ملاحظات:</p>
            <p className="text-sm text-amber-800 dark:text-amber-200">{order.notes}</p>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          {order.status === 'pending_approval' && (
            <>
              <GradientButton
                gradient="from-emerald-500 to-teal-500"
                onClick={onApprove}
                className="flex-1"
              >
                <Check className="h-4 w-4 ml-2" />
                موافقة
              </GradientButton>
              
              <GradientButton
                gradient="from-red-500 to-pink-500"
                onClick={onReject}
                className="flex-1"
              >
                <X className="h-4 w-4 ml-2" />
                رفض
              </GradientButton>
            </>
          )}
          
          <GradientButton
            gradient="from-blue-500 to-purple-500"
            variant="outline"
          >
            <Eye className="h-4 w-4 ml-2" />
            التفاصيل
          </GradientButton>
        </div>
      </CardContent>
    </Card>
  );
};

export default StorefrontOrderCard;
