import React from 'react';

const OrdersHeader = ({ title, description, icon: Icon }) => {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold gradient-text flex items-center gap-3">
          {Icon && <Icon className="w-8 h-8" />}
          {title}
        </h1>
        <p className="text-muted-foreground mt-1">{description}</p>
      </div>
    </div>
  );
};

export default OrdersHeader;