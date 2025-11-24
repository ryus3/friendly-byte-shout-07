import React from 'react';

const TrustBadge = ({ icon, text, gradient = "from-emerald-500 to-teal-500" }) => {
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 shadow-md hover:shadow-lg transition-all group">
      <div className={`p-3 rounded-full bg-gradient-to-r ${gradient} text-white shadow-lg group-hover:scale-110 transition-transform`}>
        {React.cloneElement(icon, { className: 'w-5 h-5' })}
      </div>
      <span className="font-semibold text-sm text-gray-700 dark:text-gray-300 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:to-purple-600 transition-all">
        {text}
      </span>
    </div>
  );
};

export default TrustBadge;
