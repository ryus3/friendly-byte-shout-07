import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Camera, QrCode, AlertTriangle, Play, Pause, ListChecks, CheckCircle, XCircle } from 'lucide-react';
import { useInventory } from '@/contexts/InventoryContext';
import { useFilteredProducts } from '@/hooks/useFilteredProducts';
import { toast } from '@/components/ui/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import UnifiedQRScanner from '@/components/shared/UnifiedQRScanner';

const BarcodeInventoryPage = () => {
    const { allProducts } = useInventory(); // جلب كل المنتجات
    const products = useFilteredProducts(allProducts); // تطبيق الفلترة حسب الصلاحيات
    const [isScanning, setIsScanning] = useState(false);
    const [scannedItems, setScannedItems] = useState({});
    const [lastScanned, setLastScanned] = useState(null);
    const [showResults, setShowResults] = useState(false);
    const [scannerOpen, setScannerOpen] = useState(false);
    const audioRef = useRef(null);

    useEffect(() => {
        audioRef.current = new Audio('https://storage.googleapis.com/hostinger-horizons-assets-prod/1f3b5d57-e29a-4462-965e-89e9a8cac3f1/e2e50337c7635c754d7764d1f2b60434.mp3');
        return () => {
            setScannerOpen(false);
        };
    }, []);

    const findVariantByBarcode = (barcode) => {
        // المنتجات مفلترة تلقائياً من السياق
        for (const product of products) {
            const variant = product.variants.find(v => v.barcode === barcode || v.sku === barcode);
            if (variant) {
                return { product, variant };
            }
        }
        return null;
    };

    const onScanSuccess = (decodedText) => {
        const found = findVariantByBarcode(decodedText);
        if (found) {
            const { product, variant } = found;
            const key = variant.sku || variant.barcode;
            setScannedItems(prev => ({
                ...prev,
                [key]: {
                    productName: product.name,
                    variantInfo: `${variant.color} / ${variant.size}`,
                    sku: variant.sku,
                    image: variant.image || product.images?.[0],
                    scannedCount: (prev[key]?.scannedCount || 0) + 1,
                    systemCount: variant.quantity,
                }
            }));
            setLastScanned({ name: product.name, image: variant.image || product.images?.[0] });
            audioRef.current?.play();
        } else {
            toast({
                title: "باركود غير معروف",
                description: `الباركود ${decodedText} غير مسجل في النظام.`,
                variant: 'destructive',
            });
        }
    };

    const startScanning = () => {
        setScannerOpen(true);
        setIsScanning(true);
    };

    const stopScanning = () => {
        setScannerOpen(false);
        setIsScanning(false);
    };

    const handleFinish = () => {
        stopScanning();
        setShowResults(true);
    };

    const totalScannedCount = useMemo(() => Object.values(scannedItems).reduce((sum, item) => sum + item.scannedCount, 0), [scannedItems]);

    return (
        <>
            <Helmet>
                <title>الجرد بالباركود - نظام RYUS</title>
                <meta name="description" content="جرد المخزون بسرعة ودقة باستخدام قارئ الباركود." />
            </Helmet>

            <div className="container mx-auto p-4 space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <h1 className="text-3xl font-bold gradient-text flex items-center gap-2">
                        <QrCode /> الجرد بالباركود
                    </h1>
                    {!isScanning && (
                        <Button onClick={startScanning} size="lg">
                            <Play className="w-5 h-5 ml-2" />
                            بدء الجرد
                        </Button>
                    )}
                    {isScanning && (
                        <div className="flex gap-2">
                            <Button onClick={stopScanning} variant="destructive" size="lg">
                                <Pause className="w-5 h-5 ml-2" />
                                إيقاف مؤقت
                            </Button>
                            <Button onClick={handleFinish} variant="default" size="lg">
                                <ListChecks className="w-5 h-5 ml-2" />
                                إنهاء والمقارنة
                            </Button>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card className="lg:col-span-2 h-[450px]">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Camera /> شاشة المسح</CardTitle>
                        </CardHeader>
                        <CardContent className="flex items-center justify-center h-full">
                            <div className="w-full h-full max-h-[350px] aspect-video bg-secondary rounded-lg overflow-hidden flex items-center justify-center text-muted-foreground text-sm">
                                سيتم فتح نافذة القارئ الموحد عند البدء
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="h-[450px] flex flex-col">
                        <CardHeader>
                            <CardTitle>المنتجات الممسوحة</CardTitle>
                            <CardDescription>الإجمالي: {totalScannedCount} قطعة</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-hidden">
                            <ScrollArea className="h-full pr-4">
                                <div className="space-y-3">
                                    <AnimatePresence>
                                        {Object.entries(scannedItems).map(([key, item]) => (
                                            <motion.div
                                                key={key}
                                                layout
                                                initial={{ opacity: 0, y: -10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0 }}
                                            >
                                                <div className="flex items-center gap-3 p-2 bg-secondary/50 rounded-md">
                                                    <img src={item.image} alt={item.productName} className="w-12 h-12 rounded-md object-cover"/>
                                                    <div className="flex-1">
                                                        <p className="font-semibold text-sm truncate">{item.productName}</p>
                                                        <p className="text-xs text-muted-foreground">{item.variantInfo}</p>
                                                    </div>
                                                    <div className="text-lg font-bold text-primary">{item.scannedCount}</div>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                    {Object.keys(scannedItems).length === 0 && <p className="text-center text-muted-foreground py-10">بانتظار مسح المنتجات...</p>}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <InventoryResultDialog
                open={showResults}
                onOpenChange={setShowResults}
                results={scannedItems}
            />

            <UnifiedQRScanner 
                open={scannerOpen}
                onOpenChange={(open) => { setScannerOpen(open); setIsScanning(open); }}
                onScanSuccess={(text) => onScanSuccess(text)}
                title="الجرد بالباركود"
                description="وجه الكاميرا نحو QR/Barcode"
                elementId="barcode-inventory-page-reader"
            />
        </>
    );
};

const InventoryResultDialog = ({ open, onOpenChange, results }) => {
    const comparisonData = useMemo(() => {
        return Object.values(results).map(item => ({
            ...item,
            difference: item.scannedCount - item.systemCount,
        }));
    }, [results]);

    const getRowClass = (difference) => {
        if (difference > 0) return 'bg-blue-500/10';
        if (difference < 0) return 'bg-red-500/10';
        return '';
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>نتائج جرد المخزون</DialogTitle>
                    <DialogDescription>
                        مقارنة بين الكمية الممسوحة والكمية المسجلة في النظام.
                    </DialogDescription>
                </DialogHeader>
                <div className="max-h-[70vh] overflow-y-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>المنتج</TableHead>
                                <TableHead>المسجل</TableHead>
                                <TableHead>الفعلي</TableHead>
                                <TableHead>الفرق</TableHead>
                                <TableHead>الحالة</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {comparisonData.map(item => (
                                <TableRow key={item.sku} className={getRowClass(item.difference)}>
                                    <TableCell>
                                        <div className="font-medium">{item.productName}</div>
                                        <div className="text-sm text-muted-foreground">{item.variantInfo}</div>
                                    </TableCell>
                                    <TableCell>{item.systemCount}</TableCell>
                                    <TableCell className="font-bold">{item.scannedCount}</TableCell>
                                    <TableCell className="font-bold">
                                        {item.difference > 0 ? `+${item.difference}` : item.difference}
                                    </TableCell>
                                    <TableCell>
                                        {item.difference === 0 && <CheckCircle className="w-5 h-5 text-green-500" />}
                                        {item.difference !== 0 && <XCircle className="w-5 h-5 text-red-500" />}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                <DialogFooter>
                    <Button onClick={() => onOpenChange(false)}>إغلاق</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default BarcodeInventoryPage;