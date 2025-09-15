import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bot, MessageSquare, Eye } from 'lucide-react';
import { useSuper } from '@/contexts/SuperProvider';
import AiOrdersManager from './AiOrdersManager';

const SimpleAiOrdersCard = () => {
  const { aiOrders = [], loading } = useSuper();
  const [showManager, setShowManager] = useState(false);

  const pendingCount = aiOrders.filter(order => order.status === 'pending').length;
  const totalCount = aiOrders.length;

  return (
    <>
      <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setShowManager(true)}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4" />
              طلبات الذكاء الاصطناعي
            </div>
            {pendingCount > 0 && (
              <Badge variant="destructive" className="animate-pulse">
                {pendingCount}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="animate-pulse">
              <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-muted rounded w-1/2"></div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">المجموع</span>
                <span className="font-semibold">{totalCount}</span>
              </div>
              
              {pendingCount > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">في الانتظار</span>
                  <Badge variant="secondary">{pendingCount}</Badge>
                </div>
              )}
              
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full mt-3"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowManager(true);
                }}
              >
                <Eye className="h-4 w-4 mr-2" />
                عرض الطلبات
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {showManager && (
        <AiOrdersManager 
          open={showManager} 
          onClose={() => setShowManager(false)} 
        />
      )}
    </>
  );
};

export default SimpleAiOrdersCard;