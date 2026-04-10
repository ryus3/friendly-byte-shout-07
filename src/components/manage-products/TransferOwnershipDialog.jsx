import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { ArrowRightLeft, AlertTriangle } from 'lucide-react';

const TransferOwnershipDialog = ({ open, onOpenChange, selectedProducts, onTransferComplete }) => {
  const { user } = useAuth();
  const [targetUserId, setTargetUserId] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const fetchUsers = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('user_id, full_name, employee_code, email')
        .order('full_name');
      if (data) setUsers(data);
    };
    fetchUsers();
  }, [open]);

  const handleTransfer = async () => {
    if (!targetUserId || selectedProducts.length === 0) return;
    setLoading(true);
    try {
      const productIds = selectedProducts.map(p => p.id);
      const { error } = await supabase
        .from('products')
        .update({ 
          owner_user_id: targetUserId === 'system' ? null : targetUserId,
          ownership_transferred_at: new Date().toISOString()
        })
        .in('id', productIds);

      if (error) throw error;

      const targetName = targetUserId === 'system' 
        ? 'النظام' 
        : users.find(u => u.user_id === targetUserId)?.full_name || 'مستخدم';

      toast({
        title: 'تم نقل الملكية ✅',
        description: `تم نقل ${productIds.length} منتج إلى ${targetName}. الحسابات المالية تبدأ من تاريخ النقل.`
      });

      onTransferComplete?.();
      onOpenChange(false);
      setTargetUserId('');
    } catch (error) {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5" />
            نقل ملكية المنتجات
          </DialogTitle>
          <DialogDescription>
            نقل الملكية المالية للمنتجات المحددة. الحسابات تبدأ من تاريخ النقل.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="mb-2 block">المنتجات المحددة ({selectedProducts.length})</Label>
            <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
              {selectedProducts.map(p => (
                <Badge key={p.id} variant="secondary" className="text-xs">{p.name}</Badge>
              ))}
            </div>
          </div>

          <div>
            <Label className="mb-2 block">المالك الجديد</Label>
            <Select value={targetUserId} onValueChange={setTargetUserId}>
              <SelectTrigger>
                <SelectValue placeholder="اختر المالك الجديد" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">🏢 النظام (بدون مالك)</SelectItem>
                {users.map(u => (
                  <SelectItem key={u.user_id} value={u.user_id}>
                    {u.full_name || u.email} {u.employee_code ? `(${u.employee_code})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-sm text-amber-800 dark:text-amber-300">
                <p className="font-semibold">ملاحظة مهمة:</p>
                <p>الإيرادات والأرباح ستُحسب للمالك الجديد من تاريخ النقل فقط. الحسابات السابقة تبقى كما هي.</p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={handleTransfer} disabled={!targetUserId || loading}>
            {loading ? 'جاري النقل...' : 'نقل الملكية'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TransferOwnershipDialog;
