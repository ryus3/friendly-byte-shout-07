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
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 gap-2">
          <TabsTrigger value="header" className="text-sm sm:text-base">
            <Settings className="h-4 w-4 ml-2" />
            الهيدر
          </TabsTrigger>
          <TabsTrigger value="sections" className="text-sm sm:text-base">
            <Layout className="h-4 w-4 ml-2" />
            الأقسام
          </TabsTrigger>
          <TabsTrigger value="popups" className="text-sm sm:text-base">
            <Megaphone className="h-4 w-4 ml-2" />
            الإعلانات
          </TabsTrigger>
          <TabsTrigger value="promos" className="text-sm sm:text-base">
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
                <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                  قريباً
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                ستتمكن قريباً من إضافة أقسام مخصصة (Hero, Featured, Categories, Testimonials) وترتيبها.
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
                <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                  قريباً
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                ستتمكن قريباً من إضافة إعلانات منبثقة مع صور، عناوين، وأزرار دعوة للإجراء.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* البروموكود */}
        <TabsContent value="promos" className="mt-6">
          <Card className="border-2 shadow-xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>أكواد الخصم (البروموكود)</CardTitle>
                <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                  قريباً
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                ستتمكن قريباً من إنشاء أكواد خصم بنسبة مئوية أو قيمة ثابتة، مع تحديد عدد الاستخدامات والصلاحية.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdvancedSettingsPage;
