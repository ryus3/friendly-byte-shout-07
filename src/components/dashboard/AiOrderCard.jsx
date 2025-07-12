import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { User, Phone, MapPin, Package, Edit, Trash2, ShieldCheck, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/use-toast';

const AiOrderCard = ({ order, isSelected, onSelect, onEdit }) => {
    const { approveAiOrder, deleteOrders } = useInventory();
    const { user } = useAuth();
    const [isProcessing, setIsProcessing] = React.useState(false);

    const handleDelete = async () => {
        setIsProcessing(true);
        await deleteOrders([order.id], true);
        setIsProcessing(false);
    }

    const handleApproveClick = async () => {
        if (order.createdBy !== user.id) {
            toast({ title: "غير مصرح", description: "يمكن فقط للموظف الذي أنشأ الطلب الموافقة عليه.", variant: 'destructive' });
            return;
        }
        setIsProcessing(true);
        await approveAiOrder(order.id);
        setIsProcessing(false);
    }

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
                    <div className="space-y-1">
                        <h4 className="font-medium">طلب ذكي #{order.id?.slice(-6)}</h4>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Package className="w-4 h-4" />
                            <span>{order.items?.length || 0} منتجات</span>
                        </div>
                    </div>
                </div>
                <Badge variant="secondary">
                    ذكي
                </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span>{order.customerInfo?.name || 'غير محدد'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <span>{order.customerInfo?.phone || 'غير محدد'}</span>
                    </div>
                </div>
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <span>{order.customerInfo?.address || 'غير محدد'}</span>
                    </div>
                    <div className="text-lg font-medium text-primary">
                        {order.total?.toLocaleString() || 0} د.ع.
                    </div>
                </div>
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
                    disabled={isProcessing || order.createdBy !== user.id}
                >
                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <ShieldCheck className="w-4 h-4 ml-2" />}
                    موافقة
                </Button>
            </div>
        </motion.div>
    );
};

export default AiOrderCard;