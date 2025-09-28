import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { BarChart3, TrendingUp, Clock, Zap } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

export const AiUsageStats = ({ usage = {} }) => {
  const models = [
    { id: 'gemini-2.5-flash', name: 'Flash 2.5', limit: 1500, color: 'bg-green-500' },
    { id: 'gemini-2.5-flash-lite', name: 'Flash Lite', limit: 1500, color: 'bg-blue-500' },
    { id: 'gemini-1.5-flash', name: 'Flash 1.5', limit: 1500, color: 'bg-yellow-500' },
    { id: 'gemini-2.5-pro', name: 'Pro 2.5', limit: 50, color: 'bg-purple-500' },
    { id: 'gemini-1.5-pro', name: 'Pro 1.5', limit: 50, color: 'bg-red-500' },
    { id: 'gemini-2.0-flash', name: 'Flash 2.0', limit: 50, color: 'bg-indigo-500' }
  ];

  const getTotalUsage = () => {
    return Object.values(usage).reduce((total, modelUsage) => total + (modelUsage?.daily || 0), 0);
  };

  const getTotalLimit = () => {
    return models.reduce((total, model) => total + model.limit, 0);
  };

  const getUsagePercentage = (modelId) => {
    const modelUsage = usage[modelId];
    const model = models.find(m => m.id === modelId);
    if (!modelUsage || !model) return 0;
    return Math.round((modelUsage.daily / model.limit) * 100);
  };

  const getOverallUsagePercentage = () => {
    const total = getTotalUsage();
    const limit = getTotalLimit();
    return Math.round((total / limit) * 100);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 px-3">
          <BarChart3 className="w-4 h-4 mr-2" />
          <span className="text-sm font-medium">{getTotalUsage()}</span>
          <span className="text-xs text-muted-foreground mx-1">/</span>
          <span className="text-xs text-muted-foreground">{getTotalLimit()}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="end">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h4 className="font-semibold">إحصائيات الاستخدام اليومي</h4>
          </div>

          {/* إجمالي الاستخدام */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">الاستخدام الإجمالي</span>
                <Badge variant={getOverallUsagePercentage() > 80 ? 'destructive' : 'secondary'}>
                  {getOverallUsagePercentage()}%
                </Badge>
              </div>
              <Progress value={getOverallUsagePercentage()} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>{getTotalUsage()} مستخدم</span>
                <span>{getTotalLimit()} الحد الأقصى</span>
              </div>
            </CardContent>
          </Card>

          {/* تفاصيل النماذج */}
          <div className="space-y-3">
            <h5 className="text-sm font-medium text-muted-foreground">تفاصيل النماذج</h5>
            {models.map((model) => {
              const modelUsage = usage[model.id];
              const used = modelUsage?.daily || 0;
              const percentage = getUsagePercentage(model.id);
              
              return (
                <div key={model.id} className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${model.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium truncate">{model.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {used}/{model.limit}
                      </span>
                    </div>
                    <Progress value={percentage} className="h-1.5" />
                  </div>
                  <Badge 
                    variant={percentage > 90 ? 'destructive' : percentage > 70 ? 'secondary' : 'outline'}
                    className="text-xs px-1.5 py-0.5"
                  >
                    {percentage}%
                  </Badge>
                </div>
              );
            })}
          </div>

          {/* معلومات إضافية */}
          <div className="border-t pt-3 space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>يتم تجديد الكوتة يومياً في منتصف الليل (PST)</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Zap className="w-4 h-4" />
              <span>التحويل التلقائي عند امتلاء النموذج</span>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};