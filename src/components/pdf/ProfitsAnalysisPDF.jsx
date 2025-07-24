import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

// تسجيل خط عربي يدعم PDF
Font.register({
  family: 'Amiri',
  fonts: [
    { 
      src: 'https://fonts.gstatic.com/s/amiri/v28/J7aFnoNzCdQnFN8jk8JRuMs.ttf',
      fontWeight: 'normal'
    },
    { 
      src: 'https://fonts.gstatic.com/s/amiri/v28/J7aEnoxzCdQnFN8jlcS7iJvO.ttf',
      fontWeight: 'bold'
    }
  ]
});

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    padding: 30,
    fontFamily: 'Amiri',
    direction: 'rtl',
  },
  header: {
    marginBottom: 20,
    borderBottom: '2px solid #374151',
    paddingBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#1F2937',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#6B7280',
    marginBottom: 5,
  },
  dateRange: {
    fontSize: 14,
    textAlign: 'center',
    color: '#9CA3AF',
    marginBottom: 5,
  },
  filters: {
    fontSize: 12,
    textAlign: 'center',
    color: '#9CA3AF',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 10,
    textAlign: 'right',
  },
  summaryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  summaryCard: {
    width: '48%',
    backgroundColor: '#F9FAFB',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    border: '1px solid #E5E7EB',
  },
  summaryTitle: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 5,
    textAlign: 'right',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'right',
  },
  table: {
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderBottom: '1px solid #D1D5DB',
    padding: 8,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1px solid #E5E7EB',
    padding: 8,
  },
  tableCell: {
    flex: 1,
    fontSize: 12,
    textAlign: 'center',
    color: '#374151',
  },
  tableCellHeader: {
    flex: 1,
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#1F2937',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    textAlign: 'center',
    fontSize: 10,
    color: '#9CA3AF',
    borderTop: '1px solid #E5E7EB',
    paddingTop: 10,
  },
  noData: {
    textAlign: 'center',
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
    padding: 20,
  }
});

// دالة تنسيق العملة
const formatCurrency = (amount) => {
  if (!amount || isNaN(amount)) return '0 د.ع';
  return new Intl.NumberFormat('ar-IQ', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(Math.abs(amount)) + ' د.ع';
};

const ProfitsAnalysisPDF = ({ analysisData, dateRange, filters }) => {
  // تنسيق التاريخ
  const formatDate = (date) => {
    if (!date) return '';
    try {
      return format(new Date(date), 'dd/MM/yyyy', { locale: ar });
    } catch {
      return date;
    }
  };

  // الحصول على الفلاتر النشطة
  const getActiveFilters = () => {
    const activeFilters = [];
    if (filters?.department && filters.department !== 'all') activeFilters.push(`القسم: ${filters.department}`);
    if (filters?.category && filters.category !== 'all') activeFilters.push(`التصنيف: ${filters.category}`);
    if (filters?.productType && filters.productType !== 'all') activeFilters.push(`نوع المنتج: ${filters.productType}`);
    if (filters?.season && filters.season !== 'all') activeFilters.push(`الموسم: ${filters.season}`);
    return activeFilters.length > 0 ? activeFilters.join(' • ') : 'جميع المنتجات';
  };

  // بيانات افتراضية في حالة عدم وجود بيانات
  const defaultData = {
    totalProfit: 0,
    totalOrders: 0,
    averageProfit: 0,
    profitMargin: 0,
    profitsByDepartment: [],
    profitsByCategory: [],
    topProducts: [],
    profitsByColor: [],
    profitsBySize: []
  };

  const data = analysisData || defaultData;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* العنوان الرئيسي */}
        <View style={styles.header}>
          <Text style={styles.title}>تقرير تحليل الأرباح</Text>
          <Text style={styles.subtitle}>تحليل شامل للأرباح والمبيعات</Text>
          <Text style={styles.dateRange}>
            {dateRange?.from && dateRange?.to 
              ? `من ${formatDate(dateRange.from)} إلى ${formatDate(dateRange.to)}`
              : 'جميع الفترات'
            }
          </Text>
          <Text style={styles.filters}>الفلاتر المطبقة: {getActiveFilters()}</Text>
        </View>

        {/* ملخص الأرباح */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ملخص الأرباح</Text>
          <View style={styles.summaryContainer}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>إجمالي الربح</Text>
              <Text style={styles.summaryValue}>{formatCurrency(data.totalProfit)}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>عدد الطلبات</Text>
              <Text style={styles.summaryValue}>{data.totalOrders || 0}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>متوسط الربح</Text>
              <Text style={styles.summaryValue}>{formatCurrency(data.averageProfit)}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>هامش الربح</Text>
              <Text style={styles.summaryValue}>{(data.profitMargin || 0).toFixed(1)}%</Text>
            </View>
          </View>
        </View>

        {/* الأرباح حسب القسم */}
        {data.profitsByDepartment && data.profitsByDepartment.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>الأرباح حسب القسم</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={styles.tableCellHeader}>القسم</Text>
                <Text style={styles.tableCellHeader}>الربح</Text>
                <Text style={styles.tableCellHeader}>عدد الطلبات</Text>
                <Text style={styles.tableCellHeader}>النسبة</Text>
              </View>
              {data.profitsByDepartment.slice(0, 10).map((item, index) => (
                <View key={index} style={styles.tableRow}>
                  <Text style={styles.tableCell}>{item.department || 'غير محدد'}</Text>
                  <Text style={styles.tableCell}>{formatCurrency(item.profit)}</Text>
                  <Text style={styles.tableCell}>{item.orderCount || 0}</Text>
                  <Text style={styles.tableCell}>{(item.percentage || 0).toFixed(1)}%</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* الأرباح حسب التصنيف */}
        {data.profitsByCategory && data.profitsByCategory.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>الأرباح حسب التصنيف</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={styles.tableCellHeader}>التصنيف</Text>
                <Text style={styles.tableCellHeader}>الربح</Text>
                <Text style={styles.tableCellHeader}>عدد الطلبات</Text>
                <Text style={styles.tableCellHeader}>النسبة</Text>
              </View>
              {data.profitsByCategory.slice(0, 10).map((item, index) => (
                <View key={index} style={styles.tableRow}>
                  <Text style={styles.tableCell}>{item.category || 'غير محدد'}</Text>
                  <Text style={styles.tableCell}>{formatCurrency(item.profit)}</Text>
                  <Text style={styles.tableCell}>{item.orderCount || 0}</Text>
                  <Text style={styles.tableCell}>{(item.percentage || 0).toFixed(1)}%</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* أفضل المنتجات */}
        {data.topProducts && data.topProducts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>أفضل المنتجات ربحاً</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={styles.tableCellHeader}>المنتج</Text>
                <Text style={styles.tableCellHeader}>الربح</Text>
                <Text style={styles.tableCellHeader}>الكمية</Text>
                <Text style={styles.tableCellHeader}>هامش الربح</Text>
              </View>
              {data.topProducts.slice(0, 15).map((item, index) => (
                <View key={index} style={styles.tableRow}>
                  <Text style={styles.tableCell}>{item.productName || 'غير محدد'}</Text>
                  <Text style={styles.tableCell}>{formatCurrency(item.profit)}</Text>
                  <Text style={styles.tableCell}>{item.quantity || 0}</Text>
                  <Text style={styles.tableCell}>{(item.profitMargin || 0).toFixed(1)}%</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* رسالة في حالة عدم وجود بيانات */}
        {(!data.profitsByDepartment || data.profitsByDepartment.length === 0) &&
         (!data.profitsByCategory || data.profitsByCategory.length === 0) &&
         (!data.topProducts || data.topProducts.length === 0) && (
          <View style={styles.noData}>
            <Text>لا توجد بيانات متاحة للفترة المحددة</Text>
          </View>
        )}

        {/* التذييل */}
        <View style={styles.footer}>
          <Text>تم إنشاء التقرير في: {formatDate(new Date())}</Text>
          <Text>نظام إدارة المخزون والمبيعات</Text>
        </View>
      </Page>

      {/* صفحة إضافية للتفاصيل */}
      {((data.profitsByColor && data.profitsByColor.length > 0) || 
        (data.profitsBySize && data.profitsBySize.length > 0)) && (
        <Page size="A4" style={styles.page}>
          {/* الأرباح حسب اللون */}
          {data.profitsByColor && data.profitsByColor.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>الأرباح حسب اللون</Text>
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={styles.tableCellHeader}>اللون</Text>
                  <Text style={styles.tableCellHeader}>الربح</Text>
                  <Text style={styles.tableCellHeader}>عدد الطلبات</Text>
                  <Text style={styles.tableCellHeader}>النسبة</Text>
                </View>
                {data.profitsByColor.slice(0, 15).map((item, index) => (
                  <View key={index} style={styles.tableRow}>
                    <Text style={styles.tableCell}>{item.color || 'غير محدد'}</Text>
                    <Text style={styles.tableCell}>{formatCurrency(item.profit)}</Text>
                    <Text style={styles.tableCell}>{item.orderCount || 0}</Text>
                    <Text style={styles.tableCell}>{(item.percentage || 0).toFixed(1)}%</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* الأرباح حسب المقاس */}
          {data.profitsBySize && data.profitsBySize.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>الأرباح حسب المقاس</Text>
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={styles.tableCellHeader}>المقاس</Text>
                  <Text style={styles.tableCellHeader}>الربح</Text>
                  <Text style={styles.tableCellHeader}>عدد الطلبات</Text>
                  <Text style={styles.tableCellHeader}>النسبة</Text>
                </View>
                {data.profitsBySize.slice(0, 15).map((item, index) => (
                  <View key={index} style={styles.tableRow}>
                    <Text style={styles.tableCell}>{item.size || 'غير محدد'}</Text>
                    <Text style={styles.tableCell}>{formatCurrency(item.profit)}</Text>
                    <Text style={styles.tableCell}>{item.orderCount || 0}</Text>
                    <Text style={styles.tableCell}>{(item.percentage || 0).toFixed(1)}%</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* التذييل */}
          <View style={styles.footer}>
            <Text>تم إنشاء التقرير في: {formatDate(new Date())}</Text>
            <Text>نظام إدارة المخزون والمبيعات - الصفحة 2</Text>
          </View>
        </Page>
      )}
    </Document>
  );
};

export default ProfitsAnalysisPDF;