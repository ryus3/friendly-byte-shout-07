import React from 'react';
import { Card } from '@/components/ui/card';
import { Check } from 'lucide-react';

const ThemeCard = ({ name, description, gradient, preview, selected, onClick }) => {
  return (
    <Card 
      className={`cursor-pointer transition-all duration-300 hover:scale-105 ${
        selected ? 'ring-4 ring-primary shadow-2xl' : 'hover:shadow-xl'
      }`}
      onClick={onClick}
    >
      <div className="relative aspect-video overflow-hidden rounded-t-xl">
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-90`} />
        {preview && <img src={preview} alt={name} className="w-full h-full object-cover mix-blend-overlay" />}
        
        {selected && (
          <div className="absolute top-2 left-2 bg-white rounded-full p-1 shadow-lg">
            <Check className="h-5 w-5 text-green-500" />
          </div>
        )}
      </div>
      
      <div className="p-4">
        <h3 className={`font-bold text-transparent bg-clip-text bg-gradient-to-r ${gradient} mb-1`}>
          {name}
        </h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </Card>
  );
};

export default ThemeCard;
