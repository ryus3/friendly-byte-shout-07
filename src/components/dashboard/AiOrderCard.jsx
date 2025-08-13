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
import { useAuth } from '@/contexts/UnifiedAuthContext';
const AiOrderCard = ({ order, isSelected, onSelect }) => {
  const formatDateEnglish = (date) => {
    return new Date(date).toLocaleDateString('en-US');
  };
  
  const formatDateTime = (date) => {
    try {
      return new Date(date).toLocaleString('en-US', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false
      });
    } catch { return String(date); }
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
  const { filterProductsByPermissions, isAdmin } = useAuth();
  const allowedProductIds = useMemo(() => {
    const list = (filterProductsByPermissions ? filterProductsByPermissions(products) : products) || [];
    return new Set(list.map(p => p.id));
  }, [products, filterProductsByPermissions]);

  // تطبيع أسماء المقاسات (يدعم: اكس، اكسين، 3 اكس، XL, XXL, 3XL ...)
  const normalizeSize = (s) => {
    if (!s) return '';
    let str = String(s).trim().toLowerCase();
    // أرقام عربية -> إنجليزية
    const digits = { '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9' };
    str = str.replace(/[٠-٩]/g, (d) => digits[d]);
    // أشكال شائعة
    str = str.replace(/اكسات/g, 'اكس');
    str = str.replace(/ثلاثة\s*اكس|ثلاث\s*اكس|3\s*اكس|٣\s*اكس/g, 'xxx');
    str = str.replace(/(2|٢)\s*اكس/g, 'xx');
    str = str.replace(/اكسين/g, 'xx');
    str = str.replace(/اكس/g, 'x');
    str = str.replace(/لارج|large|lrg/g, '');
    str = str.replace(/\s|-/g, '');
    // حالات قياسية
    if (/^(3xl|xxxl|xxx|3x)$/.test(str)) return 'xxxl';
    if (/^(2xl|xxl|xx|2x)$/.test(str)) return 'xxl';
    if (/^(xl|x)$/.test(str)) return 'xl';
    if (str.includes('xxx') || str.includes('3x')) return 'xxxl';
    if (str.includes('xx') || str.includes('2x')) return 'xxl';
    if (str.includes('x')) return 'xl';
    return str;
  };

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
        const ns = normalizeSize(size);
        return matches.find(v => lower(v.color || v.color_name) === lower(color) && normalizeSize(v.size || v.size_name) === ns)
          || matches.find(v => lower(v.color || v.color_name) === lower(color))
          || matches.find(v => normalizeSize(v.size || v.size_name) === ns)
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

  // أسباب المراجعة التفصيلية المستنتجة تلقائياً عند غياب أسباب صريحة من الـ AI
  const reviewReasons = useMemo(() => {
    const reasons = [];
    // تجهيز المتغيرات المتاحة مع أسماء المنتجات
    const variants = [];
    for (const p of (products || [])) {
      const list = Array.isArray(p.variants) ? p.variants : (p.product_variants || []);
      list.forEach(v => variants.push({
        ...v,
        product_id: p.id,
        product_name: p.name,
        color: v.color || v.color_name,
        size: v.size || v.size_name,
      }));
    }
    const lower = (v) => (v || '').toString().trim().toLowerCase();

    for (const it of items) {
      const name = (it?.product_name || it?.name || it?.product || '').toString().trim();
      const qty = Number(it?.quantity || 1);
      const sizeRaw = it?.size;
      const colorRaw = it?.color;
      const parts = [colorRaw ? `اللون ${colorRaw}` : null, sizeRaw ? `المقاس ${sizeRaw}` : null].filter(Boolean).join('، ');
      const avail = it?.availability;
      const miss = it?.missing_attributes || {};

      // 1) سمات ناقصة قادمة من الـ AI
      if (avail === 'missing_attributes' || miss?.need_color || miss?.need_size || (!colorRaw && variants.some(v => lower(v.product_name) === lower(name) && v.color)) || (!sizeRaw && variants.some(v => lower(v.product_name) === lower(name) && v.size))) {
        const needParts = [];
        if (!sizeRaw) needParts.push('بدون قياس');
        if (!colorRaw) needParts.push('بدون لون');
        if (needParts.length) reasons.push(`${name}: ${needParts.join(' و ')}`);
      }

      // 2) عدم السماح - لا نعرضه إن كان لدى المستخدم صلاحية فعلية للمنتج
      if (avail === 'not_permitted') {
        let pid = it?.product_id;
        if (!pid) {
          const m = variants.find(v => lower(v.product_name) === lower(name) || lower(v.product_name).includes(lower(name)));
          pid = m?.product_id;
        }
        const allowed = isAdmin || (pid && allowedProductIds.has(pid));
        if (!allowed) {
          reasons.push(`${name}: ليس ضمن صلاحياتك`);
        }
      }

      // 3) استنتاج المنتج/اللون/المقاس من قاعدة البيانات
      const matches = variants.filter(v => lower(v.product_name) === lower(name) || lower(v.product_name).includes(lower(name)));
      if (!matches.length) {
        // إذا لم نجد أي منتج مطابق
        reasons.push(`${name || 'منتج'}: غير موجود في النظام`);
        continue;
      }

      let filtered = matches;
      if (colorRaw) {
        const lc = lower(colorRaw);
        const byColor = filtered.filter(v => lower(v.color) === lc || lower(v.color_name) === lc);
        if (byColor.length === 0) {
          reasons.push(`${name}: اللون ${colorRaw} غير متوفر`);
        } else {
          filtered = byColor;
        }
      }
      if (sizeRaw) {
        const ls = normalizeSize(sizeRaw);
        const bySize = filtered.filter(v => normalizeSize(v.size || v.size_name) === ls);
        if (bySize.length === 0) {
          reasons.push(`${name}: المقاس ${sizeRaw} غير متوفر`);
        } else {
          filtered = bySize;
        }
      }

      const variant = filtered[0];
      const stock = (v) => (Number(v?.quantity ?? 0) - Number(v?.reserved_quantity ?? 0));
      if (variant) {
        const available = stock(variant);
        if (available <= 0) {
          // تحديد السبب الحقيقي بدقة
          const sameProduct = matches;
          const sameColor = colorRaw ? sameProduct.filter(v => lower(v.color) === lower(colorRaw)) : [];
          const sameSize = sizeRaw ? sameProduct.filter(v => normalizeSize(v.size || v.size_name) === normalizeSize(sizeRaw)) : [];

          const anyOtherSizeInSameColorHasStock = sizeRaw && sameColor.some(v => normalizeSize(v.size || v.size_name) !== normalizeSize(sizeRaw) && stock(v) > 0);
          const anyOtherColorInSameSizeHasStock = colorRaw && sameSize.some(v => lower(v.color) !== lower(colorRaw) && stock(v) > 0);

          if (anyOtherSizeInSameColorHasStock) {
            reasons.push(`${name}: المقاس نافذ (${sizeRaw})`);
          } else if (anyOtherColorInSameSizeHasStock) {
            reasons.push(`${name}: اللون غير متوفر (${colorRaw})`);
          } else {
            reasons.push(`${name}: نافذ من المخزون${parts ? ` (${parts})` : ''}`);
          }
        } else if (available < qty) {
          reasons.push(`${name}: الكمية غير كافية${parts ? ` (${parts})` : ''} (المتاح ${available})`);
        }
      } else if (matches.length > 0 && (colorRaw || sizeRaw)) {
        // وجدنا المنتج لكن لم نجد المطابقة الدقيقة
        if (colorRaw && sizeRaw) {
          reasons.push(`${name}: المطابقة للون ${colorRaw} والمقاس ${sizeRaw} غير متوفرة`);
        } else if (colorRaw && !sizeRaw) {
          reasons.push(`${name}: اللون ${colorRaw} غير متوفر`);
        } else if (!colorRaw && sizeRaw) {
          reasons.push(`${name}: المقاس ${sizeRaw} غير متوفر`);
        }
      }

      // 4) حالات صريحة واردة من عناصر الـ AI
      if (avail === 'not_found') reasons.push(`${name}: غير موجود في النظام`);
      if (avail === 'out') {
        reasons.push(`${name}: غير متاح حالياً${parts ? ` (${parts})` : ''}`);
      }
      if (avail === 'insufficient') {
        const av = it?.available_quantity ?? 0;
        reasons.push(`${name}: الكمية غير كافية${parts ? ` (${parts})` : ''} (المتاح ${av})`);
      }
    }
    return reasons;
  }, [items, products]);

  const needsReviewAny = useMemo(() => needsReview || reviewReasons.length > 0, [needsReview, reviewReasons.length]);

  const primaryReason = useMemo(() => {
    if (!needsReviewAny) return '';
    const unique = Array.from(new Set(reviewReasons));
    const priority = [
      /المقاس نافذ/i,
      /المقاس.*غير متوفر/i,
      /اللون.*غير متوفر/i,
      /الكمية غير كافية/i,
      /غير موجود في النظام/i,
      /ليس ضمن صلاحياتك/i,
      /نافذ من المخزون/i,
    ];
    for (const re of priority) {
      const hit = unique.find((r) => re.test(r));
      if (hit) return hit;
    }
    return unique[0] || 'هذا الطلب يحتاج مراجعة';
  }, [reviewReasons, needsReviewAny]);

  const gradientToUse = useMemo(() => {
    if (availability === 'out') return 'bg-gradient-to-br from-red-500 to-red-700';
    if (availability === 'available' && !needsReviewAny) return 'bg-gradient-to-br from-[hsl(var(--primary))] via-[hsl(var(--primary)/0.85)] to-[hsl(var(--primary)/0.7)]';
    if (needsReviewAny) return 'bg-gradient-to-br from-red-500 to-red-700';
    return getStatusColor(order.status).gradient;
  }, [availability, needsReviewAny, order.status]);

  const isProblematic = availability !== 'available' || needsReview;

  return (
    <Card id={`ai-order-${order.id}`} className={cn(
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
              <div className="text-xs opacity-90">{formatDateTime(order.created_at)}</div>
            </div>
          </div>
          {/* Alerts */}
          {needsReviewAny && (
            <div className="mb-2 p-2 rounded-md bg-white/15 border border-white/30 flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="text-xs">
                <div className="font-medium">تنبيه: هذا الطلب يحتاج مراجعة</div>
                {primaryReason && (
                  <div className="mt-1">{primaryReason}</div>
                )}
              </div>
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
                <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 bg-white text-slate-900 hover:bg-slate-100 border border-white/60 shadow-sm" disabled={needsReviewAny || availability !== 'available'}>
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
                      // تحديث فوري optimistic
                      window.dispatchEvent(new CustomEvent('aiOrderUpdated', { detail: { ...order, status: 'approved' } }));
                      toast({ title: 'جاري الموافقة...', description: 'تتم معالجة الطلب الذكي', variant: 'default' });
                      
                      try {
                        const res = await approveAiOrder?.(order.id);
                        if (res?.success) {
                          window.dispatchEvent(new CustomEvent('aiOrderDeleted', { detail: { id: order.id } }));
                          toast({ title: 'تمت الموافقة', description: 'تم تحويل الطلب الذكي إلى طلب عادي بنجاح', variant: 'success' });
                        } else {
                          // استرجاع البيانات في حالة الفشل
                          window.dispatchEvent(new CustomEvent('aiOrderUpdated', { detail: order }));
                          toast({ title: 'فشلت الموافقة', description: res?.error || 'حدث خطأ أثناء معالجة الطلب', variant: 'destructive' });
                        }
                      } catch (error) {
                        // استرجاع البيانات في حالة الخطأ
                        window.dispatchEvent(new CustomEvent('aiOrderUpdated', { detail: order }));
                        toast({ title: 'خطأ في الشبكة', description: 'تعذر الاتصال بالخادم', variant: 'destructive' });
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
                <Button variant="ghost" size="sm" className={cn("h-8 text-xs gap-1", isProblematic ? "bg-white text-slate-900 hover:bg-slate-100 border border-white/60 shadow-sm" : "bg-red-500 text-white hover:bg-red-600")}>
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
                      // تحديث فوري optimistic
                      window.dispatchEvent(new CustomEvent('aiOrderDeleted', { detail: { id: order.id } }));
                      toast({ title: 'جاري الحذف...', description: 'تم حذف الطلب الذكي', variant: 'default' });
                      
                      try {
                        const { data: rpcRes, error: rpcErr } = await supabase.rpc('delete_ai_order_safe', { p_order_id: order.id });
                        if (rpcErr || rpcRes?.success === false) {
                          // استرجاع البيانات في حالة الفشل
                          window.dispatchEvent(new CustomEvent('aiOrderCreated', { detail: order }));
                          toast({ title: 'فشل الحذف', description: rpcErr?.message || rpcRes?.error || 'تعذر حذف الطلب الذكي', variant: 'destructive' });
                        } else {
                          toast({ title: 'تم الحذف', description: 'تم حذف الطلب الذكي نهائياً', variant: 'success' });
                        }
                      } catch (error) {
                        // استرجاع البيانات في حالة الخطأ
                        window.dispatchEvent(new CustomEvent('aiOrderCreated', { detail: order }));
                        toast({ title: 'خطأ في الشبكة', description: 'تعذر الاتصال بالخادم', variant: 'destructive' });
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