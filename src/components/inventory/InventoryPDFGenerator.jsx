import React from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { PDFDownloadLink, Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import { toast } from '@/hooks/use-toast';

// تصميم PDF الاحترافي بـ React PDF
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 30,
    fontFamily: 'Helvetica',
  },
  header: {
    backgroundColor: '#2563eb',
    color: '#ffffff',
    padding: 20,
    marginBottom: 20,
    textAlign: 'center',
    borderRadius: 5
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 12,
    opacity: 0.9,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    padding: 15,
    marginBottom: 20,
    borderRadius: 5,
    border: '1 solid #e5e7eb'
  },
  statItem: {
    flex: 1,
    textAlign: 'center'
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937'
  },
  statLabel: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 2
  },
  table: {
    display: 'table',
    width: 'auto',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRightWidth: 0,
    borderBottomWidth: 0
  },
  tableRow: {
    margin: 'auto',
    flexDirection: 'row'
  },
  tableColHeader: {
    width: '25%',
    borderStyle: 'solid',
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderColor: '#e5e7eb',
    backgroundColor: '#374151'
  },
  tableCol: {
    width: '25%',
    borderStyle: 'solid',
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderColor: '#e5e7eb'
  },
  tableCellHeader: {
    margin: 8,
    fontSize: 10,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center'
  },
  tableCell: {
    margin: 8,
    fontSize: 9,
    textAlign: 'center',
    color: '#374151'
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 8,
    borderTop: '1 solid #e5e7eb',
    paddingTop: 10
  }
});

const InventoryPDFDocument = ({ data = [] }) => {
  // حساب الإحصائيات
  const totalProducts = data.length;
  const totalStock = data.reduce((sum, item) => {
    return sum + (item.variants?.reduce((vSum, v) => vSum + (v.quantity || 0), 0) || 0);
  }, 0);
  
  const lowStockItems = data.filter(item => {
    const itemStock = item.variants?.reduce((sum, v) => sum + (v.quantity || 0), 0) || 0;
    return itemStock > 0 && itemStock < 5;
  }).length;
  
  const outOfStockItems = data.filter(item => {
    const itemStock = item.variants?.reduce((sum, v) => sum + (v.quantity || 0), 0) || 0;
    return itemStock === 0;
  }).length;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* رأس التقرير */}
        <View style={styles.header}>
          <Text style={styles.title}>تقرير جرد المخزون</Text>
          <Text style={styles.subtitle}>
            {new Date().toLocaleDateString('ar-EG', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              weekday: 'long'
            })} - {new Date().toLocaleTimeString('ar-EG')}
          </Text>
        </View>

        {/* الإحصائيات */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{totalProducts}</Text>
            <Text style={styles.statLabel}>إجمالي المنتجات</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{totalStock.toLocaleString()}</Text>
            <Text style={styles.statLabel}>إجمالي المخزون</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{lowStockItems}</Text>
            <Text style={styles.statLabel}>منتجات منخفضة</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{outOfStockItems}</Text>
            <Text style={styles.statLabel}>منتجات نافذة</Text>
          </View>
        </View>

        {/* جدول المنتجات */}
        <View style={styles.table}>
          {/* رأس الجدول */}
          <View style={styles.tableRow}>
            <View style={styles.tableColHeader}>
              <Text style={styles.tableCellHeader}>المنتج</Text>
            </View>
            <View style={styles.tableColHeader}>
              <Text style={styles.tableCellHeader}>الكمية المتاحة</Text>
            </View>
            <View style={styles.tableColHeader}>
              <Text style={styles.tableCellHeader}>السعر المتوسط</Text>
            </View>
            <View style={styles.tableColHeader}>
              <Text style={styles.tableCellHeader}>حالة المخزون</Text>
            </View>
          </View>

          {/* بيانات الجدول */}
          {data.map((item, index) => {
            const itemStock = item.variants?.reduce((sum, v) => sum + (v.quantity || 0), 0) || 0;
            const avgPrice = item.variants?.length > 0 
              ? item.variants.reduce((sum, v) => sum + (v.price || 0), 0) / item.variants.length 
              : 0;
            
            let status = 'متوفر';
            if (itemStock === 0) status = 'نافذ';
            else if (itemStock < 5) status = 'منخفض';

            return (
              <View key={item.id} style={[
                styles.tableRow,
                { backgroundColor: index % 2 === 0 ? '#f9fafb' : '#ffffff' }
              ]}>
                <View style={styles.tableCol}>
                  <Text style={styles.tableCell}>
                    {item.name?.substring(0, 20) || 'بدون اسم'}
                  </Text>
                </View>
                <View style={styles.tableCol}>
                  <Text style={styles.tableCell}>{itemStock.toLocaleString()}</Text>
                </View>
                <View style={styles.tableCol}>
                  <Text style={styles.tableCell}>
                    {Math.round(avgPrice).toLocaleString()} د.ع
                  </Text>
                </View>
                <View style={styles.tableCol}>
                  <Text style={[
                    styles.tableCell,
                    { color: status === 'نافذ' ? '#dc2626' : status === 'منخفض' ? '#ea580c' : '#059669' }
                  ]}>
                    {status}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* تذييل التقرير */}
        <Text style={styles.footer}>
          تم إنشاء هذا التقرير بواسطة نظام إدارة المخزون RYUS
        </Text>
      </Page>
    </Document>
  );
};

const InventoryPDFGenerator = ({ 
  inventoryData = [], 
  selectedItems = [], 
  filters = {},
  isLoading = false 
}) => {
  const dataToExport = selectedItems.length > 0 ? 
    inventoryData.filter(item => selectedItems.includes(item.id)) : 
    inventoryData;

  const handleDownloadSuccess = () => {
    toast({
      title: "✅ تم تحميل التقرير بنجاح!",
      description: `تقرير احترافي لـ ${dataToExport.length} منتج`,
      variant: "default"
    });
  };

  const handleDownloadError = () => {
    toast({
      title: "❌ خطأ في تحميل التقرير",
      description: "حدث خطأ أثناء إنشاء ملف PDF",
      variant: "destructive"
    });
  };

  if (!dataToExport || dataToExport.length === 0) {
    return (
      <Button 
        disabled
        className="flex items-center gap-2"
        variant="outline"
      >
        <Download className="w-4 h-4" />
        لا توجد بيانات للتصدير
      </Button>
    );
  }

  const fileName = `تقرير_المخزون_${new Date().toISOString().split('T')[0]}.pdf`;

  return (
    <PDFDownloadLink
      document={<InventoryPDFDocument data={dataToExport} />}
      fileName={fileName}
      onError={handleDownloadError}
    >
      {({ blob, url, loading, error }) => (
        <Button 
          disabled={loading || isLoading}
          className="flex items-center gap-2"
          variant="outline"
          onClick={!loading && !error ? handleDownloadSuccess : undefined}
        >
          <Download className="w-4 h-4" />
          {loading ? 'جاري الإنشاء...' : 'تصدير PDF'}
        </Button>
      )}
    </PDFDownloadLink>
  );
};

export default InventoryPDFGenerator;