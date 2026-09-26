const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fix() {
  console.log('Fixing invoices_status_check constraint...');
  
  // Drop the existing constraint and add the correct one
  // Using raw SQL via PostgREST is not directly possible, but we can try via rpc if available
  // Or we can check if there's another way
  
  // Since we can't run ALTER TABLE directly via Supabase JS client,
  // we need to use a migration approach. But for now, let me check 
  // if we can use the SQL editor or if there's an existing migration that should have fixed this.
  
  console.log('Cannot run ALTER TABLE via JS client directly.');
  console.log('Need to run this SQL in Supabase SQL Editor:');
  console.log('');
  console.log('ALTER TABLE public.invoices');
  console.log('  DROP CONSTRAINT IF EXISTS invoices_status_check;');
  console.log('');
  console.log('ALTER TABLE public.invoices');
  console.log('  ADD CONSTRAINT invoices_status_check');
  console.log("  CHECK (status IN ('issued','paid','void','refunded'));");
}

fix().catch(console.error);