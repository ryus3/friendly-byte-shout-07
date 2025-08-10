import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Bot, 
  MessageSquare, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Send, 
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog.jsx';
import { useSuper } from '@/contexts/SuperProvider';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
const AiOrderCard = ({ order, isSelected, onSelect }) => {
  // المعاينة ملغاة - التفاصيل تظهر دائماً
  const formatDateEnglish = (date) => {
    return new Date(date).toLocaleDateString('en-US');
  };
  
  const formatTimeEnglish = (date) => {
    return new Date(date).toLocaleTimeString('en-US', { hour12: false });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return {
          gradient: 'bg-gradient-to-br from-amber-500 via-orange-500 to-red-500'
        };
      case 'processing':
        return {
          gradient: 'bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600'
        };
      case 'completed':
        return {
          gradient: 'bg-gradient-to-br from-emerald-400 via-green-500 to-teal-600'
        };
      case 'needs_review':
        return {
          gradient: 'bg-gradient-to-br from-red-500 via-pink-500 to-rose-600'
        };
      case 'failed':
        return {
          gradient: 'bg-gradient-to-br from-gray-500 via-slate-600 to-gray-700'
        };
      default:
        return {
          gradient: 'bg-gradient-to-br from-slate-500 via-gray-600 to-slate-700'
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
      case 'pending': return <Clock className="w-3 h-3 ml-1" />;
      case 'processing': return <Zap className="w-3 h-3 ml-1" />;
      case 'completed': return <CheckCircle2 className="w-3 h-3 ml-1" />;
      case 'needs_review': return <AlertTriangle className="w-3 h-3 ml-1" />;
      case 'failed': return <XCircle className="w-3 h-3 ml-1" />;
      default: return <AlertTriangle className="w-3 h-3 ml-1" />;
    }
  };
  const { products = [], users = [], approveAiOrder, refreshAll } = useSuper();

  const items = useMemo(() => (
    Array.isArray(order.items) ? order.items : (order.order_data?.items || [])
  ), [order]);

  const createdByName = useMemo(() => {
    const by = order.created_by || order.order_data?.created_by || order.user_id || order.created_by_employee_code;
    if (!by) return 'غير محدد';
    const profile = users.find(u => u?.employee_code === by || u?.user_id === by || u?.id === by || u?.username === by);
    return profile?.full_name || profile?.username || by;
  }, [users, order]);

  const availability = useMemo(() => {
    if (!items.length) return 'unknown';
    const lower = (v) => (v || '').toString().trim().toLowerCase();

    // جمع كل المتغيرات مع أسماء المنتجات
    const variants = [];
    for (const p of (products || [])) {
      const list = Array.isArray(p.variants) ? p.variants : (p.product_variants || []);
      list.forEach(v => variants.push({ ...v, product_id: p.id, product_name: p.name }));
    }

    const findByVariantId = (id) => variants.find(v => v.id === id);
    const findByProductId = (pid) => variants.find(v => v.product_id === pid);
    const findByName = (name, color, size) => {
      const vname = lower(name);
      const matches = variants.filter(v => lower(v.product_name) === vname || lower(v.product_name).includes(vname));
      if (!matches.length) return null;
      if (color || size) {
        return matches.find(v => lower(v.color || v.color_name) === lower(color) && lower(v.size || v.size_name) === lower(size))
          || matches.find(v => lower(v.color || v.color_name) === lower(color))
          || matches.find(v => lower(v.size || v.size_name) === lower(size))
          || matches[0];
      }
      return matches[0];
    };

    let allMatched = true;
    let allAvailable = true;

    for (const it of items) {
      const qty = Number(it.quantity || 1);
      let variant = null;
      if (it.variant_id) variant = findByVariantId(it.variant_id);
      else if (it.product_id) variant = findByProductId(it.product_id);
      else variant = findByName(it.product_name || it.name || it.product, it.color, it.size);

      if (!variant) { allMatched = false; continue; }
      const available = (Number(variant.quantity ?? 0) - Number(variant.reserved_quantity ?? 0));
      if (available < qty) { allAvailable = false; }
    }

    if (!allMatched) return 'unknown';
    return allAvailable ? 'available' : 'out';
  }, [items, products]);

  const needsReviewStatuses = ['needs_review', 'review', 'error', 'failed'];
  const needsReview = useMemo(() => needsReviewStatuses.includes(order.status) || availability !== 'available', [order.status, availability]);

  const gradientToUse = useMemo(() => {
    if (availability === 'out') return 'bg-gradient-to-br from-red-500 to-red-700';
    if (availability === 'available' && !needsReview) return 'bg-gradient-to-br from-[hsl(var(--primary))] via-[hsl(var(--primary)/0.85)] to-[hsl(var(--primary)/0.7)]';
    if (needsReview) return 'bg-gradient-to-br from-red-500 to-red-700';
    return getStatusColor(order.status).gradient;
  }, [availability, needsReview, order.status]);

  return (
    <Card className={cn(
      "relative overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-lg border-0 shadow-md",
      "bg-gradient-to-br from-white via-slate-50 to-blue-50/30 dark:from-slate-800 dark:via-slate-700 dark:to-blue-900/20",
      isSelected && "ring-2 ring-blue-500"
    )} dir="rtl">
      <CardContent className="p-2">
        <div className={cn(
          "relative rounded-lg p-2 text-white overflow-hidden",
          gradientToUse
        )}>
          {/* Background decoration - Beautiful circles like inventory sections */}
          <div className="absolute -bottom-3 -right-3 w-12 h-12 bg-white/10 rounded-full"></div>
          <div className="absolute -top-2 -left-2 w-8 h-8 bg-white/15 rounded-full"></div>
          <div className="absolute top-1/2 left-1/4 w-6 h-6 bg-white/5 rounded-full"></div>
          <div className="absolute bottom-1/3 right-1/3 w-4 h-4 bg-white/10 rounded-full"></div>
          
          {/* Header with selection */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={isSelected}
                onCheckedChange={onSelect}
                className="border-white data-[state=checked]:bg-white data-[state=checked]:text-slate-900"
              />
              <div className="p-1.5 bg-white/10 rounded-lg backdrop-blur-sm">
                {React.createElement(getSourceIcon(order.source).icon, {
                  className: "w-4 h-4 text-white"
                })}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm">{getSourceIcon(order.source).label}</h4>
                </div>
                <p className="text-xs opacity-90">بواسطة: {createdByName}</p>
              </div>
            </div>
            
            <div className="flex flex-col items-center text-center">
              <div className="flex items-center gap-1 mb-1">
                <Badge className="bg-white/20 text-white border-0 text-[10px]">
                  {getStatusIcon(order.status)}
                  {getStatusText(order.status)}
                </Badge>
              </div>
              <div className="text-xs opacity-90">{formatDateEnglish(order.created_at)}</div>
            </div>
          </div>
          {/* Alerts */}
          {availability !== 'available' && (
            <div className="mb-2 p-2 rounded-md bg-white/15 border border-white/30 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-xs font-medium">
                {availability === 'out' ? 'تنبيه: عناصر غير متاحة (نافذة/محجوزة)' : 'تنبيه: تفاصيل تحتاج مطابقة مع المنتجات'}
              </span>
            </div>
          )}

          {/* Complete Order Details */}
          <div className="space-y-1.5 mb-2">
            {/* Customer Phone */}

            {/* Shipping Address */}
            {(order.order_data?.shipping_address || order.order_data?.address || order.shipping_address) && (
              <div className="bg-white/10 rounded-md p-1.5 backdrop-blur-sm">
                <div className="flex items-center gap-1">
                  <Package className="w-3 h-3" />
                  <span className="text-[11px] font-medium">العنوان:</span>
                  <span className="text-[11px]">
                    {order.order_data?.shipping_address || order.order_data?.address || order.shipping_address}
                  </span>
                </div>
              </div>
            )}

            {/* Product Details */}
            {order.order_data && (
              <div className="bg-white/10 rounded-md p-2 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-1">
                <Package className="w-3 h-3" />
                <span className="text-xs font-medium">تفاصيل الطلب:</span>
                {(order.customer_phone || order.order_data?.customer_phone || order.order_data?.phone) && (
                  <span className="text-[11px] flex items-center gap-1">
                    <Smartphone className="w-3 h-3" />
                    {order.customer_phone || order.order_data?.customer_phone || order.order_data?.phone}
                  </span>
                )}
              </div>
                
                {items && items.length > 0 ? (
                  <div className="space-y-1">
                    {items.map((item, index) => {
                      const name = (item.product_name || item.name || item.product || '').toString().trim();
                      const size = item.size ? `${item.size}` : '';
                      const color = item.color ? `${item.color}` : '';
                      const qty = item.quantity || 1;
                      const line = `${name}${size ? ' ' + size : ''}${color ? ' ' + color : ''} x ${qty}`;
                      return (
                        <div key={index} className="text-xs">
                          {line}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs leading-relaxed">
                    {order.message || order.order_data?.raw_message || order.order_data?.description || 'لا توجد تفاصيل متاحة'}
                  </p>
                )}
                
                {/* Total Amount */}
                {(order.order_data.total_amount || order.order_data.total || order.total_amount) && (
                  <div className="mt-2 pt-2 border-t border-white/20">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium">المجموع:</span>
                      <span className="text-sm font-bold">
                        {order.order_data.total_amount || order.order_data.total || order.total_amount} د.ع
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons with confirmations */}
          <div className="grid grid-cols-3 gap-1">
            {/* Approve */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 text-xs bg-sky-500 text-white hover:bg-sky-600 gap-1" disabled={availability !== 'available' || needsReview}>
                  <CheckCircle2 className="w-3 h-3" />
                  موافقة
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>تأكيد الموافقة</AlertDialogTitle>
                  <AlertDialogDescription>سيتم إنشاء طلب حقيقي وحذف الطلب الذكي فورًا.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={async () => {
                      const res = await approveAiOrder(order.id);
                      if (res?.success) {
                        window.dispatchEvent(new CustomEvent('aiOrderApproved', { detail: { id: order.id } }));
                        toast({ title: 'تمت الموافقة', description: 'تم إنشاء الطلب وحذف الطلب الذكي', variant: 'success' });
                        try { await refreshAll?.(); } catch (e) {}
                      } else {
                        toast({ title: 'فشل الموافقة', description: res?.error || 'حدث خطأ غير متوقع', variant: 'destructive' });
                      }
                    }}
                  >
                    تأكيد
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Edit */}
            <Button 
              variant="ghost"
              size="sm"
              className="h-8 text-xs bg-white text-slate-900 hover:bg-slate-100 border border-white/60 shadow-sm gap-1"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('openQuickOrderWithAi', { detail: order }));
              }}
            >
              <Edit className="w-3 h-3" />
              تعديل
            </Button>

            {/* Delete */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 text-xs bg-red-500 text-white hover:bg-red-600 gap-1">
                  <Trash2 className="w-3 h-3" />
                  حذف
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                  <AlertDialogDescription>سيتم حذف الطلب الذكي نهائيًا.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={async () => {
                      const { error } = await supabase.from('ai_orders').delete().eq('id', order.id);
                      if (error) {
                        toast({ title: 'فشل الحذف', description: error.message, variant: 'destructive' });
                      } else {
                        window.dispatchEvent(new CustomEvent('aiOrderDeleted', { detail: { id: order.id } }));
                        toast({ title: 'تم الحذف', description: 'تم حذف الطلب الذكي نهائياً', variant: 'success' });
                        try { await refreshAll?.(); } catch (e) {}
                      }
                    }}
                  >
                    تأكيد
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Expanded Details - always visible */}
        <div className="mt-3 space-y-2 hidden">
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
            
          </div>
      </CardContent>
    </Card>
  );
};

export default AiOrderCard;