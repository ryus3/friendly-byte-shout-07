import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { toast } from '@/components/ui/use-toast';
import { useTheme } from '@/contexts/ThemeContext';
import { Palette, Monitor, Sun, Moon, Smartphone, Layout, Type, Zap, Eye } from 'lucide-react';

const DeveloperSettingsDialog = ({ open, onOpenChange }) => {
  const { theme, setTheme } = useTheme();
  const [currentColorScheme, setCurrentColorScheme] = useState('blue');
  
  // إعدادات المظهر والثيم
  const [layoutPattern, setLayoutPattern] = useState('mixed');
  const [contentDensity, setContentDensity] = useState('normal');
  const [hideCurrentStrip, setHideCurrentStrip] = useState(false);
  const [fontSize, setFontSize] = useState([100]);
  const [enableAnimations, setEnableAnimations] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [colorCorrection, setColorCorrection] = useState(false);
  const [experimentalTitle, setExperimentalTitle] = useState(false);

  const colorSchemes = [
    { id: 'blue', name: 'أزرق احترافي', primary: 'hsl(221, 83%, 53%)', class: 'from-blue-500 to-blue-600' },
    { id: 'green', name: 'أخضر طبيعي', primary: 'hsl(142, 76%, 36%)', class: 'from-green-500 to-green-600' },
    { id: 'purple', name: 'بنفسجي إبداعي', primary: 'hsl(262, 83%, 58%)', class: 'from-purple-500 to-purple-600' },
    { id: 'orange', name: 'برتقالي جريء', primary: 'hsl(25, 95%, 53%)', class: 'from-orange-500 to-orange-600' },
    { id: 'pink', name: 'وردي أنيق', primary: 'hsl(330, 81%, 60%)', class: 'from-pink-500 to-pink-600' },
    { id: 'gray', name: 'رمادي كلاسيكي', primary: 'hsl(220, 13%, 69%)', class: 'from-gray-500 to-gray-600' }
  ];

  const applyColorScheme = (scheme) => {
    setCurrentColorScheme(scheme.id);
    
    // تطبيق اللون في CSS
    const root = document.documentElement;
    const hslValues = scheme.primary.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (hslValues) {
      const [, h, s, l] = hslValues;
      root.style.setProperty('--primary', `${h} ${s}% ${l}%`);
      root.style.setProperty('--primary-foreground', '0 0% 98%');
    }
    
    toast({
      title: "تم تطبيق نمط الألوان",
      description: `تم تفعيل نمط ${scheme.name}`
    });
  };

  const applyDisplaySettings = () => {
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
    
    // تطبيق نمط التخطيط
    document.body.setAttribute('data-layout', layoutPattern);
    
    // إخفاء الشريط العلوي
    if (hideCurrentStrip) {
      document.body.classList.add('hide-header');
    } else {
      document.body.classList.remove('hide-header');
    }
    
    toast({
      title: "تم تطبيق إعدادات العرض",
      description: "تم حفظ جميع إعدادات المظهر والعرض"
    });
  };

  const resetToDefault = () => {
    const root = document.documentElement;
    root.style.setProperty('--primary', '221 83% 53%');
    root.style.setProperty('--primary-foreground', '0 0% 98%');
    root.style.setProperty('--font-scale', '1');
    
    // إعادة تعيين جميع الإعدادات
    setCurrentColorScheme('blue');
    setLayoutPattern('mixed');
    setContentDensity('normal');
    setHideCurrentStrip(false);
    setFontSize([100]);
    setEnableAnimations(true);
    setReduceMotion(false);
    setHighContrast(false);
    setColorCorrection(false);
    
    // إزالة جميع الفئات
    document.body.className = document.body.className.replace(/\b(compact|spacious|normal|high-contrast|reduce-motion|hide-header)\b/g, '');
    document.body.removeAttribute('data-layout');
    
    toast({
      title: "تم الإعادة للافتراضي",
      description: "تم إرجاع جميع الإعدادات للحالة الافتراضية"
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5" />
            إعدادات المظهر والثيم المتقدمة
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* وضع العرض */}
          <div className="space-y-4 p-4 border rounded-lg">
            <h3 className="font-semibold flex items-center gap-2">
              <Monitor className="w-4 h-4" />
              وضع العرض
            </h3>
            
            <div className="grid grid-cols-3 gap-3">
              <Button
                variant={theme === 'light' ? 'default' : 'outline'}
                onClick={() => setTheme('light')}
                className="flex flex-col items-center gap-2 h-auto py-4"
              >
                <Sun className="w-6 h-6" />
                <span>فاتح</span>
                <span className="text-xs text-muted-foreground">مظهر فاتح ومريح للعين</span>
              </Button>
              
              <Button
                variant={theme === 'dark' ? 'default' : 'outline'}
                onClick={() => setTheme('dark')}
                className="flex flex-col items-center gap-2 h-auto py-4"
              >
                <Moon className="w-6 h-6" />
                <span>داكن</span>
                <span className="text-xs text-muted-foreground">مظهر داكن ومريح للعين</span>
              </Button>
              
              <Button
                variant={theme === 'system' ? 'default' : 'outline'}
                onClick={() => setTheme('system')}
                className="flex flex-col items-center gap-2 h-auto py-4"
              >
                <Smartphone className="w-6 h-6" />
                <span>تلقائي</span>
                <span className="text-xs text-muted-foreground">يتبع إعدادات النظام</span>
              </Button>
            </div>
          </div>

          {/* نمط الألوان */}
          <div className="space-y-4 p-4 border rounded-lg">
            <h3 className="font-semibold">نمط الألوان</h3>
            <div className="grid grid-cols-2 gap-4">
              {colorSchemes.map((scheme) => (
                <button
                  key={scheme.id}
                  onClick={() => applyColorScheme(scheme)}
                  className={`p-4 rounded-lg border-2 transition-all hover:scale-105 ${
                    currentColorScheme === scheme.id ? 'border-primary shadow-lg' : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full bg-gradient-to-r ${scheme.class} shadow-md`}></div>
                    <div className="text-right">
                      <p className="font-medium">{scheme.name}</p>
                      <p className="text-xs text-muted-foreground">{scheme.id === currentColorScheme ? 'نشط' : 'انقر للتفعيل'}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* تخطيط الواجهة */}
          <div className="space-y-4 p-4 border rounded-lg">
            <h3 className="font-semibold flex items-center gap-2">
              <Layout className="w-4 h-4" />
              تخطيط الواجهة والتخطيط
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>نمط التخطيط</Label>
                <Select value={layoutPattern} onValueChange={setLayoutPattern}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mixed">مختلط (افتراضي)</SelectItem>
                    <SelectItem value="cards">بطاقات حديثة</SelectItem>
                    <SelectItem value="list">قائمة تفصيلية</SelectItem>
                    <SelectItem value="grid">شبكة منظمة</SelectItem>
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
                    <SelectItem value="compact">مضغوط - أكثر عناصر</SelectItem>
                    <SelectItem value="normal">عادي - متوازن</SelectItem>
                    <SelectItem value="spacious">واسع - مريح للعين</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">إخفاء الشريط العلوي</p>
                <p className="text-sm text-muted-foreground">إخفاء شريط التنقل العلوي لمساحة أكبر</p>
              </div>
              <Switch
                checked={hideCurrentStrip}
                onCheckedChange={setHideCurrentStrip}
              />
            </div>
          </div>

          {/* إعدادات الخط والنص */}
          <div className="space-y-4 p-4 border rounded-lg">
            <h3 className="font-semibold flex items-center gap-2">
              <Type className="w-4 h-4" />
              إعدادات الخط والنص
            </h3>
            
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>حجم الخط العام</Label>
                  <span className="text-sm font-medium text-primary">{fontSize[0]}%</span>
                </div>
                <Slider
                  value={fontSize}
                  onValueChange={setFontSize}
                  min={75}
                  max={150}
                  step={5}
                  className="w-full"
                />
                <div className="text-center p-3 bg-secondary/30 rounded-lg">
                  <p style={{ fontSize: `${fontSize[0] / 100}em` }} className="text-sm">
                    مثال على النص بالحجم المختار - سيتم تطبيقه على كامل التطبيق
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* الحركة والتأثيرات المرئية */}
          <div className="space-y-4 p-4 border rounded-lg">
            <h3 className="font-semibold flex items-center gap-2">
              <Zap className="w-4 h-4" />
              الحركة والتأثيرات المرئية
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">تفعيل الانتقالات المتحركة</p>
                  <p className="text-sm text-muted-foreground">انتقالات سلسة وجميلة بين الصفحات والعناصر</p>
                </div>
                <Switch
                  checked={enableAnimations}
                  onCheckedChange={setEnableAnimations}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">تقليل الحركة</p>
                  <p className="text-sm text-muted-foreground">مناسب للأشخاص الحساسين للحركة والوميض</p>
                </div>
                <Switch
                  checked={reduceMotion}
                  onCheckedChange={setReduceMotion}
                />
              </div>
            </div>
          </div>

          {/* إمكانية الوصول المتقدمة */}
          <div className="space-y-4 p-4 border rounded-lg">
            <h3 className="font-semibold flex items-center gap-2">
              <Eye className="w-4 h-4" />
              إمكانية الوصول المتقدمة
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">التباين العالي</p>
                  <p className="text-sm text-muted-foreground">ألوان أكثر وضوحاً ووضوح للنصوص</p>
                </div>
                <Switch
                  checked={highContrast}
                  onCheckedChange={setHighContrast}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">تصحيح الألوان</p>
                  <p className="text-sm text-muted-foreground">تحسين عرض الألوان لضعاف البصر</p>
                </div>
                <Switch
                  checked={colorCorrection}
                  onCheckedChange={setColorCorrection}
                />
              </div>
            </div>
          </div>

          {/* معاينة شاملة للإعدادات */}
          <div className="space-y-4 p-4 border rounded-lg bg-gradient-to-r from-secondary/10 to-primary/5">
            <h3 className="font-semibold">معاينة شاملة للإعدادات</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">ميزة تجريبية</p>
                    <p className="text-sm text-muted-foreground">اختبار الميزات الجديدة قبل إطلاقها</p>
                  </div>
                  <Switch
                    checked={experimentalTitle}
                    onCheckedChange={setExperimentalTitle}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button variant="default" size="sm">زر أساسي</Button>
                  <Button variant="secondary" size="sm">زر ثانوي</Button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <p className="text-sm font-medium">مثال على المحتوى</p>
                  <p className="text-xs text-muted-foreground">سيظهر هذا المحتوى بالألوان والإعدادات المختارة في جميع أنحاء التطبيق</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="text-xs">حالة نشطة</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                  <span className="text-xs">حالة تحذير</span>
                </div>
              </div>
            </div>
          </div>

          {/* أزرار الحفظ والإعدادات */}
          <div className="flex gap-4">
            <Button onClick={applyDisplaySettings} className="flex-1 gradient-primary">
              تطبيق إعدادات العرض
            </Button>
            <Button onClick={resetToDefault} variant="outline" className="flex-1">
              إعادة للافتراضي
            </Button>
            <Button onClick={() => onOpenChange(false)} variant="secondary" className="flex-1">
              إغلاق
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DeveloperSettingsDialog;