import { createClient } from '@supabase/supabase-js';

const REQUIRED_ENV_VARS = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'] as const;

type MissingVar = (typeof REQUIRED_ENV_VARS)[number];

function getMissingVars(): MissingVar[] {
  const missing: MissingVar[] = [];
  for (const key of REQUIRED_ENV_VARS) {
    const value = import.meta.env[key];
    if (value === undefined || value === null || String(value).trim() === '') {
      missing.push(key);
    }
  }
  return missing;
}

function throwMissingEnvError(missing: MissingVar[]): never {
  const envLabel = import.meta.env.MODE === 'production' ? 'production' : import.meta.env.MODE;
  const detail = missing.join(', ');
  throw new Error(
    `Supabase configuration is missing required environment variables for ${envLabel} mode: ${detail}. ` +
      'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before building/running the frontend.'
  );
}

const missingVars = getMissingVars();
if (missingVars.length > 0) {
  throwMissingEnvError(missingVars);
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);