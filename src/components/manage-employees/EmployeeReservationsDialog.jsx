import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useSupervisedEmployees } from '@/hooks/useSupervisedEmployees';
import { toast } from '@/hooks/use-toast';
import {
  Trash2, Plus, Minus, Lock, Loader2, ChevronDown, Check, Users, Package as PackageIcon, Palette, Ruler, Sparkles, X,
} from 'lucide-react';


/**
 * نافذة حجز كميات للموظفين — تصميم زجاجي احترافي مع تحديد متعدد
 * - يستطيع المدير العام أو مالك المنتج إنشاء حجوزات
 * - يدعم اختيار عدة موظفين، عدة منتجات، عدة (لون × قياس) دفعة واحدة
 */
const EmployeeReservationsDialog = ({ open, onOpenChange, defaultEmployeeId = null }) => {
  const { products } = useInventory();
  const { user, allUsers } = useAuth();
  const { isAdmin, isDepartmentManager, hasPermission } = usePermissions();
  const { supervisedEmployeeIds = [] } = useSupervisedEmployees();

  const uid = user?.user_id || user?.id;
  const uidStr = uid ? String(uid) : null;
  const isOwnerOfAny = useMemo(
    () => Array.isArray(products) && !!uidStr && products.some(p => p?.owner_user_id && String(p.owner_user_id) === uidStr),
    [products, uidStr]
  );
  // ✅ فقط المدير العام يرى كل الموظفين/المنتجات/الحجوزات.
  // مدير القسم أو مالك المنتج يرى فقط نطاقه (منتجاته + موظفيه المباشرين).
  const canManageAll = isAdmin;

  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // ✅ متعدد الاختيار
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState(defaultEmployeeId ? [defaultEmployeeId] : []);
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  // variantQuantities: { [variantId]: qty }
  const [variantQuantities, setVariantQuantities] = useState({});
  const [searchProduct, setSearchProduct] = useState('');

  // قائمة الموظفين المرشّحة:
  //  - المدير/مدير القسم/صاحب صلاحية manage_employees → كل النشطين
  //  - المالك العادي → موظفوه (المُشرَف عليهم) فقط
  const employees = useMemo(() => {
    const active = (allUsers || []).filter(u => u && u.status === 'active' && String(u.user_id || u.id) !== uidStr);
    if (canManageAll || (hasPermission && hasPermission('manage_employees'))) return active;
    const ids = new Set((supervisedEmployeeIds || []).map(String));
    return active.filter(e => ids.has(String(e.user_id || e.id)));
  }, [allUsers, canManageAll, hasPermission, supervisedEmployeeIds, uidStr]);

  // المنتجات: المدير يرى الكل، المالك يرى منتجاته فقط
  const ownedProducts = useMemo(() => {
    if (!Array.isArray(products)) return [];
    const list = canManageAll
      ? products
      : products.filter(p => p?.owner_user_id && String(p.owner_user_id) === uidStr);
    if (!searchProduct.trim()) return list;
    const q = searchProduct.trim().toLowerCase();
    return list.filter(p => (p.name || '').toLowerCase().includes(q));
  }, [products, canManageAll, uidStr, searchProduct]);

  const selectedProducts = useMemo(
    () => ownedProducts.filter(p => selectedProductIds.includes(p.id)),
    [ownedProducts, selectedProductIds]
  );

  // كل المتغيرات للمنتجات المختارة
  const allVariants = useMemo(() => {
    const out = [];
    selectedProducts.forEach(p => {
      const vs = p.variants || p.product_variants || [];
      vs.forEach(v => out.push({ ...v, _product: p }));
    });
    return out;
  }, [selectedProducts]);

  // الحجوزات النشطة: المدير يرى الكل، المالك يرى الحجوزات على منتجاته فقط
  const ownedProductIds = useMemo(() => {
    if (canManageAll) return null; // null = no filter
    if (!Array.isArray(products) || !uidStr) return [];
    return products
      .filter(p => p?.owner_user_id && String(p.owner_user_id) === uidStr)
      .map(p => p.id);
  }, [products, canManageAll, uidStr]);

  const fetchReservations = async () => {
    setLoading(true);
    try {
      let q = supabase
        .from('employee_product_reservations')
        .select('*, products(name, owner_user_id), product_variants(colors(name), sizes(name))')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (ownedProductIds && ownedProductIds.length > 0) {
        q = q.in('product_id', ownedProductIds);
      } else if (ownedProductIds && ownedProductIds.length === 0) {
        setReservations([]);
        setLoading(false);
        return;
      }
      const { data, error } = await q;
      if (error) throw error;
      // فلترة دفاعية إضافية على جهة العميل (في حال السجلات قديمة بدون product_id)
      const filtered = (data || []).filter(r => {
        if (canManageAll) return true;
        const ownerId = r.products?.owner_user_id;
        return ownerId && String(ownerId) === uidStr;
      });
      setReservations(filtered);
    } catch (e) {
      toast({ title: 'فشل تحميل الحجوزات', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (open) fetchReservations(); }, [open]);
  useEffect(() => { if (defaultEmployeeId) setSelectedEmployeeIds([defaultEmployeeId]); }, [defaultEmployeeId]);

  const toggleEmployee = (id) => setSelectedEmployeeIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleProduct = (id) => setSelectedProductIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const setVariantQty = (vid, qty) => setVariantQuantities(prev => ({ ...prev, [vid]: Math.max(0, Number(qty) || 0) }));

  const totalCombinations = useMemo(() => {
    const vCount = Object.values(variantQuantities).filter(q => q > 0).length;
    return selectedEmployeeIds.length * vCount;
  }, [selectedEmployeeIds.length, variantQuantities]);

  const handleBulkReserve = async () => {
    if (selectedEmployeeIds.length === 0) {
      toast({ title: 'لم تختر موظفين', variant: 'destructive' });
      return;
    }
    const variantEntries = Object.entries(variantQuantities).filter(([, q]) => q > 0);
    if (variantEntries.length === 0) {
      toast({ title: 'لم تحدد كميات', description: 'اختر متغيرات وحدد كميات أكبر من صفر', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      let createdCount = 0;
      for (const empId of selectedEmployeeIds) {
        for (const [variantId, qty] of variantEntries) {
          const variant = allVariants.find(v => v.id === variantId);
          if (!variant) continue;
          const available = Math.max(0, (variant.quantity || 0) - (variant.reserved_quantity || 0));
          if (qty > available) {
            toast({ title: `الكمية غير متاحة (${variant._product?.name})`, description: `المتاح: ${available}`, variant: 'destructive' });
            setSaving(false);
            return;
          }
          // RPC آمن: يحفظ sold_quantity الموجود ولا يصفّره عند إعادة الحجز
          const { error } = await supabase.rpc('upsert_employee_reservation', {
            p_employee_id: empId,
            p_product_id: variant.product_id || variant._product?.id,
            p_variant_id: variantId,
            p_reserved_quantity: Number(qty),
            p_created_by: uid,
            p_owner_user_id: variant._product?.owner_user_id || null,
            p_notes: null,
          });
          if (error) throw error;
          createdCount += 1;
        }
      }
      toast({ title: `تم حفظ ${createdCount} حجز بنجاح`, variant: 'success' });
      setSelectedProductIds([]);
      setVariantQuantities({});
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

  const employeeName = (id) => (allUsers || []).find(e => (e.user_id || e.id) === id)?.full_name || 'موظف';
  const variantLabel = (v) => `${v.colors?.name || v.color || '-'} • ${v.sizes?.name || v.size || '-'}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden border border-border bg-background shadow-2xl rounded-2xl"
        dir="rtl"
      >
        <div className="relative flex flex-col max-h-[92vh]">
          {/* رأس بتدرج وردي/بنفسجي مطابق لنافذة تقرير أرباح الفواتير */}
          <DialogHeader className="relative px-6 pt-5 pb-4 border-b border-fuchsia-500/20 bg-gradient-to-l from-pink-500/15 via-fuchsia-500/10 to-purple-600/15">
            <div className="absolute -top-16 -left-16 w-48 h-48 rounded-full bg-pink-500/20 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-16 -right-16 w-48 h-48 rounded-full bg-purple-600/20 blur-3xl pointer-events-none" />
            <DialogTitle className="relative flex items-center gap-3 text-xl">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-pink-500 via-fuchsia-500 to-purple-600 flex items-center justify-center shadow-lg shadow-fuchsia-500/40">
                <Lock className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col items-start">
                <span className="font-bold bg-gradient-to-l from-pink-400 via-fuchsia-400 to-purple-400 bg-clip-text text-transparent">حجز كميات للموظفين</span>
                <span className="text-xs font-normal text-muted-foreground flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-fuchsia-400" />
                  تحديد متعدد للموظفين والمنتجات والمتغيرات
                </span>
              </div>
            </DialogTitle>
            <DialogDescription className="relative text-xs text-muted-foreground text-right mt-1">
              خصّص كميات محددة من منتجاتك لموظف معين أو عدة موظفين دفعة واحدة. لن يتمكن غيرهم من بيعها.
            </DialogDescription>
          </DialogHeader>

          <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1 bg-background">
            {/* === صف الاختيار === */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* اختيار الموظفين */}
              <Popover>
                <PopoverTrigger asChild>
                  <button className="group relative flex items-center justify-between gap-2 p-3 rounded-xl bg-card hover:bg-fuchsia-500/10 border border-border hover:border-fuchsia-500/40 transition-all">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-fuchsia-400" />
                      <span className="text-sm font-medium text-foreground">
                        {selectedEmployeeIds.length === 0 ? 'اختر الموظفين' : `${selectedEmployeeIds.length} موظف محدد`}
                      </span>
                    </div>
                    <ChevronDown className="w-4 h-4 opacity-50 group-hover:opacity-100" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-72 p-0 bg-popover border border-fuchsia-500/30 shadow-2xl shadow-fuchsia-500/20"
                  dir="rtl"
                  align="start"
                  side="bottom"
                  sideOffset={6}
                  collisionPadding={12}
                >
                  <div
                    className="overflow-y-auto overscroll-contain p-2"
                    style={{ maxHeight: '55vh', WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
                    onWheel={(e) => e.stopPropagation()}
                    onTouchMove={(e) => e.stopPropagation()}
                  >
                    {employees.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-3">لا يوجد موظفون</p>
                    ) : employees.map(e => {
                      const id = e.user_id || e.id;
                      const checked = selectedEmployeeIds.includes(id);
                      return (
                        <label key={id} className="flex items-center gap-2 p-2 rounded hover:bg-muted/60 cursor-pointer text-sm">
                          <Checkbox checked={checked} onCheckedChange={() => toggleEmployee(id)} />
                          <span className="flex-1 truncate">{e.full_name || e.username}</span>
                        </label>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>

              {/* اختيار المنتجات */}
              <Popover>
                <PopoverTrigger asChild>
                  <button className="group relative flex items-center justify-between gap-2 p-3 rounded-xl bg-card hover:bg-pink-500/10 border border-border hover:border-pink-500/40 transition-all">
                    <div className="flex items-center gap-2">
                      <PackageIcon className="w-4 h-4 text-pink-400" />
                      <span className="text-sm font-medium text-foreground">
                        {selectedProductIds.length === 0 ? 'اختر المنتجات' : `${selectedProductIds.length} منتج محدد`}
                      </span>
                    </div>
                    <ChevronDown className="w-4 h-4 opacity-50 group-hover:opacity-100" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-80 p-0 bg-popover border border-pink-500/30 shadow-2xl shadow-pink-500/20"
                  dir="rtl"
                  align="start"
                  side="bottom"
                  sideOffset={6}
                  collisionPadding={12}
                >
                  <div className="p-2 pb-0">
                    <Input
                      placeholder="بحث..."
                      value={searchProduct}
                      onChange={(e) => setSearchProduct(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div
                    className="overflow-y-auto overscroll-contain p-2"
                    style={{ maxHeight: '50vh', WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
                    onWheel={(e) => e.stopPropagation()}
                    onTouchMove={(e) => e.stopPropagation()}
                  >
                    {ownedProducts.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-3">لا توجد منتجات</p>
                    ) : ownedProducts.map(p => {
                      const checked = selectedProductIds.includes(p.id);
                      return (
                        <label key={p.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted/60 cursor-pointer text-sm">
                          <Checkbox checked={checked} onCheckedChange={() => toggleProduct(p.id)} />
                          <span className="flex-1 truncate">{p.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* === جدول المتغيرات === */}
            {selectedProducts.length > 0 && (
              <div className="rounded-xl border border-fuchsia-500/20 bg-card overflow-hidden shadow-sm shadow-fuchsia-500/10">
                <div className="px-4 py-2.5 bg-gradient-to-l from-pink-500/15 via-fuchsia-500/10 to-purple-600/15 border-b border-fuchsia-500/20 flex items-center justify-between">
                  <span className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                    <Palette className="w-3.5 h-3.5 text-pink-400" />
                    <Ruler className="w-3.5 h-3.5 text-purple-400" />
                    حدّد الكميات لكل لون/قياس
                  </span>
                  <Badge variant="outline" className="text-[10px] border-fuchsia-500/40 text-fuchsia-300">{allVariants.length} متغير</Badge>
                </div>
                <div
                  className="overflow-y-auto overscroll-contain divide-y divide-border"
                  style={{ maxHeight: '50vh', WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
                >
                  {selectedProducts.map(prod => {
                    const vs = prod.variants || prod.product_variants || [];
                    return (
                      <div key={prod.id} className="p-3 space-y-1.5">
                        <div className="text-xs font-bold text-foreground">{prod.name}</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {vs.map(v => {
                            const available = Math.max(0, (v.quantity || 0) - (v.reserved_quantity || 0));
                            const qty = variantQuantities[v.id] || 0;
                            return (
                              <div key={v.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 border border-border">
                                <div className="flex-1 min-w-0 text-xs">
                                  <div className="truncate text-foreground">{variantLabel(v)}</div>
                                  <div className="text-[10px] text-muted-foreground">متاح: {available}</div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="outline"
                                    className="h-7 w-7 rounded-full"
                                    onClick={() => setVariantQty(v.id, Math.max(0, qty - 1))}
                                    disabled={qty <= 0}
                                  >
                                    <Minus className="w-3.5 h-3.5" />
                                  </Button>
                                  <Input
                                    type="number"
                                    min={0}
                                    max={available}
                                    value={qty || ''}
                                    onChange={(e) => setVariantQty(v.id, Math.min(available, Number(e.target.value) || 0))}
                                    placeholder="0"
                                    className="w-12 h-7 text-xs text-center px-1"
                                  />
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="outline"
                                    className="h-7 w-7 rounded-full"
                                    onClick={() => setVariantQty(v.id, Math.min(available, qty + 1))}
                                    disabled={qty >= available}
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* === زر التأكيد === */}
            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-card border border-fuchsia-500/20">
              <div className="text-xs text-muted-foreground">
                {totalCombinations > 0 ? (
                  <>سيتم إنشاء <span className="font-bold bg-gradient-to-l from-pink-400 to-purple-400 bg-clip-text text-transparent">{totalCombinations}</span> حجز</>
                ) : 'اختر الموظفين والمتغيرات والكميات'}
              </div>
              <Button
                onClick={handleBulkReserve}
                disabled={saving || totalCombinations === 0}
                className="bg-gradient-to-l from-pink-500 via-fuchsia-500 to-purple-600 hover:from-pink-600 hover:via-fuchsia-600 hover:to-purple-700 text-white font-semibold shadow-lg shadow-fuchsia-500/40 border-0"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="w-4 h-4 ml-1" />
                    حجز الكل
                  </>
                )}
              </Button>
            </div>

            {/* === قائمة الحجوزات النشطة === */}
            <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
              <div className="px-4 py-2.5 border-b border-border flex items-center justify-between bg-muted/30">
                <span className="text-xs font-semibold text-foreground">الحجوزات النشطة</span>
                <Badge variant="outline" className="text-[10px]">{reservations.length}</Badge>
              </div>
              <div className="overflow-y-auto overscroll-contain" style={{ maxHeight: '40vh', WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
                {loading ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                ) : reservations.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8 text-sm">لا توجد حجوزات نشطة</p>
                ) : (
                  <div className="divide-y divide-border">
                    {reservations.map(r => {
                      const remaining = Math.max(0, (r.reserved_quantity || 0) - (r.sold_quantity || 0));
                      return (
                        <div key={r.id} className="flex items-center justify-between gap-2 p-3">
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm truncate text-foreground">{r.products?.name || 'منتج'}</div>
                            <div className="text-[11px] text-muted-foreground truncate">
                              {r.product_variants?.colors?.name || '-'} • {r.product_variants?.sizes?.name || '-'} • {employeeName(r.employee_id)}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/30">محجوز {r.reserved_quantity}</Badge>
                            <Badge variant="outline" className="text-[10px] bg-orange-500/10 text-orange-600 border-orange-500/30">مباع {r.sold_quantity}</Badge>
                            <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">متبقي {remaining}</Badge>
                            <Button size="icon" variant="ghost" onClick={() => handleRelease(r.id)} title="تحرير" className="h-7 w-7">
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EmployeeReservationsDialog;

