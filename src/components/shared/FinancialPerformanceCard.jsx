import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { 
  TrendingUp, 
  DollarSign, 
  ShoppingCart, 
  Calculator,
  Users,
  Receipt,
  Calendar,
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
      description: 'إجمالي مبيعات الفترة بدون رسوم التوصيل'
    },
    {
      id: 'cogs',
      title: 'تكلفة البضاعة',
      value: unifiedProfitData?.cogs || 0,
      icon: ShoppingCart,
      color: '#ff6b35',
      description: 'تكلفة البضائع المباعة خلال الفترة'
    },
    {
      id: 'expenses',
      title: 'المصاريف العامة',
      value: unifiedProfitData?.generalExpenses || 0,
      icon: TrendingUp,
      color: '#e74c3c',
      description: 'المصاريف التشغيلية والإدارية'
    },
    {
      id: 'dues',
      title: 'المستحقات المدفوعة',
      value: unifiedProfitData?.employeeSettledDues || 0,
      icon: Users,
      color: '#9b59b6',
      description: 'مستحقات الموظفين المدفوعة'
    },
    {
      id: 'profit',
      title: 'صافي الربح',
      value: unifiedProfitData?.netProfit || 0,
      icon: Calculator,
      color: '#3498db',
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

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length > 0) {
      const dataKey = payload[0].dataKey;
      const metric = financialMetrics.find(m => m.id === dataKey);
      
      if (metric) {
        return (
          <div className="bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-xl p-3 min-w-48">
            <div className="flex items-center gap-2 mb-2">
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: metric.color }}
              />
              <p className="font-semibold text-sm">{metric.title}</p>
            </div>
            <p className="text-xl font-bold mb-1" style={{ color: metric.color }}>
              {payload[0].value.toLocaleString()} د.ع
            </p>
            <p className="text-xs text-muted-foreground">
              {metric.description}
            </p>
          </div>
        );
      }
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
    <Card className="bg-gradient-to-br from-slate-900/50 to-slate-800/30 border border-slate-700/50 shadow-xl">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">ملخص الأداء المالي</h3>
              <p className="text-sm text-slate-400">نظرة بيانية شاملة على الوضع المالي</p>
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
              className="appearance-none bg-slate-800/60 border border-slate-600/50 rounded-lg px-4 py-2 pr-10 text-sm text-slate-200 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all duration-200"
            >
              {Object.entries(periodLabels).map(([key, label]) => (
                <option key={key} value={key} className="bg-slate-800">{label}</option>
              ))}
            </select>
            <ChevronDown className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* الكروت المصغرة */}
        <div className="grid grid-cols-5 gap-2">
          {financialMetrics.map((metric) => {
            const Icon = metric.icon;
            
            return (
              <div
                key={metric.id}
                className="relative p-3 rounded-lg transition-all duration-200 hover:scale-105 cursor-pointer group"
                style={{ 
                  backgroundColor: `${metric.color}15`,
                  border: `1px solid ${metric.color}30`
                }}
                onMouseEnter={() => setHoveredBar(metric.id)}
                onMouseLeave={() => setHoveredBar(null)}
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
                    <p className="text-xs text-slate-300 mb-1">{metric.title}</p>
                    <p 
                      className="text-sm font-bold"
                      style={{ color: metric.color }}
                    >
                      {formatCurrency(metric.value)}
                    </p>
                  </div>
                </div>

                {/* مؤشر فوق العمود */}
                <div 
                  className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 rounded-full"
                  style={{ backgroundColor: metric.color }}
                />
              </div>
            );
          })}
        </div>

        {/* المخطط البياني المبسط */}
        <div className="h-48 bg-slate-900/30 rounded-lg p-3">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={chartData} 
              margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
              onMouseMove={(data) => {
                if (data && data.activePayload && data.activePayload[0]) {
                  setHoveredBar(data.activePayload[0].dataKey);
                }
              }}
              onMouseLeave={() => setHoveredBar(null)}
            >
              <XAxis hide />
              <YAxis hide />
              <Tooltip content={<CustomTooltip />} />
              
              {financialMetrics.map((metric) => (
                <Bar 
                  key={metric.id}
                  dataKey={metric.id} 
                  radius={[4, 4, 0, 0]}
                  className="transition-opacity duration-200"
                  onMouseEnter={() => setHoveredBar(metric.id)}
                >
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${metric.id}-${index}`} 
                      fill={hoveredBar === metric.id ? metric.color : `${metric.color}80`}
                      stroke={metric.color}
                      strokeWidth={hoveredBar === metric.id ? 2 : 0}
                    />
                  ))}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* مؤشر أسفل */}
        <div className="text-center">
          <p className="text-xs text-slate-400">
            إجمالي مبيعات الفترة بدون رسوم التوصيل
          </p>
          <p className="text-lg font-bold text-emerald-400">
            {((unifiedProfitData?.totalRevenue || 0) - (unifiedProfitData?.deliveryFees || 0)).toLocaleString()} د.ع
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default FinancialPerformanceCard;