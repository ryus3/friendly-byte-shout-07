import React from 'react';
import { Page, Text, View, Document, StyleSheet, Font } from '@react-pdf/renderer';
import { format, isValid } from 'date-fns';
import { ar } from 'date-fns/locale';

// Register font
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
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E40AF',
  },
  subtitle: {
    fontSize: 12,
    color: '#6B7280',
  },
  section: {
    marginBottom: 20,
    border: '1px solid #E5E7EB',
    borderRadius: 5,
    padding: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#111827',
    borderBottom: '2px solid #3B82F6',
    paddingBottom: 5,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottom: '1px solid #F3F4F6',
  },
  label: {
    fontSize: 12,
    color: '#374151',
  },
  value: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  green: {
    color: '#10B981',
  },
  red: {
    color: '#EF4444',
  },
  blue: {
    color: '#3B82F6',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginTop: 10,
    borderTop: '2px solid #1E40AF',
    backgroundColor: '#DBEAFE',
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  totalValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1E40AF',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    textAlign: 'center',
    fontSize: 10,
    color: 'grey',
  },
});

const FinancialReportPDF = ({ summary, dateRange }) => {
  const formattedDateRange = 
    (dateRange?.from && isValid(dateRange.from) && dateRange?.to && isValid(dateRange.to))
    ? `${format(dateRange.from, 'd MMMM yyyy', { locale: ar })} - ${format(dateRange.to, 'd MMMM yyyy', { locale: ar })}`
    : 'كل الأوقات';

  const safeSummary = {
    totalRevenue: 0,
    cogs: 0,
    grossProfit: 0,
    totalExpenses: 0,
    netProfit: 0,
    myProfit: 0,
    managerProfitFromEmployees: 0,
    employeePendingDues: 0,
    employeeSettledDues: 0,
    filteredExpenses: [],
    ...summary,
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>التقرير المالي</Text>
          <Text style={styles.subtitle}>الفترة: {formattedDateRange}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ملخص الأرباح والخسائر</Text>
          <View style={styles.row}>
            <Text style={styles.label}>إجمالي المبيعات</Text>
            <Text style={[styles.value, styles.green]}>{safeSummary.totalRevenue.toLocaleString()} د.ع</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>تكلفة البضاعة المباعة</Text>
            <Text style={[styles.value, styles.red]}>({safeSummary.cogs.toLocaleString()}) د.ع</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>مجمل الربح</Text>
            <Text style={[styles.value, styles.blue]}>{safeSummary.grossProfit.toLocaleString()} د.ع</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>إجمالي المصاريف</Text>
            <Text style={[styles.value, styles.red]}>({safeSummary.totalExpenses.toLocaleString()}) د.ع</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>صافي الربح</Text>
            <Text style={styles.totalValue}>{safeSummary.netProfit.toLocaleString()} د.ع</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>مؤشرات مالية أخرى</Text>
          <View style={styles.row}>
            <Text style={styles.label}>أرباحي من المبيعات الخاصة</Text>
            <Text style={[styles.value, styles.green]}>{safeSummary.myProfit.toLocaleString()} د.ع</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>أرباحي من الموظفين</Text>
            <Text style={[styles.value, styles.green]}>{safeSummary.managerProfitFromEmployees.toLocaleString()} د.ع</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>مستحقات الموظفين المعلقة</Text>
            <Text style={[styles.value, styles.red]}>{safeSummary.employeePendingDues.toLocaleString()} د.ع</Text>
          </View>
           <View style={styles.row}>
            <Text style={styles.label}>مستحقات الموظفين المدفوعة</Text>
            <Text style={[styles.value, styles.green]}>{safeSummary.employeeSettledDues.toLocaleString()} د.ع</Text>
          </View>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>قائمة المصاريف</Text>
          {safeSummary.filteredExpenses.map(exp => (
            <View key={exp.id} style={styles.row}>
              <Text style={styles.label}>{exp.category} - {exp.description}</Text>
              <Text style={[styles.value, styles.red]}>{exp.amount.toLocaleString()} د.ع</Text>
            </View>
          ))}
        </View>

        <Text style={styles.footer}>
          تم إنشاء هذا التقرير بواسطة نظام RYUS لإدارة المخزون والمبيعات.
        </Text>
      </Page>
    </Document>
  );
};

export default FinancialReportPDF;