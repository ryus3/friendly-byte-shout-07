import React from 'react';

/**
 * أيقونة احترافية للطلب الذكي - تجمع بين الدماغ والشرارة
 * تستخدم gradient بنفسجي → أزرق سماوي مع توهج خفيف
 */
const AiOrderIcon = ({ className = 'w-5 h-5', ...props }) => {
  const gradId = React.useId();
  const glowId = React.useId();
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="55%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
        <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.7" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g filter={`url(#${glowId})`}>
        {/* جسم الدماغ المُبسَّط */}
        <path
          d="M9 4.5a3 3 0 0 0-3 3v.2a3 3 0 0 0-2 2.8v.5a3 3 0 0 0 1.2 2.4A3 3 0 0 0 6 16.5a3 3 0 0 0 3 3 2.5 2.5 0 0 0 2.5-2.5V6.5A2 2 0 0 0 9.5 4.5H9z"
          stroke={`url(#${gradId})`}
          strokeWidth="1.4"
          strokeLinejoin="round"
          fill="none"
        />
        <path
          d="M15 4.5a3 3 0 0 1 3 3v.2a3 3 0 0 1 2 2.8v.5a3 3 0 0 1-1.2 2.4A3 3 0 0 1 18 16.5a3 3 0 0 1-3 3 2.5 2.5 0 0 1-2.5-2.5V6.5A2 2 0 0 1 14.5 4.5H15z"
          stroke={`url(#${gradId})`}
          strokeWidth="1.4"
          strokeLinejoin="round"
          fill="none"
        />
        {/* شرارة الذكاء في المنتصف */}
        <path
          d="M12 9.5l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6-1.6-.7 1.6-.7L12 9.5z"
          fill={`url(#${gradId})`}
        />
        {/* نقاط الاتصال العصبي */}
        <circle cx="7.5" cy="10" r="0.7" fill={`url(#${gradId})`} />
        <circle cx="16.5" cy="10" r="0.7" fill={`url(#${gradId})`} />
        <circle cx="9" cy="15" r="0.6" fill={`url(#${gradId})`} opacity="0.8" />
        <circle cx="15" cy="15" r="0.6" fill={`url(#${gradId})`} opacity="0.8" />
      </g>
    </svg>
  );
};

export default AiOrderIcon;
