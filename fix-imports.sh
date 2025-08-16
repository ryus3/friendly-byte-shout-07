#!/bin/bash

# Fix all imports from customSupabaseClient to correct supabase client
find src -name "*.js" -o -name "*.jsx" -o -name "*.ts" -o -name "*.tsx" | xargs sed -i "s|from '@/lib/customSupabaseClient'|from '@/integrations/supabase/client'|g"

echo "Fixed all supabase imports"