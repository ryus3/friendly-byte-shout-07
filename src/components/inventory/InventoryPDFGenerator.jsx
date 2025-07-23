import React from 'react';
import { Button } from '@/components/ui/button';
import { FileDown } from 'lucide-react';
import { generateInventoryReportPDF } from '@/utils/pdfGenerator';
import { toast } from '@/hooks/use-toast';

const InventoryPDFGenerator = ({ inventoryData, selectedItems, filters, isLoading }) => {
  const handleGeneratePDF = async () => {
    try {
      // تحضير البيانات للتقرير
      let dataToExport;
      
      if (selectedItems.length > 0) {
        // تصدير العناصر المحددة فقط
        dataToExport = inventoryData
          .filter(item => selectedItems.includes(item.id))
          .flatMap(product => 
            (product.variants || []).map(variant => ({
              product_name: product.name,
              color_name: variant.color || 'غير محدد',
              size_name: variant.size || 'غير محدد',
              quantity: variant.quantity || 0,
              sale_price: variant.price || 0,
              product_type: product.categories?.product_type || 'غير محدد',
              category_name: product.categories?.main_category || 'غير محدد',
              department_name: product.categories?.department || 'غير محدد',
              season_occasion: product.categories?.season_occasion || 'غير محدد'
            }))
          );
      } else {
        // تصدير جميع العناصر المفلترة
        dataToExport = inventoryData.flatMap(product => 
          (product.variants || []).map(variant => ({
            product_name: product.name,
            color_name: variant.color || 'غير محدد',
            size_name: variant.size || 'غير محدد',
            quantity: variant.quantity || 0,
            sale_price: variant.price || 0,
            product_type: product.categories?.product_type || 'غير محدد',
            category_name: product.categories?.main_category || 'غير محدد',
            department_name: product.categories?.department || 'غير محدد',
            season_occasion: product.categories?.season_occasion || 'غير محدد'
          }))
        );
      }

      // فلترة البيانات حسب الفلاتر النشطة
      let filteredData = dataToExport;
      
      if (filters.searchTerm) {
        const term = filters.searchTerm.toLowerCase();
        filteredData = filteredData.filter(item => 
          item.product_name.toLowerCase().includes(term) ||
          item.color_name.toLowerCase().includes(term) ||
          item.size_name.toLowerCase().includes(term)
        );
      }
      
      if (filters.category !== 'all') {
        filteredData = filteredData.filter(item => item.category_name === filters.category);
      }
      
      if (filters.color !== 'all') {
        filteredData = filteredData.filter(item => item.color_name === filters.color);
      }
      
      if (filters.size !== 'all') {
        filteredData = filteredData.filter(item => item.size_name === filters.size);
      }
      
      if (filters.stockFilter !== 'all') {
        switch (filters.stockFilter) {
          case 'low':
            filteredData = filteredData.filter(item => item.quantity > 0 && item.quantity <= 5);
            break;
          case 'medium':
            filteredData = filteredData.filter(item => item.quantity > 5 && item.quantity <= 10);
            break;
          case 'high':
            filteredData = filteredData.filter(item => item.quantity > 10);
            break;
          case 'out-of-stock':
            filteredData = filteredData.filter(item => item.quantity === 0);
            break;
        }
      }

      if (filteredData.length === 0) {
        toast({
          title: "لا توجد بيانات للتصدير",
          description: "لم يتم العثور على عناصر تطابق المعايير المحددة",
          variant: "destructive"
        });
        return;
      }

      await generateInventoryReportPDF(filteredData);
      
      toast({
        title: "✅ تم إنشاء التقرير بنجاح",
        description: `تم تصدير ${filteredData.length} عنصر`,
        variant: "success"
      });
      
    } catch (error) {
      console.error('خطأ في إنشاء تقرير PDF:', error);
      toast({
        title: "خطأ في إنشاء التقرير",
        description: "حدث خطأ أثناء إنشاء تقرير PDF",
        variant: "destructive"
      });
    }
  };

  const getButtonText = () => {
    if (isLoading) return 'جاري التحميل...';
    
    if (selectedItems.length > 0) {
      return `تصدير PDF (${selectedItems.length} محدد)`;
    }
    
    return 'تصدير PDF (حسب الفلاتر)';
  };

  return (
    <Button 
      onClick={handleGeneratePDF}
      disabled={isLoading || (!inventoryData || inventoryData.length === 0)}
      className="gap-2"
      variant="outline"
    >
      <FileDown className="h-4 w-4" />
      {getButtonText()}
    </Button>
  );
};

export default InventoryPDFGenerator;