import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bot, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { useSuper } from '@/contexts/SuperProvider';

const AiOrdersStatsCard = () => {
  const { aiOrders = [], loading } = useSuper();

  const stats = {
    total: aiOrders.length,
    pending: aiOrders.filter(order => order.status === 'pending').length,
    approved: aiOrders.filter(order => order.status === 'approved').length,
    needsReview: aiOrders.filter(order => order.status === 'pending' && 
      (order.items?.some(item => !item.product_id || !item.variant_id) || 
       order.customer_name?.includes('?') || 
       !order.customer_phone)).length
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bot className="h-4 w-4" />
            طلبات الذكاء الاصطناعي
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Bot className="h-4 w-4" />
          طلبات الذكاء الاصطناعي
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">المجموع</span>
          <Badge variant="outline">{stats.total}</Badge>
        </div>
        
        {stats.pending > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              في الانتظار
            </span>
            <Badge variant="secondary">{stats.pending}</Badge>
          </div>
        )}
        
        {stats.needsReview > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              تحتاج مراجعة
            </span>
            <Badge variant="destructive">{stats.needsReview}</Badge>
          </div>
        )}
        
        {stats.approved > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              تم الاعتماد
            </span>
            <Badge variant="default">{stats.approved}</Badge>
          </div>
        )}
        
        {stats.total === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            لا توجد طلبات ذكية حالياً
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default AiOrdersStatsCard;