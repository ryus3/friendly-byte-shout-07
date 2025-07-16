import React, { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { DollarSign, Receipt, FileText } from 'lucide-react';

const EmployeeSettlementDialog = ({ open, onOpenChange, pendingProfits }) => {
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmitRequest = async () => {
    try {
      setLoading(true);

      // إنشاء طلب تحاسب جديد
      const { error } = await supabase
        .from('settlement_requests')
        .insert({
          total_amount: pendingProfits,
          requested_amount: pendingProfits,
          notes: notes.trim() || null,
          request_details: {
            type: 'employee_request',
            created_via: 'dashboard',
            timestamp: new Date().toISOString()
          }
        });

      if (error) throw error;

      toast({
        title: 'تم إرسال طلب التحاسب',
        description: 'سيتم مراجعة طلبك والرد عليك قريباً',
      });

      onOpenChange(false);
      setNotes('');
    } catch (error) {
      console.error('خطأ في إرسال طلب التحاسب:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ في إرسال طلب التحاسب. حاول مرة أخرى.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md mx-4">
        <DialogHeader>
          <DialogTitle className="flex items-center text-lg">
            <Receipt className="ml-2 h-5 w-5 text-primary" />
            طلب تحاسب الأرباح
          </DialogTitle>
          <DialogDescription className="text-right">
            اطلب تحاسب أرباحك المعلقة من الإدارة
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* مبلغ الأرباح المعلقة */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">الأرباح المعلقة:</span>
              <Badge variant="default" className="text-base px-3 py-1">
                <DollarSign className="ml-1 h-4 w-4" />
                {pendingProfits?.toLocaleString() || 0} د.ع
              </Badge>
            </div>
          </div>

          {/* ملاحظات اختيارية */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="flex items-center">
              <FileText className="ml-1 h-4 w-4" />
              ملاحظات (اختياري)
            </Label>
            <Textarea
              id="notes"
              placeholder="أي ملاحظات أو تفاصيل إضافية..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[80px] resize-none"
              maxLength={500}
            />
            <div className="text-xs text-muted-foreground text-left">
              {notes.length}/500 حرف
            </div>
          </div>

          {/* معلومات إضافية */}
          <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
            <p className="mb-1">• سيتم مراجعة طلبك من قبل الإدارة</p>
            <p className="mb-1">• ستحصل على إشعار عند الموافقة أو الرفض</p>
            <p>• يمكنك متابعة حالة الطلب من صفحة الأرباح</p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            إلغاء
          </Button>
          <Button 
            onClick={handleSubmitRequest}
            disabled={loading || !pendingProfits || pendingProfits <= 0}
            className="w-full sm:w-auto"
          >
            {loading ? 'جاري الإرسال...' : 'إرسال طلب التحاسب'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EmployeeSettlementDialog;