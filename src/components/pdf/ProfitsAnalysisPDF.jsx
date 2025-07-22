import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

// تسجيل الخط العربي
Font.register({
  family: 'Cairo',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/cairo/v28/SLXgc1nY6HkvangtZmpQdkhYl0M.ttf', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/cairo/v28/SLXbc1nY6HkvangtZmpQeGgNl0M1QHs.ttf', fontWeight: 700 },
  ]
});

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    padding: 30,
    fontFamily: 'Cairo',
    direction: 'rtl',
  },
  header: {
    textAlign: 'center',
    marginBottom: 25,
    borderBottom: '3px solid #3B82F6',
    paddingBottom: 15,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1E40AF',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 5,
  },
  dateRange: {
    fontSize: 12,
    color: '#4B5563',
    backgroundColor: '#F3F4F6',
    padding: 8,
    borderRadius: 5,
    marginTop: 10,
  },
  summarySection: {
    backgroundColor: '#F8FAFC',
    border: '2px solid #E2E8F0',
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 15,
    textAlign: 'center',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  summaryCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    border: '1px solid #D1D5DB',
    borderRadius: 5,
    padding: 10,
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 3,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  section: {
    marginBottom: 20,
    border: '1px solid #E5E7EB',
    borderRadius: 8,
    overflow: 'hidden',
  },
  sectionHeader: {
    backgroundColor: '#F9FAFB',
    borderBottom: '1px solid #E5E7EB',
    padding: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  table: {
    width: '100%',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderBottom: '2px solid #D1D5DB',
    padding: 8,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1px solid #E5E7EB',
    padding: 8,
    minHeight: 30,
  },
  tableRowEven: {
    backgroundColor: '#F9FAFB',
  },
  tableCell: {
    fontSize: 10,
    color: '#374151',
    textAlign: 'center',
    paddingHorizontal: 4,
    justifyContent: 'center',
  },
  nameCell: {
    flex: 3,
    textAlign: 'right',
    fontWeight: 'bold',
  },
  profitCell: {
    flex: 2,
    color: '#059669',
    fontWeight: 'bold',
  },
  countCell: {
    flex: 1,
    color: '#7C3AED',
  },
  colorCell: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 4,
    border: '1px solid #D1D5DB',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    textAlign: 'center',
    borderTop: '1px solid #E5E7EB',
    paddingTop: 10,
  },
  footerText: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  noData: {
    textAlign: 'center',
    padding: 20,
    color: '#6B7280',
    fontSize: 12,
  }
});

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('ar-IQ', {
    style: 'decimal',
    minimumFractionDigits: 0
  }).format(Math.abs(amount || 0)) + ' د.ع';
};

const ProfitsAnalysisPDF = ({ analysisData, dateRange, filters }) => {
  const formatDate = (date) => {
    if (!date) return '';
    return format(new Date(date), 'dd/MM/yyyy', { locale: ar });
  };

  const getActiveFilters = () => {
    const activeFilters = [];
    if (filters.department !== 'all') activeFilters.push('القسم');
    if (filters.category !== 'all') activeFilters.push('التصنيف');
    if (filters.productType !== 'all') activeFilters.push('نوع المنتج');
    if (filters.season !== 'all') activeFilters.push('الموسم');
    if (filters.color !== 'all') activeFilters.push('اللون');
    if (filters.size !== 'all') activeFilters.push('القياس');
    return activeFilters.length > 0 ? activeFilters.join(' - ') : 'بدون فلاتر';
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* الرأس */}
        <View style={styles.header}>
          <Text style={styles.title}>تقرير تحليل أرباح المنتجات</Text>
          <Text style={styles.subtitle}>تحليل شامل للأرباح مقسم حسب المعايير المختلفة</Text>
          <Text style={styles.dateRange}>
            الفترة: {formatDate(dateRange.from)} - {formatDate(dateRange.to)}
          </Text>
          <Text style={[styles.dateRange, { marginTop: 5 }]}>
            الفلاتر المطبقة: {getActiveFilters()}
          </Text>
        </View>

        {/* ملخص الأرباح */}
        <View style={styles.summarySection}>
          <Text style={styles.summaryTitle}>الملخص العام</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>إجمالي الأرباح</Text>
              <Text style={styles.summaryValue}>{formatCurrency(analysisData?.totalProfit)}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>عدد الطلبات</Text>
              <Text style={styles.summaryValue}>{analysisData?.totalOrders || 0}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>متوسط الربح</Text>
              <Text style={styles.summaryValue}>{formatCurrency(analysisData?.averageProfit)}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>هامش الربح</Text>
              <Text style={styles.summaryValue}>{(analysisData?.profitMargin || 0).toFixed(1)}%</Text>
            </View>
          </View>
        </View>

        {/* الأرباح حسب الأقسام */}
        {analysisData?.departmentBreakdown?.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>الأرباح حسب الأقسام</Text>
            </View>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableCell, styles.nameCell]}>القسم</Text>
                <Text style={[styles.tableCell, styles.profitCell]}>الربح</Text>
                <Text style={[styles.tableCell, styles.countCell]}>الطلبات</Text>
              </View>
              {analysisData.departmentBreakdown.slice(0, 10).map((dept, index) => (
                <View key={dept.id} style={[styles.tableRow, index % 2 === 0 && styles.tableRowEven]}>
                  <Text style={[styles.tableCell, styles.nameCell]}>{dept.name}</Text>
                  <Text style={[styles.tableCell, styles.profitCell]}>{formatCurrency(dept.profit)}</Text>
                  <Text style={[styles.tableCell, styles.countCell]}>{dept.orderCount}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* الأرباح حسب التصنيفات */}
        {analysisData?.categoryBreakdown?.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>الأرباح حسب التصنيفات</Text>
            </View>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableCell, styles.nameCell]}>التصنيف</Text>
                <Text style={[styles.tableCell, styles.profitCell]}>الربح</Text>
                <Text style={[styles.tableCell, styles.countCell]}>الطلبات</Text>
              </View>
              {analysisData.categoryBreakdown.slice(0, 10).map((cat, index) => (
                <View key={cat.id} style={[styles.tableRow, index % 2 === 0 && styles.tableRowEven]}>
                  <Text style={[styles.tableCell, styles.nameCell]}>{cat.name}</Text>
                  <Text style={[styles.tableCell, styles.profitCell]}>{formatCurrency(cat.profit)}</Text>
                  <Text style={[styles.tableCell, styles.countCell]}>{cat.orderCount}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* أفضل المنتجات */}
        {analysisData?.topProducts?.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>أفضل المنتجات ربحاً</Text>
            </View>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableCell, styles.nameCell]}>المنتج</Text>
                <Text style={[styles.tableCell, styles.profitCell]}>الربح</Text>
                <Text style={[styles.tableCell, styles.countCell]}>المبيعات</Text>
              </View>
              {analysisData.topProducts.slice(0, 15).map((product, index) => (
                <View key={product.id} style={[styles.tableRow, index % 2 === 0 && styles.tableRowEven]}>
                  <Text style={[styles.tableCell, styles.nameCell]}>{product.name}</Text>
                  <Text style={[styles.tableCell, styles.profitCell]}>{formatCurrency(product.profit)}</Text>
                  <Text style={[styles.tableCell, styles.countCell]}>{product.salesCount}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* التذييل */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            تم إنشاء التقرير في {format(new Date(), 'dd/MM/yyyy - HH:mm', { locale: ar })}
          </Text>
        </View>
      </Page>

      {/* صفحة ثانية للتفاصيل الإضافية */}
      {(analysisData?.colorBreakdown?.length > 0 || analysisData?.sizeBreakdown?.length > 0) && (
        <Page size="A4" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.title}>تفاصيل الأرباح الإضافية</Text>
          </View>

          {/* الأرباح حسب الألوان */}
          {analysisData?.colorBreakdown?.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>الأرباح حسب الألوان</Text>
              </View>
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableCell, styles.nameCell]}>اللون</Text>
                  <Text style={[styles.tableCell, styles.profitCell]}>الربح</Text>
                </View>
                {analysisData.colorBreakdown.slice(0, 15).map((color, index) => (
                  <View key={color.id} style={[styles.tableRow, index % 2 === 0 && styles.tableRowEven]}>
                    <View style={[styles.tableCell, styles.colorCell]}>
                      <View style={[styles.colorDot, { backgroundColor: color.hex_code }]} />
                      <Text>{color.name}</Text>
                    </View>
                    <Text style={[styles.tableCell, styles.profitCell]}>{formatCurrency(color.profit)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* الأرباح حسب القياسات */}
          {analysisData?.sizeBreakdown?.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>الأرباح حسب القياسات</Text>
              </View>
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableCell, styles.nameCell]}>القياس</Text>
                  <Text style={[styles.tableCell, styles.profitCell]}>الربح</Text>
                </View>
                {analysisData.sizeBreakdown.slice(0, 15).map((size, index) => (
                  <View key={size.id} style={[styles.tableRow, index % 2 === 0 && styles.tableRowEven]}>
                    <Text style={[styles.tableCell, styles.nameCell]}>{size.name}</Text>
                    <Text style={[styles.tableCell, styles.profitCell]}>{formatCurrency(size.profit)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={styles.footer}>
            <Text style={styles.footerText}>صفحة 2 من 2</Text>
          </View>
        </Page>
      )}
    </Document>
  );
};

export default ProfitsAnalysisPDF;