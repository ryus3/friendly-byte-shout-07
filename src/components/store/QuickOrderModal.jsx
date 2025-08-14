import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, User, Phone, MapPin, MessageSquare, CreditCard } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';

const QuickOrderModal = ({ isOpen, onClose, cart }) => {
  const [orderForm, setOrderForm] = useState({
    customerName: '',
    phone: '',
    address: '',
    city: '',
    notes: '',
    paymentMethod: 'cash'
  });

  const totalAmount = cart.reduce((sum, item) => sum + item.total, 0);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  const cities = [
    'بغداد', 'البصرة', 'الموصل', 'أربيل', 'النجف', 'كربلاء', 
    'السليمانية', 'الناصرية', 'الحلة', 'الرمادي', 'الكوت', 'العمارة'
  ];

  const handleInputChange = (field, value) => {
    setOrderForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmitOrder = () => {
    if (!orderForm.customerName || !orderForm.phone || !orderForm.address) {
      toast({
        title: "معلومات ناقصة",
        description: "يرجى ملء جميع الحقول المطلوبة",
        variant: "destructive"
      });
      return;
    }

    // هنا يتم إرسال الطلب
    toast({
      title: "تم إرسال طلبك بنجاح!",
      description: "سيتم التواصل معك قريباً لتأكيد الطلب",
      variant: "success"
    });

    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-background/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            إتمام الطلب
          </DialogTitle>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-6">
          
          {/* معلومات العميل */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">معلومات العميل</h3>
            
            <div className="space-y-2">
              <Label htmlFor="customerName">الاسم الكامل *</Label>
              <div className="relative">
                <User className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="customerName"
                  value={orderForm.customerName}
                  onChange={(e) => handleInputChange('customerName', e.target.value)}
                  placeholder="أدخل اسمك الكامل"
                  className="pr-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">رقم الهاتف *</Label>
              <div className="relative">
                <Phone className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="phone"
                  value={orderForm.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="07xxxxxxxxx"
                  className="pr-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="city">المحافظة *</Label>
              <Select value={orderForm.city} onValueChange={(value) => handleInputChange('city', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر المحافظة" />
                </SelectTrigger>
                <SelectContent>
                  {cities.map(city => (
                    <SelectItem key={city} value={city}>{city}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">العنوان التفصيلي *</Label>
              <div className="relative">
                <MapPin className="absolute right-3 top-3 w-4 h-4 text-muted-foreground" />
                <Textarea
                  id="address"
                  value={orderForm.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  placeholder="أدخل عنوانك التفصيلي"
                  className="pr-10 min-h-20"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">ملاحظات إضافية</Label>
              <div className="relative">
                <MessageSquare className="absolute right-3 top-3 w-4 h-4 text-muted-foreground" />
                <Textarea
                  id="notes"
                  value={orderForm.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  placeholder="أي ملاحظات خاصة بالطلب"
                  className="pr-10 min-h-16"
                />
              </div>
            </div>
          </div>

          {/* ملخص الطلب */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">ملخص الطلب</h3>
            
            <div className="bg-muted/50 rounded-lg p-4 space-y-3 max-h-64 overflow-y-auto">
              {cart.map((item) => (
                <div key={item.id} className="flex justify-between items-center">
                  <div className="flex-1">
                    <p className="font-medium text-sm line-clamp-1">{item.productName}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.color} • {item.size} • كمية: {item.quantity}
                    </p>
                  </div>
                  <p className="font-bold text-primary">
                    {item.total.toLocaleString()} د.ع
                  </p>
                </div>
              ))}
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex justify-between">
                <span>عدد القطع:</span>
                <span>{totalItems}</span>
              </div>
              <div className="flex justify-between">
                <span>المجموع الفرعي:</span>
                <span>{totalAmount.toLocaleString()} د.ع</span>
              </div>
              <div className="flex justify-between">
                <span>رسوم التوصيل:</span>
                <span className="text-green-600">مجاني</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>المجموع الكلي:</span>
                <span className="text-primary">{totalAmount.toLocaleString()} د.ع</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>طريقة الدفع</Label>
              <Select value={orderForm.paymentMethod} onValueChange={(value) => handleInputChange('paymentMethod', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">الدفع عند الاستلام</SelectItem>
                  <SelectItem value="transfer">تحويل مصرفي</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="pt-4 space-y-3">
              <Button
                onClick={handleSubmitOrder}
                className="w-full bg-gradient-to-r from-primary to-purple-500 text-white py-3"
                size="lg"
              >
                تأكيد الطلب
              </Button>
              <Button
                variant="outline"
                onClick={onClose}
                className="w-full"
              >
                إلغاء
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QuickOrderModal;