import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useAppStartSync } from '@/hooks/useAppStartSync';

/**
 * مؤشر التقدم العام للمزامنة الشاملة عند بدء التطبيق
 */
export const GlobalSyncProgress = () => {
  const { syncing, syncProgress } = useAppStartSync();

  if (!syncing) return null;

  const progressPercentage = syncProgress.total > 0 ? (syncProgress.current / syncProgress.total) * 100 : 0;

  return (
    <div className="fixed top-4 right-4 z-50 w-80">
      <Card className="border-primary/20 bg-background/95 backdrop-blur-sm shadow-lg">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <div className="flex-1">
              <h4 className="text-sm font-medium text-foreground">
                مزامنة شاملة جارية...
              </h4>
              <p className="text-xs text-muted-foreground mt-1">
                {syncProgress.status}
              </p>
            </div>
          </div>
          
          <div className="space-y-2">
            <Progress 
              value={progressPercentage} 
              className="h-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>المرحلة {syncProgress.current} من {syncProgress.total}</span>
              <span>{Math.round(progressPercentage)}%</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};