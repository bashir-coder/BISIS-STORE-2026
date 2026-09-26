const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
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
  
  console.log('Amount:', amount, 'Tax:', tax, 'Total:', total);
  
  const invoiceNumber = `INV-${Date.now()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  console.log('Invoice number:', invoiceNumber);
  
  const { data, error } = await supabaseAdmin.from('invoices').insert([{
    order_id: order.id, amount, tax, total,
    invoice_number: invoiceNumber,
    status: 'issued',
  }]).select().single();
  
  if (error) {
    console.log('Insert error:', error);
  } else {
    console.log('Inserted:', data);
  }
}

test().catch(console.error);