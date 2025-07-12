import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { 
  Sun, Moon, Monitor, Palette, Type, Zap, Eye, 
  RotateCcw, Check, Settings, Contrast, Volume2, Sparkles,
  Paintbrush, Grid, Layout, Download, Upload
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

const AppearanceDialog = ({ open, onOpenChange }) => {
  const { theme, setTheme } = useTheme();
  
  const [fontSize, setFontSize] = useState(16);
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  const [highContrast, setHighContrast] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [currentScheme, setCurrentScheme] = useState('blue');
  const [layoutDensity, setLayoutDensity] = useState('comfortable');
  const [borderRadius, setBorderRadius] = useState(8);

  const colorSchemes = [
    { 
      id: 'blue', 
      name: 'أزرق احترافي', 
      primary: '#3B82F6', 
      secondary: '#EFF6FF', 
      accent: '#1D4ED8',
      description: 'النمط الافتراضي المناسب للأعمال' 
    },
    { 
      id: 'green', 
      name: 'أخضر طبيعي', 
      primary: '#10B981', 
      secondary: '#ECFDF5', 
      accent: '#059669',
      description: 'مريح للعين ومناسب للاستخدام المطول' 
    },
    { 
      id: 'purple', 
      name: 'بنفسجي إبداعي', 
      primary: '#8B5CF6', 
      secondary: '#F3E8FF', 
      accent: '#7C3AED',
      description: 'جذاب وحديث للواجهات الإبداعية' 
    },
    { 
      id: 'orange', 
      name: 'برتقالي جريء', 
      primary: '#F97316', 
      secondary: '#FFF7ED', 
      accent: '#EA580C',
      description: 'نشيط ومحفز للإنتاجية' 
    },
    { 
      id: 'rose', 
      name: 'وردي دافئ', 
      primary: '#F43F5E', 
      secondary: '#FFF1F2', 
      accent: '#E11D48',
      description: 'دافئ وودود للتطبيقات الاجتماعية' 
    },
    { 
      id: 'slate', 
      name: 'رمادي أنيق', 
      primary: '#64748B', 
      secondary: '#F8FAFC', 
      accent: '#475569',
      description: 'كلاسيكي ومتوازن' 
    }
  ];

  const handleSchemeChange = (scheme) => {
    setCurrentScheme(scheme.id);
    
    // Apply color scheme to CSS variables
    const root = document.documentElement;
    root.style.setProperty('--color-primary', scheme.primary);
    root.style.setProperty('--color-primary-rgb', hexToRgb(scheme.primary));
    root.style.setProperty('--color-accent', scheme.accent);
    
    toast({
      title: "تم تطبيق النمط",
      description: `تم تفعيل ${scheme.name} بنجاح`,
      className: "bg-card border-primary/20"
    });
  };

  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? 
      `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : null;
  };

  const handleFontSizeChange = (value) => {
    const newSize = value[0];
    setFontSize(newSize);
    document.documentElement.style.fontSize = `${newSize}px`;
    
    toast({
      title: "تم تحديث حجم الخط",
      description: `تم تعيين حجم الخط إلى ${newSize}px`
    });
  };

  const handleAnimationToggle = (enabled) => {
    setAnimationsEnabled(enabled);
    if (enabled) {
      document.documentElement.style.setProperty('--animation-duration', '0.3s');
    } else {
      document.documentElement.style.setProperty('--animation-duration', '0s');
    }
    
    toast({
      title: enabled ? "تم تفعيل التأثيرات" : "تم إيقاف التأثيرات",
      description: enabled ? "التأثيرات المتحركة مفعلة" : "التأثيرات المتحركة معطلة"
    });
  };

  const handleHighContrastToggle = (enabled) => {
    setHighContrast(enabled);
    if (enabled) {
      document.documentElement.classList.add('high-contrast');
    } else {
      document.documentElement.classList.remove('high-contrast');
    }
    
    toast({
      title: enabled ? "تم تفعيل التباين العالي" : "تم إيقاف التباين العالي",
      description: enabled ? "تم تحسين التباين للرؤية الأفضل" : "تم إرجاع التباين للوضع العادي"
    });
  };

  const handleLayoutDensityChange = (density) => {
    setLayoutDensity(density);
    document.documentElement.setAttribute('data-density', density);
    
    toast({
      title: "تم تحديث كثافة التخطيط",
      description: `تم تعيين التخطيط إلى ${density === 'compact' ? 'مضغوط' : density === 'comfortable' ? 'مريح' : 'متباعد'}`
    });
  };

  const handleBorderRadiusChange = (value) => {
    const newRadius = value[0];
    setBorderRadius(newRadius);
    document.documentElement.style.setProperty('--radius', `${newRadius}px`);
    
    toast({
      title: "تم تحديث انحناء الحواف",
      description: `تم تعيين انحناء الحواف إلى ${newRadius}px`
    });
  };

  const resetToDefaults = () => {
    setTheme('system');
    setFontSize(16);
    setAnimationsEnabled(true);
    setHighContrast(false);
    setSoundEnabled(true);
    setReducedMotion(false);
    setCurrentScheme('blue');
    setLayoutDensity('comfortable');
    setBorderRadius(8);
    
    // Reset CSS variables
    document.documentElement.style.fontSize = '16px';
    document.documentElement.style.setProperty('--animation-duration', '0.3s');
    document.documentElement.classList.remove('high-contrast');
    document.documentElement.setAttribute('data-density', 'comfortable');
    document.documentElement.style.setProperty('--radius', '8px');
    
    toast({
      title: "تم إعادة التعيين",
      description: "تم استعادة جميع الإعدادات الافتراضية"
    });
  };

  const exportSettings = () => {
    const settings = {
      theme,
      fontSize,
      animationsEnabled,
      highContrast,
      soundEnabled,
      reducedMotion,
      currentScheme,
      layoutDensity,
      borderRadius
    };
    
    const dataStr = JSON.stringify(settings, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = 'ryus-appearance-settings.json';
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    toast({
      title: "تم تصدير الإعدادات",
      description: "تم حفظ إعدادات المظهر في ملف JSON"
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5" />
            إعدادات المظهر والثيم
          </DialogTitle>
          <DialogDescription>
            قم بتخصيص تجربة استخدامك للنظام وجعلها مناسبة لاحتياجاتك
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Theme Selection */}
          <div className="lg:col-span-2 space-y-6">
            {/* Theme Mode */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">نمط العرض</Label>
                <Button variant="outline" size="sm" onClick={resetToDefaults}>
                  <RotateCcw className="w-4 h-4 ml-1" />
                  إعادة تعيين
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 'light', label: 'فاتح', icon: Sun, desc: 'للنهار' },
                  { value: 'dark', label: 'داكن', icon: Moon, desc: 'مريح' },
                  { value: 'system', label: 'تلقائي', icon: Monitor, desc: 'حسب النظام' }
                ].map((themeOption) => {
                  const IconComponent = themeOption.icon;
                  return (
                    <div
                      key={themeOption.value}
                      className={`relative p-3 border-2 rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md ${
                        theme === themeOption.value 
                          ? 'border-primary bg-primary/5 shadow-md' 
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => setTheme(themeOption.value)}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <div className={`p-2 rounded-md ${theme === themeOption.value ? 'bg-primary text-white' : 'bg-secondary'}`}>
                          <IconComponent className="w-5 h-5" />
                        </div>
                        <div className="text-center">
                          <p className="font-medium text-sm">{themeOption.label}</p>
                          <p className="text-xs text-muted-foreground">{themeOption.desc}</p>
                        </div>
                      </div>
                      {theme === themeOption.value && (
                        <Check className="absolute top-2 right-2 w-4 h-4 text-primary" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* Color Schemes */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">أنماط الألوان</Label>
              <div className="grid grid-cols-2 gap-3">
                {colorSchemes.map((scheme) => (
                  <div
                    key={scheme.id}
                    className={`relative p-3 border-2 rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md ${
                      currentScheme === scheme.id 
                        ? 'border-primary bg-primary/5 shadow-md' 
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => handleSchemeChange(scheme)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1">
                        <div 
                          className="w-4 h-4 rounded-full border border-white shadow-sm"
                          style={{ backgroundColor: scheme.primary }}
                        ></div>
                        <div 
                          className="w-4 h-4 rounded-full border border-white shadow-sm"
                          style={{ backgroundColor: scheme.secondary }}
                        ></div>
                        <div 
                          className="w-4 h-4 rounded-full border border-white shadow-sm"
                          style={{ backgroundColor: scheme.accent }}
                        ></div>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{scheme.name}</p>
                        <p className="text-xs text-muted-foreground">{scheme.description}</p>
                      </div>
                    </div>
                    {currentScheme === scheme.id && (
                      <Check className="absolute top-2 right-2 w-4 h-4 text-primary" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Layout Settings */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">إعدادات التخطيط</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>كثافة التخطيط</Label>
                  <Select value={layoutDensity} onValueChange={handleLayoutDensityChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="compact">مضغوط</SelectItem>
                      <SelectItem value="comfortable">مريح</SelectItem>
                      <SelectItem value="spacious">متباعد</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>انحناء الحواف: {borderRadius}px</Label>
                  <Slider
                    value={[borderRadius]}
                    onValueChange={handleBorderRadiusChange}
                    max={20}
                    min={0}
                    step={1}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Settings Panel */}
          <div className="space-y-4">
            {/* Typography */}
            <div className="space-y-3">
              <Label className="text-base font-semibold flex items-center gap-2">
                <Type className="w-4 h-4" />
                الخطوط والنصوص
              </Label>
              <div className="space-y-3">
                <Label className="text-sm">حجم الخط الأساسي: {fontSize}px</Label>
                <Slider
                  value={[fontSize]}
                  onValueChange={handleFontSizeChange}
                  max={24}
                  min={12}
                  step={1}
                  className="w-full"
                />
                <div className="p-3 bg-secondary/30 rounded-lg border">
                  <p style={{ fontSize: `${fontSize}px` }}>نموذج للنص بالحجم المحدد</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Accessibility */}
            <div className="space-y-4">
              <Label className="text-base font-semibold flex items-center gap-2">
                <Eye className="w-4 h-4" />
                إعدادات الوصول
              </Label>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">التأثيرات المتحركة</Label>
                    <p className="text-xs text-muted-foreground">تحريك العناصر والانتقالات</p>
                  </div>
                  <Switch
                    checked={animationsEnabled}
                    onCheckedChange={handleAnimationToggle}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">التباين العالي</Label>
                    <p className="text-xs text-muted-foreground">تحسين الرؤية والوضوح</p>
                  </div>
                  <Switch
                    checked={highContrast}
                    onCheckedChange={handleHighContrastToggle}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">الأصوات التفاعلية</Label>
                    <p className="text-xs text-muted-foreground">أصوات للإشعارات</p>
                  </div>
                  <Switch
                    checked={soundEnabled}
                    onCheckedChange={setSoundEnabled}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">تقليل الحركة</Label>
                    <p className="text-xs text-muted-foreground">للحساسية للحركة</p>
                  </div>
                  <Switch
                    checked={reducedMotion}
                    onCheckedChange={setReducedMotion}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Preview & Export */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">معاينة وتصدير</Label>
              
              <div className="space-y-3">
                <div className="p-3 bg-primary text-primary-foreground rounded-lg">
                  <p className="text-sm font-medium">عنصر أساسي</p>
                </div>
                <div className="p-3 bg-secondary text-secondary-foreground rounded-lg">
                  <p className="text-sm">عنصر ثانوي</p>
                </div>
                <div className="p-3 border rounded-lg">
                  <p className="text-sm text-muted-foreground">نص توضيحي</p>
                </div>
                <div className="flex gap-2">
                  <Badge variant="default">تسمية</Badge>
                  <Badge variant="outline">تسمية فرعية</Badge>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={exportSettings} className="flex-1">
                  <Download className="w-4 h-4 ml-1" />
                  تصدير
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  <Upload className="w-4 h-4 ml-1" />
                  استيراد
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button onClick={() => {
            toast({ 
              title: "تم الحفظ", 
              description: "تم حفظ جميع إعدادات المظهر بنجاح" 
            });
            onOpenChange(false);
          }}>
            حفظ التغييرات
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AppearanceDialog;