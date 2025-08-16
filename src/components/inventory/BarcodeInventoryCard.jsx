import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Camera, QrCode, AlertTriangle, Play, Pause, ListChecks, CheckCircle, XCircle } from 'lucide-react';
import { useInventory } from '@/contexts/InventoryContext';
import { toast } from '@/components/ui/use-toast';


const BarcodeInventoryCard = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><QrCode /> الجرد بـ QR Code</CardTitle>
                    <CardDescription>جرد المخزون بسرعة ودقة باستخدام قارئ QR Code.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button 
                        onClick={() => setIsModalOpen(true)}
                        className="bg-gradient-to-r from-blue-500 via-blue-600 to-purple-600 hover:from-blue-600 hover:via-blue-700 hover:to-purple-700 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl"
                    >
                        <Play className="w-4 h-4 ml-2" />
                        بدء الجرد بـ QR Code
                    </Button>
                </CardContent>
            </Card>
            <BarcodeInventoryDialog open={isModalOpen} onOpenChange={setIsModalOpen} />
        </>
    );
};

const BarcodeInventoryDialog = ({ open, onOpenChange }) => {
    const { products } = useInventory(); // المنتجات مفلترة تلقائياً حسب الصلاحيات
    const [isScanning, setIsScanning] = useState(false);
    const [scannedItems, setScannedItems] = useState({});
    const [cameraError, setCameraError] = useState(null);
    const [showResults, setShowResults] = useState(false);
    const html5QrCodeRef = useRef(null);
    const audioRef = useRef(null);

    useEffect(() => {
        audioRef.current = new Audio('https://storage.googleapis.com/hostinger-horizons-assets-prod/1f3b5d57-e29a-4462-965e-89e9a8cac3f1/e2e50337c7635c754d7764d1f2b60434.mp3');
        return () => {
            if (html5QrCodeRef.current?.isScanning) {
                stopScanning();
            }
        };
    }, []);

    const findVariantByBarcode = (barcode) => {
        for (const product of products) {
            const variant = product.variants.find(v => v.barcode === barcode || v.sku === barcode);
            if (variant) return { product, variant };
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
            audioRef.current?.play();
        } else {
            toast({ title: "QR code غير معروف", variant: 'destructive' });
        }
    };

    const startScanning = async () => {
        setCameraError(null);
        try {
            await Html5Qrcode.getCameras();
            const html5QrCode = new Html5Qrcode("reader");
            html5QrCodeRef.current = html5QrCode;
            await html5QrCode.start(
                { facingMode: "environment" },
                { fps: 5, qrbox: { width: 250, height: 150 } },
                onScanSuccess,
                () => {}
            );
            setIsScanning(true);
        } catch (err) {
            setCameraError("لا يمكن الوصول للكاميرا. يرجى التأكد من صلاحيات المتصفح.");
        }
    };

    const stopScanning = async () => {
        if (html5QrCodeRef.current?.isScanning) {
            await html5QrCodeRef.current.stop();
        }
        setIsScanning(false);
    };

    const handleFinish = () => {
        stopScanning();
        setShowResults(true);
    };
    
    const handleClose = () => {
        stopScanning();
        onOpenChange(false);
        setScannedItems({});
        setShowResults(false);
    }

    const totalScannedCount = useMemo(() => Object.values(scannedItems).reduce((sum, item) => sum + item.scannedCount, 0), [scannedItems]);

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-5xl h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>الجرد بـ QR Code</DialogTitle>
                    <DialogDescription>امسح المنتجات ضوئياً لمقارنتها بالمخزون المسجل.</DialogDescription>
                </DialogHeader>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 overflow-hidden">
                    <div className="lg:col-span-2 flex flex-col gap-4">
                        <div id="reader" className="w-full bg-secondary rounded-lg overflow-hidden aspect-video">
                            {cameraError && (
                                <div className="flex items-center justify-center h-full">
                                    <Alert variant="destructive" className="w-auto">
                                        <AlertTriangle className="h-4 w-4" />
                                        <AlertTitle>خطأ في الكاميرا!</AlertTitle>
                                        <AlertDescription>{cameraError}</AlertDescription>
                                    </Alert>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2 justify-center">
                            {!isScanning ? (
                                <Button onClick={startScanning} size="lg">
                                    <Play className="w-5 h-5 ml-2" /> بدء المسح
                                </Button>
                            ) : (
                                <>
                                    <Button onClick={stopScanning} variant="destructive" size="lg">
                                        <Pause className="w-5 h-5 ml-2" /> إيقاف مؤقت
                                    </Button>
                                    <Button onClick={handleFinish} variant="default" size="lg">
                                        <ListChecks className="w-5 h-5 ml-2" /> إنهاء والمقارنة
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>

                    <Card className="flex flex-col">
                        <CardHeader>
                            <CardTitle>المنتجات الممسوحة</CardTitle>
                            <CardDescription>الإجمالي: {totalScannedCount} قطعة</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-hidden">
                            <ScrollArea className="h-full pr-4">
                                <div className="space-y-3">
                                    <div className="space-y-3">
                                        {Object.entries(scannedItems).map(([key, item]) => (
                                            <div key={key} className="animate-fade-in">
                                                <div className="flex items-center gap-3 p-2 bg-secondary/50 rounded-md">
                                                    <img src={item.image} alt={item.productName} className="w-12 h-12 rounded-md object-cover"/>
                                                    <div className="flex-1"><p className="font-semibold text-sm truncate">{item.productName}</p><p className="text-xs text-muted-foreground">{item.variantInfo}</p></div>
                                                    <div className="text-lg font-bold text-primary">{item.scannedCount}</div>
                                                </div>
                                    </div>
                                        ))}
                                        {Object.keys(scannedItems).length === 0 && <p className="text-center text-muted-foreground py-10">بانتظار مسح المنتجات...</p>}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </div>
                <InventoryResultDialog open={showResults} onOpenChange={setShowResults} results={scannedItems} />
            </DialogContent>
        </Dialog>
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
                    <DialogDescription>مقارنة بين الكمية الممسوحة والكمية المسجلة في النظام.</DialogDescription>
                </DialogHeader>
                <div className="max-h-[70vh] overflow-y-auto">
                    <Table>
                        <TableHeader><TableRow><TableHead>المنتج</TableHead><TableHead>المسجل</TableHead><TableHead>الفعلي</TableHead><TableHead>الفرق</TableHead><TableHead>الحالة</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {comparisonData.map(item => (
                                <TableRow key={item.sku} className={getRowClass(item.difference)}>
                                    <TableCell><div className="font-medium">{item.productName}</div><div className="text-sm text-muted-foreground">{item.variantInfo}</div></TableCell>
                                    <TableCell>{item.systemCount}</TableCell>
                                    <TableCell className="font-bold">{item.scannedCount}</TableCell>
                                    <TableCell className="font-bold">{item.difference > 0 ? `+${item.difference}` : item.difference}</TableCell>
                                    <TableCell>
                                        {item.difference === 0 && <CheckCircle className="w-5 h-5 text-green-500" />}
                                        {item.difference !== 0 && <XCircle className="w-5 h-5 text-red-500" />}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                <DialogFooter><Button onClick={() => onOpenChange(false)}>إغلاق</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default BarcodeInventoryCard;