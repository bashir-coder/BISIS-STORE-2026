const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('id, amount, price, user_id, workspace_id')
    .eq('id', 117)
    .single();
  
  const amount = Number(order.amount ?? order.price);
  const tax = Number((amount * 0.15).toFixed(2));
  const total = Number((amount + tax).toFixed(2));
  
  const statuses = ['issued', 'paid', 'void', 'refunded', 'pending', 'draft', 'cancelled'];
  
  for (const status of statuses) {
    const invoiceNumber = `INV-${Date.now()}-${require('crypto').randomUUID().slice(0, 8).toUpperCase()}`;
    
    const { data, error } = await supabaseAdmin.from('invoices').insert([{
      order_id: order.id, amount, tax, total,
      invoice_number: invoiceNumber,
      status,
    }]).select().single();
    
    if (error) {
      console.log(`Status '${status}': FAIL - ${error.message}`);
    } else {
      console.log(`Status '${status}': OK - ID ${data.id}`);
      // Clean up
      await supabaseAdmin.from('invoices').delete().eq('id', data.id);
    }
  }
}

test().catch(console.error);