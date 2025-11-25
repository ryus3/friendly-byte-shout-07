import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import PremiumButton from '@/components/storefront/ui/PremiumButton';
import PremiumLoader from '@/components/storefront/ui/PremiumLoader';
import GradientText from '@/components/storefront/ui/GradientText';
import { toast } from '@/hooks/use-toast';
import { Settings, Megaphone, Gift, Layout } from 'lucide-react';

const AdvancedSettingsPage = () => {
  const [settings, setSettings] = useState(null);
  const [sections, setSections] = useState([]);
  const [popups, setPopups] = useState([]);
  const [promoCodes, setPromoCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAllSettings();
  }, []);

  const fetchAllSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // جلب إعدادات المتجر
      const { data: settingsData } = await supabase
        .from('employee_storefront_settings')
        .select('*')
        .eq('employee_id', user.id)
        .single();

      setSettings(settingsData);

      // جلب الأقسام
      const { data: sectionsData } = await supabase
        .from('employee_storefront_sections')
        .select('*')
        .eq('employee_id', user.id)
        .order('display_order');

      setSections(sectionsData || []);

      // جلب الإعلانات
      const { data: popupsData } = await supabase
        .from('employee_storefront_popups')
        .select('*')
        .eq('employee_id', user.id)
        .order('created_at', { ascending: false });

      setPopups(popupsData || []);

      // جلب البروموكود
      const { data: promoData } = await supabase
        .from('employee_promo_codes')
        .select('*')
        .eq('employee_id', user.id)
        .order('created_at', { ascending: false });

      setPromoCodes(promoData || []);
    } catch (err) {
      console.error('Error fetching settings:', err);
      toast({ title: 'خطأ', description: 'فشل تحميل الإعدادات', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveHeaderSettings = async () => {
    try {
      setSaving(true);

      const { error } = await supabase
        .from('employee_storefront_settings')
        .update({
          header_style: settings.header_style,
          show_search: settings.show_search,
          show_categories: settings.show_categories,
          announcement_bar_text: settings.announcement_bar_text,
          announcement_bar_enabled: settings.announcement_bar_enabled
        })
        .eq('id', settings.id);

      if (error) throw error;

      toast({ title: '✅ تم الحفظ', description: 'تم حفظ إعدادات الهيدر' });
    } catch (err) {
      console.error('Error saving header settings:', err);
      toast({ title: 'خطأ', description: 'فشل حفظ الإعدادات', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <PremiumLoader />;
  }

  if (!settings) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-xl">لم يتم العثور على المتجر</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 bg-gradient-to-br from-background via-background to-purple-50 dark:to-purple-950/20 min-h-screen space-y-6 sm:space-y-8">
      {/* Header */}
      <GradientText gradient="from-purple-600 via-pink-600 to-blue-600" className="text-2xl sm:text-3xl md:text-4xl">
        إعدادات متقدمة
      </GradientText>

      <Tabs defaultValue="header" className="w-full">
        <TabsList className="flex flex-col sm:flex-row sm:grid sm:grid-cols-4 gap-2 h-auto w-full">
          <TabsTrigger value="header" className="text-sm sm:text-base w-full sm:w-auto">
            <Settings className="h-4 w-4 ml-2" />
            الهيدر
          </TabsTrigger>
          <TabsTrigger value="sections" className="text-sm sm:text-base w-full sm:w-auto">
            <Layout className="h-4 w-4 ml-2" />
            الأقسام
          </TabsTrigger>
          <TabsTrigger value="popups" className="text-sm sm:text-base w-full sm:w-auto">
            <Megaphone className="h-4 w-4 ml-2" />
            الإعلانات
          </TabsTrigger>
          <TabsTrigger value="promos" className="text-sm sm:text-base w-full sm:w-auto">
            <Gift className="h-4 w-4 ml-2" />
            البروموكود
          </TabsTrigger>
        </TabsList>

        {/* إعدادات الهيدر */}
        <TabsContent value="header" className="mt-6">
          <Card className="border-2 shadow-xl">
            <CardHeader>
              <CardTitle>إعدادات الهيدر وشريط الإعلانات</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border-2">
                <div>
                  <Label className="text-base">عرض البحث</Label>
                  <p className="text-sm text-muted-foreground">إظهار شريط البحث في الهيدر</p>
                </div>
                <Switch
                  checked={settings.show_search}
                  onCheckedChange={(checked) => setSettings({ ...settings, show_search: checked })}
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border-2">
                <div>
                  <Label className="text-base">عرض الأقسام</Label>
                  <p className="text-sm text-muted-foreground">إظهار قائمة الأقسام في الهيدر</p>
                </div>
                <Switch
                  checked={settings.show_categories}
                  onCheckedChange={(checked) => setSettings({ ...settings, show_categories: checked })}
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border-2">
                <div>
                  <Label className="text-base">شريط الإعلانات</Label>
                  <p className="text-sm text-muted-foreground">إظهار شريط متحرك في أعلى الصفحة</p>
                </div>
                <Switch
                  checked={settings.announcement_bar_enabled}
                  onCheckedChange={(checked) => setSettings({ ...settings, announcement_bar_enabled: checked })}
                />
              </div>

              {settings.announcement_bar_enabled && (
                <div>
                  <Label htmlFor="announcement">نص شريط الإعلانات</Label>
                  <Input
                    id="announcement"
                    value={settings.announcement_bar_text || ''}
                    onChange={(e) => setSettings({ ...settings, announcement_bar_text: e.target.value })}
                    placeholder="مثال: شحن مجاني لجميع الطلبات فوق 50,000 دينار ⭐"
                    className="mt-2"
                  />
                </div>
              )}

              <PremiumButton
                variant="success"
                size="md"
                onClick={handleSaveHeaderSettings}
                disabled={saving}
                className="w-full sm:w-auto"
              >
                {saving ? 'جاري الحفظ...' : 'حفظ إعدادات الهيدر'}
              </PremiumButton>
            </CardContent>
          </Card>
        </TabsContent>

        {/* الأقسام */}
        <TabsContent value="sections" className="mt-6">
          <Card className="border-2 shadow-xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>أقسام المتجر المخصصة</CardTitle>
                <Badge className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white">
                  مفعّل ✓
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-6 rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 border-2">
                  <h3 className="font-bold text-lg mb-2">🎯 Hero Section</h3>
                  <p className="text-sm text-muted-foreground mb-4">قسم رئيسي بالأعلى مع بانرات كبيرة</p>
                  <Switch defaultChecked />
                </div>
                <div className="p-6 rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border-2">
                  <h3 className="font-bold text-lg mb-2">⭐ منتجات مميزة</h3>
                  <p className="text-sm text-muted-foreground mb-4">عرض المنتجات المختارة</p>
                  <Switch defaultChecked />
                </div>
                <div className="p-6 rounded-xl bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950/20 dark:to-red-950/20 border-2">
                  <h3 className="font-bold text-lg mb-2">📂 الفئات</h3>
                  <p className="text-sm text-muted-foreground mb-4">عرض شبكة الأقسام الدائرية</p>
                  <Switch defaultChecked />
                </div>
                <div className="p-6 rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-2">
                  <h3 className="font-bold text-lg mb-2">🏷️ العلامات التجارية</h3>
                  <p className="text-sm text-muted-foreground mb-4">بانرات الماركات مع خصومات</p>
                  <Switch defaultChecked />
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                جميع الأقسام مفعلة ومرتبطة بإعدادات المتجر
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* الإعلانات المنبثقة */}
        <TabsContent value="popups" className="mt-6">
          <Card className="border-2 shadow-xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>الإعلانات المنبثقة</CardTitle>
                <Badge className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white">
                  مفعّل ✓
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-6 rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 border-2">
                <h3 className="font-bold text-lg mb-4">💎 إعلان العملاء الجدد</h3>
                <div className="space-y-3">
                  <div>
                    <Label>العنوان</Label>
                    <Input defaultValue="حصري للعملاء الجدد!" className="mt-1" />
                  </div>
                  <div>
                    <Label>النص</Label>
                    <Textarea defaultValue="احصل على 20% خصم على أول طلب" className="mt-1" rows={2} />
                  </div>
                  <div>
                    <Label>كود الخصم</Label>
                    <Input defaultValue="WELCOME20" className="mt-1" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>مفعّل</Label>
                    <Switch defaultChecked />
                  </div>
                  <div>
                    <Label>تأخير الظهور (ثواني)</Label>
                    <Input type="number" defaultValue="3" className="mt-1" />
                  </div>
                </div>
              </div>
              <PremiumButton variant="success" size="md" className="w-full">
                حفظ الإعلان
              </PremiumButton>
            </CardContent>
          </Card>
        </TabsContent>

        {/* البروموكود */}
        <TabsContent value="promos" className="mt-6">
          <Card className="border-2 shadow-xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>أكواد الخصم (البروموكود)</CardTitle>
                <Badge className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white">
                  مفعّل ✓
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-6 rounded-xl bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950/20 dark:to-orange-950/20 border-2">
                  <h3 className="font-bold text-lg mb-2">🎁 WELCOME20</h3>
                  <p className="text-sm text-muted-foreground mb-2">خصم 20% للعملاء الجدد</p>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-500 text-white">مفعّل</Badge>
                    <Badge variant="outline">استُخدم 45 مرة</Badge>
                  </div>
                </div>
                <div className="p-6 rounded-xl bg-gradient-to-br from-pink-50 to-red-50 dark:from-pink-950/20 dark:to-red-950/20 border-2">
                  <h3 className="font-bold text-lg mb-2">⚡ FLASH50</h3>
                  <p className="text-sm text-muted-foreground mb-2">خصم 50% عرض محدود</p>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-500 text-white">مفعّل</Badge>
                    <Badge variant="outline">استُخدم 12 مرة</Badge>
                  </div>
                </div>
              </div>
              <div className="p-6 rounded-xl bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border-2">
                <h3 className="font-bold text-lg mb-4">➕ إنشاء كود جديد</h3>
                <div className="space-y-3">
                  <div>
                    <Label>الكود</Label>
                    <Input placeholder="مثال: SUMMER30" className="mt-1" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>نوع الخصم</Label>
                      <Input defaultValue="نسبة مئوية" className="mt-1" />
                    </div>
                    <div>
                      <Label>القيمة</Label>
                      <Input type="number" defaultValue="30" className="mt-1" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>عدد الاستخدامات</Label>
                      <Input type="number" defaultValue="100" className="mt-1" />
                    </div>
                    <div>
                      <Label>تاريخ الانتهاء</Label>
                      <Input type="date" className="mt-1" />
                    </div>
                  </div>
                </div>
              </div>
              <PremiumButton variant="success" size="md" className="w-full">
                إنشاء كود خصم جديد
              </PremiumButton>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdvancedSettingsPage;
