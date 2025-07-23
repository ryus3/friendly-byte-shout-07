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
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0) + ' د.ع';
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('ar-SA');
  };

  const generatePrintHTML = (purchase) => {
    const items = purchase.items || [];
    const itemsTotal = items.reduce((sum, item) => sum + ((item.costPrice || 0) * (item.quantity || 0)), 0);
    const shippingCost = purchase.shipping_cost || 0;
    const transferCost = purchase.transfer_cost || 0;
    const grandTotal = itemsTotal + shippingCost + transferCost;

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
            line-height: 1.4;
            color: #1a1a1a;
            direction: rtl;
            background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
            min-height: 100vh;
          }
          
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 25px;
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.2);
            position: relative;
            overflow: hidden;
          }
          
          .container::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, #3b82f6, #8b5cf6, #06b6d4);
          }
          
          .header {
            text-align: center;
            padding: 0 0 20px 0;
            margin-bottom: 25px;
            position: relative;
          }
          
          .header::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 50%;
            transform: translateX(-50%);
            width: 80px;
            height: 2px;
            background: linear-gradient(90deg, #3b82f6, #8b5cf6);
            border-radius: 2px;
          }
          
          .title {
            font-size: 24px;
            font-weight: 700;
            background: linear-gradient(135deg, #3b82f6, #8b5cf6);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin-bottom: 5px;
          }
          
          .company {
            font-size: 12px;
            color: #64748b;
            font-weight: 500;
          }
          
          .info-section {
            display: flex;
            gap: 15px;
            margin-bottom: 25px;
            background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
            border-radius: 12px;
            padding: 18px;
          }
          
          .info-box {
            flex: 1;
            background: white;
            border-radius: 10px;
            padding: 15px;
            border: 1px solid #e2e8f0;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
          }
          
          .info-box h3 {
            font-size: 13px;
            font-weight: 600;
            color: #334155;
            margin-bottom: 12px;
            padding-bottom: 6px;
            border-bottom: 1px solid #e2e8f0;
          }
          
          .info-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 6px;
            font-size: 11px;
          }
          
          .info-label {
            font-weight: 500;
            color: #64748b;
          }
          
          .info-value {
            color: #0f172a;
            font-weight: 600;
          }
          
          .table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            background: white;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 3px 6px rgba(0, 0, 0, 0.08);
          }
          
          .table th {
            background: linear-gradient(135deg, #3b82f6, #1d4ed8);
            color: white;
            padding: 10px 6px;
            font-weight: 600;
            font-size: 11px;
            text-align: center;
          }
          
          .table td {
            padding: 8px 6px;
            text-align: center;
            border-bottom: 1px solid #f1f5f9;
            font-size: 11px;
          }
          
          .table tr:nth-child(even) {
            background: #f8fafc;
          }
          
          .totals {
            margin-top: 25px;
            padding: 18px;
            background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
            border-radius: 12px;
            border: 1px solid #3b82f6;
          }
          
          .total-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
            font-size: 13px;
            font-weight: 600;
            color: #334155;
          }
          
          .grand-total {
            font-size: 16px;
            color: #1e40af;
            border-top: 2px solid #3b82f6;
            padding-top: 12px;
            margin-top: 12px;
            font-weight: 700;
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
            body { 
              background: white !important;
              font-size: 11px;
            }
            .container { 
              padding: 15px !important;
              margin: 0 !important;
              box-shadow: none !important;
              border-radius: 0 !important;
            }
            .container::before {
              display: none !important;
            }
            .no-print { display: none; }
            .table th {
              background: #334155 !important;
              color: white !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 class="title">فاتورة شراء</h1>
            <p class="company">RYUS BRAND - إدارة المخزون ومتابعة الطلبات</p>
          </div>
          
          <div class="info-section">
            <div class="info-box">
              <h3>معلومات الفاتورة</h3>
              <div class="info-item">
                <span class="info-label">رقم الفاتورة:</span>
                <span class="info-value">${purchase.purchase_number || 'غير محدد'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">التاريخ:</span>
                <span class="info-value">${formatDate(purchase.purchase_date || purchase.created_at)}</span>
              </div>
              <div class="info-item">
                <span class="info-label">الحالة:</span>
                <span class="info-value">${purchase.status === 'completed' ? 'مكتملة' : 'معلقة'}</span>
              </div>
            </div>
            
            <div class="info-box">
              <h3>معلومات المورد</h3>
              <div class="info-item">
                <span class="info-label">اسم المورد:</span>
                <span class="info-value">${purchase.supplier_name || 'غير محدد'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">التواصل:</span>
                <span class="info-value">${purchase.supplier_contact || 'غير متوفر'}</span>
              </div>
              <div class="info-item">
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
              <span>${formatCurrency(itemsTotal)}</span>
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