import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/use-toast';
import { useTheme } from '@/contexts/ThemeContext';
import { Palette, Monitor, Sun, Moon, Smartphone } from 'lucide-react';

const DeveloperSettingsDialog = ({ open, onOpenChange }) => {
  const { theme, setTheme } = useTheme();
  const [currentColorScheme, setCurrentColorScheme] = useState('blue');
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

  const resetToDefault = () => {
    const root = document.documentElement;
    root.style.setProperty('--primary', '221 83% 53%'); // اللون الأزرق الافتراضي
    root.style.setProperty('--primary-foreground', '0 0% 98%');
    setCurrentColorScheme('blue');
    
    toast({
      title: "تم الإعادة للافتراضي",
      description: "تم إرجاع الألوان للإعدادات الافتراضية"
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5" />
            إعدادات المطور
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

          {/* معاينة */}
          <div className="space-y-4 p-4 border rounded-lg">
            <h3 className="font-semibold">معاينة الإعدادات</h3>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">عنوان تجريبي</p>
                <p className="text-sm text-muted-foreground">هذا نص تجريبي لمعاينة الإعدادات المطبقة. يمكنك رؤية كيف ستندو الألوان والمظهر في التطبيق.</p>
              </div>
              <Switch
                checked={experimentalTitle}
                onCheckedChange={setExperimentalTitle}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Button variant="default">زر أساسي</Button>
              <Button variant="secondary">زر ثانوي</Button>
            </div>

            <div className="p-3 bg-primary/10 rounded-lg">
              <p className="text-sm">مثال على التطبيق: سيظهر هذا المحتوى بالألوان المختارة</p>
            </div>
          </div>

          {/* إعادة تعيين */}
          <div className="flex gap-4">
            <Button onClick={resetToDefault} variant="outline" className="flex-1">
              إعادة للافتراضي
            </Button>
            <Button onClick={() => onOpenChange(false)} className="flex-1">
              تطبيق الإعدادات
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DeveloperSettingsDialog;