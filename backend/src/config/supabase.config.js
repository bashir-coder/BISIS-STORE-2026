const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
// The backend intentionally uses the server-only service-role key.
const supabaseKey = supabaseServiceRoleKey;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase configuration: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
}

// ✅ إضافة خيارات timeout عشان ما ننتظر 40 ثانية
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
  },
  global: {
    headers: { 'x-application-name': 'BİŞİŞ-backend' },
    fetch: (url, options) => {
      // إضافة timeout 10 ثواني
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      return fetch(url, { ...options, signal: controller.signal })
        .finally(() => clearTimeout(timeoutId));
    }
  },
  db: {
    schema: 'public'
  }
});

module.exports = supabase;
