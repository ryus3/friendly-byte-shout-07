import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Search, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const InventoryHeader = ({ onExport }) => {
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResults, setAuditResults] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const { toast } = useToast();

  const handleAuditInventory = async () => {
    setIsAuditing(true);
    try {
      const { data, error } = await supabase.rpc('audit_inventory_accuracy');
      
      if (error) throw error;
      
      setAuditResults(data || []);
      setShowResults(true);
      
      if (!data || data.length === 0) {
        toast({
          title: "✅ المخزون صحيح",
          description: "جميع الأرقام متطابقة مع الطلبات الفعلية",
        });
      } else {
        toast({
          title: "⚠️ تم اكتشاف فروقات",
          description: `${data.length} منتج يحتاج مراجعة`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Audit error:', error);
      toast({
        title: "خطأ في الفحص",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsAuditing(false);
    }
  };

  const handleFixDiscrepancies = async () => {
    try {
      const { data, error } = await supabase.rpc('fix_inventory_discrepancies');
      
      if (error) throw error;
      
      toast({
        title: "✅ تم الإصلاح",
        description: `تم تصحيح ${data?.length || 0} منتج`,
      });
      
      setShowResults(false);
      setAuditResults(null);
    } catch (error) {
      console.error('Fix error:', error);
      toast({
        title: "خطأ في الإصلاح",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 flex-1">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">الجرد المفصل</h1>
          <p className="text-muted-foreground mt-1">إدارة مخزون جميع المنتجات والمقاسات</p>
        </div>
        
        <div className="flex gap-3">
          <Button 
            onClick={handleAuditInventory}
            disabled={isAuditing}
            variant="outline"
            className="border-amber-500/50 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20"
          >
            {isAuditing ? (
              <Loader2 className="w-4 h-4 ml-2 animate-spin" />
            ) : (
              <Search className="w-4 h-4 ml-2" />
            )}
            فحص دقة المخزون
          </Button>
          
          <Button 
            onClick={onExport} 
            className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 border-0"
          >
            <Download className="w-4 h-4 ml-2" />
            تصدير تقرير PDF
          </Button>
        </div>
      </div>

      <Dialog open={showResults} onOpenChange={setShowResults}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {auditResults?.length === 0 ? (
                <>
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  المخزون صحيح 100%
                </>
              ) : (
                <>
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  فروقات في المخزون ({auditResults?.length || 0})
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          
          {auditResults?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="w-16 h-16 mx-auto text-green-500 mb-4" />
              <p>جميع أرقام المخزون متطابقة مع الطلبات الفعلية</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-2 text-right">المنتج</th>
                      <th className="p-2 text-center">المحجوز</th>
                      <th className="p-2 text-center">المباع</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditResults?.map((item, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="p-2">
                          <div className="font-medium">{item.product_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {item.color_name} - {item.size_value}
                          </div>
                        </td>
                        <td className="p-2 text-center">
                          {item.reserved_diff !== 0 ? (
                            <span className="text-red-500">
                              {item.current_reserved} → {item.calculated_reserved}
                            </span>
                          ) : (
                            <span className="text-green-500">✓</span>
                          )}
                        </td>
                        <td className="p-2 text-center">
                          {item.sold_diff !== 0 ? (
                            <span className="text-red-500">
                              {item.current_sold} → {item.calculated_sold}
                            </span>
                          ) : (
                            <span className="text-green-500">✓</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowResults(false)}>
                  إغلاق
                </Button>
                <Button onClick={handleFixDiscrepancies} className="bg-green-600 hover:bg-green-700">
                  إصلاح الفروقات تلقائياً
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default InventoryHeader;
