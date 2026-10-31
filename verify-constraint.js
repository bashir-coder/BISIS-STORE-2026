const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {

  const { data, error } = await supabase.from(__PROTECT_3__).insert([{
    order_id: 999999,
    invoice_number: __PROTECT_4__ + Date.now(),
    amount: 100,
    tax: 15,
    total: 115,
    status: __PROTECT_5__
  }]).select().single();
  console.log(__PROTECT_6__, error ? error.message : __PROTECT_7__, data ? data.id : __PROTECT_8__);

  const { data: d2, error: e2 } = await supabase.from(__PROTECT_9__).insert([{
    order_id: 999998,
    invoice_number: __PROTECT_10__ + Date.now(),
    amount: 100,
    tax: 15,
    total: 115,
    status: __PROTECT_11__
  }]).select().single();
  console.log(__PROTECT_12__, e2 ? e2.message : __PROTECT_13__, d2 ? d2.id : __PROTECT_14__);

  const { data: d3, error: e3 } = await supabase.from(__PROTECT_15__).insert([{
    order_id: 999997,
    invoice_number: __PROTECT_16__ + Date.now(),
    amount: 100,
    tax: 15,
    total: 115,
    status: __PROTECT_17__
  }]).select().single();
  console.log(__PROTECT_18__, e3 ? e3.message : __PROTECT_19__, d3 ? d3.id : __PROTECT_20__);

  const { data: d4, error: e4 } = await supabase.from(__PROTECT_21__).insert([{
    order_id: 999996,
    invoice_number: __PROTECT_22__ + Date.now(),
    amount: 100,
    tax: 15,
    total: 115,
    status: __PROTECT_23__
  }]).select().single();
  console.log(__PROTECT_24__, e4 ? e4.message : __PROTECT_25__, d4 ? d4.id : __PROTECT_26__);

  const { data: d5, error: e5 } = await supabase.from(__PROTECT_27__).insert([{
    order_id: 999995,
    invoice_number: __PROTECT_28__ + Date.now(),
    amount: 100,
    tax: 15,
    total: 115,
    status: __PROTECT_29__
  }]).select().single();
  console.log(__PROTECT_30__, e5 ? e5.message : __PROTECT_31__, d5 ? d5.id : __PROTECT_32__);

  await supabase.from('invoices').delete().in('order_id', [999999, 999998, 999997, 999996, 999995]);
  console.log('Cleanup done');
}

test().catch(console.error);
