import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bskbylgxjzdbiiepwhef.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJza2J5bGd4anpkYmlpZXB3aGVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5MjAzMjAsImV4cCI6MjA2NzQ5NjMyMH0.nLkG-Mm-hfu8lUKaSMyLllIZZkKCa7Ogo48Wk7BdkCo';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);