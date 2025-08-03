import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { 
  TrendingUp, 
  ShoppingCart, 
  Calculator,
  Users,
  Receipt,
  BarChart3,
  ChevronDown
} from 'lucide-react';
import { BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts';

const FinancialPerformanceCard = ({ 
  unifiedProfitData, 
  selectedTimePeriod, 
  onTimePeriodChange 
}) => {
  const [hoveredBar, setHoveredBar] = useState(null);
  const [hoveredCard, setHoveredCard] = useState(null);

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
      color: '#00d4aa',
      darkColor: '#00d4aa',
      bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
      borderColor: 'border-emerald-200 dark:border-emerald-700/50',
      description: 'إجمالي المبيعات بدون رسوم التوصيل'
    },
    {
      id: 'cogs',
      title: 'تكلفة البضاعة',
      value: unifiedProfitData?.cogs || 0,
      icon: ShoppingCart,
      color: '#ff6b35',
      darkColor: '#ff6b35',
      bgColor: 'bg-orange-50 dark:bg-orange-900/20',
      borderColor: 'border-orange-200 dark:border-orange-700/50',
      description: 'تكلفة البضائع المباعة'
    },
    {
      id: 'expenses',
      title: 'المصاريف العامة',
      value: unifiedProfitData?.generalExpenses || 0,
      icon: TrendingUp,
      color: '#e74c3c',
      darkColor: '#e74c3c',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      borderColor: 'border-red-200 dark:border-red-700/50',
      description: 'المصاريف التشغيلية والإدارية'
    },
    {
      id: 'dues',
      title: 'المستحقات المدفوعة',
      value: unifiedProfitData?.employeeSettledDues || 0,
      icon: Users,
      color: '#9b59b6',
      darkColor: '#9b59b6',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20',
      borderColor: 'border-purple-200 dark:border-purple-700/50',
      description: 'مستحقات الموظفين المدفوعة'
    },
    {
      id: 'profit',
      title: 'صافي الربح',
      value: unifiedProfitData?.netProfit || 0,
      icon: Calculator,
      color: '#3498db',
      darkColor: '#3498db',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      borderColor: 'border-blue-200 dark:border-blue-700/50',
      description: 'الربح النهائي بعد خصم التكاليف'
    }
  ];

  // إنشاء بيانات منفصلة لكل عمود
  const chartData = financialMetrics.map(metric => ({
    name: metric.title,
    value: metric.value,
    id: metric.id,
    color: metric.color
  }));

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length > 0) {
      const data = payload[0].payload;
      const metric = financialMetrics.find(m => m.id === data.id);
      
      return (
        <div className="bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-xl p-3 min-w-48">
          <div className="flex items-center gap-2 mb-2">
            <div 
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: metric?.color }}
            />
            <p className="font-semibold text-sm">{metric?.title}</p>
          </div>
          <p className="text-xl font-bold mb-1" style={{ color: metric?.color }}>
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
    <Card className="bg-background border border-border shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">ملخص الأداء المالي</h3>
              <p className="text-sm text-muted-foreground">نظرة بيانية شاملة على الوضع المالي</p>
            </div>
          </div>
          
          {/* فلتر محسن */}
          <div className="relative">
            <select 
              value={selectedTimePeriod} 
              onChange={(e) => {
                const period = e.target.value;
                onTimePeriodChange(period);
                localStorage.setItem('financialTimePeriod', period);
              }}
              className="appearance-none bg-background border border-border rounded-lg px-4 py-2 pr-10 text-sm text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200"
            >
              {Object.entries(periodLabels).map(([key, label]) => (
                <option key={key} value={key} className="bg-background">{label}</option>
              ))}
            </select>
            <ChevronDown className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* الكروت المصغرة فوق الأعمدة مباشرة */}
        <div className="relative">
          <div className="grid grid-cols-5 gap-2 mb-2">
            {financialMetrics.map((metric) => {
              const Icon = metric.icon;
              
              return (
                <div
                  key={metric.id}
                  className={`relative p-3 rounded-xl ${metric.bgColor} ${metric.borderColor} border transition-all duration-200 hover:scale-105 cursor-pointer group`}
                  onMouseEnter={() => {
                    setHoveredCard(metric.id);
                    setHoveredBar(metric.id);
                  }}
                  onMouseLeave={() => {
                    setHoveredCard(null);
                    setHoveredBar(null);
                  }}
                >
                  <div className="text-center space-y-2">
                    <div 
                      className="w-8 h-8 rounded-full mx-auto flex items-center justify-center"
                      style={{ backgroundColor: `${metric.color}25` }}
                    >
                      <Icon 
                        className="w-4 h-4" 
                        style={{ color: metric.color }}
                      />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">{metric.title}</p>
                      <p 
                        className="text-sm font-bold"
                        style={{ color: metric.color }}
                      >
                        {formatCurrency(metric.value)}
                      </p>
                    </div>
                  </div>

                  {/* مؤشر اتصال بالعمود */}
                  <div 
                    className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 rounded-full"
                    style={{ backgroundColor: metric.color }}
                  />

                  {/* Tooltip للكرت */}
                  {hoveredCard === metric.id && (
                    <div className="absolute -top-16 left-1/2 transform -translate-x-1/2 bg-background/95 backdrop-blur-sm border border-border rounded-lg p-2 shadow-xl z-50 min-w-40 animate-in fade-in-0 zoom-in-95 duration-200">
                      <p className="text-xs text-center text-muted-foreground">
                        {metric.description}
                      </p>
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-border" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* المخطط البياني */}
          <div className="h-40 bg-muted/30 rounded-lg p-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={chartData} 
                margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
              >
                <XAxis hide />
                <YAxis hide />
                <Tooltip content={<CustomTooltip />} />
                
                <Bar 
                  dataKey="value"
                  radius={[4, 4, 0, 0]}
                  onMouseEnter={(data, index) => {
                    setHoveredBar(chartData[index]?.id);
                  }}
                  onMouseLeave={() => {
                    setHoveredBar(null);
                  }}
                >
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={hoveredBar === entry.id ? entry.color : `${entry.color}80`}
                      stroke={hoveredBar === entry.id ? entry.color : 'transparent'}
                      strokeWidth={hoveredBar === entry.id ? 2 : 0}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* مؤشر المبيعات الإجمالية */}
        <div className="text-center pt-2 border-t border-border/50">
          <p className="text-xs text-muted-foreground mb-1">
            إجمالي مبيعات الفترة بدون رسوم التوصيل
          </p>
          <p className="text-lg font-bold text-emerald-500">
            {((unifiedProfitData?.totalRevenue || 0) - (unifiedProfitData?.deliveryFees || 0)).toLocaleString()} د.ع
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default FinancialPerformanceCard;

export default FinancialPerformanceCard;