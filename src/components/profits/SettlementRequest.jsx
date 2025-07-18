import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { DollarSign, Calendar, FileText, Send, Clock, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { supabase } from '@/lib/customSupabaseClient';

const SettlementRequest = ({ 
  profits, 
  onRequestCreated,
  canRequestSettlement = true,
  className 
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState('');

  // حساب إجمالي الأرباح المعلقة
  const pendingProfits = (profits || []).filter(p => p.status === 'pending');
  const totalPendingAmount = pendingProfits.reduce((sum, p) => sum + (p.employee_profit || 0), 0);

  // طلب تحاسب جديد
  const createSettlementRequest = async () => {
    if (totalPendingAmount <= 0) {
      toast({
        title: "تحذير",
        description: "لا توجد أرباح معلقة للمطالبة بها",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // إنشاء طلب التحاسب
      const { data: settlement, error: settlementError } = await supabase
        .from('settlement_requests')
        .insert({
          employee_id: user.user_id,
          total_amount: totalPendingAmount,
          requested_amount: totalPendingAmount,
          order_ids: pendingProfits.map(p => p.order_id),
          notes: notes.trim() || null,
          request_details: {
            profits_count: pendingProfits.length,
            orders_count: pendingProfits.length,
            created_at: new Date().toISOString()
          }
        })
        .select()
        .single();

      if (settlementError) throw settlementError;

      // إنشاء إشعار للمدير
      await supabase
        .from('notifications')
        .insert({
          title: 'طلب تحاسب جديد',
          message: `طلب تحاسب من ${user.full_name || user.username} بمبلغ ${totalPendingAmount.toLocaleString()} د.ع`,
          type: 'settlement_request',
          priority: 'high',
          data: {
            settlement_id: settlement.id,
            employee_id: user.user_id,
            amount: totalPendingAmount
          },
          user_id: null // إشعار عام للمدراء
        });

      toast({
        title: "تم إرسال الطلب",
        description: `تم إرسال طلب التحاسب بمبلغ ${totalPendingAmount.toLocaleString()} د.ع بنجاح`,
      });

      setNotes('');
      if (onRequestCreated) onRequestCreated(settlement);
    } catch (error) {
      console.error('خطأ في إنشاء طلب التحاسب:', error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء إرسال طلب التحاسب",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (!canRequestSettlement) return null;

  return (
    <Card className={`border-dashed border-2 border-primary/30 bg-primary/5 ${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-primary">
          <DollarSign className="w-5 h-5" />
          طلب تحاسب الأرباح
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-950/30">
            <div className="text-2xl font-bold text-green-600">
              {totalPendingAmount.toLocaleString()}
            </div>
            <div className="text-sm text-muted-foreground">د.ع - الأرباح المعلقة</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30">
            <div className="text-2xl font-bold text-blue-600">
              {pendingProfits.length}
            </div>
            <div className="text-sm text-muted-foreground">طلب معلق</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-purple-50 dark:bg-purple-950/30">
            <div className="text-2xl font-bold text-purple-600">
              <Clock className="w-6 h-6 mx-auto" />
            </div>
            <div className="text-sm text-muted-foreground">في انتظار المراجعة</div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">ملاحظات إضافية (اختياري)</Label>
          <Textarea
            id="notes"
            placeholder="أضف أي ملاحظات أو تفاصيل إضافية..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-green-600 border-green-600">
              <Calendar className="w-3 h-3 mr-1" />
              {new Date().toLocaleDateString('ar')}
            </Badge>
            <Badge variant="outline">
              <FileText className="w-3 h-3 mr-1" />
              {pendingProfits.length} طلب
            </Badge>
          </div>
          
          <Button 
            onClick={createSettlementRequest}
            disabled={loading || totalPendingAmount <= 0}
            className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
          >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            <Send className="w-4 h-4 mr-2" />
            إرسال طلب التحاسب
          </Button>
        </div>

        {totalPendingAmount <= 0 && (
          <div className="text-center p-4 text-muted-foreground border border-dashed border-muted-foreground/30 rounded-lg">
            لا توجد أرباح معلقة للمطالبة بها حالياً
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SettlementRequest;