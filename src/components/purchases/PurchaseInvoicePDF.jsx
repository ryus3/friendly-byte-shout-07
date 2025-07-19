import React from 'react';
import { Document, Page, Text, View, StyleSheet, PDFDownloadLink, Font } from '@react-pdf/renderer';
import { Button } from '@/components/ui/button';
import { Download, FileText } from 'lucide-react';

// تسجيل خط عربي - سيتم استخدامه إذا كان متاحاً
try {
  Font.register({
    family: 'Amiri',
    src: '/fonts/Amiri-Regular.ttf'
  });

  Font.register({
    family: 'Amiri-Bold',
    src: '/fonts/Amiri-Bold.ttf'
  });
} catch (error) {
  console.log('الخطوط العربية غير متاحة، سيتم استخدام الخط الافتراضي');
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    padding: 30,
    fontFamily: 'Helvetica', // استخدام خط افتراضي
    direction: 'ltr', // تعديل لدعم أفضل
  },
  header: {
    marginBottom: 20,
    borderBottom: 2,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 15,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 10,
  },
  invoiceNumber: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 5,
  },
  invoiceDate: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#334155',
    marginBottom: 8,
    borderBottom: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 3,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottom: 1,
    borderBottomColor: '#f1f5f9',
  },
  rowBold: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    backgroundColor: '#f8fafc',
    fontWeight: 'bold',
    marginTop: 5,
  },
  label: {
    fontSize: 12,
    color: '#475569',
    width: '40%',
  },
  value: {
    fontSize: 12,
    color: '#1e293b',
    width: '60%',
    textAlign: 'right',
  },
  table: {
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    padding: 8,
    borderBottom: 2,
    borderBottomColor: '#e2e8f0',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 6,
    borderBottom: 1,
    borderBottomColor: '#f1f5f9',
  },
  tableCell: {
    fontSize: 10,
    color: '#374151',
    textAlign: 'center',
  },
  tableCellHeader: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
  },
  col1: { width: '10%' },
  col2: { width: '25%' },
  col3: { width: '15%' },
  col4: { width: '15%' },
  col5: { width: '15%' },
  col6: { width: '20%' },
  footer: {
    marginTop: 30,
    paddingTop: 15,
    borderTop: 2,
    borderTopColor: '#e2e8f0',
    textAlign: 'center',
  },
  footerText: {
    fontSize: 10,
    color: '#64748b',
  },
  total: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#059669',
  }
});

const PurchaseInvoicePDF = ({ purchase }) => {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ar-IQ', {
      style: 'currency',
      currency: 'IQD',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('ar-IQ', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>فاتورة شراء</Text>
          <Text style={styles.invoiceNumber}>رقم الفاتورة: {purchase.purchase_number}</Text>
          <Text style={styles.invoiceDate}>التاريخ: {formatDate(purchase.created_at)}</Text>
        </View>

        {/* بيانات المورد */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>بيانات المورد</Text>
          <View style={styles.row}>
            <Text style={styles.label}>اسم المورد:</Text>
            <Text style={styles.value}>{purchase.supplier_name}</Text>
          </View>
          {purchase.supplier_contact && (
            <View style={styles.row}>
              <Text style={styles.label}>معلومات الاتصال:</Text>
              <Text style={styles.value}>{purchase.supplier_contact}</Text>
            </View>
          )}
        </View>

        {/* تفاصيل الفاتورة */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>تفاصيل الفاتورة</Text>
          <View style={styles.row}>
            <Text style={styles.label}>حالة الفاتورة:</Text>
            <Text style={styles.value}>{purchase.status === 'completed' ? 'مكتملة' : 'قيد الانتظار'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>إجمالي المبلغ:</Text>
            <Text style={styles.value}>{formatCurrency(purchase.total_amount)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>المبلغ المدفوع:</Text>
            <Text style={styles.value}>{formatCurrency(purchase.paid_amount)}</Text>
          </View>
          {purchase.notes && (
            <View style={styles.row}>
              <Text style={styles.label}>ملاحظات:</Text>
              <Text style={styles.value}>{purchase.notes}</Text>
            </View>
          )}
        </View>

        {/* جدول المنتجات */}
        {purchase.items && purchase.items.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>المنتجات المشتراة</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableCellHeader, styles.col1]}>#</Text>
                <Text style={[styles.tableCellHeader, styles.col2]}>المنتج</Text>
                <Text style={[styles.tableCellHeader, styles.col3]}>اللون</Text>
                <Text style={[styles.tableCellHeader, styles.col4]}>القياس</Text>
                <Text style={[styles.tableCellHeader, styles.col5]}>الكمية</Text>
                <Text style={[styles.tableCellHeader, styles.col6]}>سعر التكلفة</Text>
              </View>
              {purchase.items.map((item, index) => (
                <View key={index} style={styles.tableRow}>
                  <Text style={[styles.tableCell, styles.col1]}>{index + 1}</Text>
                  <Text style={[styles.tableCell, styles.col2]}>{item.productName || 'غير محدد'}</Text>
                  <Text style={[styles.tableCell, styles.col3]}>{item.color || 'افتراضي'}</Text>
                  <Text style={[styles.tableCell, styles.col4]}>{item.size || 'افتراضي'}</Text>
                  <Text style={[styles.tableCell, styles.col5]}>{item.quantity}</Text>
                  <Text style={[styles.tableCell, styles.col6]}>{formatCurrency(item.costPrice)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* الإجماليات */}
        <View style={styles.section}>
          <View style={styles.rowBold}>
            <Text style={styles.label}>إجمالي قيمة الفاتورة:</Text>
            <Text style={[styles.value, styles.total]}>{formatCurrency(purchase.total_amount)}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>تم إنشاء هذه الفاتورة بواسطة نظام RYUS</Text>
          <Text style={styles.footerText}>تاريخ الطباعة: {formatDate(new Date())}</Text>
        </View>
      </Page>
    </Document>
  );
};

const PurchaseInvoicePDFButton = ({ purchase }) => {
  const fileName = `فاتورة_شراء_${purchase.purchase_number}.pdf`;
  
  return (
    <PDFDownloadLink 
      document={<PurchaseInvoicePDF purchase={purchase} />} 
      fileName={fileName}
    >
      {({ blob, url, loading, error }) => (
        <Button 
          variant="outline" 
          size="sm" 
          disabled={loading}
          className="gap-2"
        >
          {loading ? (
            <>
              <FileText className="h-4 w-4" />
              جاري التحضير...
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              تحميل PDF
            </>
          )}
        </Button>
      )}
    </PDFDownloadLink>
  );
};

export default PurchaseInvoicePDFButton;