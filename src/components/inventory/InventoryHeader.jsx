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
          className="bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-500 hover:from-purple-700 hover:via-blue-700 hover:to-cyan-600 text-white font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 border-0"
        >
          <Download className="w-4 h-4 ml-2" />
          تصدير تقرير PDF
        </Button>
      </div>
    </div>
  );
}

export default InventoryHeader;