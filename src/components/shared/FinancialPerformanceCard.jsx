import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  DollarSign, 
  ShoppingCart, 
  Calculator,
  Users,
  Receipt,
  Calendar,
  BarChart3
} from 'lucide-react';
import { BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Cell } from 'recharts';

const FinancialPerformanceCard = ({ 
  unifiedProfitData, 
  selectedTimePeriod, 
  onTimePeriodChange 
}) => {
  const [hoveredMetric, setHoveredMetric] = useState(null);

  const periodLabels = {
    all: 'كل الفترات',
    today: 'اليوم',
    week: 'هذا الأسبوع',
    month: 'هذا الشهر',
    year: 'هذا العام'
  };

  const financialMetrics = [
    {
      id: 'revenue',
      title: 'المبيعات',
      value: (unifiedProfitData?.totalRevenue || 0) - (unifiedProfitData?.deliveryFees || 0),
      icon: Receipt,
      color: '#10b981',
      bgGradient: 'from-emerald-500/20 to-emerald-600/10',
      description: 'إجمالي مبيعات الفترة بدون رسوم التوصيل'
    },
    {
      id: 'cogs',
      title: 'تكلفة البضاعة',
      value: unifiedProfitData?.cogs || 0,
      icon: ShoppingCart,
      color: '#f59e0b',
      bgGradient: 'from-amber-500/20 to-amber-600/10',
      description: 'تكلفة البضائع المباعة خلال الفترة'
    },
    {
      id: 'expenses',
      title: 'المصاريف العامة',
      value: unifiedProfitData?.generalExpenses || 0,
      icon: TrendingUp,
      color: '#ef4444',
      bgGradient: 'from-red-500/20 to-red-600/10',
      description: 'المصاريف التشغيلية والإدارية'
    },
    {
      id: 'dues',
      title: 'المستحقات المدفوعة',
      value: unifiedProfitData?.employeeSettledDues || 0,
      icon: Users,
      color: '#8b5cf6',
      bgGradient: 'from-violet-500/20 to-violet-600/10',
      description: 'مستحقات الموظفين المدفوعة'
    },
    {
      id: 'profit',
      title: 'صافي الربح',
      value: unifiedProfitData?.netProfit || 0,
      icon: Calculator,
      color: '#06b6d4',
      bgGradient: 'from-cyan-500/20 to-cyan-600/10',
      description: 'الربح النهائي بعد خصم جميع التكاليف'
    }
  ];

  const chartData = [
    {
      name: 'البيانات المالية',
      revenue: (unifiedProfitData?.totalRevenue || 0) - (unifiedProfitData?.deliveryFees || 0),
      cogs: unifiedProfitData?.cogs || 0,
      expenses: unifiedProfitData?.generalExpenses || 0,
      dues: unifiedProfitData?.employeeSettledDues || 0,
      profit: unifiedProfitData?.netProfit || 0
    }
  ];

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const metric = financialMetrics.find(m => m.id === payload[0].dataKey);
      return (
        <div className="bg-background/95 backdrop-blur-md border border-border/50 rounded-xl shadow-2xl p-4 max-w-64">
          <div className="flex items-center gap-2 mb-2">
            <div 
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: metric?.color }}
            />
            <p className="font-semibold text-sm">{metric?.title}</p>
          </div>
          <p className="text-2xl font-bold mb-2" style={{ color: metric?.color }}>
            {payload[0].value.toLocaleString()} د.ع
          </p>
          <p className="text-xs text-muted-foreground">
            {metric?.description}
          </p>
        </div>
      );
    }
    return null;
  };

  const formatCurrency = (amount) => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}م`;
    } else if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}ك`;
    }
    return amount.toLocaleString();
  };

  return (
    <Card className="relative overflow-hidden bg-gradient-to-br from-background via-background to-muted/20 border-2 border-border/50 shadow-2xl hover:shadow-3xl transition-all duration-500 group">
      {/* خلفية متحركة */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
      
      <CardHeader className="relative z-10 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center shadow-inner">
                <BarChart3 className="w-6 h-6 text-primary" />
              </div>
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full animate-pulse" />
            </div>
            <div>
              <h3 className="text-xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                ملخص الأداء المالي
              </h3>
              <p className="text-sm text-muted-foreground">نظرة بيانية شاملة على الوضع المالي</p>
            </div>
          </div>
          
          {/* فلتر الفترة المحسن */}
          <div className="relative">
            <select 
              value={selectedTimePeriod} 
              onChange={(e) => {
                const period = e.target.value;
                onTimePeriodChange(period);
                localStorage.setItem('financialTimePeriod', period);
              }}
              className="appearance-none bg-gradient-to-r from-background to-muted/50 border-2 border-border/30 rounded-xl px-4 py-2 pr-10 text-sm font-medium shadow-inner hover:shadow-lg transition-all duration-300 focus:ring-2 focus:ring-primary/20 focus:border-primary/50 cursor-pointer"
            >
              {Object.entries(periodLabels).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="relative z-10 space-y-6">
        {/* المقاييس المالية */}
        <div className="grid grid-cols-5 gap-3">
          {financialMetrics.map((metric) => {
            const Icon = metric.icon;
            const isHovered = hoveredMetric === metric.id;
            
            return (
              <div
                key={metric.id}
                className={`relative p-4 rounded-xl bg-gradient-to-br ${metric.bgGradient} border border-border/30 cursor-pointer transition-all duration-300 transform hover:scale-105 hover:shadow-xl group/metric`}
                onMouseEnter={() => setHoveredMetric(metric.id)}
                onMouseLeave={() => setHoveredMetric(null)}
              >
                {/* تأثير الإضاءة */}
                <div 
                  className="absolute inset-0 rounded-xl opacity-0 group-hover/metric:opacity-20 transition-opacity duration-300"
                  style={{ 
                    background: `radial-gradient(circle at center, ${metric.color}40, transparent)` 
                  }}
                />
                
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-3">
                    <div 
                      className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm"
                      style={{ backgroundColor: `${metric.color}20` }}
                    >
                      <Icon 
                        className="w-4 h-4" 
                        style={{ color: metric.color }}
                      />
                    </div>
                    {isHovered && (
                      <Badge 
                        variant="secondary" 
                        className="text-xs animate-fade-in"
                        style={{ 
                          backgroundColor: `${metric.color}15`,
                          color: metric.color,
                          borderColor: `${metric.color}30`
                        }}
                      >
                        نشط
                      </Badge>
                    )}
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      {metric.title}
                    </p>
                    <p 
                      className="text-lg font-bold tracking-tight"
                      style={{ color: metric.color }}
                    >
                      {formatCurrency(metric.value)}
                    </p>
                  </div>

                  {/* وصف عند التمرير */}
                  {isHovered && (
                    <div className="absolute -top-16 left-1/2 transform -translate-x-1/2 bg-background/95 backdrop-blur-md border border-border/50 rounded-lg p-2 shadow-xl z-50 min-w-48 animate-fade-in">
                      <p className="text-xs text-center text-muted-foreground">
                        {metric.description}
                      </p>
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-border/50" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* المخطط البياني المحسن */}
        <div className="relative h-64 bg-gradient-to-br from-muted/10 to-muted/5 rounded-xl border border-border/30 p-4 overflow-hidden">
          {/* خلفية ديناميكية */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent opacity-50" />
          
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
              <defs>
                {financialMetrics.map((metric) => (
                  <linearGradient key={`gradient-${metric.id}`} id={`gradient-${metric.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={metric.color} stopOpacity={0.9}/>
                    <stop offset="95%" stopColor={metric.color} stopOpacity={0.3}/>
                  </linearGradient>
                ))}
              </defs>
              
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.3} />
              <XAxis 
                dataKey="name" 
                stroke="hsl(var(--muted-foreground))" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false} 
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false} 
                tickFormatter={(value) => formatCurrency(value)} 
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--primary)/0.05)' }} />
              
              {financialMetrics.map((metric) => (
                <Bar 
                  key={metric.id}
                  dataKey={metric.id} 
                  fill={`url(#gradient-${metric.id})`} 
                  radius={[4, 4, 0, 0]}
                  className="hover:opacity-80 transition-opacity duration-200"
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* مؤشرات الأداء */}
        <div className="flex items-center justify-center gap-4 pt-2">
          <div className="flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-emerald-500/10 to-emerald-600/5 rounded-full border border-emerald-500/20">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-medium text-emerald-600">نمو إيجابي</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-blue-500/10 to-blue-600/5 rounded-full border border-blue-500/20">
            <DollarSign className="w-3 h-3 text-blue-600" />
            <span className="text-xs font-medium text-blue-600">أداء مالي قوي</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default FinancialPerformanceCard;