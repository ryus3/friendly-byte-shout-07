import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useInventory } from '@/contexts/InventoryContext';
import { toast } from '@/components/ui/use-toast';
import { Loader2, PlusCircle } from 'lucide-react';
import SelectProductForPurchaseDialog from './SelectProductForPurchaseDialog';
import PurchaseItemsPreview from './PurchaseItemsPreview';
import { useLocation } from 'react-router-dom';

const AddPurchaseDialog = ({ open, onOpenChange }) => {
    const { addPurchase } = useInventory();
    const location = useLocation();
    const [supplier, setSupplier] = useState('');
    const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
    const [shippingCost, setShippingCost] = useState(0);
    const [items, setItems] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isProductSelectorOpen, setIsProductSelectorOpen] = useState(false);

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
        setIsSubmitting(true);
        const totalCost = items.reduce((sum, item) => sum + (item.costPrice * item.quantity), 0);
        const purchaseData = {
            supplier,
            purchaseDate: new Date(purchaseDate),
            items,
            totalCost,
            shippingCost: Number(shippingCost) || 0,
            status: 'completed'
        };
        const result = await addPurchase(purchaseData);
        if (result.success) {
            toast({ title: "نجاح", description: "تمت إضافة فاتورة الشراء بنجاح." });
            resetForm();
            onOpenChange(false);
        } else {
            toast({ title: "خطأ", description: result.error, variant: "destructive" });
        }
        setIsSubmitting(false);
    };

    const resetForm = () => {
        setSupplier('');
        setPurchaseDate(new Date().toISOString().split('T')[0]);
        setShippingCost(0);
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
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-4">
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
                            <Input id="shippingCost" type="number" value={shippingCost} onChange={e => setShippingCost(e.target.value)} />
                        </div>
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