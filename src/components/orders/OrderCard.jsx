import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, isValid } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { motion } from 'framer-motion';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Trash2, Truck, Eye, Pencil } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/use-toast';

const OrderCard = ({ order, onViewOrder, onSelect, isSelected, onUpdateStatus, onDeleteOrder, onEditOrder }) => {
  const { hasPermission } = useAuth();
  
  const cardVariants = {
    rest: { scale: 1 },
    hover: { scale: 1.01 },
  };

  const getOrderDate = () => {
    const dateString = order.created_at || order.createdAt;
    if (!dateString) return 'لا يوجد تاريخ';
    const date = parseISO(dateString);
    if (!isValid(date)) return 'تاريخ غير صالح';
    return format(date, 'd/M/yyyy', { locale: ar });
  };

  const statusVariants = {
    pending: { label: 'قيد التجهيز', color: 'bg-[hsl(var(--status-pending)_/_0.1)] text-[hsl(var(--status-pending))] border-[hsl(var(--status-pending)_/_0.2)]' },
    processing: { label: 'قيد المعالجة', color: 'bg-[hsl(var(--status-processing)_/_0.1)] text-[hsl(var(--status-processing))] border-[hsl(var(--status-processing)_/_0.2)]' },
    shipped: { label: 'تم الشحن', color: 'bg-[hsl(var(--status-shipped)_/_0.1)] text-[hsl(var(--status-shipped))] border-[hsl(var(--status-shipped)_/_0.2)]' },
    delivery: { label: 'قيد التوصيل', color: 'bg-[hsl(var(--status-delivery)_/_0.1)] text-[hsl(var(--status-delivery))] border-[hsl(var(--status-delivery)_/_0.2)]' },
    delivered: { label: 'تم التسليم', color: 'bg-[hsl(var(--status-delivered)_/_0.1)] text-[hsl(var(--status-delivered))] border-[hsl(var(--status-delivered)_/_0.2)]' },
    returned: { label: 'راجعة', color: 'bg-[hsl(var(--status-returned)_/_0.1)] text-[hsl(var(--status-returned))] border-[hsl(var(--status-returned)_/_0.2)]' },
    cancelled: { label: 'ملغي', color: 'bg-[hsl(var(--status-cancelled)_/_0.1)] text-[hsl(var(--status-cancelled))] border-[hsl(var(--status-cancelled)_/_0.2)]' },
  };

  const customerInfo = order.customerinfo || {
    name: order.customer_name,
    phone: order.customer_phone,
    address: order.customer_address
  };

  return (
    <motion.div variants={cardVariants} initial="rest" whileHover="hover" transition={{ duration: 0.2 }}>
      <Card className={`overflow-hidden bg-card/90 backdrop-blur-sm transition-all duration-300 w-full border-2 hover:bg-card/95 hover:shadow-lg ${isSelected ? 'border-primary' : 'border-transparent hover:border-primary/20'}`}>
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-start gap-3">
            {/* Checkbox */}
            <div className="flex-shrink-0" onClick={(e) => { e.stopPropagation(); onSelect(order.id); }}>
              <Checkbox checked={isSelected} className="mt-1 sm:mt-0"/>
            </div>

            {/* Customer & Order Info */}
            <div className="flex-grow space-y-3 w-full cursor-pointer" onClick={(e) => {e.stopPropagation(); onViewOrder()}}>
              {/* الصف الأول - معلومات الزبون والسعر */}
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="font-bold text-sm text-foreground truncate">{customerInfo.name || 'زبون غير معروف'}</p>
                  <p className="text-xs text-muted-foreground">{customerInfo.phone || 'لا يوجد رقم هاتف'}</p>
                </div>
                <div className="text-left">
                  <p className="font-semibold text-primary text-md">{(order.final_amount || order.total || 0).toLocaleString()} د.ع</p>
                  <p className="text-xs text-muted-foreground">{getOrderDate()}</p>
                </div>
              </div>
              
              {/* الصف الثاني - رقم التتبع والتوصيل والحالة */}
              <div className="flex items-center justify-between">
                <div className="flex-1 space-y-1">
                  <p className="text-xs text-muted-foreground">{order.tracking_number || order.trackingnumber || 'لا يوجد رقم تتبع'}</p>
                  <div className="flex items-center gap-2">
                     <Badge variant="outline" className={`text-xs ${order.delivery_partner === 'محلي' || !order.delivery_partner ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300' : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300'}`}>
                       {order.delivery_partner === 'محلي' || !order.delivery_partner ? 'توصيل محلي' : order.delivery_partner}
                     </Badge>
                  </div>
                </div>
                <Badge className={`text-center ${statusVariants[order.status]?.color || 'bg-gray-500/10 text-gray-500'}`}>
                  {statusVariants[order.status]?.label || 'غير معروف'}
                </Badge>
              </div>
              
              {/* الصف الثالث - صور المنتجات */}
              <div className="flex -space-x-2 rtl:space-x-reverse overflow-hidden items-center">
                 <TooltipProvider>
                   {(order.order_items || order.items || []).slice(0, 4).map((item, index) => {
                     const productName = item.products?.name || item.product_name || item.productName || 'منتج غير معروف';
                     const productImage = item.products?.images?.[0] || item.product_variants?.images?.[0] || item.image;
                     return (
                       <Tooltip key={`${item.product_id || item.productId}-${index}`}>
                         <TooltipTrigger asChild>
                           <Avatar className="inline-block h-8 w-8 rounded-full ring-2 ring-background">
                             <AvatarImage src={productImage} alt={productName} />
                             <AvatarFallback>{productName?.charAt(0) || 'P'}</AvatarFallback>
                           </Avatar>
                         </TooltipTrigger>
                         <TooltipContent><p>{productName} (x{item.quantity})</p></TooltipContent>
                       </Tooltip>
                     );
                   })}
                   {(order.order_items || order.items || []).length > 4 && (
                     <Tooltip>
                        <TooltipTrigger asChild><Avatar className="inline-block h-8 w-8 rounded-full ring-2 ring-background"><AvatarFallback>+{(order.order_items || order.items || []).length - 4}</AvatarFallback></Avatar></TooltipTrigger>
                        <TooltipContent><p>و {(order.order_items || order.items || []).length - 4} منتجات أخرى</p></TooltipContent>
                     </Tooltip>
                   )}
                 </TooltipProvider>
              </div>
            </div>

            {/* Actions */}
            <div className="flex-shrink-0 flex items-center gap-1 self-start">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e)=>{e.stopPropagation(); onViewOrder()}}>
                  <Eye className="h-4 w-4" />
              </Button>
              
              {/* زر التتبع لشركات التوصيل */}
              {order.delivery_partner && order.delivery_partner !== 'محلي' && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e)=>{e.stopPropagation(); toast({title: "قيد التطوير", description: "سيتم تفعيل تتبع الشحنة قريباً."})}}>
                      <Truck className="h-4 w-4" />
                  </Button>
              )}
              
              {/* زر التعديل - للطلبات قيد التجهيز */}
              {order.status === 'pending' && hasPermission('edit_orders') && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e)=>{e.stopPropagation(); onEditOrder()}}>
                      <Pencil className="h-4 w-4" />
                  </Button>
              )}
              
              {/* زر الحذف - للطلبات قيد التجهيز */}
              {order.status === 'pending' && hasPermission('cancel_orders') && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={(e)=>{e.stopPropagation(); onDeleteOrder([order.id])}}>
                      <Trash2 className="h-4 w-4" />
                  </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default OrderCard;