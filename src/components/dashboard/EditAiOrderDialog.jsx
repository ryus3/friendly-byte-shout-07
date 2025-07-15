import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { X, Save, User, Phone, MapPin, Package, Plus, Trash2 } from 'lucide-react';
import { useInventory } from '@/contexts/InventoryContext';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';

const EditAiOrderDialog = ({ order, open, onOpenChange }) => {
  const { refetchProducts, setAiOrders } = useInventory();
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_phone: '',
    customer_address: '',
    items: [],
    total_amount: 0
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (order) {
      setFormData({
        customer_name: order.customer_name || '',
        customer_phone: order.customer_phone || '',
        customer_address: order.customer_address || '',
        items: order.items || [],
        total_amount: order.total_amount || 0
      });
    }
  }, [order]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleItemChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { name: '', quantity: 1, price: 0 }]
    }));
  };

  const removeItem = (index) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const calculateTotal = () => {
    const total = formData.items.reduce((sum, item) => 
      sum + (item.quantity || 0) * (item.price || 0), 0
    );
    setFormData(prev => ({ ...prev, total_amount: total }));
  };

  useEffect(() => {
    calculateTotal();
  }, [formData.items]);

  const handleSave = async () => {
    if (!formData.customer_name.trim()) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال اسم العميل",
        variant: "destructive"
      });
      return;
    }

    if (formData.items.length === 0) {
      toast({
        title: "خطأ",
        description: "يرجى إضافة منتجات للطلب",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('ai_orders')
        .update({
          customer_name: formData.customer_name,
          customer_phone: formData.customer_phone,
          customer_address: formData.customer_address,
          items: formData.items,
          total_amount: formData.total_amount,
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id)
        .select()
        .single();

      if (error) throw error;

      // تحديث حالة الطلبات المحلية
      setAiOrders(prev => prev.map(o => 
        o.id === order.id ? { ...o, ...data } : o
      ));

      toast({
        title: "نجح",
        description: "تم تحديث الطلب بنجاح"
      });

      onOpenChange(false);
    } catch (error) {
      console.error('Error updating AI order:', error);
      toast({
        title: "خطأ",
        description: "فشل في تحديث الطلب",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            تعديل الطلب الذكي
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* معلومات العميل */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="customer_name" className="flex items-center gap-2">
                <User className="w-4 h-4" />
                اسم العميل
              </Label>
              <Input
                id="customer_name"
                value={formData.customer_name}
                onChange={(e) => handleInputChange('customer_name', e.target.value)}
                placeholder="أدخل اسم العميل"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer_phone" className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                رقم الهاتف
              </Label>
              <Input
                id="customer_phone"
                value={formData.customer_phone}
                onChange={(e) => handleInputChange('customer_phone', e.target.value)}
                placeholder="أدخل رقم الهاتف"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer_address" className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              العنوان
            </Label>
            <Textarea
              id="customer_address"
              value={formData.customer_address}
              onChange={(e) => handleInputChange('customer_address', e.target.value)}
              placeholder="أدخل عنوان العميل"
              rows={3}
            />
          </div>

          {/* المنتجات */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">المنتجات</h3>
              <Button onClick={addItem} size="sm" variant="outline">
                <Plus className="w-4 h-4 ml-2" />
                إضافة منتج
              </Button>
            </div>

            <div className="space-y-3">
              {formData.items.map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border rounded-lg"
                >
                  <div className="md:col-span-2">
                    <Label>اسم المنتج</Label>
                    <Input
                      value={item.name || ''}
                      onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                      placeholder="اسم المنتج"
                    />
                  </div>
                  <div>
                    <Label>الكمية</Label>
                    <Input
                      type="number"
                      value={item.quantity || 1}
                      onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 1)}
                      min="1"
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Label>السعر</Label>
                      <Input
                        type="number"
                        value={item.price || 0}
                        onChange={(e) => handleItemChange(index, 'price', parseFloat(e.target.value) || 0)}
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => removeItem(index)}
                      className="mb-0.5"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* المجموع */}
          <div className="flex justify-end">
            <div className="text-lg font-semibold">
              المجموع: {formData.total_amount.toLocaleString()} د.ع
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? 'جاري الحفظ...' : 'حفظ التغييرات'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditAiOrderDialog;