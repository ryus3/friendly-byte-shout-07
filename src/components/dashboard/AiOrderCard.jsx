import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { User, Phone, MapPin, Package, Edit, Trash2, ShieldCheck, Loader2, MessageCircle, Bot } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { toast } from '@/components/ui/use-toast';

const AiOrderCard = ({ order, isSelected, onSelect, onEdit }) => {
    const { approveAiOrder, deleteOrders } = useInventory();
    const { user, hasPermission } = useAuth();
    const [isProcessing, setIsProcessing] = React.useState(false);

    const handleDelete = async () => {
        setIsProcessing(true);
        await deleteOrders([order.id], true);
        setIsProcessing(false);
        toast({ title: "تم حذف الطلب الذكي", variant: "success" });
    }

    const handleApproveClick = async () => {
        if (!hasPermission('approve_orders')) {
            toast({ 
                title: "ليس لديك صلاحية", 
                description: "ليس لديك صلاحية للموافقة على الطلبات", 
                variant: "destructive" 
            });
            return;
        }
        
        setIsProcessing(true);
        try {
            await approveAiOrder(order.id);
            toast({ 
                title: "نجاح", 
                description: "تمت الموافقة على الطلب بنجاح", 
                variant: "success" 
            });
        } catch (error) {
            console.error('Error approving order:', error);
            toast({ 
                title: "خطأ", 
                description: error.message || "فشل في الموافقة على الطلب", 
                variant: "destructive" 
            });
        } finally {
            setIsProcessing(false);
        }
    }

    // تحديد نوع المصدر وأيقونته
    const getSourceInfo = (source) => {
        switch (source) {
            case 'telegram':
                return { icon: MessageCircle, label: 'تليغرام', color: 'text-blue-500' };
            case 'whatsapp':
                return { icon: MessageCircle, label: 'واتساب', color: 'text-green-500' };
            default:
                return { icon: Bot, label: 'ذكي', color: 'text-purple-500' };
        }
    };

    const sourceInfo = getSourceInfo(order.source);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="border rounded-lg p-4 space-y-4 hover:shadow-md transition-shadow"
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
                <Badge variant="secondary">
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
                        <span>بواسطة: {order.created_by}</span>
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
                
                <Button 
                    size="sm"
                    onClick={handleApproveClick}
                    disabled={isProcessing}
                >
                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <ShieldCheck className="w-4 h-4 ml-2" />}
                    موافقة
                </Button>
            </div>
        </motion.div>
    );
};

export default AiOrderCard;