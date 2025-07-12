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
    padding: 30,
    fontFamily: 'Amiri',
  },
  header: {
    textAlign: 'center',
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#4A90E2',
    paddingBottom: 10,
  },
  headerText: {
    fontSize: 24,
    color: '#4A90E2',
  },
  dateText: {
    fontSize: 10,
    color: '#777',
    marginTop: 4,
  },
  productSection: {
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#EAEAEA',
    borderRadius: 5,
    padding: 10,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F7F9FC',
    padding: 8,
    borderRadius: 3,
  },
  productName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  productCategory: {
    fontSize: 10,
    color: '#666',
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
    backgroundColor: '#4A90E2',
    color: 'white',
  },
  tableColHeader: {
    width: '20%',
    padding: 5,
    fontSize: 10,
    fontWeight: 'bold',
  },
  tableCol: {
    width: '20%',
    padding: 5,
    fontSize: 10,
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

const InventoryPDF = React.forwardRef(({ products }, ref) => (
  <Document ref={ref}>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.headerText}>تقرير الجرد</Text>
        <Text style={styles.dateText}>تاريخ التقرير: {new Date().toLocaleDateString('ar-EG')}</Text>
      </View>

      {products.map(product => (
        <View key={product.id} style={styles.productSection} wrap={false}>
          <View style={styles.productHeader}>
            <Text style={styles.productName}>{product.name}</Text>
            <Text style={styles.productCategory}>{product.categories?.main_category}</Text>
          </View>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={styles.tableColHeader}>اللون</Text>
              <Text style={styles.tableColHeader}>القياس</Text>
              <Text style={styles.tableColHeader}>SKU</Text>
              <Text style={styles.tableColHeader}>الكمية</Text>
              <Text style={styles.tableColHeader}>السعر</Text>
            </View>
            {product.variants.map(variant => (
              <View key={variant.id} style={styles.tableRow}>
                <View style={[styles.tableCol, styles.colorCell]}>
                  <View style={[styles.colorBox, { backgroundColor: variant.color_hex || '#ccc' }]} />
                  <Text>{variant.color}</Text>
                </View>
                <Text style={styles.tableCol}>{variant.size}</Text>
                <Text style={styles.tableCol}>{variant.sku}</Text>
                <Text style={styles.tableCol}>{variant.quantity}</Text>
                <Text style={styles.tableCol}>{variant.price.toLocaleString()} د.ع</Text>
              </View>
            ))}
          </View>
        </View>
      ))}

      <Text style={styles.footer} render={({ pageNumber, totalPages }) => (
        `صفحة ${pageNumber} من ${totalPages}`
      )} fixed />
    </Page>
  </Document>
));

export default InventoryPDF;