import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useInventory } from '@/contexts/InventoryContext';
import { useVariants } from '@/contexts/VariantsContext';
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandList } from '@/components/ui/command';
import { Check, PlusCircle, Barcode as BarcodeIcon, ScanLine } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import AddEditColorDialog from '@/components/manage-variants/AddEditColorDialog';
import AddEditSizeDialog from '@/components/manage-variants/AddEditSizeDialog';
import BarcodeScannerDialog from '@/components/products/BarcodeScannerDialog';

const SelectProductForPurchaseDialog = ({ open, onOpenChange, onItemsAdd }) => {
    const { products, settings } = useInventory();
    const { colors, sizes, addColor, addSize } = useVariants();
    const navigate = useNavigate();
    const location = useLocation();

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [selectedColor, setSelectedColor] = useState(null);
    const [selectedSize, setSelectedSize] = useState(null);
    
    const [quantity, setQuantity] = useState(1);
    const [costPrice, setCostPrice] = useState(0);
    const [salePrice, setSalePrice] = useState(0);
    
    const [isColorDialogOpen, setIsColorDialogOpen] = useState(false);
    const [isSizeDialogOpen, setIsSizeDialogOpen] = useState(false);
    const [isScannerOpen, setIsScannerOpen] = useState(false);

    const filteredProducts = useMemo(() => 
        products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())),
        [products, searchTerm]
    );

    const productColors = useMemo(() => {
        if (!selectedProduct) return [];
        const colorIds = new Set(selectedProduct.variants.map(v => v.colorId));
        return colors.filter(c => colorIds.has(c.id));
    }, [selectedProduct, colors]);

    const productSizesForColor = useMemo(() => {
        if (!selectedProduct || !selectedColor) return [];
        const sizeIds = new Set(selectedProduct.variants.filter(v => v.colorId === selectedColor.id).map(v => v.sizeId));
        return sizes.filter(s => sizeIds.has(s.id));
    }, [selectedProduct, selectedColor, sizes]);

    useEffect(() => {
        if (selectedProduct) {
            setCostPrice(selectedProduct.costPrice || 0);
            setSalePrice(selectedProduct.price || 0);
        }
    }, [selectedProduct]);

    const handleConfirm = () => {
        if (!selectedProduct || !selectedColor || !selectedSize || quantity <= 0) {
            toast({ title: "خطأ", description: "يرجى اختيار المنتج واللون والقياس وإدخال كمية صالحة.", variant: "destructive" });
            return;
        }

        const existingVariant = selectedProduct.variants.find(v => v.colorId === selectedColor.id && v.sizeId === selectedSize.id);
        const sku = existingVariant?.sku || `${settings?.sku_prefix || 'PROD'}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`.toUpperCase();

        const itemToAdd = {
            productId: selectedProduct.id,
            productName: selectedProduct.name,
            variantSku: sku,
            color: selectedColor.name,
            size: selectedSize.value,
            quantity: parseInt(quantity),
            costPrice: parseFloat(costPrice),
            salePrice: parseFloat(salePrice),
            image: existingVariant?.image || selectedProduct.images?.[0] || null,
            isNewVariant: !existingVariant,
            colorId: selectedColor.id,
            sizeId: selectedSize.id,
            color_hex: selectedColor.hex_code,
        };

        onItemsAdd([itemToAdd]);
        toast({ title: "تمت الإضافة", description: `${itemToAdd.productName} (${itemToAdd.color}, ${itemToAdd.size})` });
        resetSelection();
    };
    
    const resetState = () => {
        setSearchTerm('');
        setSelectedProduct(null);
        resetSelection();
    };

    const resetSelection = () => {
        setSelectedColor(null);
        setSelectedSize(null);
        setQuantity(1);
        setCostPrice(selectedProduct?.costPrice || 0);
        setSalePrice(selectedProduct?.price || 0);
    };
    
    const handleDialogStateChange = (isOpen) => {
        if(!isOpen) resetState();
        onOpenChange(isOpen);
    };

    const handleCreateNewProduct = () => {
        onOpenChange(false);
        navigate('/products/add', { state: { from: location.pathname } });
    };

    const handleCreateColor = async (newColorData) => {
        const result = await addColor(newColorData);
        if (result.success && result.data) {
            setSelectedColor(result.data);
            return true;
        }
        return false;
    };

    const handleCreateSize = async (newSizeData) => {
        const result = await addSize(newSizeData);
        if (result.success && result.data) {
            setSelectedSize(result.data);
            return true;
        }
        return false;
    };

    const handleBarcodeScan = (decodedText) => {
        setIsScannerOpen(false);
        const foundProduct = products.find(p => p.variants.some(v => v.sku === decodedText));
        if (foundProduct) {
            const variant = foundProduct.variants.find(v => v.sku === decodedText);
            const color = colors.find(c => c.id === variant.colorId);
            const size = sizes.find(s => s.id === variant.sizeId);
            
            setSelectedProduct(foundProduct);
            setSelectedColor(color);
            setSelectedSize(size);
            toast({ title: "تم العثور على المنتج", description: `${foundProduct.name} (${color.name}, ${size.value})` });
        } else {
            toast({ title: "خطأ", description: "لم يتم العثور على منتج بهذا الباركود.", variant: "destructive" });
        }
    };

    return (
        <>
            <Dialog open={open} onOpenChange={handleDialogStateChange}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>إضافة صنف إلى الفاتورة</DialogTitle>
                        <DialogDescription>ابحث واختر المنتج، أو استخدم قارئ الباركود.</DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-1">
                            <Command className="rounded-lg border shadow-md">
                                <div className="flex items-center border-b">
                                    <CommandInput placeholder="ابحث عن منتج..." value={searchTerm} onValueChange={setSearchTerm}/>
                                    <Button variant="ghost" size="icon" className="mr-2" onClick={() => setIsScannerOpen(true)}>
                                        <ScanLine className="w-5 h-5" />
                                    </Button>
                                </div>
                                <CommandList>
                                    <ScrollArea className="h-96">
                                    <CommandEmpty>
                                        <div className="text-center p-4">
                                            <p>لم يتم العثور على منتج.</p>
                                            <Button variant="link" onClick={handleCreateNewProduct}><PlusCircle className="w-4 h-4 ml-2" />إنشاء منتج جديد</Button>
                                        </div>
                                    </CommandEmpty>
                                    <CommandGroup>
                                        {filteredProducts.map((product) => (
                                            <div key={product.id} onClick={() => { setSelectedProduct(product); resetSelection(); }} className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground">
                                                <Check className={`ml-2 h-4 w-4 ${selectedProduct?.id === product.id ? "opacity-100" : "opacity-0"}`} />
                                                {product.name}
                                            </div>
                                        ))}
                                    </CommandGroup>
                                    </ScrollArea>
                                </CommandList>
                            </Command>
                        </div>
                        <div className="md:col-span-2 space-y-4">
                            {selectedProduct ? (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        <Command className="rounded-lg border shadow-md">
                                            <CommandList>
                                                <CommandGroup heading="الألوان المتاحة">
                                                    <ScrollArea className="h-40">
                                                        {productColors.map((color) => (
                                                            <div key={color.id} onClick={() => setSelectedColor(color)} className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground">
                                                                <Check className={`ml-2 h-4 w-4 ${selectedColor?.id === color.id ? "opacity-100" : "opacity-0"}`} />
                                                                {color.name}
                                                            </div>
                                                        ))}
                                                    </ScrollArea>
                                                </CommandGroup>
                                                <Button variant="link" size="sm" onClick={() => setIsColorDialogOpen(true)}><PlusCircle className="w-4 h-4 ml-1" />إضافة لون جديد</Button>
                                            </CommandList>
                                        </Command>
                                        <Command className="rounded-lg border shadow-md">
                                            <CommandList>
                                                <CommandGroup heading="القياسات المتاحة">
                                                    <ScrollArea className="h-40">
                                                        {selectedColor ? productSizesForColor.map((size) => (
                                                            <div key={size.id} onClick={() => setSelectedSize(size)} className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground">
                                                                <Check className={`ml-2 h-4 w-4 ${selectedSize?.id === size.id ? "opacity-100" : "opacity-0"}`} />
                                                                {size.value}
                                                            </div>
                                                        )) : <div className="p-2 text-sm text-muted-foreground">اختر لوناً أولاً</div>}
                                                    </ScrollArea>
                                                </CommandGroup>
                                                <Button variant="link" size="sm" onClick={() => setIsSizeDialogOpen(true)}><PlusCircle className="w-4 h-4 ml-1" />إضافة قياس جديد</Button>
                                            </CommandList>
                                        </Command>
                                    </div>
                                    {selectedColor && selectedSize && (
                                        <div className="p-4 border rounded-lg space-y-3 bg-muted/50">
                                            <div className="grid grid-cols-3 gap-4">
                                                <div><Label>الكمية</Label><Input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} /></div>
                                                <div><Label>سعر التكلفة</Label><Input type="number" value={costPrice} onChange={e => setCostPrice(e.target.value)} /></div>
                                                <div><Label>سعر البيع</Label><Input type="number" value={salePrice} onChange={e => setSalePrice(e.target.value)} /></div>
                                            </div>
                                            <div className="flex items-center justify-center">
                                                <BarcodeIcon className="w-5 h-5 text-muted-foreground mr-2" />
                                                <p className="font-mono text-sm">
                                                    {selectedProduct.variants.find(v => v.colorId === selectedColor.id && v.sizeId === selectedSize.id)?.sku || "سيتم توليد باركود جديد"}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="h-full flex items-center justify-center border rounded-lg bg-muted text-muted-foreground"><p>الرجاء اختيار منتج أولاً</p></div>
                            )}
                        </div>
                    </div>
                    <DialogFooter className="flex justify-between pt-4">
                        <Button variant="ghost" onClick={() => handleDialogStateChange(false)}>إغلاق</Button>
                        <Button onClick={handleConfirm} disabled={!selectedProduct || !selectedColor || !selectedSize}>إضافة الصنف للفاتورة</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <AddEditColorDialog open={isColorDialogOpen} onOpenChange={setIsColorDialogOpen} onSuccess={handleCreateColor} />
            <AddEditSizeDialog open={isSizeDialogOpen} onOpenChange={setIsSizeDialogOpen} onSuccessfulSubmit={handleCreateSize} />
            <BarcodeScannerDialog open={isScannerOpen} onOpenChange={setIsScannerOpen} onScanSuccess={handleBarcodeScan} />
        </>
    );
};

export default SelectProductForPurchaseDialog;