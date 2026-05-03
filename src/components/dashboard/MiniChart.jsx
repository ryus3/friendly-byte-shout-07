import React, { Suspense, lazy } from 'react';

// 🚀 Lazy-load recharts (~250KB) — split out of main bundle
const MiniChartImpl = lazy(() => import('./MiniChartImpl'));

const ChartSkeleton = () => (
  <div className="w-full h-full min-h-[120px] rounded-lg bg-muted/40 animate-pulse" />
);

const MiniChart = (props) => (
  <Suspense fallback={<ChartSkeleton />}>
    <MiniChartImpl {...props} />
  </Suspense>
);

export default MiniChart;
