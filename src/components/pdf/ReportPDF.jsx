import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font, Image } from '@react-pdf/renderer';

// Register Arabic font
Font.register({
  family: 'Amiri',
  src: '/fonts/Amiri-Regular.ttf',
});

Font.register({
  family: 'Amiri',
  src: '/fonts/Amiri-Bold.ttf',
  fontWeight: 'bold',
});

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Amiri',
    fontSize: 12,
    paddingTop: 30,
    paddingLeft: 30,
    paddingRight: 30,
    paddingBottom: 30,
    direction: 'rtl',
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
    borderBottomWidth: 2,
    borderBottomColor: '#2563eb',
    paddingBottom: 15,
  },
  logo: {
    width: 60,
    height: 60,
  },
  companyInfo: {
    textAlign: 'right',
    flex: 1,
    marginRight: 20,
  },
  companyName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 5,
  },
  reportTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#1e3a8a',
    marginBottom: 20,
    backgroundColor: '#eff6ff',
    padding: 10,
    borderRadius: 5,
  },
  dateInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 5,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
    paddingBottom: 5,
  },
  table: {
    display: 'table',
    width: 'auto',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 5,
  },
  tableRow: {
    margin: 'auto',
    flexDirection: 'row',
  },
  tableHeader: {
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    fontWeight: 'bold',
  },
  tableColHeader: {
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#d1d5db',
    padding: 8,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: 'bold',
  },
  tableCol: {
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#d1d5db',
    padding: 8,
    textAlign: 'center',
    fontSize: 10,
  },
  summarySection: {
    backgroundColor: '#f0f9ff',
    padding: 15,
    borderRadius: 5,
    marginTop: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#2563eb',
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 10,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
    fontSize: 12,
  },
  highlight: {
    color: '#059669',
    fontWeight: 'bold',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 10,
    borderTopWidth: 1,
    borderTopColor: '#d1d5db',
    paddingTop: 10,
  },
});

const ReportPDF = ({ reportData, reportType = 'daily' }) => {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ar-IQ', {
      style: 'currency',
      currency: 'IQD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getReportTitle = () => {
    switch (reportType) {
      case 'daily':
        return 'التقرير اليومي';
      case 'weekly':
        return 'التقرير الأسبوعي';
      case 'monthly':
        return 'التقرير الشهري';
      case 'inventory':
        return 'تقرير المخزون';
      default:
        return 'التقرير المالي';
    }
  };

  const currentDate = new Date().toLocaleDateString('ar-IQ', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const currentTime = new Date().toLocaleTimeString('ar-IQ', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.companyInfo}>
            <Text style={styles.companyName}>نظام إدارة المخزون RYUS</Text>
            <Text>تقرير شامل ومفصل</Text>
          </View>
        </View>

        {/* Report Title */}
        <Text style={styles.reportTitle}>{getReportTitle()}</Text>

        {/* Date Information */}
        <View style={styles.dateInfo}>
          <Text>تاريخ التقرير: {currentDate}</Text>
          <Text>وقت الإنشاء: {currentTime}</Text>
        </View>

        {/* Sales Section */}
        {reportData?.sales && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>إحصائيات المبيعات</Text>
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableHeader]}>
                <Text style={[styles.tableColHeader, { width: '25%' }]}>المنتج</Text>
                <Text style={[styles.tableColHeader, { width: '20%' }]}>الكمية المباعة</Text>
                <Text style={[styles.tableColHeader, { width: '25%' }]}>السعر الإجمالي</Text>
                <Text style={[styles.tableColHeader, { width: '30%' }]}>الربح</Text>
              </View>
              {reportData.sales.map((item, index) => (
                <View style={styles.tableRow} key={index}>
                  <Text style={[styles.tableCol, { width: '25%' }]}>{item.product}</Text>
                  <Text style={[styles.tableCol, { width: '20%' }]}>{item.quantity}</Text>
                  <Text style={[styles.tableCol, { width: '25%' }]}>{formatCurrency(item.total)}</Text>
                  <Text style={[styles.tableCol, { width: '30%' }]}>{formatCurrency(item.profit)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Orders Section */}
        {reportData?.orders && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>الطلبات</Text>
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableHeader]}>
                <Text style={[styles.tableColHeader, { width: '20%' }]}>رقم الطلب</Text>
                <Text style={[styles.tableColHeader, { width: '25%' }]}>العميل</Text>
                <Text style={[styles.tableColHeader, { width: '20%' }]}>الحالة</Text>
                <Text style={[styles.tableColHeader, { width: '35%' }]}>المبلغ الإجمالي</Text>
              </View>
              {reportData.orders.map((order, index) => (
                <View style={styles.tableRow} key={index}>
                  <Text style={[styles.tableCol, { width: '20%' }]}>{order.id}</Text>
                  <Text style={[styles.tableCol, { width: '25%' }]}>{order.customer}</Text>
                  <Text style={[styles.tableCol, { width: '20%' }]}>{order.status}</Text>
                  <Text style={[styles.tableCol, { width: '35%' }]}>{formatCurrency(order.total)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Inventory Section */}
        {reportData?.inventory && reportType === 'inventory' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>حالة المخزون</Text>
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableHeader]}>
                <Text style={[styles.tableColHeader, { width: '30%' }]}>المنتج</Text>
                <Text style={[styles.tableColHeader, { width: '20%' }]}>الكمية المتاحة</Text>
                <Text style={[styles.tableColHeader, { width: '25%' }]}>القيمة</Text>
                <Text style={[styles.tableColHeader, { width: '25%' }]}>الحالة</Text>
              </View>
              {reportData.inventory.map((item, index) => (
                <View style={styles.tableRow} key={index}>
                  <Text style={[styles.tableCol, { width: '30%' }]}>{item.name}</Text>
                  <Text style={[styles.tableCol, { width: '20%' }]}>{item.stock}</Text>
                  <Text style={[styles.tableCol, { width: '25%' }]}>{formatCurrency(item.value)}</Text>
                  <Text style={[styles.tableCol, { width: '25%' }]}>{item.status}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Summary Section */}
        <View style={styles.summarySection}>
          <Text style={styles.summaryTitle}>ملخص التقرير</Text>
          {reportData?.summary && (
            <>
              <View style={styles.summaryItem}>
                <Text>إجمالي المبيعات:</Text>
                <Text style={styles.highlight}>{formatCurrency(reportData.summary.totalSales || 0)}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text>إجمالي الأرباح:</Text>
                <Text style={styles.highlight}>{formatCurrency(reportData.summary.totalProfit || 0)}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text>عدد الطلبات:</Text>
                <Text style={styles.highlight}>{reportData.summary.totalOrders || 0}</Text>
              </View>
              {reportType === 'inventory' && (
                <View style={styles.summaryItem}>
                  <Text>قيمة المخزون الإجمالية:</Text>
                  <Text style={styles.highlight}>{formatCurrency(reportData.summary.totalInventoryValue || 0)}</Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          تم إنشاء هذا التقرير تلقائياً بواسطة نظام RYUS - {currentDate} {currentTime}
        </Text>
      </Page>
    </Document>
  );
};

export default ReportPDF;