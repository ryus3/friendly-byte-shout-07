import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { X, Bot, FileDown, Trash2, ShieldCheck, Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/components/ui/use-toast';
import AiOrderCard from './AiOrderCard';
import EditAiOrderDialog from './EditAiOrderDialog';
import { useNotifications } from '@/contexts/NotificationsContext';

const AiOrdersManager = ({ onClose }) => {
  const { user } = useAuth();
  const { aiOrders, approveAiOrder, deleteOrders } = useInventory();
  const { deleteNotificationByTypeAndData } = useNotifications();
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);

  const userAiOrders = useMemo(() => {
    return aiOrders.filter(o => o.created_by === user.id);
  }, [aiOrders, user.id]);

  const handleSelect = (orderId) => {
    setSelectedOrders(prev =>
      prev.includes(orderId)
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedOrders(userAiOrders.map(order => order.id));
    } else {
      setSelectedOrders([]);
    }
  };

  const handleApproveSelected = async () => {
    setIsProcessing(true);
    for (const orderId of selectedOrders) {
        await approveAiOrder(orderId);
        await deleteNotificationByTypeAndData('new_ai_order', { id: orderId });
    }
    toast({ title: "نجاح", description: `تمت الموافقة على ${selectedOrders.length} طلبات.` });
    setSelectedOrders([]);
    setIsProcessing(false);
  };

  const handleDeleteSelected = async () => {
    setIsProcessing(true);
    await deleteOrders(selectedOrders, true);
    setSelectedOrders([]);
    setIsProcessing(false);
  };
  
  const handleExport = () => {
    toast({
      title: "🚧 هذه الميزة غير مطبقة بعد",
      description: "لكن لا تقلق! يمكنك طلبها في الرسالة التالية! 🚀"
    });
  }

  return (
    <>
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 50, opacity: 0 }}
        className="w-full max-w-5xl"
        onClick={e => e.stopPropagation()}
      >
        <Card className="max-h-[90vh] flex flex-col border-2 border-primary/20 shadow-2xl shadow-primary/10">
          <CardHeader className="border-b border-border">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-2xl gradient-text flex items-center gap-2"><Bot /> طلبات الذكاء الاصطناعي</CardTitle>
                <CardDescription>مراجعة والموافقة على الطلبات المولدة بواسطتك.</CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-6 h-6" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6 flex-1 flex flex-col gap-4">
             <div className="flex flex-col sm:flex-row gap-2 items-center p-2 rounded-lg bg-secondary">
                 <div className="flex items-center gap-3 flex-1">
                    <Checkbox
                        id="selectAllAi"
                        checked={selectedOrders.length > 0 && selectedOrders.length === userAiOrders.length}
                        onCheckedChange={handleSelectAll}
                        disabled={userAiOrders.length === 0}
                    />
                    <label htmlFor="selectAllAi" className="text-sm font-medium">
                        تحديد الكل ({selectedOrders.length} / {userAiOrders.length})
                    </label>
                 </div>
                 <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleExport} disabled={selectedOrders.length === 0 || isProcessing}>
                        <FileDown className="w-4 h-4 ml-2" /> تصدير
                    </Button>
                    <Button variant="destructive" size="sm" onClick={handleDeleteSelected} disabled={selectedOrders.length === 0 || isProcessing}>
                        {isProcessing ? <Loader2 className="w-4 h-4 animate-spin ml-2"/> : <Trash2 className="w-4 h-4 ml-2" />} حذف المحدد
                    </Button>
                     <Button size="sm" onClick={handleApproveSelected} className="bg-green-600 hover:bg-green-700" disabled={selectedOrders.length === 0 || isProcessing}>
                        {isProcessing ? <Loader2 className="w-4 h-4 animate-spin ml-2"/> : <ShieldCheck className="w-4 h-4 ml-2" />} موافقة على المحدد
                    </Button>
                 </div>
             </div>
            <div className="flex-1 overflow-y-auto pr-2 -mr-2">
                <AnimatePresence>
                {userAiOrders.length > 0 ? (
                    <div className="space-y-4">
                    {userAiOrders.map(order => (
                        <AiOrderCard
                        key={order.id}
                        order={order}
                        isSelected={selectedOrders.includes(order.id)}
                        onSelect={handleSelect}
                        onEdit={() => setEditingOrder(order)}
                        />
                    ))}
                    </div>
                ) : (
                    <div className="text-center py-16">
                    <Bot className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                    <p className="font-bold text-xl">لا توجد طلبات من الذكاء الاصطناعي</p>
                    <p className="text-muted-foreground">سيتم عرض الطلبات المولدة آلياً هنا.</p>
                    </div>
                )}
                </AnimatePresence>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
    <AnimatePresence>
        {editingOrder && (
            <EditAiOrderDialog 
                order={editingOrder}
                open={!!editingOrder}
                onOpenChange={() => setEditingOrder(null)}
            />
        )}
    </AnimatePresence>
    </>
  );
};

export default AiOrdersManager;