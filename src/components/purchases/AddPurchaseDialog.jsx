import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useInventory } from '@/contexts/InventoryContext';
import { useImprovedPurchases } from '@/hooks/useImprovedPurchases';
import { useCashSources } from '@/hooks/useCashSources';
import { toast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Wallet } from 'lucide-react';
import SelectProductForPurchaseDialog from './SelectProductForPurchaseDialog';
import PurchaseItemsPreview from './PurchaseItemsPreview';
import { useLocation } from 'react-router-dom';

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
                status: 'completed'
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
        setTransferCost(''); // إعادة تعيين تكاليف التحويل
        setItems([]);
    };

    const handleOpenChange = (isOpen) => {
        if (!isOpen) {
            resetForm();
        }
        onOpenChange(isOpen);
    };

    return (
        <>
            <Dialog open={open} onOpenChange={handleOpenChange}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>إضافة فاتورة شراء جديدة</DialogTitle>
                        <DialogDescription>أدخل تفاصيل الفاتورة والمنتجات المشتراة.</DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 py-4">
                        <div>
                            <Label htmlFor="supplier">اسم المورد</Label>
                            <Input id="supplier" value={supplier} onChange={e => setSupplier(e.target.value)} />
                        </div>
                        <div>
                            <Label htmlFor="purchaseDate">تاريخ الشراء</Label>
                            <Input id="purchaseDate" type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
                        </div>
                        <div>
                            <Label htmlFor="shippingCost">مصاريف الشحن (د.ع)</Label>
                            <Input 
                                id="shippingCost" 
                                type="number" 
                                min="0"
                                step="1"
                                placeholder="أدخل تكلفة الشحن"
                                value={shippingCost} 
                                onChange={e => setShippingCost(e.target.value)} 
                            />
                        </div>
                        <div>
                            <Label htmlFor="transferCost">تكاليف التحويل (د.ع)</Label>
                            <Input 
                                id="transferCost" 
                                type="number" 
                                min="0"
                                step="1"
                                placeholder="أدخل تكلفة التحويل المالي"
                                value={transferCost} 
                                onChange={e => setTransferCost(e.target.value)} 
                            />
                        </div>
                    </div>

                    {/* مصدر الأموال */}
                    <div className="space-y-2">
                        <Label htmlFor="cashSource" className="flex items-center gap-2">
                            <Wallet className="w-4 h-4" />
                            مصدر الأموال
                        </Label>
                        <Select value={selectedCashSource} onValueChange={setSelectedCashSource}>
                            <SelectTrigger>
                                <SelectValue placeholder="اختر مصدر الأموال" />
                            </SelectTrigger>
                            <SelectContent>
                                {cashSources.map(source => {
                                    // للقاصة الرئيسية، استخدم الرصيد المحسوب (رأس المال + الأرباح)
                                    const displayBalance = source.name === 'القاصة الرئيسية' 
                                        ? mainCashSourceBalance
                                        : source.current_balance;
                                    
                                    // التأكد من أن الرصيد ليس سالبًا ولا يُظهر NaN
                                    const safeBalance = isNaN(displayBalance) ? 0 : Math.max(0, displayBalance);
                                    
                                    return (
                                        <SelectItem key={source.id} value={source.id}>
                                            {source.name} - {safeBalance.toLocaleString()} د.ع
                                        </SelectItem>
                                    );
                                })}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-4">
                        <h3 className="font-semibold">المنتجات</h3>
                        <PurchaseItemsPreview items={items} onRemove={handleRemoveItem} onUpdate={handleUpdateItem} />
                        <Button variant="outline" onClick={() => setIsProductSelectorOpen(true)}>
                            <PlusCircle className="w-4 h-4 ml-2" />
                            إضافة منتج
                        </Button>
                    </div>

                    <DialogFooter>
                        <Button onClick={handleSubmit} disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "حفظ الفاتورة"}
                        </Button>
                    </DialogFooter>
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