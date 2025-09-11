import React from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Monitor, Sun, Moon } from 'lucide-react';

export const AppearanceDialog = ({ open, onOpenChange }) => {
  const { theme, setTheme } = useTheme();

  const themeOptions = [
    { key: 'light', label: 'فاتح', icon: Sun },
    { key: 'dark', label: 'داكن', icon: Moon },
    { key: 'system', label: 'النظام', icon: Monitor }
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>إعدادات المظهر</DialogTitle>
          <DialogDescription>
            اختر المظهر المفضل للتطبيق
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-3 py-4">
          {themeOptions.map(({ key, label, icon: Icon }) => (
            <Card 
              key={key}
              className={`p-4 cursor-pointer border-2 transition-all ${
                theme === key ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              }`}
              onClick={() => setTheme(key)}
            >
              <div className="flex items-center gap-3">
                <Icon className="h-5 w-5" />
                <span className="font-medium">{label}</span>
                {theme === key && (
                  <div className="ml-auto w-2 h-2 bg-primary rounded-full" />
                )}
              </div>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};