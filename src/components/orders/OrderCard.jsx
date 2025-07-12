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
    pending: { label: 'قيد الانتظار', color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' },
    processing: { label: 'قيد التجهيز', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
    shipped: { label: 'تم الشحن', color: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' },
    delivered: { label: 'تم التوصيل', color: 'bg-green-500/10 text-green-500 border-green-500/20' },
    returned: { label: 'راجع', color: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
    cancelled: { label: 'ملغي', color: 'bg-red-500/10 text-red-500 border-red-500/20' },
  };

  const customerInfo = order.customerinfo || {};

  return (
    <motion.div variants={cardVariants} initial="rest" whileHover="hover" transition={{ duration: 0.2 }}>
      <Card className={`overflow-hidden bg-card/80 backdrop-blur-sm transition-all duration-300 w-full border-2 ${isSelected ? 'border-primary' : 'border-transparent'}`}>
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {/* Checkbox */}
            <div className="flex-shrink-0" onClick={(e) => { e.stopPropagation(); onSelect(order.id); }}>
              <Checkbox checked={isSelected} className="mt-1 sm:mt-0"/>
            </div>

            {/* Customer & Order Info */}
            <div className="flex-grow grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-x-4 gap-y-2 w-full cursor-pointer" onClick={(e) => {e.stopPropagation(); onViewOrder()}}>
              <div className="col-span-2 sm:col-span-1">
                <p className="font-bold text-sm text-foreground truncate">{customerInfo.name || 'زبون غير معروف'}</p>
                <p className="text-xs text-muted-foreground">{customerInfo.phone || 'لا يوجد رقم هاتف'}</p>
              </div>
              <div className="col-span-2 sm:col-span-1">
                 <p className="text-xs text-muted-foreground">{order.trackingnumber || 'لا يوجد رقم تتبع'}</p>
                 <p className="font-mono text-xs">{getOrderDate()}</p>
              </div>
              <div className="col-span-2 sm:col-span-1 flex -space-x-2 rtl:space-x-reverse overflow-hidden items-center">
                 <TooltipProvider>
                  {order.items.slice(0, 3).map((item, index) => (
                    <Tooltip key={`${item.productId}-${index}`}>
                      <TooltipTrigger asChild>
                        <Avatar className="inline-block h-8 w-8 rounded-full ring-2 ring-background">
                          <AvatarImage src={item.image} alt={item.productName} />
                          <AvatarFallback>{item.productName?.charAt(0)}</AvatarFallback>
                        </Avatar>
                      </TooltipTrigger>
                      <TooltipContent><p>{item.productName} (x{item.quantity})</p></TooltipContent>
                    </Tooltip>
                  ))}
                  {order.items.length > 3 && (
                    <Tooltip>
                       <TooltipTrigger asChild><Avatar className="inline-block h-8 w-8 rounded-full ring-2 ring-background"><AvatarFallback>+{order.items.length - 3}</AvatarFallback></Avatar></TooltipTrigger>
                       <TooltipContent><p>و {order.items.length - 3} منتجات أخرى</p></TooltipContent>
                    </Tooltip>
                  )}
                </TooltipProvider>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <p className="font-semibold text-primary text-md">{order.total.toLocaleString()} د.ع</p>
              </div>
               <div className="col-span-2 md:col-span-1 flex items-center justify-start md:justify-center">
                 <Badge className={`w-28 text-center justify-center ${statusVariants[order.status]?.color || 'bg-gray-500/10 text-gray-500'}`}>
                   {statusVariants[order.status]?.label || 'غير معروف'}
                 </Badge>
               </div>
            </div>

            {/* Actions */}
            <div className="flex-shrink-0 flex sm:flex-col md:flex-row items-center gap-1 self-start sm:self-center ml-auto">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e)=>{e.stopPropagation(); onViewOrder()}}>
                  <Eye className="h-4 w-4" />
              </Button>
              {order.shipping_company !== 'محلي' && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e)=>{e.stopPropagation(); toast({title: "قيد التطوير", description: "سيتم تفعيل تتبع الشحنة قريباً."})}}>
                      <Truck className="h-4 w-4" />
                  </Button>
              )}
              {order.shipping_company !== 'محلي' && order.status === 'pending' && hasPermission('manage_orders') && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e)=>{e.stopPropagation(); onEditOrder()}}>
                      <Pencil className="h-4 w-4" />
                  </Button>
              )}
               {hasPermission('delete_local_orders') && order.shipping_company === 'محلي' && (
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