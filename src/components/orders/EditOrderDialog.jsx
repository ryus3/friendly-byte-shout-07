
import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { toast } from '@/components/ui/use-toast';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';

const EditOrderDialog = ({ order, open, onOpenChange, onOrderUpdated }) => {
  const [formData, setFormData] = useState({});
  const [orderItems, setOrderItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const { cities, regions, packageSizes, fetchRegions, editAlWaseetOrder } = useAlWaseet();

  const initializeForm = useCallback(() => {
    if (order) {
      // التحقق من إمكانية التعديل - فقط الطلبات قيد التجهيز
      const deliveryData = order.delivery_partner_data || {};
      const canEditOrder = !order.delivery_status || order.delivery_status === 'قيد التجهيز' || order.delivery_status === 'في الانتظار';
      setCanEdit(canEditOrder);
      
      const customerInfo = order.customerinfo || {};
      const initialData = {
        qr_id: order.trackingnumber || order.tracking_number,
        client_name: deliveryData.client_name || customerInfo.name || order.customer_name,
        client_mobile: deliveryData.client_mobile || customerInfo.phone || order.customer_phone,
        client_mobile2: deliveryData.client_mobile2 || '',
        city_id: deliveryData.city_id || '',
        region_id: deliveryData.region_id || '',
        location: deliveryData.location || customerInfo.address || order.customer_address,
        type_name: deliveryData.type_name || (order.items || []).map(i => `${i.productName || i.product_name} (${i.quantity})`).join(' + '),
        items_number: deliveryData.items_number || (order.items || []).reduce((acc, i) => acc + i.quantity, 0),
        price: deliveryData.price || order.total || order.total_amount,
        package_size: deliveryData.package_size || '',
        merchant_notes: deliveryData.merchant_notes || order.notes || '',
        replacement: deliveryData.replacement || 0,
      };
      setFormData(initialData);
      setOrderItems(order.items || []);
      
      if (initialData.city_id && fetchRegions) {
        fetchRegions(initialData.city_id);
      }
    }
  }, [order, fetchRegions]);

  useEffect(() => {
    if (open) {
      initializeForm();
    }
  }, [open, initializeForm]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    if (name === 'city_id' && fetchRegions) {
      fetchRegions(value);
      setFormData(prev => ({ ...prev, region_id: '' }));
    }
  };

  const handleItemChange = (index, field, value) => {
    const updatedItems = [...orderItems];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setOrderItems(updatedItems);
    
    // إعادة حساب إجمالي السعر والكمية
    const totalQuantity = updatedItems.reduce((acc, item) => acc + (parseInt(item.quantity) || 0), 0);
    const itemsDescription = updatedItems.map(item => `${item.productName || item.product_name} (${item.quantity})`).join(' + ');
    
    setFormData(prev => ({
      ...prev,
      items_number: totalQuantity,
      type_name: itemsDescription
    }));
  };

  const addNewItem = () => {
    setOrderItems([...orderItems, { productName: '', quantity: 1, price: 0 }]);
  };

  const removeItem = (index) => {
    const updatedItems = orderItems.filter((_, i) => i !== index);
    setOrderItems(updatedItems);
    
    const totalQuantity = updatedItems.reduce((acc, item) => acc + (parseInt(item.quantity) || 0), 0);
    const itemsDescription = updatedItems.map(item => `${item.productName || item.product_name} (${item.quantity})`).join(' + ');
    
    setFormData(prev => ({
      ...prev,
      items_number: totalQuantity,
      type_name: itemsDescription
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!canEdit) {
      toast({
        title: "غير مسموح",
        description: "لا يمكن تعديل الطلب إلا في حالة 'قيد التجهيز'.",
        variant: "destructive",
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      // تحديث بيانات الطلب في قاعدة البيانات أولاً
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          items: orderItems,
          total: formData.price,
          delivery_partner_data: formData,
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);

      if (updateError) {
        throw new Error(`فشل في تحديث قاعدة البيانات: ${updateError.message}`);
      }

      // إرسال التحديث لشركة التوصيل
      const result = await editAlWaseetOrder(formData);

      if (result.success) {
        toast({
          title: "تم بنجاح",
          description: "تم تعديل الطلب وإرساله لشركة التوصيل بنجاح.",
          variant: "success",
        });
        onOrderUpdated(order.id, { 
          delivery_partner_data: formData, 
          items: orderItems,
          total: formData.price,
          ...formData 
        });
        onOpenChange(false);
      } else {
        throw new Error(result.message || "فشل في إرسال التحديث لشركة التوصيل.");
      }
    } catch (error) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!order) return null;

  const safeCities = Array.isArray(cities) ? cities : [];
  const safeRegions = Array.isArray(regions) ? regions : [];
  const safePackageSizes = Array.isArray(packageSizes) ? packageSizes : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="gradient-text">تعديل الطلب #{order.trackingnumber}</DialogTitle>
          {!canEdit && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-2">
              <p className="text-yellow-800 text-sm">⚠️ يمكن تعديل الطلبات فقط في حالة "قيد التجهيز"</p>
            </div>
          )}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="client_name">اسم العميل</Label>
              <Input id="client_name" name="client_name" value={formData.client_name || ''} onChange={handleChange} required />
            </div>
            <div>
              <Label htmlFor="client_mobile">رقم الهاتف</Label>
              <Input id="client_mobile" name="client_mobile" value={formData.client_mobile || ''} onChange={handleChange} required />
            </div>
            <div>
              <Label htmlFor="client_mobile2">رقم هاتف ثاني (اختياري)</Label>
              <Input id="client_mobile2" name="client_mobile2" value={formData.client_mobile2 || ''} onChange={handleChange} />
            </div>
            <div>
              <Label htmlFor="price">السعر الإجمالي (مع التوصيل)</Label>
              <Input id="price" name="price" type="number" value={formData.price || ''} onChange={handleChange} required disabled={!canEdit} />
            </div>
            <div>
              <Label htmlFor="city_id">المدينة</Label>
              <Select name="city_id" value={String(formData.city_id || '')} onValueChange={(value) => handleSelectChange('city_id', value)} required>
                <SelectTrigger><SelectValue placeholder="اختر مدينة" /></SelectTrigger>
                <SelectContent>
                  {safeCities.map(city => <SelectItem key={city.id} value={String(city.id)}>{city.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="region_id">المنطقة</Label>
              <Select name="region_id" value={String(formData.region_id || '')} onValueChange={(value) => handleSelectChange('region_id', value)} required disabled={!formData.city_id || safeRegions.length === 0}>
                <SelectTrigger><SelectValue placeholder="اختر منطقة" /></SelectTrigger>
                <SelectContent>
                  {safeRegions.map(region => <SelectItem key={region.id} value={String(region.id)}>{region.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* قسم تعديل المنتجات */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-lg font-semibold">منتجات الطلب</Label>
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={addNewItem}
                disabled={!canEdit}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                إضافة منتج
              </Button>
            </div>
            
            {orderItems.map((item, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-3 p-3 bg-white dark:bg-gray-700 rounded border">
                <div>
                  <Label className="text-xs">اسم المنتج</Label>
                  <Input
                    value={item.productName || item.product_name || ''}
                    onChange={(e) => handleItemChange(index, 'productName', e.target.value)}
                    placeholder="اسم المنتج"
                    disabled={!canEdit}
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs">الكمية</Label>
                  <Input
                    type="number"
                    min="1"
                    value={item.quantity || 1}
                    onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 1)}
                    disabled={!canEdit}
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs">السعر</Label>
                  <Input
                    type="number"
                    min="0"
                    value={item.price || 0}
                    onChange={(e) => handleItemChange(index, 'price', parseFloat(e.target.value) || 0)}
                    disabled={!canEdit}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => removeItem(index)}
                    disabled={!canEdit || orderItems.length <= 1}
                    className="w-full"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          
          <div>
            <Label htmlFor="location">العنوان التفصيلي</Label>
            <Textarea id="location" name="location" value={formData.location || ''} onChange={handleChange} required disabled={!canEdit} />
          </div>
          <div>
            <Label htmlFor="type_name">نوع البضاعة (يتم تحديثه تلقائياً من المنتجات)</Label>
            <Input id="type_name" name="type_name" value={formData.type_name || ''} onChange={handleChange} required disabled />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="items_number">عدد القطع (يتم حسابه تلقائياً)</Label>
              <Input id="items_number" name="items_number" type="number" value={formData.items_number || ''} onChange={handleChange} required disabled />
            </div>
            <div>
              <Label htmlFor="package_size">حجم الطلب</Label>
              <Select name="package_size" value={String(formData.package_size || '')} onValueChange={(value) => handleSelectChange('package_size', value)} required>
                <SelectTrigger><SelectValue placeholder="اختر الحجم" /></SelectTrigger>
                <SelectContent>
                  {safePackageSizes.map(size => <SelectItem key={size.id} value={String(size.id)}>{size.size}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="merchant_notes">ملاحظات التاجر (اختياري)</Label>
            <Textarea id="merchant_notes" name="merchant_notes" value={formData.merchant_notes || ''} onChange={handleChange} />
          </div>
          <div>
            <Label>هل الطلب استبدال؟</Label>
            <Select name="replacement" value={String(formData.replacement || '0')} onValueChange={(value) => handleSelectChange('replacement', value)} required>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">لا</SelectItem>
                <SelectItem value="1">نعم</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
            <Button type="submit" disabled={isLoading || !canEdit}>
              {isLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              {canEdit ? 'حفظ التعديلات' : 'لا يمكن التعديل'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditOrderDialog;
