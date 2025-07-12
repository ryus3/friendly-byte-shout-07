import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useInventory } from '@/contexts/InventoryContext';
import { Loader2, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

const EditAiOrderDialog = ({ order, open, onOpenChange }) => {
  const { updateOrder, approveAiOrder } = useInventory();
  const [customerInfo, setCustomerInfo] = useState({ name: '', phone: '', address: '', city: '' });
  const [items, setItems] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (order) {
      setCustomerInfo(order.customerInfo);
      setItems(order.items);
    }
  }, [order]);

  if (!order) return null;

  const handleCustomerInfoChange = (e) => {
    const { name, value } = e.target;
    setCustomerInfo(prev => ({ ...prev, [name]: value }));
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    const item = newItems[index];
    item[field] = value;
    if (field === 'quantity' || field === 'price') {
        item.total = item.quantity * item.price;
    }
    setItems(newItems);
  };
  
  const handleRemoveItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleApprove = async () => {
    setIsProcessing(true);
    const subtotal = items.reduce((acc, item) => acc + item.total, 0);
    const total = subtotal + (order.deliveryFee || 0) - (order.discount || 0);
    
    const updatedData = {
      customerInfo,
      items,
      subtotal,
      total,
    };
    
    // First, update the AI order details silently
    await updateOrder(order.id, updatedData, true);
    
    // Then, run the approval logic
    const result = await approveAiOrder(order.id);
    if (result.success) {
      toast({ title: "نجاح", description: "تمت الموافقة على الطلب وتحديثه." });
      onOpenChange(false);
    }
    setIsProcessing(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>تعديل والموافقة على طلب AI</DialogTitle>
          <DialogDescription>
            مراجعة وتعديل تفاصيل الطلب قبل إضافته إلى قائمة الطلبات النشطة.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto pr-2 space-y-6 py-4">
          <div className="space-y-4 p-4 border rounded-lg">
            <h3 className="font-semibold">معلومات الزبون</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">الاسم</Label>
                <Input id="name" name="name" value={customerInfo.name} onChange={handleCustomerInfoChange} />
              </div>
              <div>
                <Label htmlFor="phone">رقم الهاتف</Label>
                <Input id="phone" name="phone" value={customerInfo.phone} onChange={handleCustomerInfoChange} />
              </div>
              <div>
                <Label htmlFor="address">العنوان</Label>
                <Input id="address" name="address" value={customerInfo.address} onChange={handleCustomerInfoChange} />
              </div>
              <div>
                <Label htmlFor="city">المحافظة</Label>
                <Input id="city" name="city" value={customerInfo.city} onChange={handleCustomerInfoChange} />
              </div>
            </div>
          </div>
          <div className="space-y-4 p-4 border rounded-lg">
            <h3 className="font-semibold">المنتجات</h3>
            <div className="space-y-2">
              {items.map((item, index) => (
                <div key={index} className="flex items-end gap-2 p-2 border rounded-md">
                  <div className="flex-1">
                    <p className="font-medium">{item.productName} ({item.color}, {item.size})</p>
                  </div>
                  <div className="w-20">
                    <Label className="text-xs">الكمية</Label>
                    <Input type="number" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 0)} />
                  </div>
                  <div className="w-24">
                    <Label className="text-xs">السعر</Label>
                    <Input type="number" value={item.price} onChange={(e) => handleItemChange(index, 'price', parseFloat(e.target.value) || 0)} />
                  </div>
                  <Button variant="destructive" size="icon" className="h-10 w-10" onClick={() => handleRemoveItem(index)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={handleApprove} disabled={isProcessing} className="bg-green-600 hover:bg-green-700">
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <ShieldCheck className="w-4 h-4 ml-2" />}
            موافقة وإرسال
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditAiOrderDialog;