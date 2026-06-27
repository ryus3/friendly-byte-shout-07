import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY);

async function run() {
  const { data: invs } = await supabase.from('delivery_invoices').select('id, external_id, amount').limit(5);
  console.log('Sample Invoices:', JSON.stringify(invs, null, 2));
}
run();
