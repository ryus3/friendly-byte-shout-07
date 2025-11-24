import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

const ColorGradientPicker = ({ label, value, onChange }) => {
  return (
    <div className="space-y-3">
      <Label className="text-lg font-semibold">{label}</Label>
      
      <div className="flex items-center gap-4">
        <div className="relative">
          <Input
            type="color"
            value={value || '#8B5CF6'}
            onChange={(e) => onChange(e.target.value)}
            className="w-24 h-24 rounded-xl cursor-pointer border-4 shadow-lg"
          />
        </div>
        
        <div className="flex-1">
          <Input
            type="text"
            value={value || '#8B5CF6'}
            onChange={(e) => onChange(e.target.value)}
            placeholder="#8B5CF6"
            className="font-mono"
          />
          <div 
            className="mt-2 h-12 rounded-lg shadow-inner"
            style={{ background: value || '#8B5CF6' }}
          />
        </div>
      </div>
    </div>
  );
};

export default ColorGradientPicker;
