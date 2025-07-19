import React from 'react';
import { Document, Page, Text, View, StyleSheet, PDFDownloadLink, Font } from '@react-pdf/renderer';
import { Button } from '@/components/ui/button';
import { Download, FileText } from 'lucide-react';

// تسجيل الخطوط العربية
Font.register({
  family: 'Amiri',
  fonts: [
    { src: '/fonts/Amiri-Regular.ttf' },
    { src: '/fonts/Amiri-Bold.ttf', fontWeight: 'bold' }
  ]
});

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    padding: 40,
    fontFamily: 'Amiri',
    direction: 'rtl',
    fontSize: 12,
  },
  header: {
    marginBottom: 30,
    borderBottom: 3,
    borderBottomColor: '#2563eb',
    paddingBottom: 20,
    textAlign: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 10,
  },
  companyName: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 15,
  },
  invoiceInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    padding: 15,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
  },
  infoSection: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 10,
    borderBottom: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 5,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  label: {
    fontSize: 11,
    color: '#6b7280',
    width: 120,
    fontWeight: 'bold',
  },
  value: {
    fontSize: 11,
    color: '#111827',
    flex: 1,
  },
  table: {
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#2563eb',
    padding: 12,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  tableRow: {
    flexDirection: 'row',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    minHeight: 40,
  },
  tableRowAlt: {
    backgroundColor: '#f9fafb',
  },
  tableCell: {
    fontSize: 10,
    color: '#374151',
    textAlign: 'center',
    paddingHorizontal: 5,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableCellHeader: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
  },
  col1: { width: '8%' },
  col2: { width: '32%' },
  col3: { width: '15%' },
  col4: { width: '15%' },
  col5: { width: '15%' },
  col6: { width: '15%' },
  totalSection: {
    marginTop: 30,
    padding: 20,
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    border: 2,
    borderColor: '#2563eb',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingVertical: 5,
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#374151',
  },
  totalValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1e40af',
  },
  grandTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e40af',
    paddingTop: 10,
    borderTop: 2,
    borderTopColor: '#2563eb',
  },
  footer: {
    marginTop: 40,
    paddingTop: 20,
    borderTop: 1,
    borderTopColor: '#e5e7eb',
    textAlign: 'center',
  },
  footerText: {
    fontSize: 10,
    color: '#6b7280',
    marginBottom: 5,
  },
  notes: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#fefce8',
    borderRadius: 8,
    borderLeft: 4,
    borderLeftColor: '#eab308',
  },
  notesTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#92400e',
    marginBottom: 8,
  },
  notesText: {
    fontSize: 10,
    color: '#a16207',
    lineHeight: 1.4,
  }
});

const PurchaseInvoicePDF = ({ purchase }) => {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ar-IQ', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0) + ' د.ع';
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('ar-IQ', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getStatusText = (status) => {
    switch(status) {
      case 'completed': return 'مكتملة';
      case 'pending': return 'قيد الانتظار';
      case 'cancelled': return 'ملغية';
      default: return 'غير محدد';
    }
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>فاتورة شراء</Text>
          <Text style={styles.companyName}>نظام إدارة المخزون RYUS</Text>
        </View>

        {/* Invoice Info */}
        <View style={styles.invoiceInfo}>
          <View style={styles.infoSection}>
            <Text style={styles.sectionTitle}>معلومات الفاتورة</Text>
            <View style={styles.row}>
              <Text style={styles.label}>رقم الفاتورة:</Text>
              <Text style={styles.value}>{purchase.purchase_number}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>تاريخ الإنشاء:</Text>
              <Text style={styles.value}>{formatDate(purchase.created_at)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>حالة الفاتورة:</Text>
              <Text style={styles.value}>{getStatusText(purchase.status)}</Text>
            </View>
          </View>
          
          <View style={styles.infoSection}>
            <Text style={styles.sectionTitle}>بيانات المورد</Text>
            <View style={styles.row}>
              <Text style={styles.label}>اسم المورد:</Text>
              <Text style={styles.value}>{purchase.supplier_name || 'غير محدد'}</Text>
            </View>
            {purchase.supplier_contact && (
              <View style={styles.row}>
                <Text style={styles.label}>جهة الاتصال:</Text>
                <Text style={styles.value}>{purchase.supplier_contact}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Items Table */}
        {purchase.items && purchase.items.length > 0 && (
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableCellHeader, styles.col1]}>#</Text>
              <Text style={[styles.tableCellHeader, styles.col2]}>اسم المنتج</Text>
              <Text style={[styles.tableCellHeader, styles.col3]}>اللون</Text>
              <Text style={[styles.tableCellHeader, styles.col4]}>القياس</Text>
              <Text style={[styles.tableCellHeader, styles.col5]}>الكمية</Text>
              <Text style={[styles.tableCellHeader, styles.col6]}>سعر التكلفة</Text>
            </View>
            {purchase.items.map((item, index) => (
              <View key={index} style={[styles.tableRow, index % 2 === 1 && styles.tableRowAlt]}>
                <Text style={[styles.tableCell, styles.col1]}>{index + 1}</Text>
                <Text style={[styles.tableCell, styles.col2]}>{item.productName || 'غير محدد'}</Text>
                <Text style={[styles.tableCell, styles.col3]}>{item.color || 'افتراضي'}</Text>
                <Text style={[styles.tableCell, styles.col4]}>{item.size || 'افتراضي'}</Text>
                <Text style={[styles.tableCell, styles.col5]}>{item.quantity}</Text>
                <Text style={[styles.tableCell, styles.col6]}>{formatCurrency(item.costPrice)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Totals */}
        <View style={styles.totalSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>إجمالي قيمة المنتجات:</Text>
            <Text style={styles.totalValue}>
              {formatCurrency((purchase.items || []).reduce((sum, item) => sum + (item.costPrice * item.quantity), 0))}
            </Text>
          </View>
          {/* حساب الشحن من إجمالي الفاتورة - قيمة المنتجات */}
          {((purchase.total_amount || 0) - (purchase.items || []).reduce((sum, item) => sum + (item.costPrice * item.quantity), 0)) > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>مصاريف الشحن:</Text>
              <Text style={styles.totalValue}>
                {formatCurrency((purchase.total_amount || 0) - (purchase.items || []).reduce((sum, item) => sum + (item.costPrice * item.quantity), 0))}
              </Text>
            </View>
          )}
          <View style={[styles.totalRow, { borderTop: 2, borderTopColor: '#2563eb', paddingTop: 10 }]}>
            <Text style={styles.grandTotal}>إجمالي الفاتورة:</Text>
            <Text style={styles.grandTotal}>{formatCurrency(purchase.total_amount)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>المبلغ المدفوع:</Text>
            <Text style={styles.totalValue}>{formatCurrency(purchase.paid_amount)}</Text>
          </View>
        </View>

        {/* Notes */}
        {purchase.notes && (
          <View style={styles.notes}>
            <Text style={styles.notesTitle}>ملاحظات:</Text>
            <Text style={styles.notesText}>{purchase.notes}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>تم إنشاء هذه الفاتورة بواسطة نظام إدارة المخزون RYUS</Text>
          <Text style={styles.footerText}>تاريخ الطباعة: {formatDate(new Date())}</Text>
          <Text style={styles.footerText}>هذه وثيقة رسمية - يرجى الاحتفاظ بها للمراجعة</Text>
        </View>
      </Page>
    </Document>
  );
};

const PurchaseInvoicePDFButton = ({ purchase }) => {
  const fileName = `فاتورة_شراء_${purchase.purchase_number || purchase.id}.pdf`;
  
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
          className="gap-1 text-green-600 hover:text-green-700 border-green-200 hover:border-green-300 hover:bg-green-50"
        >
          {loading ? (
            <>
              <FileText className="h-4 w-4" />
              تحضير...
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              PDF
            </>
          )}
        </Button>
      )}
    </PDFDownloadLink>
  );
};

export default PurchaseInvoicePDFButton;