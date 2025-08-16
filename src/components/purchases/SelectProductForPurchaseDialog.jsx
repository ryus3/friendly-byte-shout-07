import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { useVariants } from '@/contexts/VariantsContext';
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandList } from '@/components/ui/command';
import { Check, PlusCircle, Barcode as BarcodeIcon, ScanLine } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import AddEditColorDialog from '@/components/manage-variants/AddEditColorDialog';
import AddEditSizeDialog from '@/components/manage-variants/AddEditSizeDialog';
import UnifiedQRScanner from '@/components/shared/UnifiedQRScanner';

const SelectProductForPurchaseDialog = ({ open, onOpenChange, onItemsAdd }) => {
    const { products, settings } = useInventory();
    const { filterProductsByPermissions } = useAuth();
    const { colors, sizes, addColor, addSize } = useVariants();
    const navigate = useNavigate();
    const location = useLocation();

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [selectedItems, setSelectedItems] = useState([]); // لحفظ عدة ألوان وقياسات
    const [currentColor, setCurrentColor] = useState(null);
    const [currentSize, setCurrentSize] = useState(null);
    
    const [quantity, setQuantity] = useState(1);
    const [costPrice, setCostPrice] = useState(0);
    const [salePrice, setSalePrice] = useState(0);
    
    const [isColorDialogOpen, setIsColorDialogOpen] = useState(false);
    const [isSizeDialogOpen, setIsSizeDialogOpen] = useState(false);
    const [isScannerOpen, setIsScannerOpen] = useState(false);

    const allowedProducts = useMemo(() => 
        filterProductsByPermissions ? filterProductsByPermissions(products) : products,
        [products, filterProductsByPermissions]
    );

    const filteredProducts = useMemo(() => 
        allowedProducts.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())),
        [allowedProducts, searchTerm]
    );

    // استخدام جميع الألوان المتاحة في الموقع بدلاً من ألوان المنتج فقط
    const availableColors = useMemo(() => colors, [colors]);

    // استخدام جميع الأحجام المتاحة في الموقع
    const availableSizes = useMemo(() => sizes, [sizes]);

    useEffect(() => {
        if (selectedProduct) {
            setCostPrice(selectedProduct.cost_price || selectedProduct.costPrice || 0);
            setSalePrice(selectedProduct.base_price || selectedProduct.price || 0);
        }
    }, [selectedProduct]);

    const addCurrentSelection = () => {
        if (!selectedProduct || !currentColor || !currentSize || quantity <= 0 || !costPrice || costPrice <= 0) {
            toast({ title: "خطأ", description: "يرجى اختيار المنتج واللون والقياس وإدخال كمية وسعر تكلفة صالحين.", variant: "destructive" });
            return;
        }

        const existingVariant = selectedProduct.variants?.find(v => (v.color_id || v.colorId) === currentColor.id && (v.size_id || v.sizeId) === currentSize.id);
        const sku = existingVariant?.sku || existingVariant?.barcode || `${settings?.sku_prefix || 'PROD'}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`.toUpperCase();

        const newItem = {
            productId: selectedProduct.id,
            productName: selectedProduct.name,
            variantSku: sku,
            variantId: existingVariant?.id,
            color: currentColor.name,
            size: currentSize.name || currentSize.value,
            quantity: parseInt(quantity),
            costPrice: parseFloat(costPrice),
            salePrice: parseFloat(salePrice),
            image: existingVariant?.images?.[0] || selectedProduct.images?.[0] || null,
            isNewVariant: !existingVariant,
            colorId: currentColor.id,
            sizeId: currentSize.id,
            color_hex: currentColor.hex_code || currentColor.hex_color,
        };

        setSelectedItems(prev => [...prev, newItem]);
        toast({ title: "تمت الإضافة", description: `${newItem.productName} (${newItem.color}, ${newItem.size})` });
        
        // إعادة تعيين الاختيار الحالي
        setCurrentColor(null);
        setCurrentSize(null);
        setQuantity(1);
        setCostPrice(selectedProduct?.cost_price || selectedProduct?.costPrice || 0);
        setSalePrice(selectedProduct?.base_price || selectedProduct?.price || 0);
    };

    const removeSelectedItem = (index) => {
        setSelectedItems(prev => prev.filter((_, i) => i !== index));
    };

    const handleConfirm = () => {
        if (selectedItems.length === 0) {
            toast({ title: "خطأ", description: "يرجى إضافة عنصر واحد على الأقل.", variant: "destructive" });
            return;
        }

        onItemsAdd(selectedItems);
        toast({ title: "تمت الإضافة", description: `تمت إضافة ${selectedItems.length} عنصر للفاتورة` });
        resetState();
    };
    
    const resetState = () => {
        setSearchTerm('');
        setSelectedProduct(null);
        setSelectedItems([]);
        resetSelection();
    };

    const resetSelection = () => {
        setCurrentColor(null);
        setCurrentSize(null);
        setQuantity(1);
        setCostPrice(selectedProduct?.cost_price || selectedProduct?.costPrice || 0);
        setSalePrice(selectedProduct?.base_price || selectedProduct?.price || 0);
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
            setCurrentColor(result.data);
            return true;
        }
        return false;
    };

    const handleCreateSize = async (newSizeData) => {
        const result = await addSize(newSizeData);
        if (result.success && result.data) {
            setCurrentSize(result.data);
            return true;
        }
        return false;
    };

    const handleBarcodeScan = (decodedText) => {
        setIsScannerOpen(false);
        const foundProduct = allowedProducts.find(p => 
            p.variants?.some(v => v.sku === decodedText || v.barcode === decodedText)
        );
        if (foundProduct) {
            const variant = foundProduct.variants.find(v => v.sku === decodedText || v.barcode === decodedText);
            const color = colors.find(c => c.id === (variant.color_id || variant.colorId));
            const size = sizes.find(s => s.id === (variant.size_id || variant.sizeId));
            
            setSelectedProduct(foundProduct);
            setCurrentColor(color);
            setCurrentSize(size);
            toast({ title: "تم العثور على المنتج", description: `${foundProduct.name} (${color?.name}, ${size?.name || size?.value})` });
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
                                    {/* العناصر المختارة */}
                                    {selectedItems.length > 0 && (
                                        <div className="border rounded-lg p-4 bg-muted/30">
                                            <h4 className="font-medium mb-2">العناصر المختارة ({selectedItems.length})</h4>
                                            <div className="space-y-2 max-h-32 overflow-y-auto">
                                                {selectedItems.map((item, index) => (
                                                    <div key={index} className="flex items-center justify-between text-sm bg-background p-2 rounded">
                                                        <span>{item.productName} - {item.color} - {item.size} (كمية: {item.quantity})</span>
                                                        <Button variant="ghost" size="sm" onClick={() => removeSelectedItem(index)}>
                                                            حذف
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-4">
                                        <Command className="rounded-lg border shadow-md">
                                            <CommandList>
                                                <CommandGroup heading="جميع الألوان المتاحة">
                                                     <ScrollArea className="h-40">
                                                         {(availableColors || []).map((color) => (
                                                             <div key={color.id} onClick={() => setCurrentColor(color)} className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground">
                                                                 <Check className={`ml-2 h-4 w-4 ${currentColor?.id === color.id ? "opacity-100" : "opacity-0"}`} />
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
                                                <CommandGroup heading="جميع القياسات المتاحة">
                                                    <ScrollArea className="h-40">
                                                          {(availableSizes || []).map((size) => (
                                                              <div key={size.id} onClick={() => setCurrentSize(size)} className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground">
                                                                  <Check className={`ml-2 h-4 w-4 ${currentSize?.id === size.id ? "opacity-100" : "opacity-0"}`} />
                                                                  {size.name || size.value}
                                                              </div>
                                                          ))}
                                                    </ScrollArea>
                                                </CommandGroup>
                                                <Button variant="link" size="sm" onClick={() => setIsSizeDialogOpen(true)}><PlusCircle className="w-4 h-4 ml-1" />إضافة قياس جديد</Button>
                                            </CommandList>
                                        </Command>
                                    </div>
                                    {currentColor && currentSize && (
                                        <div className="p-4 border rounded-lg space-y-3 bg-muted/50">
                                            <div className="grid grid-cols-3 gap-4">
                                                <div><Label>الكمية</Label><Input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} /></div>
                                                <div><Label>سعر التكلفة</Label><Input type="number" value={costPrice} onChange={e => setCostPrice(e.target.value)} /></div>
                                                <div><Label>سعر البيع</Label><Input type="number" value={salePrice} onChange={e => setSalePrice(e.target.value)} /></div>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center">
                                                    <BarcodeIcon className="w-5 h-5 text-muted-foreground mr-2" />
                                                    <p className="font-mono text-sm">
                                                        {selectedProduct.variants?.find(v => (v.color_id || v.colorId) === currentColor.id && (v.size_id || v.sizeId) === currentSize.id)?.sku || 
                                                         selectedProduct.variants?.find(v => (v.color_id || v.colorId) === currentColor.id && (v.size_id || v.sizeId) === currentSize.id)?.barcode || 
                                                         "سيتم توليد باركود جديد"}
                                                    </p>
                                                </div>
                                                 <Button onClick={addCurrentSelection} size="sm">
                                                     <PlusCircle className="w-4 h-4 ml-1" />
                                                     إضافة للقائمة
                                                 </Button>
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
                        <Button onClick={handleConfirm} disabled={selectedItems.length === 0}>
                            إضافة العناصر للفاتورة ({selectedItems.length})
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <AddEditColorDialog open={isColorDialogOpen} onOpenChange={setIsColorDialogOpen} onSuccess={handleCreateColor} />
            <AddEditSizeDialog open={isSizeDialogOpen} onOpenChange={setIsSizeDialogOpen} onSuccessfulSubmit={handleCreateSize} />
            <UnifiedQRScanner 
                open={isScannerOpen} 
                onOpenChange={setIsScannerOpen} 
                onScanSuccess={handleBarcodeScan}
                title="🔍 قارئ باركود المنتجات"
                description="📱 امسح باركود المنتج لاختياره"
                elementId="purchase-barcode-scanner"
            />
        </>
    );
};

export default SelectProductForPurchaseDialog;