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
            max-width: 700px;
            margin: 0 auto;
            padding: 30px;
            background: white;
            border-radius: 20px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            position: relative;
            overflow: hidden;
          }
          
          .container::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 5px;
            background: linear-gradient(90deg, #3b82f6, #8b5cf6, #06b6d4);
          }
          
          .header {
            text-align: center;
            padding: 0 0 25px 0;
            margin-bottom: 35px;
            position: relative;
          }
          
          .header::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 50%;
            transform: translateX(-50%);
            width: 100px;
            height: 3px;
            background: linear-gradient(90deg, #3b82f6, #8b5cf6);
            border-radius: 2px;
          }
          
          .title {
            font-size: 32px;
            font-weight: 700;
            background: linear-gradient(135deg, #3b82f6, #8b5cf6);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin-bottom: 8px;
            letter-spacing: -0.02em;
          }
          
          .company {
            font-size: 14px;
            color: #64748b;
            font-weight: 500;
          }
          
          .info-section {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 35px;
          }
          
          .info-box {
            background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
            border-radius: 16px;
            padding: 20px;
            border: 1px solid #e2e8f0;
          }
          
          .info-box h3 {
            font-size: 15px;
            font-weight: 600;
            color: #334155;
            margin-bottom: 16px;
            padding-bottom: 8px;
            border-bottom: 2px solid #cbd5e1;
          }
          
          .info-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
            font-size: 13px;
          }
          
          .info-label {
            font-weight: 500;
            color: #64748b;
            min-width: 100px;
          }
          
          .info-value {
            color: #0f172a;
            font-weight: 600;
          }
          
          .table {
            width: 100%;
            border-collapse: collapse;
            margin: 25px 0;
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          }
          
          .table th {
            background: linear-gradient(135deg, #3b82f6, #1d4ed8);
            color: white;
            padding: 12px 8px;
            font-weight: 600;
            font-size: 12px;
            text-align: center;
          }
          
          .table td {
            padding: 10px 8px;
            text-align: center;
            border-bottom: 1px solid #f1f5f9;
            font-size: 12px;
          }
          
          .table tr:nth-child(even) {
            background: #f8fafc;
          }
          
          .table tr:hover {
            background: #f1f5f9;
          }
          
          .totals {
            margin-top: 35px;
            padding: 25px;
            background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
            border-radius: 16px;
            border: 2px solid #3b82f6;
            position: relative;
          }
          
          .totals::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, #3b82f6, #8b5cf6);
            border-radius: 16px 16px 0 0;
          }
          
          .total-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
            font-size: 15px;
            font-weight: 600;
            color: #334155;
          }
          
          .grand-total {
            font-size: 18px;
            color: #1e40af;
            border-top: 2px solid #3b82f6;
            padding-top: 15px;
            margin-top: 15px;
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