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
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      className="bg-card/80 p-4 rounded-lg border border-border flex items-start gap-4"
    >
      <Checkbox
        className="mt-1"
        checked={isSelected}
        onCheckedChange={() => onSelect(order.id)}
      />
      <div className="flex-1 space-y-3">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
          <div className="space-y-1">
            <p className="font-bold text-foreground flex items-center gap-2"><User className="w-4 h-4 text-primary" /> {order.customerInfo.name}</p>
            <p className="text-sm text-muted-foreground flex items-center gap-2"><Phone className="w-4 h-4 text-primary" /> {order.customerInfo.phone}</p>
            <p className="text-sm text-muted-foreground flex items-center gap-2"><MapPin className="w-4 h-4 text-primary" /> {order.customerInfo.address}</p>
          </div>
          <div className="flex gap-2 self-start sm:self-center">
            <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-red-500" onClick={handleDelete} disabled={isProcessing}>
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Trash2 className="w-4 h-4"/>}
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={onEdit} disabled={isProcessing}>
                <Edit className="w-4 h-4"/>
            </Button>
            <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={handleApproveClick} disabled={isProcessing}>
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin"/> : <ShieldCheck className="w-4 h-4 mr-2"/>}
                موافقة
            </Button>
          </div>
        </div>
        <div className="border-t pt-3 mt-2">
            <h4 className="font-semibold mb-2 flex items-center gap-2 text-sm">
                <Package className="w-4 h-4" /> المنتجات المطلوبة
            </h4>
            <div className="space-y-2">
                {order.items.map((item, index) => (
                    <div key={index} className="flex justify-between items-center text-sm p-2 bg-secondary/50 rounded-md">
                        <div>
                            <span className="font-medium">{item.productName}</span>
                            <div className="flex gap-2 mt-1">
                                <Badge variant="outline">{item.color}</Badge>
                                <Badge variant="outline">{item.size}</Badge>
                                <Badge variant="secondary">الكمية: {item.quantity}</Badge>
                            </div>
                        </div>
                        <span className="font-semibold text-primary">{item.total.toLocaleString()} د.ع</span>
                    </div>
                ))}
            </div>
             <div className="text-right mt-2 font-bold text-lg">
                الإجمالي: {order.total.toLocaleString()} د.ع
            </div>
        </div>
      </div>
    </motion.div>
  );
};

export default AiOrderCard;