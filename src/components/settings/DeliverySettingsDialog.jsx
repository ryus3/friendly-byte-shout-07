import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/use-toast';
import { 
  Truck, DollarSign, Settings, MapPin, 
  Clock, Package, Users, UserCheck, Printer, ImageIcon
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { useInventory } from '@/contexts/InventoryContext';
import { supabase } from '@/integrations/supabase/client';

const DeliverySettingsDialog = ({ open, onOpenChange }) => {
  const { settings, updateSettings } = useInventory();
  
  const [localSettings, setLocalSettings] = useState({
    deliveryFee: settings?.deliveryFee || 5000,
    freeDeliveryThreshold: settings?.freeDeliveryThreshold || 50000,
    enableFreeDelivery: settings?.enableFreeDelivery || false,
    deliveryTimeEstimate: settings?.deliveryTimeEstimate || '2-3 أيام',
    maxDeliveryDistance: settings?.maxDeliveryDistance || 50,
    enableExpressDelivery: settings?.enableExpressDelivery || false,
    expressDeliveryFee: settings?.expressDeliveryFee || 10000,
  });

  // ✅ إعداد التوجيه: 'creator' (افتراضي) = إرسال الطلب الذكي بحساب منشئه الأصلي
  //                  'approver' = إرسال بحساب من ضغط الموافقة
  const [sendAsCreator, setSendAsCreator] = useState(true);

  // ✅ هيدر فاتورة الطلب المحلي (شعار/اسم محل/هاتف/عنوان/تذييل)
  const [invoiceHeader, setInvoiceHeader] = useState({
    shop_name: 'RYUS',
    logo_url: '',
    phone: '',
    address: '',
    footer_note: '',
  });

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const { data } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'ai_approval_send_as')
          .maybeSingle();
        const raw = data?.value;
        const parsed = typeof raw === 'string' ? raw.replace(/"/g, '') : raw;
        setSendAsCreator(parsed !== 'approver');
      } catch (_) {}

      try {
        const { data: hdr } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'local_invoice_header')
          .maybeSingle();
        if (hdr?.value) {
          const h = typeof hdr.value === 'string' ? JSON.parse(hdr.value) : hdr.value;
          setInvoiceHeader((prev) => ({ ...prev, ...h }));
        }
      } catch (_) {}
    })();
  }, [open]);


  const handleSave = async () => {
    try {
      await updateSettings({
        ...settings,
        ...localSettings
      });

      // ✅ حفظ إعداد توجيه الطلبات الذكية
      try {
        await supabase
          .from('settings')
          .upsert(
            { key: 'ai_approval_send_as', value: JSON.stringify(sendAsCreator ? 'creator' : 'approver') },
            { onConflict: 'key' }
          );
      } catch (e) {
        console.error('فشل حفظ إعداد توجيه الموافقة:', e);
      }
      
      toast({
        title: "تم الحفظ!",
        description: "تم حفظ إعدادات التوصيل بنجاح",
        variant: "success"
      });
      
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل في حفظ الإعدادات",
        variant: "destructive"
      });
    }
  };


  const updateLocalSetting = (key, value) => {
    setLocalSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-blue-500" />
            إعدادات التوصيل
          </DialogTitle>
          <DialogDescription>
            إدارة أسعار وقواعد التوصيل للطلبات
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* الأسعار الأساسية */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                الأسعار والرسوم
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="deliveryFee">سعر التوصيل الأساسي (د.ع)</Label>
                  <Input
                    id="deliveryFee"
                    type="number"
                    value={localSettings.deliveryFee}
                    onChange={(e) => updateLocalSetting('deliveryFee', parseInt(e.target.value) || 0)}
                    min="0"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="freeDeliveryThreshold">الحد الأدنى للتوصيل المجاني (د.ع)</Label>
                  <Input
                    id="freeDeliveryThreshold"
                    type="number"
                    value={localSettings.freeDeliveryThreshold}
                    onChange={(e) => updateLocalSetting('freeDeliveryThreshold', parseInt(e.target.value) || 0)}
                    min="0"
                    disabled={!localSettings.enableFreeDelivery}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>تفعيل التوصيل المجاني</Label>
                  <p className="text-sm text-muted-foreground">عند الوصول للحد الأدنى المحدد</p>
                </div>
                <Switch
                  checked={localSettings.enableFreeDelivery}
                  onCheckedChange={(checked) => updateLocalSetting('enableFreeDelivery', checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* التوصيل السريع */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                التوصيل السريع
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>تفعيل خدمة التوصيل السريع</Label>
                  <p className="text-sm text-muted-foreground">توصيل في نفس اليوم أو خلال 24 ساعة</p>
                </div>
                <Switch
                  checked={localSettings.enableExpressDelivery}
                  onCheckedChange={(checked) => updateLocalSetting('enableExpressDelivery', checked)}
                />
              </div>

              {localSettings.enableExpressDelivery && (
                <div className="space-y-2">
                  <Label htmlFor="expressDeliveryFee">رسوم التوصيل السريع (د.ع)</Label>
                  <Input
                    id="expressDeliveryFee"
                    type="number"
                    value={localSettings.expressDeliveryFee}
                    onChange={(e) => updateLocalSetting('expressDeliveryFee', parseInt(e.target.value) || 0)}
                    min="0"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* ✅ توجيه موافقة الطلبات الذكية */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-emerald-600" />
                توجيه الطلبات الذكية
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <Label>إرسال بحساب منشئ الطلب الأصلي</Label>
                  <p className="text-sm text-muted-foreground">
                    عند موافقة المدير أو مدير القسم على طلب موظف، يُرسل الطلب لحساب الموظف في شركة التوصيل ويُحفظ محلياً باسمه. (موصى به)
                  </p>
                </div>
                <Switch
                  checked={sendAsCreator}
                  onCheckedChange={setSendAsCreator}
                />
              </div>
            </CardContent>
          </Card>



          {/* معلومات إضافية */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <div className="space-y-3 text-sm text-blue-700">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  <span>سيتم تطبيق هذه الأسعار على جميع الطلبات الجديدة</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span>يمكن للموظفين رؤية أسعار التوصيل في صفحة إنشاء الطلبات</span>
                </div>
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  <span>يمكن تخصيص أسعار مختلفة لكل منطقة من إعدادات شركات التوصيل</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button onClick={handleSave}>
            حفظ التغييرات
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DeliverySettingsDialog;