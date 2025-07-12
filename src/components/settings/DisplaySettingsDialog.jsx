import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { toast } from '@/components/ui/use-toast';
import { Monitor, Layout, Type, Zap } from 'lucide-react';

const DisplaySettingsDialog = ({ open, onOpenChange }) => {
  const [layoutPattern, setLayoutPattern] = useState('mixed');
  const [contentDensity, setContentDensity] = useState('normal');
  const [hideCurrentStrip, setHideCurrentStrip] = useState(false);
  const [fontSize, setFontSize] = useState([100]);
  const [enableAnimations, setEnableAnimations] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [colorCorrection, setColorCorrection] = useState(false);

  const applySettings = () => {
    const root = document.documentElement;
    
    // تطبيق حجم الخط
    root.style.setProperty('--font-scale', `${fontSize[0] / 100}`);
    
    // تطبيق كثافة المحتوى
    const densityClass = contentDensity === 'compact' ? 'compact' : contentDensity === 'spacious' ? 'spacious' : 'normal';
    document.body.className = document.body.className.replace(/\b(compact|spacious|normal)\b/g, '') + ` ${densityClass}`;
    
    // تطبيق التباين العالي
    if (highContrast) {
      document.body.classList.add('high-contrast');
    } else {
      document.body.classList.remove('high-contrast');
    }
    
    // تطبيق تقليل الحركة
    if (reduceMotion) {
      document.body.classList.add('reduce-motion');
    } else {
      document.body.classList.remove('reduce-motion');
    }
    
    toast({
      title: "تم تطبيق الإعدادات",
      description: "تم حفظ إعدادات العرض بنجاح"
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Monitor className="w-5 h-5" />
            إعدادات العرض
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* تخطيط الواجهة */}
          <div className="space-y-4 p-4 border rounded-lg">
            <h3 className="font-semibold flex items-center gap-2">
              <Layout className="w-4 h-4" />
              تخطيط الواجهة
            </h3>
            
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>نمط التخطيط</Label>
                <Select value={layoutPattern} onValueChange={setLayoutPattern}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mixed">مختلط</SelectItem>
                    <SelectItem value="cards">كروت</SelectItem>
                    <SelectItem value="list">قائمة</SelectItem>
                    <SelectItem value="grid">شبكة</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>كثافة المحتوى</Label>
                <Select value={contentDensity} onValueChange={setContentDensity}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="compact">مضغوط</SelectItem>
                    <SelectItem value="normal">عادي</SelectItem>
                    <SelectItem value="spacious">واسع</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">إخفاء الشريط الحالي</p>
                  <p className="text-sm text-muted-foreground">إخفاء شريط التنقل العلوي</p>
                </div>
                <Switch
                  checked={hideCurrentStrip}
                  onCheckedChange={setHideCurrentStrip}
                />
              </div>
            </div>
          </div>

          {/* الخط والنص */}
          <div className="space-y-4 p-4 border rounded-lg">
            <h3 className="font-semibold flex items-center gap-2">
              <Type className="w-4 h-4" />
              الخط والنص
            </h3>
            
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>حجم الخط</Label>
                  <span className="text-sm text-muted-foreground">{fontSize[0]}%</span>
                </div>
                <Slider
                  value={fontSize}
                  onValueChange={setFontSize}
                  min={75}
                  max={150}
                  step={5}
                  className="w-full"
                />
                <div className="text-center">
                  <p style={{ fontSize: `${fontSize[0] / 100}em` }} className="text-sm">
                    مثال على النص بالحجم المختار
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* الحركة والتأثيرات */}
          <div className="space-y-4 p-4 border rounded-lg">
            <h3 className="font-semibold flex items-center gap-2">
              <Zap className="w-4 h-4" />
              الحركة والتأثيرات
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">تفعيل الحركات</p>
                  <p className="text-sm text-muted-foreground">انتقالات سلسة بين الصفحات</p>
                </div>
                <Switch
                  checked={enableAnimations}
                  onCheckedChange={setEnableAnimations}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">تقليل الحركة</p>
                  <p className="text-sm text-muted-foreground">للأشخاص الحساسين للحركة</p>
                </div>
                <Switch
                  checked={reduceMotion}
                  onCheckedChange={setReduceMotion}
                />
              </div>
            </div>
          </div>

          {/* إمكانية الوصول */}
          <div className="space-y-4 p-4 border rounded-lg">
            <h3 className="font-semibold">إمكانية الوصول</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">التباين العالي</p>
                  <p className="text-sm text-muted-foreground">ألوان أكثر وضوحاً</p>
                </div>
                <Switch
                  checked={highContrast}
                  onCheckedChange={setHighContrast}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">حجم النص الألوان</p>
                  <p className="text-sm text-muted-foreground">تحسين عرض الألوان</p>
                </div>
                <Switch
                  checked={colorCorrection}
                  onCheckedChange={setColorCorrection}
                />
              </div>
            </div>
          </div>

          {/* معاينة الإعدادات */}
          <div className="p-4 border rounded-lg bg-card/50">
            <h4 className="font-medium mb-3">معاينة</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-sm">هذا نص تجريبي لمعاينة الإعدادات</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span className="text-sm">يمكنك رؤية كيف ستبدو النصوص والألوان</span>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <Button onClick={applySettings} className="flex-1">
              حفظ الإعدادات
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              إلغاء
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DisplaySettingsDialog;