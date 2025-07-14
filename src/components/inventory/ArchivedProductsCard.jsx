import React from 'react';
import { Archive, Package, Eye, RotateCcw } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const ArchivedProductsCard = ({ archivedCount = 0, onViewArchive, onRestoreProduct }) => {
  return (
    <Card className={cn(
      "relative bg-card rounded-xl p-4 sm:p-6 border transition-all duration-300 animate-fade-in hover-scale",
      "shadow-lg shadow-black/10 dark:shadow-black/30",
      "hover:shadow-2xl hover:shadow-primary/10",
      "dark:hover:shadow-primary/20",
      "cursor-pointer group"
    )}>
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/10 to-transparent rounded-xl pointer-events-none"></div>
      <div 
        className="absolute inset-px rounded-xl opacity-60"
        style={{
          backgroundImage: `radial-gradient(circle at 40% 30%, hsl(var(--card-foreground) / 0.03), transparent), radial-gradient(circle at 90% 80%, hsl(var(--primary) / 0.05), transparent)`
        }}
      ></div>

      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              <Archive className="w-5 h-5 text-gray-500" />
              أرشيف المنتجات
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              المنتجات النافذة والمؤرشفة
            </p>
          </div>
          <div className="bg-gradient-to-tr from-gray-500 to-gray-600 rounded-lg p-3 transition-transform duration-300 group-hover:scale-110">
            <Package className="w-6 h-6 text-white" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-bold text-foreground">{archivedCount.toLocaleString()}</h3>
            <p className="text-xs text-muted-foreground">منتج مؤرشف</p>
          </div>
          <Badge variant="secondary" className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
            {archivedCount > 0 ? 'يحتاج مراجعة' : 'لا يوجد'}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onViewArchive}
            className="flex items-center gap-2 text-xs"
          >
            <Eye className="w-3 h-3" />
            عرض الأرشيف
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onRestoreProduct}
            className="flex items-center gap-2 text-xs"
            disabled={archivedCount === 0}
          >
            <RotateCcw className="w-3 h-3" />
            استعادة
          </Button>
        </div>

        {archivedCount > 0 && (
          <div className="text-xs text-muted-foreground bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded border border-yellow-200 dark:border-yellow-800">
            <p className="text-yellow-600 dark:text-yellow-400">
              💡 هذه المنتجات تم أرشفتها تلقائياً لأن جميع مقاساتها نافذة
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ArchivedProductsCard;