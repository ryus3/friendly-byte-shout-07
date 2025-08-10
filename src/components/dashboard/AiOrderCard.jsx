import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { User, Phone, MapPin, Package, Edit, Trash2, ShieldCheck, Loader2, MessageCircle, Bot, AlertTriangle, Sparkles, Zap, Clock, CreditCard, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';

const AiOrderCard = ({ order, isSelected, onSelect, onEdit }) => {
    const { approveAiOrder, deleteOrders } = useInventory();
    const { user, hasPermission } = useAuth();
    const [isProcessing, setIsProcessing] = React.useState(false);
    const [creatorName, setCreatorName] = React.useState(null);

    // عرض اسم المستخدم بدلاً من كود الموظف
    React.useEffect(() => {
        let isMounted = true;
        const fetchName = async () => {
            if (!order?.created_by) return;
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('full_name, username')
                    .eq('employee_code', order.created_by)
                    .maybeSingle();
                if (!error && isMounted) {
                    setCreatorName(data?.full_name || data?.username || order.created_by);
                }
            } catch (err) {
                console.error('Error fetching creator name:', err);
            }
        };
        fetchName();
        return () => { isMounted = false; };
    }, [order?.created_by]);

    const handleDelete = async () => {
        setIsProcessing(true);
        await deleteOrders([order.id], true);
        setIsProcessing(false);
        toast({ title: "تم حذف الطلب الذكي", variant: "success" });
    }

    const handleApproveClick = async () => {
        setIsProcessing(true);
        try {
            const res = await approveAiOrder(order.id);
            if (res?.success) {
                toast({ title: "تم التحويل", description: "تم إنشاء طلب حقيقي وحذف الذكي", variant: "success" });
            } else {
                toast({ title: "لم يكتمل", description: res?.error || "فشل التحويل", variant: "destructive" });
            }
        } catch (error) {
            console.error('Error approving order:', error);
            toast({ title: "خطأ", description: error.message || "فشل في تحويل الطلب", variant: "destructive" });
        } finally {
            setIsProcessing(false);
        }
    }

    // تحديد نوع المصدر وأيقونته
    const getSourceInfo = (source) => {
        switch (source) {
            case 'telegram':
                return { icon: MessageCircle, label: 'تليغرام', color: 'from-blue-500 to-cyan-500', bgColor: 'bg-blue-500/10', textColor: 'text-blue-600' };
            case 'whatsapp':
                return { icon: MessageCircle, label: 'واتساب', color: 'from-green-500 to-emerald-500', bgColor: 'bg-green-500/10', textColor: 'text-green-600' };
            default:
                return { icon: Bot, label: 'ذكي', color: 'from-purple-500 to-indigo-500', bgColor: 'bg-purple-500/10', textColor: 'text-purple-600' };
        }
    };

    const sourceInfo = getSourceInfo(order.source);

    // فحص توفر بديل احتياطي للطلبات القديمة التي لا تحتوي حقول availability
    const { products } = useInventory();
    const isItemAvailable = (it) => {
        if (it?.available === false) return false;
        if (it?.availability) return it.availability === 'ok';
        // احتياطي: حساب التوفر من بيانات المخزون عند توفر variant_id
        if (it?.variant_id) {
            const variant = products?.flatMap(p => p.variants || []).find(v => v.id === it.variant_id);
            if (variant) {
                const qty = Number(variant.quantity || 0);
                const reserved = Number(variant.reserved_quantity || 0);
                const availableQty = Math.max(0, qty - reserved);
                const requested = Number(it.quantity || 1);
                return availableQty >= requested;
            }
        }
        return true; // إذا لم نستطع التحقق نعتبره متاح لتجنب الإيجابيات الكاذبة
    };

    const hasUnavailable = Array.isArray(order.items) && order.items.some(it => !isItemAvailable(it));
    const availableItems = Array.isArray(order.items) ? order.items.filter(it => isItemAvailable(it)) : [];
    const unavailableItems = Array.isArray(order.items) ? order.items.filter(it => !isItemAvailable(it)) : [];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -4, scale: 1.02 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-card via-card/95 to-card/90 border-2 border-primary/20 hover:border-primary/40 shadow-xl hover:shadow-2xl hover:shadow-primary/25 transition-all duration-500"
        >
            {/* خلفية متدرجة جميلة */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-all duration-500" />
            <div className={`absolute top-0 left-0 w-full h-2 bg-gradient-to-r ${sourceInfo.color}`} />
            
            {/* نقاط مضيئة */}
            <div className="absolute top-4 right-4 w-2 h-2 bg-blue-400 rounded-full opacity-60 animate-pulse" />
            <div className="absolute bottom-4 left-4 w-1.5 h-1.5 bg-purple-400 rounded-full opacity-40 animate-ping" />

            <div className="relative p-6 space-y-4">
                
                {/* Header مع نوع المصدر */}
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                        <Checkbox 
                            checked={isSelected}
                            onCheckedChange={onSelect}
                            className="scale-125 border-2"
                        />
                        <div className="flex items-center gap-3">
                            <div className={`p-3 rounded-2xl ${sourceInfo.bgColor} border border-primary/20 shadow-lg backdrop-blur-sm`}>
                                <sourceInfo.icon className={`w-6 h-6 ${sourceInfo.textColor}`} />
                            </div>
                            <div>
                                <h4 className="text-xl font-bold text-foreground">{order.customer_name}</h4>
                                <div className="flex items-center gap-3 mt-1">
                                    <Badge className={`bg-gradient-to-r ${sourceInfo.color} text-white border-0 shadow-lg font-bold`}>
                                        {sourceInfo.label}
                                    </Badge>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Package className="w-4 h-4" />
                                        <span>{order.items?.length || 0} منتجات</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    {/* مبلغ الطلب */}
                    <div className="text-left">
                        <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 backdrop-blur-sm border border-green-300/30 rounded-2xl px-4 py-2 shadow-lg">
                            <div className="flex items-center gap-2">
                                <CreditCard className="w-5 h-5 text-green-600" />
                                <span className="text-2xl font-bold text-green-700">
                                    {order.total_amount?.toLocaleString() || 0}
                                </span>
                                <span className="text-sm text-green-600">د.ع</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* تنبيه بارز عند عدم التوفر */}
                {hasUnavailable && (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-gradient-to-r from-red-500/20 via-pink-500/20 to-orange-500/20 backdrop-blur-sm border-2 border-red-400/50 rounded-2xl p-4 shadow-2xl"
                    >
                        <div className="flex items-start gap-3">
                            <div className="relative">
                                <div className="absolute inset-0 bg-red-500 rounded-full blur-lg opacity-60 animate-pulse" />
                                <AlertTriangle className="relative w-6 h-6 text-red-600" />
                            </div>
                            <div className="flex-1">
                                <h5 className="text-lg font-bold text-red-700 mb-2 flex items-center gap-2">
                                    ⚠️ منتجات غير متاحة
                                    <Badge className="bg-red-500 text-white animate-bounce">
                                        {unavailableItems.length}
                                    </Badge>
                                </h5>
                                <p className="text-red-600 text-sm leading-relaxed">
                                    بعض المنتجات غير متاحة حالياً أو محجوزة. يرجى اختيار بديل قبل الموافقة.
                                    <br />
                                    <span className="font-semibold">لا نبيع بالسالب أو المنتجات النافذة.</span>
                                </p>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* معلومات العميل */}
                <div className="bg-gradient-to-r from-muted/30 to-muted/10 backdrop-blur-sm rounded-2xl p-4 border border-muted/30">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        
                        {/* معلومات الاتصال */}
                        <div className="space-y-3">
                            {order.customer_phone && (
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-500/10 rounded-lg">
                                        <Phone className="w-4 h-4 text-blue-600" />
                                    </div>
                                    <span className="text-sm font-medium">{order.customer_phone}</span>
                                </div>
                            )}
                            
                            {order.customer_address && (
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-green-500/10 rounded-lg">
                                        <MapPin className="w-4 h-4 text-green-600" />
                                    </div>
                                    <span className="text-sm text-muted-foreground line-clamp-2">{order.customer_address}</span>
                                </div>
                            )}
                        </div>

                        {/* معلومات الطلب */}
                        <div className="space-y-3">
                            {order.created_by && (
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-purple-500/10 rounded-lg">
                                        <User className="w-4 h-4 text-purple-600" />
                                    </div>
                                    <span className="text-sm font-medium">{creatorName || order.created_by}</span>
                                </div>
                            )}
                            
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-orange-500/10 rounded-lg">
                                    <Clock className="w-4 h-4 text-orange-600" />
                                </div>
                                <span className="text-sm text-muted-foreground">
                                    {new Date(order.created_at).toLocaleString('ar')}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* قائمة المنتجات */}
                {order.items && order.items.length > 0 && (
                    <div className="bg-gradient-to-br from-primary/5 to-blue-500/5 rounded-2xl p-4 border border-primary/20">
                        <h6 className="font-bold text-foreground mb-3 flex items-center gap-2">
                            <Package className="w-5 h-5 text-primary" />
                            المنتجات ({order.items.length})
                        </h6>
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                            {order.items.slice(0, 5).map((item, index) => {
                                const isAvailable = isItemAvailable(item);
                                return (
                                    <div key={index} className={`flex items-center gap-3 p-2 rounded-lg transition-all ${
                                        isAvailable 
                                            ? 'bg-green-500/10 border border-green-300/30' 
                                            : 'bg-red-500/10 border border-red-300/30'
                                    }`}>
                                        {isAvailable ? (
                                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                                        ) : (
                                            <AlertTriangle className="w-4 h-4 text-red-600" />
                                        )}
                                        <span className={`text-sm font-medium ${isAvailable ? 'text-green-700' : 'text-red-700'}`}>
                                            {item.name}
                                            {item.color && ` (${item.color})`}
                                            {item.size && ` ${item.size}`}
                                            {item.quantity && ` × ${item.quantity}`}
                                        </span>
                                    </div>
                                );
                            })}
                            {order.items.length > 5 && (
                                <div className="text-xs text-muted-foreground text-center pt-2 border-t border-muted/30">
                                    ... و {order.items.length - 5} منتجات أخرى
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* النص الأصلي */}
                {order.order_data?.original_text && (
                    <div className="bg-gradient-to-br from-muted/20 to-muted/10 rounded-2xl p-4 border border-muted/30">
                        <h6 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                            <MessageCircle className="w-4 h-4 text-primary" />
                            النص الأصلي
                        </h6>
                        <div className="text-sm text-muted-foreground bg-background/50 rounded-lg p-3 max-h-24 overflow-y-auto">
                            {order.order_data.original_text}
                        </div>
                    </div>
                )}

                {/* أزرار التحكم */}
                <div className="flex items-center justify-between pt-4 border-t border-primary/10">
                    <div className="flex items-center gap-3">
                        <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={onEdit}
                            disabled={isProcessing}
                            className="rounded-xl bg-blue-500/10 border-blue-300/50 text-blue-600 hover:bg-blue-500/20 hover:border-blue-400 shadow-lg transform hover:scale-105 transition-all duration-300"
                        >
                            <Edit className="w-4 h-4 ml-2" />
                            تعديل
                        </Button>
                        
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button 
                                    size="sm" 
                                    variant="destructive" 
                                    disabled={isProcessing}
                                    className="rounded-xl bg-red-500/10 border-red-300/50 text-red-600 hover:bg-red-500/20 hover:border-red-400 shadow-lg transform hover:scale-105 transition-all duration-300"
                                >
                                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Trash2 className="w-4 h-4 ml-2" />}
                                    حذف
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-gradient-to-br from-background via-background to-red-50/20 border-2 border-red-200/50 rounded-2xl shadow-2xl">
                                <AlertDialogHeader>
                                    <AlertDialogTitle className="text-2xl font-bold text-red-700 flex items-center gap-2">
                                        <Trash2 className="w-6 h-6" />
                                        تأكيد حذف الطلب
                                    </AlertDialogTitle>
                                    <AlertDialogDescription className="text-lg text-red-600 leading-relaxed">
                                        هل أنت متأكد من حذف طلب <span className="font-bold">{order.customer_name}</span>؟
                                        <br />
                                        <span className="text-sm text-muted-foreground mt-2 block">هذا الإجراء غير قابل للتراجع</span>
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter className="gap-3">
                                    <AlertDialogCancel className="rounded-xl">إلغاء</AlertDialogCancel>
                                    <AlertDialogAction 
                                        onClick={handleDelete}
                                        className="bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 rounded-xl"
                                    >
                                        تأكيد الحذف
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                    
                    {/* زر الموافقة */}
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button 
                                size="sm" 
                                disabled={isProcessing || hasUnavailable}
                                className={`rounded-xl shadow-lg transform hover:scale-105 transition-all duration-300 ${
                                    hasUnavailable 
                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                                        : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white'
                                }`}
                            >
                                {isProcessing ? (
                                    <Loader2 className="w-4 h-4 animate-spin ml-2" />
                                ) : hasUnavailable ? (
                                    <AlertTriangle className="w-4 h-4 ml-2" />
                                ) : (
                                    <ShieldCheck className="w-4 h-4 ml-2" />
                                )}
                                {hasUnavailable ? 'حلّ التعارض أولاً' : 'موافقة وتحويل'}
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-gradient-to-br from-background via-background to-green-50/20 border-2 border-green-200/50 rounded-2xl shadow-2xl">
                            <AlertDialogHeader>
                                <AlertDialogTitle className="text-2xl font-bold text-green-700 flex items-center gap-2">
                                    <ShieldCheck className="w-6 h-6" />
                                    تأكيد تحويل الطلب
                                </AlertDialogTitle>
                                <AlertDialogDescription className="text-lg text-green-600 leading-relaxed">
                                    سيتم تحويل هذا الطلب الذكي إلى طلب حقيقي مع التحقق من المخزون وحجزه تلقائياً.
                                    <br />
                                    <span className="text-sm text-muted-foreground mt-2 block">
                                        سيتم إنشاء رقم طلب ورقم تتبع QR تلقائياً
                                    </span>
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="gap-3">
                                <AlertDialogCancel className="rounded-xl">إلغاء</AlertDialogCancel>
                                <AlertDialogAction 
                                    onClick={handleApproveClick}
                                    className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-xl"
                                >
                                    <Sparkles className="w-4 h-4 ml-2" />
                                    تأكيد التحويل
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </div>
        </motion.div>
    );
};

export default AiOrderCard;