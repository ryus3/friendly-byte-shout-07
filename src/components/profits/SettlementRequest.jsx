import React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, DollarSign } from 'lucide-react';

const SettlementRequest = ({
  canRequestSettlement,
  isRequesting,
  selectedOrdersCount,
  onRequest,
}) => {
  if (!canRequestSettlement) return null;

  return (
    <div className="p-4 border rounded-lg mb-4 flex flex-col sm:flex-row items-center justify-between gap-2">
      <p className="text-sm font-medium">حدد الطلبات التي تريد المحاسبة عليها:</p>
      <Button onClick={onRequest} disabled={isRequesting || selectedOrdersCount === 0}>
        {isRequesting ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <DollarSign className="w-4 h-4 ml-2" />}
        طلب محاسبة ({selectedOrdersCount})
      </Button>
    </div>
  );
};

export default SettlementRequest;