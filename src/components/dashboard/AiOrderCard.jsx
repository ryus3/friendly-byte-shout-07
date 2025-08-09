import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { User, Phone, MapPin, Package, Edit, Trash2, ShieldCheck, Loader2, MessageCircle, Bot } from 'lucide-react';
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
                return { icon: MessageCircle, label: 'تليغرام', color: 'text-primary' };
            case 'whatsapp':
                return { icon: MessageCircle, label: 'واتساب', color: 'text-primary' };
            default:
                return { icon: Bot, label: 'ذكي', color: 'text-primary' };
        }
    };

    const sourceInfo = getSourceInfo(order.source);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="group rounded-2xl p-4 md:p-5 space-y-4 bg-card/70 backdrop-blur ring-1 ring-border/50 hover:ring-primary/40 hover:shadow-xl transition-all hover-scale"
        >
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                    <Checkbox 
                        checked={isSelected}
                        onCheckedChange={onSelect}
                    />
                    <div className="flex items-center gap-2">
                        <sourceInfo.icon className={`w-5 h-5 ${sourceInfo.color}`} />
                        <div className="space-y-1">
                            <h4 className="font-medium">{order.customer_name}</h4>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Package className="w-4 h-4" />
                                <span>{order.items?.length || 0} منتجات</span>
                                <Badge variant="outline" size="sm" className="ml-1">
                                    {sourceInfo.label}
                                </Badge>
                            </div>
                        </div>
                    </div>
                </div>
                <Badge variant="secondary" className="bg-primary/10 text-primary ring-1 ring-primary/20 shadow-sm">
                    {order.total_amount?.toLocaleString() || 0} د.ع
                </Badge>
            </div>

            <div className="space-y-2 text-sm">
                {order.customer_phone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="w-4 h-4" />
                        {order.customer_phone}
                    </div>
                )}
                
                {order.customer_address && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="w-4 h-4" />
                        {order.customer_address}
                    </div>
                )}

                {order.created_by && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <User className="w-4 h-4" />
                        <span>بواسطة: {creatorName || order.created_by}</span>
                    </div>
                )}

                {order.items && order.items.length > 0 && (
                    <div>
                        <span className="font-medium">العناصر:</span>
                        <div className="mt-1 space-y-1">
                            {order.items.slice(0, 3).map((item, index) => (
                                <div key={index} className="text-xs text-muted-foreground pl-4">
                                    • {item.name} {item.quantity && `× ${item.quantity}`}
                                </div>
                            ))}
                            {order.items.length > 3 && (
                                <div className="text-xs text-muted-foreground pl-4">
                                    ... و {order.items.length - 3} عناصر أخرى
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {order.order_data?.original_text && (
                    <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
                        <span className="font-medium">النص الأصلي:</span>
                        <div className="mt-1 text-muted-foreground max-h-20 overflow-y-auto">
                            {order.order_data.original_text}
                        </div>
                    </div>
                )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t">
                <div className="flex items-center gap-2">
                    <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={onEdit}
                        disabled={isProcessing}
                    >
                        <Edit className="w-4 h-4 ml-2" />
                        تعديل
                    </Button>
                    <Button 
                        size="sm" 
                        variant="destructive" 
                        onClick={handleDelete}
                        disabled={isProcessing}
                    >
                        {isProcessing ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Trash2 className="w-4 h-4 ml-2" />}
                        حذف
                    </Button>
                </div>
                
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button size="sm" disabled={isProcessing}>
                            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <ShieldCheck className="w-4 h-4 ml-2" />}
                            موافقة
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>تأكيد تحويل الطلب</AlertDialogTitle>
                            <AlertDialogDescription>
                                سيتم تحويل هذا الطلب الذكي إلى طلب حقيقي مع التحقق من المخزون وحجزه.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>إلغاء</AlertDialogCancel>
                            <AlertDialogAction onClick={handleApproveClick}>تأكيد التحويل</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </motion.div>
    );
};

export default AiOrderCard;