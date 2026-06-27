import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY);

async function run() {
  const { data: inv } = await supabase.from('delivery_invoices').select('*').eq('external_id', '3623484').maybeSingle();
  console.log('Invoice:', JSON.stringify(inv, null, 2));
  
  if (inv) {
    const { data: links } = await supabase.from('delivery_invoice_orders').select('*').eq('invoice_id', inv.id);
    const orderIds = links.map(l => l.order_id);
    console.log('Linked Order IDs:', orderIds);
    
    const { data: occ } = await supabase.from('off_channel_collections').select('*').in('order_id', orderIds);
    console.log('Off-Channel Collections:', JSON.stringify(occ, null, 2));
    
    const { data: orders } = await supabase.from('orders').select('id, order_type, final_amount, delivery_fee').in('id', orderIds);
    console.log('Orders:', JSON.stringify(orders, null, 2));
  }
}
run();
