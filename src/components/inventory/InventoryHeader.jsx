import React from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

const InventoryHeader = ({ onExport }) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 flex-1">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">الجرد المفصل</h1>
        <p className="text-muted-foreground mt-1">إدارة مخزون جميع المنتجات والمقاسات</p>
      </div>
      
      <div className="flex gap-3">
        <Button 
          onClick={onExport} 
          className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 border-0"
        >
          <Download className="w-4 h-4 ml-2" />
          تصدير تقرير PDF
        </Button>
      </div>
    </div>
  );
}

export default InventoryHeader;