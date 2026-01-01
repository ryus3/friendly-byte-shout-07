import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useInventory } from '@/contexts/InventoryContext';
import { useImprovedPurchases } from '@/hooks/useImprovedPurchases';
import { useCashSources } from '@/hooks/useCashSources';
import { toast } from '@/hooks/use-toast';
import { 
    Loader2, PlusCircle, Wallet, X, Receipt, 
    Truck, CreditCard, DollarSign, Package, Sparkles, CalendarIcon 
} from 'lucide-react';
import SelectProductForPurchaseDialog from './SelectProductForPurchaseDialog';
import PurchaseItemsPreview from './PurchaseItemsPreview';
import { useLocation } from 'react-router-dom';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

const AddPurchaseDialog = ({ open, onOpenChange, onPurchaseAdded }) => {
    const { addPurchase } = useImprovedPurchases();
    const { cashSources, getMainCashSource } = useCashSources();
    const location = useLocation();
    const [supplier, setSupplier] = useState('');
    const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
    const [shippingCost, setShippingCost] = useState('');
    const [transferCost, setTransferCost] = useState('');
    const [selectedCashSource, setSelectedCashSource] = useState('');
    const [items, setItems] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isProductSelectorOpen, setIsProductSelectorOpen] = useState(false);
    const [mainCashSourceBalance, setMainCashSourceBalance] = useState(0);
    
    // حقول دعم الدولار
    const [currency, setCurrency] = useState('IQD');
    const [exchangeRate, setExchangeRate] = useState(1);
    const [showExchangeRate, setShowExchangeRate] = useState(false);

    // جلب رصيد القاصة الرئيسية
    useEffect(() => {
        const loadMainCashBalance = async () => {
            const mainSource = await getMainCashSource();
            if (mainSource) {
                setMainCashSourceBalance(mainSource.calculatedBalance || 0);
            }
        };
        
        if (open) {
            loadMainCashBalance();
        }
    }, [open, getMainCashSource]);

    useEffect(() => {
        if (location.state?.productJustAdded) {
            onOpenChange(true);
            setIsProductSelectorOpen(true);
        }
    }, [location.state, onOpenChange]);

    const handleAddItems = (newItems) => {
        setItems(prev => {
            const updatedItems = [...prev];
            newItems.forEach(newItem => {
                const existingIndex = updatedItems.findIndex(item => item.variantSku === newItem.variantSku);
                if (existingIndex > -1) {
                    updatedItems[existingIndex].quantity += newItem.quantity;
                } else {
                    updatedItems.push(newItem);
                }
            });
            return updatedItems;
        });
    };

    const handleRemoveItem = (sku) => {
        setItems(prev => prev.filter(item => item.variantSku !== sku));
    };

    const handleUpdateItem = (sku, field, value) => {
        setItems(prev => prev.map(item => item.variantSku === sku ? { ...item, [field]: value } : item));
    };

    const handleSubmit = async () => {
        if (!supplier || items.length === 0) {
            toast({ title: "خطأ", description: "يرجى إدخال اسم المورد وإضافة منتج واحد على الأقل.", variant: "destructive" });
            return;
        }

        if (!selectedCashSource) {
            toast({ title: "خطأ", description: "يرجى اختيار مصدر الأموال.", variant: "destructive" });
            return;
        }

        // التحقق من صحة البيانات
        const invalidItems = items.filter(item => !item.costPrice || item.costPrice <= 0 || !item.quantity || item.quantity <= 0);
        if (invalidItems.length > 0) {
            toast({ 
                title: "خطأ في البيانات", 
                description: "يرجى التأكد من إدخال سعر التكلفة والكمية بشكل صحيح لجميع المنتجات.", 
                variant: "destructive" 
            });
            return;
        }

        setIsSubmitting(true);
        try {
            const totalCost = items.reduce((sum, item) => sum + (Number(item.costPrice) * Number(item.quantity)), 0);
            const finalShippingCost = Number(shippingCost) || 0;
            const finalTransferCost = Number(transferCost) || 0;
            
            // حساب المبالغ بالعملة المختارة
            const totalInSelectedCurrency = totalCost;
            const totalInIQD = currency === 'USD' ? totalCost * exchangeRate : totalCost;
            
            const purchaseData = {
                supplier,
                purchaseDate: new Date(purchaseDate),
                items: items.map(item => ({
                    ...item,
                    costPrice: Number(item.costPrice),
                    quantity: Number(item.quantity)
                })),
                totalCost,
                shippingCost: finalShippingCost,
                transferCost: finalTransferCost,
                cashSourceId: selectedCashSource,
                status: 'completed',
                // دعم الدولار
                currency: currency,
                exchangeRate: currency === 'USD' ? exchangeRate : 1.0,
                totalInUSD: currency === 'USD' ? totalCost : null
            };
            
            console.log('Purchase data with shipping:', purchaseData);
            const result = await addPurchase(purchaseData);
            
            if (result.success) {
                toast({ 
                    title: "نجاح", 
                    description: `تمت إضافة فاتورة الشراء رقم ${result.purchase?.purchase_number} بنجاح.`,
                    variant: "success"
                });
                resetForm();
                onOpenChange(false);
                // استدعاء callback للتحديث
                onPurchaseAdded?.();
            } else {
                throw new Error(result.error || 'فشل في إضافة الفاتورة');
            }
        } catch (error) {
            console.error('Purchase submission error:', error);
            toast({ 
                title: "خطأ", 
                description: error.message || "فشل في إضافة فاتورة الشراء", 
                variant: "destructive" 
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setSupplier('');
        setPurchaseDate(new Date().toISOString().split('T')[0]);
        setShippingCost('');
        setTransferCost('');
        setItems([]);
        setCurrency('IQD');
        setExchangeRate(1);
        setShowExchangeRate(false);
    };

    const handleOpenChange = (isOpen) => {
        if (!isOpen) {
            resetForm();
        }
        onOpenChange(isOpen);
    };

    // حساب الإجمالي
    const itemsTotal = items.reduce((sum, item) => sum + (Number(item.costPrice) * Number(item.quantity)), 0);
    const grandTotal = currency === 'USD' 
        ? (itemsTotal * exchangeRate) + Number(shippingCost || 0) + Number(transferCost || 0)
        : itemsTotal + Number(shippingCost || 0) + Number(transferCost || 0);

    return (
        <>
            <Dialog open={open} onOpenChange={handleOpenChange}>
                <DialogContent dir="rtl" className="w-[95vw] max-w-[480px] p-0 overflow-hidden gap-0 max-h-[90vh] flex flex-col">
                    {/* Header متدرج فاخر */}
                    <div className="relative bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 p-4 shrink-0">
                        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxjaXJjbGUgY3g9IjIwIiBjeT0iMjAiIHI9IjIiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4xKSIvPjwvZz48L3N2Zz4=')] opacity-50 rounded-t-lg" />
                        
                        <div className="relative flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white/20 rounded-full backdrop-blur-sm">
                                    <Receipt className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-white font-bold text-base">فاتورة شراء جديدة</h2>
                                    <p className="text-white/70 text-xs">أدخل تفاصيل الفاتورة والمنتجات</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => handleOpenChange(false)}
                                className="p-1.5 hover:bg-white/20 rounded-full transition-colors"
                            >
                                <X className="w-5 h-5 text-white" />
                            </button>
                        </div>

                        {/* شريط الإحصائيات */}
                        <div className="flex items-center gap-2 mt-3 text-white/90 text-xs flex-wrap">
                            <div className="flex items-center gap-1.5 bg-white/10 rounded-lg px-2 py-1">
                                <Package className="w-3.5 h-3.5" />
                                <span>{items.length} منتج</span>
                            </div>
                            <div className="flex items-center gap-1.5 bg-white/10 rounded-lg px-2 py-1">
                                <DollarSign className="w-3.5 h-3.5" />
                                <span>{currency}</span>
                            </div>
                            {selectedCashSource && (
                                <div className="flex items-center gap-1.5 bg-emerald-400/30 rounded-lg px-2 py-1">
                                    <Wallet className="w-3.5 h-3.5" />
                                    <span>مصدر محدد</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Body مع Scroll */}
                    <ScrollArea className="flex-1 overflow-y-auto">
                        <div className="p-4 space-y-4">
                            {/* قسم بيانات الفاتورة */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-sm font-semibold text-foreground justify-end">
                                    <span>بيانات الفاتورة</span>
                                    <Receipt className="w-4 h-4 text-primary" />
                                </div>
                                
                                <div className="space-y-3">
                                    {/* المورد */}
                                    <div className="space-y-1">
                                        <Label htmlFor="supplier" className="text-xs text-muted-foreground text-right block">المورد</Label>
                                        <Input 
                                            id="supplier" 
                                            value={supplier} 
                                            onChange={e => setSupplier(e.target.value)} 
                                            className="h-10 w-full text-right"
                                            dir="rtl"
                                            placeholder="اسم المورد"
                                        />
                                    </div>
                                    
                                    {/* التاريخ */}
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                                            التاريخ
                                            <CalendarIcon className="w-3 h-3" />
                                        </Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button 
                                                    variant="outline" 
                                                    className="w-full h-10 justify-end font-normal text-right"
                                                    dir="rtl"
                                                >
                                                    <CalendarIcon className="h-4 w-4 opacity-70 ml-2" />
                                                    <span>
                                                        {purchaseDate 
                                                            ? format(new Date(purchaseDate), 'dd MMMM yyyy', { locale: ar })
                                                            : 'اختر التاريخ'}
                                                    </span>
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={purchaseDate ? new Date(purchaseDate) : undefined}
                                                    onSelect={(date) => setPurchaseDate(date?.toISOString().split('T')[0] || '')}
                                                    locale={ar}
                                                    className="pointer-events-auto"
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-sm font-semibold text-foreground justify-end">
                                    <span>التكاليف الإضافية</span>
                                    <Truck className="w-4 h-4 text-primary" />
                                </div>
                                
                                <div className="grid grid-cols-2 gap-3" style={{ direction: 'ltr' }}>
                                    <div className="space-y-1" dir="rtl">
                                        <Label htmlFor="transferCost" className="text-xs text-muted-foreground text-right block">التحويل (د.ع)</Label>
                                        <Input 
                                            id="transferCost" 
                                            type="number" 
                                            min="0"
                                            placeholder="0"
                                            value={transferCost} 
                                            onChange={e => setTransferCost(e.target.value)} 
                                            className="h-10 w-full text-right"
                                        />
                                    </div>
                                    <div className="space-y-1" dir="rtl">
                                        <Label htmlFor="shippingCost" className="text-xs text-muted-foreground text-right block">الشحن (د.ع)</Label>
                                        <Input 
                                            id="shippingCost" 
                                            type="number" 
                                            min="0"
                                            placeholder="0"
                                            value={shippingCost} 
                                            onChange={e => setShippingCost(e.target.value)} 
                                            className="h-10 w-full text-right"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* قسم العملة */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-sm font-semibold text-foreground justify-end">
                                    <span>العملة</span>
                                    <DollarSign className="w-4 h-4 text-primary" />
                                </div>
                                
                                <div className="grid grid-cols-2 gap-3" style={{ direction: 'ltr' }}>
                                    {showExchangeRate && (
                                        <div className="space-y-1" dir="rtl">
                                            <Label className="text-xs text-muted-foreground text-right block">سعر الصرف</Label>
                                            <Input
                                                type="number"
                                                placeholder="1480"
                                                value={exchangeRate}
                                                onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 1)}
                                                min="1"
                                                className="h-10 w-full text-right"
                                            />
                                        </div>
                                    )}
                                    <div className={`space-y-1 ${!showExchangeRate ? 'col-span-2' : ''}`} dir="rtl">
                                        <Label className="text-xs text-muted-foreground text-right block">نوع العملة</Label>
                                        <Select 
                                            value={currency} 
                                            onValueChange={(val) => {
                                                setCurrency(val);
                                                setShowExchangeRate(val === 'USD');
                                                if (val === 'IQD') setExchangeRate(1);
                                            }}
                                        >
                                            <SelectTrigger className="h-10 w-full min-w-0 text-right" dir="rtl">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent dir="rtl">
                                                <SelectItem value="IQD" className="text-right">دينار (IQD)</SelectItem>
                                                <SelectItem value="USD" className="text-right">دولار ($)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>

                            {/* مصدر الأموال */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-sm font-semibold text-foreground justify-end">
                                    <span>مصدر الأموال</span>
                                    <Wallet className="w-4 h-4 text-primary" />
                                </div>
                                
                                <Select value={selectedCashSource} onValueChange={setSelectedCashSource}>
                                    <SelectTrigger className="h-10 w-full min-w-0 text-right" dir="rtl">
                                        <SelectValue placeholder="اختر مصدر الأموال" />
                                    </SelectTrigger>
                                    <SelectContent dir="rtl">
                                        {cashSources.map(source => {
                                            const displayBalance = source.name === 'القاصة الرئيسية' 
                                                ? mainCashSourceBalance
                                                : source.current_balance;
                                            const safeBalance = isNaN(displayBalance) ? 0 : Math.max(0, displayBalance);
                                            return (
                                                <SelectItem key={source.id} value={source.id} className="text-right">
                                                    {source.name} - {safeBalance.toLocaleString()} د.ع
                                                </SelectItem>
                                            );
                                        })}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* قسم المنتجات */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between flex-row-reverse">
                                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground justify-end">
                                        <span>المنتجات</span>
                                        <Package className="w-4 h-4 text-primary" />
                                    </div>
                                    <Button 
                                        variant="outline" 
                                        size="sm"
                                        onClick={() => setIsProductSelectorOpen(true)}
                                        className="h-8 text-xs"
                                    >
                                        <PlusCircle className="w-3.5 h-3.5 ml-1" />
                                        إضافة
                                    </Button>
                                </div>
                                
                                <PurchaseItemsPreview 
                                    items={items} 
                                    onRemove={handleRemoveItem} 
                                    onUpdate={handleUpdateItem} 
                                />
                            </div>
                        </div>
                    </ScrollArea>

                    {/* Footer ثابت */}
                    <div className="border-t bg-muted/30 p-4 space-y-3 shrink-0">
                        {/* المبلغ الإجمالي */}
                        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-3 rounded-xl border border-primary/20">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-primary/20 rounded-lg">
                                        <CreditCard className="w-4 h-4 text-primary" />
                                    </div>
                                    <span className="text-sm text-muted-foreground">المبلغ الإجمالي</span>
                                </div>
                                <div className="text-left">
                                    {currency === 'USD' ? (
                                        <div className="space-y-0.5">
                                            <p className="text-lg font-bold text-primary">
                                                ${itemsTotal.toLocaleString()}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                = {grandTotal.toLocaleString()} د.ع
                                            </p>
                                        </div>
                                    ) : (
                                        <p className="text-xl font-bold text-primary">
                                            {grandTotal.toLocaleString()} <span className="text-sm">د.ع</span>
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* زر الحفظ */}
                        <Button 
                            onClick={handleSubmit} 
                            disabled={isSubmitting || items.length === 0}
                            className="w-full h-11 text-base font-semibold bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
                        >
                            {isSubmitting ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    <Sparkles className="w-4 h-4 ml-2" />
                                    حفظ الفاتورة
                                </>
                            )}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
            <SelectProductForPurchaseDialog 
                open={isProductSelectorOpen} 
                onOpenChange={setIsProductSelectorOpen}
                onItemsAdd={handleAddItems}
            />
        </>
    );
};

export default AddPurchaseDialog;