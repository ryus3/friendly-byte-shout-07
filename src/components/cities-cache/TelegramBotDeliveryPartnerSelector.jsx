import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bot, Building2, RefreshCw, CheckCircle2, AlertTriangle, Database } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';

const TelegramBotDeliveryPartnerSelector = () => {
  const [currentPartner, setCurrentPartner] = useState('alwaseet');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [reloadStats, setReloadStats] = useState(null);

  const handleReloadBotCache = async () => {
    setReloading(true);
    setReloadStats(null);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anon = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/telegram-bot?action=reload_cache`,
        { method: 'POST', headers: { 'Authorization': `Bearer ${anon}`, 'apikey': anon, 'Content-Type': 'application/json' }, body: '{}' }
      );
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error || 'فشل إعادة التحميل');
      setReloadStats(data);
      toast({
        title: '✅ تم إعادة تحميل كاش البوت',
        description: `${data.cities} مدينة، ${data.regions} منطقة، ${data.region_aliases} مرادف منطقة (${data.partner})`,
      });
    } catch (e) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' });
    } finally {
      setReloading(false);
    }
  };

  // جلب الإعداد الحالي
  useEffect(() => {
    fetchCurrentSetting();
  }, []);

  const fetchCurrentSetting = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'telegram_bot_delivery_partner')
        .maybeSingle();

      if (error) throw error;

      if (data?.value) {
        const partner = typeof data.value === 'string' ? data.value : data.value;
        setCurrentPartner(partner || 'alwaseet');
      }
    } catch (error) {
      console.error('❌ خطأ في جلب إعداد شركة التوصيل:', error);
      toast({
        title: "خطأ",
        description: "فشل جلب إعداد شركة التوصيل للبوت",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('settings')
        .upsert({
          key: 'telegram_bot_delivery_partner',
          value: currentPartner,
          description: 'شركة التوصيل الافتراضية المستخدمة في بوت تليغرام'
        }, {
          onConflict: 'key'
        });

      if (error) throw error;

      await fetchCurrentSetting();

      toast({
        title: "✅ تم الحفظ",
        description: `تم تحديث شركة التوصيل إلى "${getPartnerName(currentPartner)}" بنجاح. سيتم تحميل المدن والمناطق تلقائياً عند إعادة تشغيل البوت.`,
        variant: "default"
      });
    } catch (error) {
      console.error('❌ خطأ في حفظ إعداد شركة التوصيل:', error);
      toast({
        title: "خطأ",
        description: "فشل حفظ إعداد شركة التوصيل",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const getPartnerName = (partner) => {
    const partners = {
      'alwaseet': 'الوسيط',
      'modon': 'مدن',
      'local': 'محلي'
    };
    return partners[partner] || partner;
  };

  const getPartnerColor = (partner) => {
    const colors = {
      'alwaseet': 'from-blue-500 to-blue-600',
      'modon': 'from-purple-500 to-purple-600',
      'local': 'from-green-500 to-green-600'
    };
    return colors[partner] || 'from-gray-500 to-gray-600';
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>جاري التحميل...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          إعدادات بوت تليغرام
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        

        {/* اختيار شركة التوصيل */}
        <div className="space-y-3">
          <label className="text-sm font-medium flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            شركة التوصيل المستخدمة في البوت
          </label>
          
          <Select value={currentPartner} onValueChange={setCurrentPartner}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="اختر شركة التوصيل" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alwaseet">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${getPartnerColor('alwaseet')}`} />
                  <span>الوسيط</span>
                </div>
              </SelectItem>
              <SelectItem value="modon">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${getPartnerColor('modon')}`} />
                  <span>مدن</span>
                </div>
              </SelectItem>
              <SelectItem value="local" disabled>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${getPartnerColor('local')}`} />
                  <span>محلي (قريباً)</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* الحالة الحالية */}
        <div className="bg-secondary/20 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span className="font-medium">الإعداد الحالي:</span>
          </div>
          <Badge 
            variant="secondary" 
            className={`bg-gradient-to-r ${getPartnerColor(currentPartner)} text-white border-none`}
          >
            {getPartnerName(currentPartner)}
          </Badge>
        </div>

        {/* تحذير مهم */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-yellow-900">
                ملاحظة مهمة عن إعادة التشغيل
              </p>
              <p className="text-xs text-yellow-700">
                • البوت يُعيد تشغيل نفسه تلقائياً عند عدم النشاط (Instance Warmup)
              </p>
              <p className="text-xs text-yellow-700">
                • Cache المدن والمناطق يُحمّل تلقائياً عند أول طلب
              </p>
              <p className="text-xs text-yellow-700">
                • Cache محفوظ لمدة 30 يوم لتقليل الاستدعاءات
              </p>
              <p className="text-xs text-yellow-700">
                • البحث محصور في مناطق المدينة المختارة فقط لسرعة عالية
              </p>
            </div>
          </div>
        </div>

        {/* زر الحفظ */}
        <Button 
          onClick={handleSave}
          disabled={saving}
          className="w-full"
        >
          {saving ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              جاري الحفظ...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              حفظ الإعدادات
            </>
          )}
        </Button>

        {/* معلومات إضافية */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Cache يُحفظ 30 يوم لتقليل عدد المرات المطلوب تحديثه</p>
          <p>• البحث الذكي يعمل فقط في مناطق المدينة المختارة (سرعة + دقة)</p>
          <p>• يعرض حتى 5 مناطق محتملة فقط في "هل تقصد؟"</p>
          <p>• في المستقبل، يمكن إضافة دعم لشركات توصيل أخرى</p>
        </div>

      </CardContent>
    </Card>
  );
};

export default TelegramBotDeliveryPartnerSelector;
