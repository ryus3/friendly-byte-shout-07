import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';

const THEMES = [
  { id: 'modern', name: 'عصري', description: 'تصميم نظيف وبسيط' },
  { id: 'luxury', name: 'فاخر', description: 'تصميم أنيق ومميز' },
  { id: 'minimal', name: 'بسيط', description: 'تصميم بسيط وواضح' },
  { id: 'vibrant', name: 'حيوي', description: 'تصميم ملون ونابض' }
];

const ThemeCustomizer = ({ theme, primaryColor, accentColor, onChange }) => {
  return (
    <div className="space-y-6">
      <div>
        <Label>القالب</Label>
        <Select value={theme} onValueChange={(value) => onChange({ theme: value })}>
          <SelectTrigger className="mt-2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {THEMES.map(t => (
              <SelectItem key={t.id} value={t.id}>
                <div>
                  <div className="font-medium">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.description}</div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="primary_color">اللون الأساسي</Label>
          <div className="flex gap-2 mt-2">
            <input
              type="color"
              id="primary_color"
              value={primaryColor || '#2563eb'}
              onChange={(e) => onChange({ primary_color: e.target.value })}
              className="h-10 w-20 rounded border cursor-pointer"
            />
            <input
              type="text"
              value={primaryColor || '#2563eb'}
              onChange={(e) => onChange({ primary_color: e.target.value })}
              className="flex-1 px-3 py-2 border rounded text-sm"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="accent_color">اللون الثانوي</Label>
          <div className="flex gap-2 mt-2">
            <input
              type="color"
              id="accent_color"
              value={accentColor || '#f59e0b'}
              onChange={(e) => onChange({ accent_color: e.target.value })}
              className="h-10 w-20 rounded border cursor-pointer"
            />
            <input
              type="text"
              value={accentColor || '#f59e0b'}
              onChange={(e) => onChange({ accent_color: e.target.value })}
              className="flex-1 px-3 py-2 border rounded text-sm"
            />
          </div>
        </div>
      </div>

      {/* معاينة الألوان */}
      <Card className="p-4">
        <p className="text-sm font-medium mb-3">معاينة</p>
        <div className="space-y-2">
          <div 
            className="h-12 rounded flex items-center justify-center text-white font-medium"
            style={{ backgroundColor: primaryColor || '#2563eb' }}
          >
            اللون الأساسي
          </div>
          <div 
            className="h-12 rounded flex items-center justify-center text-white font-medium"
            style={{ backgroundColor: accentColor || '#f59e0b' }}
          >
            اللون الثانوي
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ThemeCustomizer;
