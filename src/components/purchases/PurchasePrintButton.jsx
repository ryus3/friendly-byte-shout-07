import React from 'react';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

const PurchasePrintButton = ({ purchase }) => {
  const handlePrint = () => {
    const printContent = generatePrintHTML(purchase);
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ar-IQ', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0) + ' د.ع';
  };

  const generatePrintHTML = (purchase) => {
    const items = purchase.items || [];
    const totalCost = purchase.total_amount || 0;
    const shippingCost = purchase.shipping_cost || 0;
    const transferCost = purchase.transfer_cost || 0;
    const grandTotal = totalCost + shippingCost + transferCost;

    return `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>فاتورة شراء رقم ${purchase.purchase_number}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap');
          
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Tajawal', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            direction: rtl;
            background: white;
          }
          
          .container {
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
          }
          
          .header {
            text-align: center;
            border-bottom: 3px solid #2563eb;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          
          .title {
            font-size: 28px;
            font-weight: bold;
            color: #2563eb;
            margin-bottom: 10px;
          }
          
          .company {
            font-size: 16px;
            color: #666;
          }
          
          .info-section {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-bottom: 30px;
            padding: 20px;
            background: #f8fafc;
            border-radius: 8px;
          }
          
          .info-box h3 {
            font-size: 16px;
            font-weight: bold;
            color: #374151;
            margin-bottom: 15px;
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 5px;
          }
          
          .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            font-size: 14px;
          }
          
          .info-label {
            font-weight: bold;
            color: #6b7280;
            min-width: 120px;
          }
          
          .info-value {
            color: #111827;
          }
          
          .table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          }
          
          .table th {
            background: #2563eb;
            color: white;
            padding: 15px 10px;
            font-weight: bold;
            font-size: 14px;
            text-align: center;
          }
          
          .table td {
            padding: 12px 10px;
            text-align: center;
            border-bottom: 1px solid #e5e7eb;
            font-size: 13px;
          }
          
          .table tr:nth-child(even) {
            background: #f9fafb;
          }
          
          .totals {
            margin-top: 30px;
            padding: 25px;
            background: #f0f9ff;
            border-radius: 8px;
            border: 2px solid #2563eb;
          }
          
          .total-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            font-size: 16px;
            font-weight: bold;
          }
          
          .grand-total {
            font-size: 20px;
            color: #1e40af;
            border-top: 2px solid #2563eb;
            padding-top: 15px;
            margin-top: 15px;
          }
          
          .footer {
            margin-top: 40px;
            text-align: center;
            color: #6b7280;
            font-size: 12px;
            border-top: 1px solid #e5e7eb;
            padding-top: 20px;
          }
          
          @media print {
            body { font-size: 12px; }
            .container { padding: 10px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 class="title">فاتورة شراء</h1>
            <p class="company">نظام إدارة المخزون</p>
          </div>
          
          <div class="info-section">
            <div class="info-box">
              <h3>معلومات الفاتورة</h3>
              <div class="info-row">
                <span class="info-label">رقم الفاتورة:</span>
                <span class="info-value">${purchase.purchase_number || 'غير محدد'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">تاريخ الشراء:</span>
                <span class="info-value">${new Date(purchase.purchase_date || purchase.created_at).toLocaleDateString('ar-SA')}</span>
              </div>
              <div class="info-row">
                <span class="info-label">حالة الفاتورة:</span>
                <span class="info-value">${purchase.status === 'completed' ? 'مكتملة' : 'معلقة'}</span>
              </div>
            </div>
            
            <div class="info-box">
              <h3>معلومات المورد</h3>
              <div class="info-row">
                <span class="info-label">اسم المورد:</span>
                <span class="info-value">${purchase.supplier_name || 'غير محدد'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">التواصل:</span>
                <span class="info-value">${purchase.supplier_contact || 'غير متوفر'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">طريقة الدفع:</span>
                <span class="info-value">${purchase.payment_method === 'cash' ? 'نقداً' : 'تحويل'}</span>
              </div>
            </div>
          </div>

          <table class="table">
            <thead>
              <tr>
                <th>#</th>
                <th>اسم المنتج</th>
                <th>اللون</th>
                <th>القياس</th>
                <th>الكمية</th>
                <th>سعر الوحدة</th>
                <th>الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              ${items.map((item, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td>${item.productName || 'غير محدد'}</td>
                  <td>${item.color || 'غير محدد'}</td>
                  <td>${item.size || 'غير محدد'}</td>
                  <td>${item.quantity || 0}</td>
                  <td>${formatCurrency(item.costPrice || 0)}</td>
                  <td>${formatCurrency((item.costPrice || 0) * (item.quantity || 0))}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="totals">
            <div class="total-row">
              <span>إجمالي المنتجات:</span>
              <span>${formatCurrency(totalCost)}</span>
            </div>
            ${shippingCost > 0 ? `
              <div class="total-row">
                <span>تكلفة الشحن:</span>
                <span>${formatCurrency(shippingCost)}</span>
              </div>
            ` : ''}
            ${transferCost > 0 ? `
              <div class="total-row">
                <span>تكلفة التحويل:</span>
                <span>${formatCurrency(transferCost)}</span>
              </div>
            ` : ''}
            <div class="total-row grand-total">
              <span>المجموع الكلي:</span>
              <span>${formatCurrency(grandTotal)}</span>
            </div>
          </div>

          <div class="footer">
            <p>هذه وثيقة رسمية - يرجى الاحتفاظ بها للمراجعة</p>
            <p>تم الإنشاء في: ${new Date().toLocaleString('ar-SA')}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  return (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={handlePrint}
      className="gap-1 text-blue-600 hover:text-blue-700 border-blue-200 hover:border-blue-300 hover:bg-blue-50"
    >
      <Printer className="h-4 w-4" />
      طباعة
    </Button>
  );
};

export default PurchasePrintButton;