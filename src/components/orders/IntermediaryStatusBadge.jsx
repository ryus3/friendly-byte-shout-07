import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, ExternalLink } from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';

const IntermediaryStatusBadge = ({ order }) => {
  // فقط للطلبات الخارجية التي تحتوي على delivery_status
  if (!order.delivery_status || !order.tracking_number || order.tracking_number.startsWith('RYUS-')) {
    return null;
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto p-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Eye className="w-3 h-3 ml-1" />
          تفاصيل الوسيط
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ExternalLink className="w-4 h-4" />
            حالة الطلب في الوسيط
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="border rounded-lg p-3">
            <div className="text-sm text-muted-foreground mb-1">رقم التتبع</div>
            <div className="font-mono font-medium">{order.tracking_number}</div>
          </div>
          
          <div className="border rounded-lg p-3">
            <div className="text-sm text-muted-foreground mb-1">حالة الوسيط (النص الأصلي)</div>
            <Badge variant="outline" className="font-medium">
              {order.delivery_status}
            </Badge>
          </div>
          
          {order.delivery_partner && (
            <div className="border rounded-lg p-3">
              <div className="text-sm text-muted-foreground mb-1">شركة التوصيل</div>
              <div className="font-medium">{order.delivery_partner}</div>
            </div>
          )}
          
          <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
            ملاحظة: هذه هي الحالة الأصلية كما ترسلها شركة التوصيل، وقد تختلف عن العرض المبسط في النظام.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default IntermediaryStatusBadge;