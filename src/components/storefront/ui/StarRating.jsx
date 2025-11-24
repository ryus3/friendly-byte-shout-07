import React from 'react';
import { Star } from 'lucide-react';

const StarRating = ({ rating = 0, maxRating = 5, size = 'medium', showNumber = true }) => {
  const sizeClasses = {
    small: 'w-3 h-3',
    medium: 'w-4 h-4',
    large: 'w-6 h-6'
  };

  const textSizeClasses = {
    small: 'text-xs',
    medium: 'text-sm',
    large: 'text-lg'
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex">
        {[...Array(maxRating)].map((_, index) => (
          <Star
            key={index}
            className={`${sizeClasses[size]} ${
              index < Math.floor(rating)
                ? 'fill-yellow-400 text-yellow-400'
                : index < rating
                ? 'fill-yellow-200 text-yellow-400'
                : 'fill-gray-200 text-gray-200 dark:fill-gray-700 dark:text-gray-700'
            } transition-all`}
          />
        ))}
      </div>
      {showNumber && (
        <span className={`${textSizeClasses[size]} font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 to-orange-500`}>
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  );
};

export default StarRating;
