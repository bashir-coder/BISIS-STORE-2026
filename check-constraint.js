const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const sql = __PROTECT_0__;

supabase
  .rpc(__PROTECT_4__, { sql })
  .then(r => console.log(__PROTECT_5__, JSON.stringify(r, null, 2)))
  .catch(e => console.log(__PROTECT_6__, e.message));

supabase
  .from('invoices')
  .select('*')
  .then(r => console.log('ALL INVOICES:', JSON.stringify(r.data, null, 2)));
