import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, Trash2, Download, Calendar, Package, DollarSign, CreditCard } from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import PurchasePrintButton from './PurchasePrintButton';


const PurchaseCard = ({ purchase, onViewDetails, onDelete, index }) => {
  const totalCost = (purchase.total_amount || 0); // المبلغ الأساسي فقط
  const hasShipping = (purchase.shipping_cost || 0) > 0;
  const hasTransfer = (purchase.transfer_cost || 0) > 0;
  
  const getStatusColor = (status) => {
    switch(status) {
      case 'completed': return 'bg-green-500/10 text-green-700 border-green-200';
      case 'pending': return 'bg-yellow-500/10 text-yellow-700 border-yellow-200';
      case 'cancelled': return 'bg-red-500/10 text-red-700 border-red-200';
      default: return 'bg-gray-500/10 text-gray-700 border-gray-200';
    }
  };

  const getStatusText = (status) => {
    switch(status) {
      case 'completed': return 'مكتملة';
      case 'pending': return 'قيد الانتظار';
      case 'cancelled': return 'ملغية';
      default: return 'غير محدد';
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="group relative overflow-hidden rounded-xl border bg-card 
                 shadow-lg shadow-black/10 
                 hover:shadow-xl hover:shadow-primary/20 
                 hover:border-primary/30 
                 transition-all duration-300 ease-out
                 dark:bg-card dark:shadow-white/5 dark:hover:shadow-primary/10
                 w-full max-w-full"
    >
      {/* خلفية متدرجة */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      {/* محتوى الكارت */}
      <div className="relative p-6 space-y-4">
        {/* الهيدر */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge 
                variant="outline" 
                className="font-mono text-xs bg-primary/10 text-primary border-primary/20"
              >
                #{purchase.purchase_number || purchase.id.slice(0, 8)}
              </Badge>
              <Badge 
                className={cn("text-xs", getStatusColor(purchase.status))}
              >
                {getStatusText(purchase.status)}
              </Badge>
            </div>
            <h3 className="font-semibold text-lg text-card-foreground group-hover:text-primary transition-colors">
              {purchase.supplier_name || purchase.supplier || 'مورد غير محدد'}
            </h3>
          </div>
          
          {/* تاريخ الشراء */}
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span className="text-sm">
              {format(new Date(purchase.purchase_date || purchase.created_at), 'd MMM yyyy', { locale: ar })}
            </span>
          </div>
        </div>

        {/* الإحصائيات */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {/* عدد الأصناف */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 group-hover:bg-primary/5 transition-colors">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 flex-shrink-0">
              <Package className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-muted-foreground truncate">عدد الأصناف</p>
              <p className="font-semibold">{purchase.items?.length || 0}</p>
            </div>
          </div>

          {/* الإجمالي */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 group-hover:bg-primary/5 transition-colors">
            <div className="p-2 rounded-lg bg-green-500/10 text-green-600 flex-shrink-0">
              <DollarSign className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-muted-foreground truncate">الإجمالي</p>
              <p className="font-semibold text-sm sm:text-base">{totalCost.toLocaleString()} د.ع</p>
            </div>
          </div>
        </div>

        {/* التكاليف الإضافية */}
        {(hasShipping || hasTransfer) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {hasShipping && (
              <div className="flex items-center justify-between p-2 rounded-lg bg-orange-50 dark:bg-orange-900/20">
                <span className="text-xs text-orange-700 dark:text-orange-300 truncate">شحن</span>
                <span className="text-xs font-medium text-orange-800 dark:text-orange-200 flex-shrink-0">
                  {(purchase.shipping_cost || 0).toLocaleString()} د.ع
                </span>
              </div>
            )}
            {hasTransfer && (
              <div className="flex items-center justify-between p-2 rounded-lg bg-purple-50 dark:bg-purple-900/20">
                <span className="text-xs text-purple-700 dark:text-purple-300 truncate">تحويل</span>
                <span className="text-xs font-medium text-purple-800 dark:text-purple-200 flex-shrink-0">
                  {(purchase.transfer_cost || 0).toLocaleString()} د.ع
                </span>
              </div>
            )}
          </div>
        )}

        {/* الأزرار */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pt-2 border-t border-border/50 gap-3 sm:gap-2">
          <div className="flex gap-1 sm:gap-2 flex-wrap">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => onViewDetails(purchase)}
              className="h-8 px-2 sm:px-3 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
            >
              <Eye className="w-3.5 h-3.5 ml-1" />
              <span className="text-xs">عرض</span>
            </Button>
            
            <PurchasePrintButton purchase={purchase} />
            
            
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => onDelete?.(purchase)}
              className="h-8 px-2 sm:px-3 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <Trash2 className="w-3.5 h-3.5 ml-1" />
              <span className="text-xs">حذف</span>
            </Button>
          </div>
          
          {/* مبلغ المنتجات */}
          <div className="text-right w-full sm:w-auto">
            <p className="text-xs text-muted-foreground">قيمة المنتجات</p>
            <p className="text-sm font-medium">{(purchase.total_amount || 0).toLocaleString()} د.ع</p>
          </div>
        </div>
      </div>

      {/* تأثير الضوء */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out pointer-events-none" />
    </motion.div>
  );
};

export default PurchaseCard;