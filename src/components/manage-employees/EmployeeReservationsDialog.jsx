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

  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // ✅ متعدد الاختيار
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState(defaultEmployeeId ? [defaultEmployeeId] : []);
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  // variantQuantities: { [variantId]: qty }
  const [variantQuantities, setVariantQuantities] = useState({});
  const [searchProduct, setSearchProduct] = useState('');

  // قائمة الموظفين المرشّحة: المدير العام يرى الكل، غيره يرى من تحت إشرافه
  const employees = useMemo(() => {
    const active = (allUsers || []).filter(u => u && u.status === 'active' && (u.user_id || u.id) !== uid);
    if (isAdmin || isDepartmentManager || hasPermission("manage_employees")) return active;
    const ids = new Set(supervisedEmployeeIds);
    return active.filter(e => ids.has(e.user_id || e.id));
  }, [allUsers, isAdmin, supervisedEmployeeIds, uid]);

  // المنتجات: المدير العام يرى الكل، غيره يرى منتجاته فقط
  const ownedProducts = useMemo(() => {
    if (!Array.isArray(products)) return [];
    const list = (isAdmin || isDepartmentManager || hasPermission("manage_products")) ? products : products.filter(p => p.owner_user_id === uid);
    if (!searchProduct.trim()) return list;
    const q = searchProduct.trim().toLowerCase();
    return list.filter(p => (p.name || '').toLowerCase().includes(q));
  }, [products, isAdmin, uid, searchProduct]);

  const selectedProducts = useMemo(
    () => (isAdmin || isDepartmentManager || hasPermission("manage_products") ? products : products?.filter(p => p.owner_user_id === uid) || []).filter(p => selectedProductIds.includes(p.id)),
    [products, isAdmin, uid, selectedProductIds]
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
      // عرض حجوزات منتجاتي فقط للمالك
      const filtered = (data || []).filter(r => {
        if (isAdmin) return true;
        return r.owner_user_id === uid || r.products?.owner_user_id === uid;
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
      const rows = [];
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
          rows.push({
            employee_id: empId,
            product_id: variant.product_id || variant._product?.id,
            variant_id: variantId,
            reserved_quantity: Number(qty),
            created_by: uid,
            owner_user_id: variant._product?.owner_user_id || uid,
            is_active: true,
          });
        }
      }
      const { error } = await supabase
        .from('employee_product_reservations')
        .upsert(rows, { onConflict: 'employee_id,variant_id' });
      if (error) throw error;
      toast({ title: `تم إنشاء ${rows.length} حجز بنجاح`, variant: 'success' });
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
        className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden border-0 bg-transparent shadow-none"
        dir="rtl"
      >
        {/* ✅ غلاف زجاجي مع تدرج خلفي وحواف ملوّنة */}
        <div className="relative rounded-3xl overflow-hidden">
          {/* خلفية متدرجة سائلة نابضة بالحياة */}
          <div className="absolute inset-0 bg-gradient-to-br from-violet-600/50 via-fuchsia-500/40 to-cyan-500/50" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(168,85,247,0.45),transparent_55%),radial-gradient(circle_at_85%_15%,rgba(236,72,153,0.4),transparent_55%),radial-gradient(circle_at_50%_100%,rgba(6,182,212,0.5),transparent_60%)]" />
          <div className="absolute -top-28 -right-28 w-80 h-80 rounded-full bg-fuchsia-500/50 blur-[90px] animate-pulse" />
          <div className="absolute -bottom-28 -left-28 w-80 h-80 rounded-full bg-cyan-400/50 blur-[90px] animate-pulse" style={{ animationDelay: '1.5s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-indigo-500/30 blur-[80px]" />
          {/* الطبقة الزجاجية */}
          <div className="absolute inset-0 backdrop-blur-2xl bg-background/75 border border-white/25" />
          {/* حواف ملوّنة رفيعة متدرجة (conic) متحركة */}
          <div className="pointer-events-none absolute inset-0 rounded-3xl p-[2px] animate-[spin_8s_linear_infinite]" style={{
            background: 'conic-gradient(from 0deg, #a855f7, #ec4899, #06b6d4, #6366f1, #a855f7)',
            WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
          }} />

          <div className="relative z-10 flex flex-col max-h-[92vh]">
            <DialogHeader className="px-6 pt-5 pb-3 border-b border-white/10">
              <DialogTitle className="flex items-center gap-3 text-xl">
                <div className="relative">
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 blur-md opacity-60" />
                  <div className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 via-fuchsia-500 to-cyan-500 flex items-center justify-center shadow-lg">
                    <Lock className="w-5 h-5 text-white" />
                  </div>
                </div>
                <div className="flex flex-col items-start">
                  <span className="font-bold bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">
                    حجز كميات للموظفين
                  </span>
                  <span className="text-xs font-normal text-muted-foreground flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    تحديد متعدد للموظفين والمنتجات والمتغيرات
                  </span>
                </div>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground/90 text-right">
                خصّص كميات محددة من منتجاتك لموظف معين أو عدة موظفين دفعة واحدة. لن يتمكن غيرهم من بيعها.
              </DialogDescription>
            </DialogHeader>

            <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
              {/* === صف الاختيار: الموظفون + المنتجات === */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* اختيار الموظفين */}
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="group relative flex items-center justify-between gap-2 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 backdrop-blur-xl transition-all">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-indigo-400" />
                        <span className="text-sm font-medium">
                          {selectedEmployeeIds.length === 0 ? 'اختر الموظفين' : `${selectedEmployeeIds.length} موظف محدد`}
                        </span>
                      </div>
                      <ChevronDown className="w-4 h-4 opacity-50 group-hover:opacity-100" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-72 p-0"
                    dir="rtl"
                    align="start"
                    side="bottom"
                    sideOffset={6}
                    style={{ maxHeight: '60vh' }}
                  >
                    <div
                      className="overflow-y-auto overscroll-contain p-2"
                      style={{ maxHeight: '60vh', WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
                      
                      
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
                    <button className="group relative flex items-center justify-between gap-2 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 backdrop-blur-xl transition-all">
                      <div className="flex items-center gap-2">
                        <PackageIcon className="w-4 h-4 text-fuchsia-400" />
                        <span className="text-sm font-medium">
                          {selectedProductIds.length === 0 ? 'اختر المنتجات' : `${selectedProductIds.length} منتج محدد`}
                        </span>
                      </div>
                      <ChevronDown className="w-4 h-4 opacity-50 group-hover:opacity-100" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-80 p-0"
                    dir="rtl"
                    align="start"
                    side="bottom"
                    sideOffset={6}
                    style={{ maxHeight: '65vh' }}
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
                      style={{ maxHeight: '55vh', WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
                      
                      
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

              {/* === جدول المتغيرات للمنتجات المختارة === */}
              {selectedProducts.length > 0 && (
                <div className="rounded-xl border border-white/15 bg-white/5 backdrop-blur-xl overflow-hidden">
                  <div className="px-4 py-2.5 bg-gradient-to-l from-fuchsia-500/10 to-indigo-500/10 border-b border-white/10 flex items-center justify-between">
                    <span className="text-xs font-semibold flex items-center gap-1.5">
                      <Palette className="w-3.5 h-3.5 text-fuchsia-400" />
                      <Ruler className="w-3.5 h-3.5 text-cyan-400" />
                      حدّد الكميات لكل لون/قياس
                    </span>
                    <Badge variant="outline" className="text-[10px] border-white/20">{allVariants.length} متغير</Badge>
                  </div>
                  <ScrollArea className="max-h-[50vh]">
                    <div className="divide-y divide-white/5">
                      {selectedProducts.map(prod => {
                        const vs = prod.variants || prod.product_variants || [];
                        return (
                          <div key={prod.id} className="p-3 space-y-1.5">
                            <div className="text-xs font-bold text-foreground/90">{prod.name}</div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                              {vs.map(v => {
                                const available = Math.max(0, (v.quantity || 0) - (v.reserved_quantity || 0));
                                const qty = variantQuantities[v.id] || 0;
                                return (
                                  <div key={v.id} className="flex items-center gap-2 p-2 rounded-lg bg-background/40 border border-white/10">
                                    <div className="flex-1 min-w-0 text-xs">
                                      <div className="truncate">{variantLabel(v)}</div>
                                      <div className="text-[10px] text-muted-foreground">متاح: {available}</div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <Button
                                        type="button"
                                        size="icon"
                                        variant="outline"
                                        className="h-7 w-7 rounded-md"
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
                                        className="h-7 w-7 rounded-md"
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
                  </ScrollArea>

                </div>
              )}

              {/* === زر التأكيد === */}
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground">
                  {totalCombinations > 0 ? (
                    <>سيتم إنشاء <span className="font-bold text-foreground">{totalCombinations}</span> حجز</>
                  ) : 'اختر الموظفين والمتغيرات والكميات'}
                </div>
                <Button
                  onClick={handleBulkReserve}
                  disabled={saving || totalCombinations === 0}
                  className="relative bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-cyan-500 hover:opacity-90 text-white border-0 shadow-lg shadow-fuchsia-500/30"
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
              <div className="rounded-xl border border-white/15 bg-white/5 backdrop-blur-xl">
                <div className="px-4 py-2.5 border-b border-white/10 flex items-center justify-between">
                  <span className="text-xs font-semibold">الحجوزات النشطة</span>
                  <Badge variant="outline" className="text-[10px] border-white/20">{reservations.length}</Badge>
                </div>
                <ScrollArea className="max-h-64">
                  {loading ? (
                    <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                  ) : reservations.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8 text-sm">لا توجد حجوزات نشطة</p>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {reservations.map(r => {
                        const remaining = Math.max(0, (r.reserved_quantity || 0) - (r.sold_quantity || 0));
                        return (
                          <div key={r.id} className="flex items-center justify-between gap-2 p-3">
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-sm truncate">{r.products?.name || 'منتج'}</div>
                              <div className="text-[11px] text-muted-foreground truncate">
                                {r.product_variants?.colors?.name || '-'} • {r.product_variants?.sizes?.name || '-'} • {employeeName(r.employee_id)}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-500 border-blue-500/30">محجوز {r.reserved_quantity}</Badge>
                              <Badge variant="outline" className="text-[10px] bg-orange-500/10 text-orange-500 border-orange-500/30">مباع {r.sold_quantity}</Badge>
                              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-500/30">متبقي {remaining}</Badge>
                              <Button size="icon" variant="ghost" onClick={() => handleRelease(r.id)} title="تحرير" className="h-7 w-7">
                                <Trash2 className="w-3.5 h-3.5 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EmployeeReservationsDialog;
