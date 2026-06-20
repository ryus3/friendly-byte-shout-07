import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from '@/hooks/use-toast';
import { Trash2, Plus, Lock, Loader2 } from 'lucide-react';

/**
 * نافذة إدارة حجز كميات المنتجات للموظفين
 * - المدير العام يستطيع الحجز لأي موظف
 * - مالك المنتج يستطيع الحجز لأي موظف لكن في منتجاته فقط
 */
const EmployeeReservationsDialog = ({ open, onOpenChange, defaultEmployeeId = null }) => {
  const { products } = useInventory();
  const { user, allUsers } = useAuth();
  const { isAdmin } = usePermissions();

  const uid = user?.user_id || user?.id;

  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // النموذج
  const [employeeId, setEmployeeId] = useState(defaultEmployeeId || '');
  const [productId, setProductId] = useState('');
  const [variantId, setVariantId] = useState('');
  const [quantity, setQuantity] = useState(1);

  const employees = useMemo(() => (allUsers || []).filter(u => u.status === 'active'), [allUsers]);

  // المنتجات المتاحة للحجز: للمدير العام كل المنتجات، للمالك منتجاته فقط
  const ownedProducts = useMemo(() => {
    if (!Array.isArray(products)) return [];
    if (isAdmin) return products;
    return products.filter(p => p.owner_user_id === uid);
  }, [products, isAdmin, uid]);

  const selectedProduct = useMemo(() => ownedProducts.find(p => p.id === productId), [ownedProducts, productId]);
  const variants = useMemo(() => selectedProduct?.variants || selectedProduct?.product_variants || [], [selectedProduct]);
  const selectedVariant = useMemo(() => variants.find(v => v.id === variantId), [variants, variantId]);

  const fetchReservations = async () => {
    setLoading(true);
    try {
      let q = supabase
        .from('employee_product_reservations')
        .select('*, products(name, owner_user_id), product_variants(colors(name), sizes(name))')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      const { data, error } = await q;
      if (error) throw error;
      setReservations(data || []);
    } catch (e) {
      toast({ title: 'فشل تحميل الحجوزات', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) fetchReservations();
  }, [open]);

  useEffect(() => {
    if (defaultEmployeeId) setEmployeeId(defaultEmployeeId);
  }, [defaultEmployeeId]);

  const handleAdd = async () => {
    if (!employeeId || !productId || !variantId || quantity < 1) {
      toast({ title: 'بيانات ناقصة', description: 'اختر الموظف والمنتج والقياس والكمية', variant: 'destructive' });
      return;
    }
    const variant = variants.find(v => v.id === variantId);
    const available = Math.max(0, (variant?.quantity || 0) - (variant?.reserved_quantity || 0));
    if (quantity > available) {
      toast({ title: 'الكمية غير متاحة في المخزون', description: `المتاح: ${available}`, variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('employee_product_reservations')
        .upsert({
          employee_id: employeeId,
          product_id: productId,
          variant_id: variantId,
          reserved_quantity: Number(quantity),
          created_by: uid,
          owner_user_id: selectedProduct?.owner_user_id || null,
          is_active: true,
        }, { onConflict: 'employee_id,variant_id' });
      if (error) throw error;
      toast({ title: 'تم الحجز بنجاح', variant: 'success' });
      setProductId(''); setVariantId(''); setQuantity(1);
      fetchReservations();
    } catch (e) {
      toast({ title: 'فشل الحجز', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const handleRelease = async (id) => {
    try {
      const { error } = await supabase
        .from('employee_product_reservations')
        .update({ is_active: false })
        .eq('id', id);
      if (error) throw error;
      toast({ title: 'تم تحرير الحجز', variant: 'success' });
      fetchReservations();
    } catch (e) {
      toast({ title: 'فشل التحرير', description: e.message, variant: 'destructive' });
    }
  };

  const employeeName = (id) => employees.find(e => (e.user_id || e.id) === id)?.full_name || 'موظف';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary" />
            حجز كميات للموظفين
          </DialogTitle>
          <DialogDescription>
            خصّص كميات محددة من منتجاتك/متغيراتها لموظف معين. لن يتمكن غيره من بيعها.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 p-3 rounded-lg border bg-muted/30">
          <Select value={employeeId} onValueChange={setEmployeeId}>
            <SelectTrigger><SelectValue placeholder="الموظف" /></SelectTrigger>
            <SelectContent>
              {employees.map(e => (
                <SelectItem key={e.user_id || e.id} value={e.user_id || e.id}>{e.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={productId} onValueChange={(v) => { setProductId(v); setVariantId(''); }}>
            <SelectTrigger><SelectValue placeholder="المنتج" /></SelectTrigger>
            <SelectContent>
              {ownedProducts.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={variantId} onValueChange={setVariantId} disabled={!productId}>
            <SelectTrigger><SelectValue placeholder="اللون/القياس" /></SelectTrigger>
            <SelectContent>
              {variants.map(v => {
                const color = v.colors?.name || v.color || '-';
                const size = v.sizes?.name || v.size || '-';
                const stock = v.quantity || 0;
                const reserved = v.reserved_quantity || 0;
                return (
                  <SelectItem key={v.id} value={v.id}>
                    {color} - {size} (متاح: {Math.max(0, stock - reserved)})
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <Input
            type="number" min={1}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
            placeholder="الكمية"
          />
          <Button onClick={handleAdd} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 ml-1" />حجز</>}
          </Button>
        </div>

        <div className="flex-1 min-h-0 mt-2">
          <ScrollArea className="h-[55vh]">
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : reservations.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">لا توجد حجوزات نشطة</p>
            ) : (
              <div className="space-y-2">
                {reservations.map(r => {
                  const remaining = Math.max(0, (r.reserved_quantity || 0) - (r.sold_quantity || 0));
                  return (
                    <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate">{r.products?.name || 'منتج'}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.product_variants?.colors?.name || '-'} • {r.product_variants?.sizes?.name || '-'} • للموظف: <span className="font-medium text-foreground">{employeeName(r.employee_id)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-blue-500/10 text-blue-600">محجوز: {r.reserved_quantity}</Badge>
                        <Badge variant="outline" className="bg-orange-500/10 text-orange-600">مباع: {r.sold_quantity}</Badge>
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600">متبقي: {remaining}</Badge>
                        <Button size="icon" variant="ghost" onClick={() => handleRelease(r.id)} title="تحرير الحجز">
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EmployeeReservationsDialog;
