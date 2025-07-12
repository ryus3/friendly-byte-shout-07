import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Upload, Download } from 'lucide-react';

const PurchasesHeader = ({ onAdd, onImport, onExport, hasPermission }) => (
  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
    <div>
      <h1 className="text-3xl font-bold gradient-text">المشتريات</h1>
      <p className="text-gray-400 mt-1">إدارة وتتبع جميع المشتريات</p>
    </div>
    
    <div className="flex gap-3">
      <Button
        onClick={onImport}
        variant="outline"
        className="glass-effect border-white/20 hover:bg-white/10"
      >
        <Upload className="w-4 h-4 ml-2" />
        استيراد
      </Button>
      <Button
        onClick={onExport}
        variant="outline"
        className="glass-effect border-white/20 hover:bg-white/10"
      >
        <Download className="w-4 h-4 ml-2" />
        تصدير
      </Button>
      
      {hasPermission && (
        <Button
          onClick={onAdd}
          className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
        >
          <Plus className="w-4 h-4 ml-2" />
          إضافة مشتريات
        </Button>
      )}
    </div>
  </div>
);

export default PurchasesHeader;