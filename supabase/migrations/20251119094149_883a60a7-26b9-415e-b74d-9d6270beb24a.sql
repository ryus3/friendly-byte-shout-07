-- Test the two problematic orders by changing their status to trigger the return process

-- Test order 112168362
UPDATE orders
SET status = 'returned'
WHERE tracking_number = 'RYUS-112168362';

UPDATE orders
SET status = 'returned_in_stock'
WHERE tracking_number = 'RYUS-112168362';

-- Test order 112066293
UPDATE orders
SET status = 'returned'
WHERE tracking_number = 'RYUS-112066293';

UPDATE orders
SET status = 'returned_in_stock'
WHERE tracking_number = 'RYUS-112066293';