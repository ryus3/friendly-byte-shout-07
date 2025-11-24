import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const StatCard = ({ title, value, icon, gradient, shadowColor, badge }) => {
  return (
    <Card className={`relative overflow-hidden border-2 transition-all duration-300 hover:scale-105 hover:shadow-2xl shadow-${shadowColor}/20`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-5`} />
      
      <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={`p-3 rounded-xl bg-gradient-to-br ${gradient} text-white shadow-lg relative`}>
          {icon}
          {badge && (
            <Badge className="absolute -top-2 -left-2 h-5 w-5 p-0 flex items-center justify-center bg-red-500 text-white text-xs rounded-full animate-pulse">
              !
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="relative z-10">
        <div className={`text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r ${gradient}`}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
};

export default StatCard;
