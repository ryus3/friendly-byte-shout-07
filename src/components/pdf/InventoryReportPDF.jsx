import React, { forwardRef } from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

// Register Arabic fonts
Font.register({
  family: 'Amiri',
  fonts: [
    { src: '/fonts/Amiri-Regular.ttf' },
    { src: '/fonts/Amiri-Bold.ttf', fontWeight: 'bold' }
  ]
});

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    padding: 20,
    fontFamily: 'Amiri',
    fontSize: 10,
    direction: 'rtl',
    textAlign: 'right'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
    paddingBottom: 15,
    borderBottomWidth: 2,
    borderBottomColor: '#E8F4FD',
    borderBottomStyle: 'solid'
  },
  headerLeft: {
    flexDirection: 'column',
    alignItems: 'flex-start'
  },
  headerRight: {
    flexDirection: 'column',
    alignItems: 'flex-end'
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E40AF',
    marginBottom: 5,
    fontFamily: 'Amiri'
  },
  subtitle: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Amiri'
  },
  date: {
    fontSize: 10,
    color: '#9CA3AF',
    fontFamily: 'Amiri'
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'solid'
  },
  statBox: {
    flexDirection: 'column',
    alignItems: 'center',
    flex: 1
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E40AF',
    marginBottom: 2,
    fontFamily: 'Amiri'
  },
  statLabel: {
    fontSize: 9,
    color: '#64748B',
    fontFamily: 'Amiri'
  },
  categorySection: {
    marginBottom: 25,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'solid',
    borderRadius: 8,
    overflow: 'hidden'
  },
  categoryHeader: {
    backgroundColor: '#3B82F6',
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: 'Amiri'
  },
  categoryStats: {
    fontSize: 10,
    color: '#DBEAFE',
    fontFamily: 'Amiri'
  },
  productContainer: {
    padding: 15,
    backgroundColor: '#FFFFFF'
  },
  productRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#3B82F6',
    borderLeftStyle: 'solid'
  },
  productInfo: {
    flex: 3,
    flexDirection: 'column'
  },
  productName: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 2,
    fontFamily: 'Amiri'
  },
  productBrand: {
    fontSize: 9,
    color: '#6B7280',
    fontFamily: 'Amiri'
  },
  variantSection: {
    flex: 2,
    flexDirection: 'column',
    alignItems: 'center'
  },
  variantRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 2
  },
  variantText: {
    fontSize: 9,
    color: '#374151',
    fontFamily: 'Amiri'
  },
  stockSection: {
    flex: 1,
    alignItems: 'center'
  },
  stockValue: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Amiri'
  },
  stockHigh: {
    color: '#059669'
  },
  stockMedium: {
    color: '#D97706'
  },
  stockLow: {
    color: '#DC2626'
  },
  stockLabel: {
    fontSize: 8,
    color: '#6B7280',
    fontFamily: 'Amiri'
  },
  priceSection: {
    flex: 1,
    alignItems: 'center'
  },
  priceValue: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1E40AF',
    fontFamily: 'Amiri'
  },
  priceLabel: {
    fontSize: 8,
    color: '#6B7280',
    fontFamily: 'Amiri'
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    textAlign: 'center',
    fontSize: 8,
    color: '#9CA3AF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    borderTopStyle: 'solid',
    paddingTop: 10,
    fontFamily: 'Amiri'
  },
  alertBadge: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderStyle: 'solid',
    borderRadius: 4,
    padding: 3,
    marginLeft: 5
  },
  alertText: {
    fontSize: 7,
    color: '#DC2626',
    fontFamily: 'Amiri'
  }
});

const InventoryReportPDF = forwardRef(({ products, settings }, ref) => {
  const currentDate = new Date().toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });

  // Calculate statistics
  const stats = {
    totalProducts: products.length,
    totalVariants: products.reduce((sum, p) => sum + (p.variants?.length || 0), 0),
    totalStock: products.reduce((sum, p) => 
      sum + (p.variants?.reduce((vSum, v) => vSum + (v.quantity || 0), 0) || 0), 0),
    lowStockCount: products.reduce((sum, p) => 
      sum + (p.variants?.filter(v => (v.quantity || 0) <= (settings?.lowStockThreshold || 5)).length || 0), 0)
  };

  // Group products by category
  const groupedProducts = products.reduce((acc, product) => {
    const category = product.categories?.main_category || 'غير مصنف';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(product);
    return acc;
  }, {});

  const getStockStyle = (quantity) => {
    const threshold = settings?.lowStockThreshold || 5;
    if (quantity <= threshold) return styles.stockLow;
    if (quantity <= threshold * 2) return styles.stockMedium;
    return styles.stockHigh;
  };

  return (
    <Document ref={ref}>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRight}>
            <Text style={styles.title}>تقرير المخزون التفصيلي</Text>
            <Text style={styles.subtitle}>نظام إدارة المخزون - RYUS</Text>
          </View>
          <View style={styles.headerLeft}>
            <Text style={styles.date}>{currentDate}</Text>
            <Text style={styles.date}>تم الإنشاء: {new Date().toLocaleTimeString('ar-EG')}</Text>
          </View>
        </View>

        {/* Statistics */}
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats.totalProducts}</Text>
            <Text style={styles.statLabel}>إجمالي المنتجات</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats.totalVariants}</Text>
            <Text style={styles.statLabel}>إجمالي المتغيرات</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats.totalStock.toLocaleString()}</Text>
            <Text style={styles.statLabel}>إجمالي الكمية</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, styles.stockLow]}>{stats.lowStockCount}</Text>
            <Text style={styles.statLabel}>تنبيهات نقص المخزون</Text>
          </View>
        </View>

        {/* Products by Category */}
        {Object.entries(groupedProducts).map(([category, categoryProducts]) => (
          <View key={category} style={styles.categorySection} wrap={false}>
            <View style={styles.categoryHeader}>
              <Text style={styles.categoryTitle}>{category}</Text>
              <Text style={styles.categoryStats}>
                {categoryProducts.length} منتج | {' '}
                {categoryProducts.reduce((sum, p) => sum + (p.variants?.length || 0), 0)} متغير
              </Text>
            </View>
            
            <View style={styles.productContainer}>
              {categoryProducts.map(product => (
                <View key={product.id} style={styles.productRow}>
                  <View style={styles.productInfo}>
                    <Text style={styles.productName}>{product.name}</Text>
                    {product.brand && (
                      <Text style={styles.productBrand}>{product.brand}</Text>
                    )}
                  </View>
                  
                  <View style={styles.variantSection}>
                    {product.variants?.slice(0, 3).map((variant, idx) => (
                      <View key={idx} style={styles.variantRow}>
                        <Text style={styles.variantText}>
                          {variant.color} - {variant.size}
                        </Text>
                      </View>
                    ))}
                    {product.variants?.length > 3 && (
                      <Text style={styles.variantText}>
                        +{product.variants.length - 3} متغير آخر
                      </Text>
                    )}
                  </View>
                  
                  <View style={styles.stockSection}>
                    <Text style={[
                      styles.stockValue, 
                      getStockStyle(product.variants?.reduce((sum, v) => sum + (v.quantity || 0), 0) || 0)
                    ]}>
                      {(product.variants?.reduce((sum, v) => sum + (v.quantity || 0), 0) || 0).toLocaleString()}
                    </Text>
                    <Text style={styles.stockLabel}>قطعة</Text>
                    {(product.variants?.reduce((sum, v) => sum + (v.quantity || 0), 0) || 0) <= (settings?.lowStockThreshold || 5) && (
                      <View style={styles.alertBadge}>
                        <Text style={styles.alertText}>نقص مخزون</Text>
                      </View>
                    )}
                  </View>
                  
                  <View style={styles.priceSection}>
                    <Text style={styles.priceValue}>
                      {(product.variants?.[0]?.price || 0).toLocaleString()}
                    </Text>
                    <Text style={styles.priceLabel}>د.ع</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* Footer */}
        <Text style={styles.footer}>
          هذا التقرير تم إنشاؤه تلقائياً من نظام RYUS لإدارة المخزون
          {'\n'}
          جميع البيانات محدثة حتى تاريخ الطباعة المذكور أعلاه
        </Text>
      </Page>
    </Document>
  );
});

InventoryReportPDF.displayName = 'InventoryReportPDF';

export default InventoryReportPDF;