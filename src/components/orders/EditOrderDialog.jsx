
import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { toast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const EditOrderDialog = ({ order, open, onOpenChange, onOrderUpdated }) => {
  const [formData, setFormData] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const { cities, regions, packageSizes, fetchRegions, editAlWaseetOrder } = useAlWaseet();

  const initializeForm = useCallback(() => {
    if (order) {
      const deliveryData = order.delivery_partner_data || {};
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    const result = await editAlWaseetOrder(formData);

    if (result.success) {
      toast({
        title: "تم بنجاح",
        description: "تم تعديل الطلب بنجاح.",
        variant: "success",
      });
      onOrderUpdated(order.id, { delivery_partner_data: formData, ...formData });
      onOpenChange(false);
    } else {
      toast({
        title: "خطأ",
        description: result.message || "فشل تعديل الطلب.",
        variant: "destructive",
      });
    }
    setIsLoading(false);
  };

  if (!order) return null;

  const safeCities = Array.isArray(cities) ? cities : [];
  const safeRegions = Array.isArray(regions) ? regions : [];
  const safePackageSizes = Array.isArray(packageSizes) ? packageSizes : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="gradient-text">تعديل الطلب #{order.trackingnumber}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
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
              <Input id="price" name="price" type="number" value={formData.price || ''} onChange={handleChange} required />
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
          <div>
            <Label htmlFor="location">العنوان التفصيلي</Label>
            <Textarea id="location" name="location" value={formData.location || ''} onChange={handleChange} required />
          </div>
          <div>
            <Label htmlFor="type_name">نوع البضاعة</Label>
            <Input id="type_name" name="type_name" value={formData.type_name || ''} onChange={handleChange} required />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="items_number">عدد القطع</Label>
              <Input id="items_number" name="items_number" type="number" value={formData.items_number || ''} onChange={handleChange} required />
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
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              حفظ التعديلات
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditOrderDialog;
