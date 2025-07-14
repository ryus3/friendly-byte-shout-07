import React from 'react';

const DefaultProductImage = ({ className = "w-full h-full object-cover", alt = "منتج" }) => {
  return (
    <div className={`bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center ${className} rounded-md`}>
      <svg 
        className="w-1/2 h-1/2 text-gray-400 dark:text-gray-500"
        fill="currentColor" 
        viewBox="0 0 20 20"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path 
          fillRule="evenodd" 
          d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" 
          clipRule="evenodd" 
        />
      </svg>
    </div>
  );
};

export default DefaultProductImage;