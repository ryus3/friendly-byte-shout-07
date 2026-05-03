import React from 'react';
import { RefreshCw } from 'lucide-react';

/**
 * مؤشر السحب-للتحديث — إيماءة عالمية كتطبيقات الهاتف
 */
const PullToRefreshIndicator = ({ pullDistance = 0, isRefreshing = false, threshold = 70 }) => {
  const ready = pullDistance >= threshold || isRefreshing;
  const opacity = Math.min(pullDistance / threshold, 1);
  const rotation = isRefreshing ? 360 : (pullDistance / threshold) * 180;

  if (pullDistance <= 1 && !isRefreshing) return null;

  return (
    <div
      className="fixed top-0 left-1/2 -translate-x-1/2 z-[60] pointer-events-none"
      style={{
        transform: `translate(-50%, ${Math.min(pullDistance - 30, 40)}px)`,
        opacity,
        transition: isRefreshing ? 'transform 0.25s ease' : 'none',
      }}
      aria-hidden="true"
    >
      <div className={`p-2 rounded-full bg-primary/10 backdrop-blur-md border border-primary/30 shadow-lg ${ready ? 'bg-primary/20' : ''}`}>
        <RefreshCw
          className={`w-5 h-5 text-primary ${isRefreshing ? 'animate-spin' : ''}`}
          style={{ transform: `rotate(${rotation}deg)`, transition: isRefreshing ? 'none' : 'transform 0.1s linear' }}
        />
      </div>
    </div>
  );
};

export default PullToRefreshIndicator;
