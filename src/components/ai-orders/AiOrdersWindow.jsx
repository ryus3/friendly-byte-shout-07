/**
 * نافذة طلبات الذكاء الاصطناعي الجديدة - مضمونة العمل
 * حل جذري ومبسط بدون تعقيدات
 */

import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { 
  Bot, 
  Search, 
  Filter, 
  RefreshCw,
  X,
  Eye,
  Calendar,
  Hash,
  MessageSquare,
  Smartphone,
  AlertTriangle,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAiOrdersCore, SimpleAiOrderCard } from './AiOrdersCore';

const AiOrdersWindow = ({ open, onClose, highlightId }) => {
  const { aiOrders, loading, error, fetchAiOrders, approveOrder, deleteOrder } = useAiOrdersCore();
  
  // فلاتر محلية
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // الطلبات المفلترة
  const filteredOrders = useMemo(() => {
    let filtered = aiOrders;

    // فلتر الحالة
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === statusFilter);
    }

    // فلتر المصدر
    if (sourceFilter !== 'all') {
      filtered = filtered.filter(order => order.source === sourceFilter);
    }

    // البحث النصي
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(order => 
        order.customer_name?.toLowerCase().includes(term) ||
        order.customer_phone?.includes(term) ||
        order.id?.toString().includes(term) ||
        order.items?.some(item => 
          item.product_name?.toLowerCase().includes(term) ||
          item.name?.toLowerCase().includes(term)
        )
      );
    }

    return filtered;
  }, [aiOrders, statusFilter, sourceFilter, searchTerm]);

  // إحصائيات سريعة
  const stats = useMemo(() => {
    const total = aiOrders.length;
    const pending = aiOrders.filter(o => o.status === 'pending').length;
    const approved = aiOrders.filter(o => o.status === 'approved').length;
    const needsReview = aiOrders.filter(o => o.status === 'needs_review').length;
    const error = aiOrders.filter(o => o.status === 'error').length;

    return { total, pending, approved, needsReview, error };
  }, [aiOrders]);

  // الطلب المُبرز
  const highlightedOrder = highlightId ? 
    filteredOrders.find(order => order.id === highlightId) : null;

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Bot className="h-6 w-6 text-primary" />
              طلبات الذكاء الاصطناعي
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchAiOrders}
              disabled={loading}
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>
        </DialogHeader>

        <div className="p-6 pt-4">
          {/* الإحصائيات السريعة */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <Card className="text-center">
              <CardContent className="p-3">
                <div className="text-2xl font-bold text-primary">{stats.total}</div>
                <div className="text-xs text-muted-foreground">المجموع</div>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="p-3">
                <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
                <div className="text-xs text-muted-foreground">في الانتظار</div>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="p-3">
                <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
                <div className="text-xs text-muted-foreground">معتمد</div>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="p-3">
                <div className="text-2xl font-bold text-orange-600">{stats.needsReview}</div>
                <div className="text-xs text-muted-foreground">يحتاج مراجعة</div>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="p-3">
                <div className="text-2xl font-bold text-red-600">{stats.error}</div>
                <div className="text-xs text-muted-foreground">خطأ</div>
              </CardContent>
            </Card>
          </div>

          {/* أدوات التحكم والفلاتر */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="البحث في الطلبات..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10"
                />
              </div>
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="الحالة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الحالات</SelectItem>
                <SelectItem value="pending">في الانتظار</SelectItem>
                <SelectItem value="approved">معتمد</SelectItem>
                <SelectItem value="needs_review">يحتاج مراجعة</SelectItem>
                <SelectItem value="error">خطأ</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="المصدر" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع المصادر</SelectItem>
                <SelectItem value="telegram">تليجرام</SelectItem>
                <SelectItem value="whatsapp">واتساب</SelectItem>
                <SelectItem value="ai_chat">الدردشة الذكية</SelectItem>
                <SelectItem value="phone">الهاتف</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* المحتوى الرئيسي */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* قائمة الطلبات */}
            <div className="lg:col-span-2">
              <ScrollArea className="h-[500px]">
                {loading && (
                  <div className="flex items-center justify-center h-40">
                    <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                    <span className="mr-2">جاري التحميل...</span>
                  </div>
                )}

                {error && (
                  <Card className="border-red-200 bg-red-50">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-red-600">
                        <AlertTriangle className="h-5 w-5" />
                        <span>خطأ في تحميل الطلبات: {error}</span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {!loading && !error && filteredOrders.length === 0 && (
                  <Card className="border-dashed">
                    <CardContent className="p-8 text-center">
                      <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium mb-2">لا توجد طلبات</h3>
                      <p className="text-muted-foreground">
                        {searchTerm || statusFilter !== 'all' || sourceFilter !== 'all' 
                          ? 'لا توجد طلبات تطابق الفلاتر المحددة'
                          : 'لم يتم إنشاء أي طلبات ذكية بعد'
                        }
                      </p>
                    </CardContent>
                  </Card>
                )}

                {!loading && !error && filteredOrders.length > 0 && (
                  <div className="space-y-4">
                    {/* إظهار الطلب المُبرز أولاً */}
                    {highlightedOrder && (
                      <div className="border-2 border-primary rounded-lg p-2">
                        <div className="text-xs text-primary font-medium mb-2">الطلب المحدد:</div>
                        <SimpleAiOrderCard
                          order={highlightedOrder}
                          onApprove={approveOrder}
                          onDelete={deleteOrder}
                        />
                      </div>
                    )}
                    
                    {/* باقي الطلبات */}
                    {filteredOrders
                      .filter(order => order.id !== highlightId)
                      .map((order) => (
                        <SimpleAiOrderCard
                          key={order.id}
                          order={order}
                          onApprove={approveOrder}
                          onDelete={deleteOrder}
                        />
                      ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* معلومات إضافية */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">معلومات النظام</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>آخر تحديث:</span>
                    <span>{new Date().toLocaleTimeString('ar-SA')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>الطلبات المعروضة:</span>
                    <span>{filteredOrders.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>إجمالي الطلبات:</span>
                    <span>{aiOrders.length}</span>
                  </div>
                </CardContent>
              </Card>

              {/* اختصارات سريعة */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">اختصارات سريعة</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => setStatusFilter('pending')}
                  >
                    <Clock className="h-4 w-4 mr-2" />
                    الطلبات المعلقة ({stats.pending})
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => setStatusFilter('needs_review')}
                  >
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    تحتاج مراجعة ({stats.needsReview})
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => setSourceFilter('telegram')}
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    من تليجرام
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AiOrdersWindow;