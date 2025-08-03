import React from 'react';
import { BarChart, Bar, AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';

const MiniChart = ({ data, colors, type = 'area', dataKeys = ['value'] }) => {
  const gradientId = colors ? `color-${colors[0]}` : 'color-default';
  
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="p-2 bg-background/80 backdrop-blur-sm border border-border rounded-lg shadow-lg">
          <p className="label text-sm text-muted-foreground">{`${label}`}</p>
          {payload.map((pld, index) => (
            <p key={index} style={{ color: pld.fill }} className="intro text-sm font-semibold">
              {`${pld.name}: ${pld.value.toLocaleString()} د.ع`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (type === 'bar') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
          <defs>
            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.3}/>
            </linearGradient>
            <linearGradient id="cogsGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.3}/>
            </linearGradient>
            <linearGradient id="expensesGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0.3}/>
            </linearGradient>
            <linearGradient id="duesGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.3}/>
            </linearGradient>
            <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.3}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.5)" />
          <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
          <Tooltip content={<CustomTooltip />} cursor={{fill: 'hsl(var(--primary)/0.1)'}}/>
          <Legend wrapperStyle={{fontSize: '12px'}} />
          <Bar dataKey="revenue" name="المبيعات" fill="url(#revenueGradient)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="cogs" name="تكلفة البضاعة" fill="url(#cogsGradient)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="expenses" name="المصاريف" fill="url(#expensesGradient)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="dues" name="المستحقات المدفوعة" fill="url(#duesGradient)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="profit" name="صافي الربح" fill="url(#profitGradient)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={data}
        margin={{
          top: 5,
          right: 0,
          left: 0,
          bottom: 0,
        }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={colors ? `hsl(var(--${colors[0]}))` : 'hsl(var(--primary))'} stopOpacity={0.4}/>
            <stop offset="95%" stopColor={colors ? `hsl(var(--${colors[1]}))` : 'hsl(var(--primary))'} stopOpacity={0}/>
          </linearGradient>
        </defs>
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--background))',
            borderColor: 'hsl(var(--border))',
            fontSize: '12px',
            borderRadius: 'var(--radius)',
          }}
          labelFormatter={() => ''}
          formatter={(value) => [`${value.toLocaleString()} د.ع`, 'القيمة']}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={colors ? `hsl(var(--${colors[0]}))` : 'hsl(var(--primary))'}
          strokeWidth={2}
          fillOpacity={1}
          fill={`url(#${gradientId})`}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

export default MiniChart;