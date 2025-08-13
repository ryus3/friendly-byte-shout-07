UPDATE user_product_permissions 
SET has_full_access = false, 
    allowed_items = ARRAY[]::uuid[]
WHERE user_id = 'fba59dfc-451c-4906-8882-ae4601ff34d4' 
AND permission_type = 'department';