import React from 'react';
import { Page, Text, View, Document, StyleSheet, Font } from '@react-pdf/renderer';
import { AmiriFont } from '@/lib/AmiriFont.js';

Font.register({
  family: 'Amiri',
  src: AmiriFont,
});

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    padding: 20,
    fontFamily: 'Amiri',
  },
  header: {
    textAlign: 'center',
    marginBottom: 25,
    borderBottomWidth: 3,
    borderBottomColor: '#2563eb',
    paddingBottom: 15,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 20,
  },
  headerText: {
    fontSize: 28,
    color: '#1e40af',
    fontWeight: 'bold',
  },
  companyInfo: {
    fontSize: 14,
    color: '#374151',
    marginTop: 8,
  },
  dateText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 6,
  },
  summarySection: {
    backgroundColor: '#eff6ff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 10,
    textAlign: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#374151',
  },
  summaryValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  productSection: {
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 15,
    backgroundColor: '#fefefe',
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  productName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  productCategory: {
    fontSize: 12,
    color: '#6b7280',
    backgroundColor: '#e0e7ff',
    padding: 4,
    borderRadius: 4,
  },
  productInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  productInfoItem: {
    fontSize: 10,
    color: '#374151',
  },
  table: {
    display: "table",
    width: "auto",
    marginTop: 10,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: '#EAEAEA',
    alignItems: 'center',
  },
  tableHeader: {
    backgroundColor: '#1e40af',
    color: 'white',
    borderRadius: 6,
  },
  tableColHeader: {
    width: '20%',
    padding: 8,
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  tableCol: {
    width: '20%',
    padding: 8,
    fontSize: 11,
    textAlign: 'center',
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
  },
  stockStatus: {
    padding: 4,
    borderRadius: 4,
    textAlign: 'center',
    fontSize: 9,
    fontWeight: 'bold',
  },
  stockLow: {
    backgroundColor: '#fef2f2',
    color: '#dc2626',
  },
  stockMedium: {
    backgroundColor: '#fffbeb',
    color: '#d97706',
  },
  stockHigh: {
    backgroundColor: '#f0fdf4',
    color: '#16a34a',
  },
  colorCell: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorBox: {
    width: 10,
    height: 10,
    borderRadius: 2,
    marginRight: 5,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    textAlign: 'center',
    fontSize: 8,
    color: 'grey',
  },
});

const InventoryPDF = React.forwardRef(({ products }, ref) => {
  if (!products || !Array.isArray(products)) {
    console.error('InventoryPDF: products prop is missing or invalid');
    return null;
  }

  const totalProducts = products.length;
  const totalVariants = products.reduce((sum, p) => sum + (p.variants?.length || 0), 0);
  const totalStock = products.reduce((sum, p) => 
    sum + (p.variants?.reduce((varSum, v) => varSum + (v.quantity || 0), 0) || 0), 0
  );
  const lowStockVariants = products.reduce((sum, p) => 
    sum + (p.variants?.filter(v => (v.quantity || 0) > 0 && (v.quantity || 0) <= 5).length || 0), 0
  );
  const goodStockVariants = products.reduce((sum, p) => 
    sum + (p.variants?.filter(v => (v.quantity || 0) >= 11).length || 0), 0
  );

  return (
    <Document ref={ref}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.headerText}>تقرير الجرد التفصيلي</Text>
          <Text style={styles.companyInfo}>نظام RYUS لإدارة المخزون</Text>
          <Text style={styles.dateText}>تاريخ التقرير: {new Date().toLocaleDateString('ar-EG', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}</Text>
        </View>

        <View style={styles.summarySection}>
          <Text style={styles.summaryTitle}>ملخص التقرير</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>إجمالي المنتجات:</Text>
            <Text style={styles.summaryValue}>{totalProducts}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>إجمالي المتغيرات:</Text>
            <Text style={styles.summaryValue}>{totalVariants}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>إجمالي المخزون:</Text>
            <Text style={styles.summaryValue}>{totalStock} قطعة</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>متغيرات منخفضة المخزون:</Text>
            <Text style={styles.summaryValue}>{lowStockVariants}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>متغيرات بمخزون جيد (11+):</Text>
            <Text style={styles.summaryValue}>{goodStockVariants}</Text>
          </View>
        </View>

        {products.map(product => (
          <View key={product.id} style={styles.productSection} wrap={false}>
            <View style={styles.productHeader}>
              <View>
                <Text style={styles.productName}>{product.name}</Text>
                <View style={styles.productInfo}>
                  <Text style={styles.productInfoItem}>التصنيف: {product.categories?.main_category || 'غير محدد'}</Text>
                  <Text style={styles.productInfoItem}>إجمالي المتغيرات: {product.variants?.length || 0}</Text>
                  <Text style={styles.productInfoItem}>إجمالي المخزون: {product.totalStock || 0}</Text>
                </View>
              </View>
              <Text style={styles.productCategory}>{product.stockLevel === 'low' ? 'منخفض' : product.stockLevel === 'medium' ? 'متوسط' : 'جيد'}</Text>
            </View>
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableHeader]}>
                <Text style={styles.tableColHeader}>اللون</Text>
                <Text style={styles.tableColHeader}>القياس</Text>
                <Text style={styles.tableColHeader}>الكمية</Text>
                <Text style={styles.tableColHeader}>المحجوز</Text>
                <Text style={styles.tableColHeader}>الحالة</Text>
              </View>
              {product.variants?.map(variant => {
                const quantity = variant.quantity || 0;
                const getStockStatusStyle = () => {
                  if (quantity === 0) return styles.stockLow;
                  if (quantity > 0 && quantity <= 5) return styles.stockLow;
                  if (quantity >= 6 && quantity <= 10) return styles.stockMedium;
                  return styles.stockHigh; // 11+
                };

                const getStockStatusText = () => {
                  if (quantity === 0) return 'نفذ';
                  if (quantity > 0 && quantity <= 5) return 'منخفض';
                  if (quantity >= 6 && quantity <= 10) return 'متوسط';
                  return 'جيد'; // 11+
                };

                return (
                  <View key={variant.id} style={styles.tableRow}>
                    <View style={[styles.tableCol, styles.colorCell]}>
                      <View style={[styles.colorBox, { backgroundColor: variant.color_hex || '#e5e7eb' }]} />
                      <Text>{variant.color || 'لا يوجد'}</Text>
                    </View>
                    <Text style={styles.tableCol}>{variant.size || 'لا يوجد'}</Text>
                    <Text style={styles.tableCol}>{quantity}</Text>
                    <Text style={styles.tableCol}>{variant.reserved || 0}</Text>
                    <View style={[styles.tableCol, styles.stockStatus, getStockStatusStyle()]}>
                      <Text>{getStockStatusText()}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        ))}

        <Text style={styles.footer} render={({ pageNumber, totalPages }) => (
          `تم إنشاء التقرير بواسطة نظام RYUS | صفحة ${pageNumber} من ${totalPages}`
        )} fixed />
      </Page>
    </Document>
  );
});

export default InventoryPDF;