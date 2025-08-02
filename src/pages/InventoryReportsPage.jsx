import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Download, Printer } from 'lucide-react';
import { useInventory } from '@/contexts/InventoryContext';
import { PDFDownloadLink, PDFViewer } from '@react-pdf/renderer';
import InventoryReportPDF from '@/components/pdf/InventoryReportPDF';
import { motion } from 'framer-motion';

const InventoryReportsPage = () => {
  const { products, settings } = useInventory();
  const [showPreview, setShowPreview] = useState(false);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>تقرير المخزون</title>
          <style>
            body { font-family: Arial, sans-serif; direction: rtl; }
            .header { text-align: center; margin-bottom: 30px; }
            .stats { display: flex; justify-content: space-around; margin: 20px 0; }
            .stat-box { text-align: center; padding: 10px; border: 1px solid #ddd; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>تقرير المخزون التفصيلي</h1>
            <p>نظام RYUS - ${new Date().toLocaleDateString('ar-EG')}</p>
          </div>
          <div class="stats">
            <div class="stat-box">
              <h3>${products.length}</h3>
              <p>إجمالي المنتجات</p>
            </div>
            <div class="stat-box">
              <h3>${products.reduce((sum, p) => sum + (p.variants?.length || 0), 0)}</h3>
              <p>إجمالي المتغيرات</p>
            </div>
            <div class="stat-box">
              <h3>${products.reduce((sum, p) => sum + (p.variants?.reduce((vSum, v) => vSum + (v.quantity || 0), 0) || 0), 0).toLocaleString()}</h3>
              <p>إجمالي الكمية</p>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold gradient-text">تقارير المخزون</h1>
            <p className="text-muted-foreground">تصدير وطباعة تقارير المخزون المتقدمة</p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                تقرير PDF احترافي
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                تقرير مفصل بالألوان والخطوط العربية
              </p>
              <div className="flex flex-col gap-2">
                <PDFDownloadLink
                  document={<InventoryReportPDF products={products} settings={settings} />}
                  fileName={`تقرير_المخزون_${new Date().toLocaleDateString('ar-EG').replace(/\//g, '-')}.pdf`}
                >
                  {({ loading }) => (
                    <Button className="w-full" disabled={loading}>
                      <Download className="w-4 h-4 ml-2" />
                      {loading ? 'جاري التحضير...' : 'تحميل PDF'}
                    </Button>
                  )}
                </PDFDownloadLink>
                <Button 
                  variant="outline" 
                  onClick={() => setShowPreview(!showPreview)}
                  className="w-full"
                >
                  <FileText className="w-4 h-4 ml-2" />
                  {showPreview ? 'إخفاء المعاينة' : 'معاينة التقرير'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Printer className="w-5 h-5" />
                طباعة سريعة
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                طباعة مباشرة للتقرير
              </p>
              <Button onClick={handlePrint} variant="outline" className="w-full">
                <Printer className="w-4 h-4 ml-2" />
                طباعة الآن
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card>
            <CardHeader>
              <CardTitle>إحصائيات سريعة</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>المنتجات:</span>
                  <span className="font-bold">{products.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>المتغيرات:</span>
                  <span className="font-bold">
                    {products.reduce((sum, p) => sum + (p.variants?.length || 0), 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>إجمالي الكمية:</span>
                  <span className="font-bold text-green-600">
                    {products.reduce((sum, p) => 
                      sum + (p.variants?.reduce((vSum, v) => vSum + (v.quantity || 0), 0) || 0), 0
                    ).toLocaleString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {showPreview && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }} 
          animate={{ opacity: 1, height: 'auto' }} 
          className="border rounded-lg overflow-hidden"
        >
          <div style={{ height: '800px' }}>
            <PDFViewer width="100%" height="100%">
              <InventoryReportPDF products={products} settings={settings} />
            </PDFViewer>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default InventoryReportsPage;