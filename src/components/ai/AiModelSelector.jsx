import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Zap, Brain, Cpu, Sparkles } from 'lucide-react';

const AI_MODELS = [
  {
    id: 'gemini-2.5-flash',
    name: 'Flash 2.5',
    description: 'الأسرع والأكثر كفاءة',
    icon: Zap,
    dailyLimit: 1500,
    priority: 1,
    color: 'bg-green-500'
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Flash Lite 2.5',
    description: 'نسخة مخففة سريعة',
    icon: Zap,
    dailyLimit: 1500,
    priority: 2,
    color: 'bg-blue-500'
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Flash 1.5',
    description: 'نسخة ثابتة ومجربة',
    icon: Cpu,
    dailyLimit: 1500,
    priority: 3,
    color: 'bg-yellow-500'
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Pro 2.5',
    description: 'للطلبات المعقدة',
    icon: Brain,
    dailyLimit: 50,
    priority: 4,
    color: 'bg-purple-500'
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Pro 1.5',
    description: 'نسخة احتياطية قوية',
    icon: Brain,
    dailyLimit: 50,
    priority: 5,
    color: 'bg-red-500'
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Flash 2.0',
    description: 'نسخة تجريبية',
    icon: Sparkles,
    dailyLimit: 50,
    priority: 6,
    color: 'bg-indigo-500'
  }
];

export const AiModelSelector = ({ currentModel, onModelChange }) => {
  const selectedModel = AI_MODELS.find(model => model.id === currentModel);

  return (
    <Select value={currentModel} onValueChange={onModelChange}>
      <SelectTrigger className="w-[200px] h-9">
        <SelectValue placeholder="اختر النموذج">
          {selectedModel && (
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${selectedModel.color}`} />
              <span className="text-sm font-medium">{selectedModel.name}</span>
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <div className="p-2">
          <h4 className="font-semibold text-sm mb-2 text-muted-foreground">نماذج الذكاء الاصطناعي</h4>
          {AI_MODELS.map((model) => {
            const Icon = model.icon;
            return (
              <SelectItem key={model.id} value={model.id} className="p-3">
                <div className="flex items-center gap-3 w-full">
                  <div className={`w-8 h-8 rounded-full ${model.color} flex items-center justify-center`}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{model.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {model.dailyLimit} يومياً
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {model.description}
                    </p>
                  </div>
                </div>
              </SelectItem>
            );
          })}
        </div>
      </SelectContent>
    </Select>
  );
};