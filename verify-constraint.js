const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  // Check constraint via insert test
  const { data, error } = await supabase.from('invoices').insert([{
    order_id: 999999,
    invoice_number: 'TEST-CONSTRAINT-' + Date.now(),
    amount: 100,
    tax: 15,
    total: 115,
    status: 'issued'
  }]).select().single();
  console.log('INSERT issued:', error ? error.message : 'OK', data ? data.id : '');

  const { data: d2, error: e2 } = await supabase.from('invoices').insert([{
    order_id: 999998,
    invoice_number: 'TEST-CONSTRAINT-' + Date.now(),
    amount: 100,
    tax: 15,
    total: 115,
    status: 'paid'
  }]).select().single();
  console.log('INSERT paid:', e2 ? e2.message : 'OK', d2 ? d2.id : '');

  const { data: d3, error: e3 } = await supabase.from('invoices').insert([{
    order_id: 999997,
    invoice_number: 'TEST-CONSTRAINT-' + Date.now(),
    amount: 100,
    tax: 15,
    total: 115,
    status: 'void'
  }]).select().single();
  console.log('INSERT void:', e3 ? e3.message : 'OK', d3 ? d3.id : '');

  const { data: d4, error: e4 } = await supabase.from('invoices').insert([{
    order_id: 999996,
    invoice_number: 'TEST-CONSTRAINT-' + Date.now(),
    amount: 100,
    tax: 15,
    total: 115,
    status: 'refunded'
  }]).select().single();
  console.log('INSERT refunded:', e4 ? e4.message : 'OK', d4 ? d4.id : '');

  // Try invalid status
  const { data: d5, error: e5 } = await supabase.from('invoices').insert([{
    order_id: 999995,
    invoice_number: 'TEST-CONSTRAINT-' + Date.now(),
    amount: 100,
    tax: 15,
    total: 115,
    status: 'pending'
  }]).select().single();
  console.log('INSERT pending (should FAIL):', e5 ? e5.message : 'UNEXPECTED OK', d5 ? d5.id : '');

  // Cleanup test rows
  await supabase.from('invoices').delete().in('order_id', [999999, 999998, 999997, 999996, 999995]);
  console.log('Cleanup done');
}

test().catch(console.error);