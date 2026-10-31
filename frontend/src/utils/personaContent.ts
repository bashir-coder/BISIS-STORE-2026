import { supabase } from '../lib/supabase';
import { PostgrestError } from '@supabase/supabase-js';

interface PersonaContentRow {
  key: string;
  value: string;
}

export async function fetchPersonaContent(persona: string, lang: string): Promise<Record<string, string>> {
  try {

    const { data, error }: { data: PersonaContentRow[] | null; error: PostgrestError | null } =
      await supabase
        .from('persona_content')
        .select('key, value')
        .eq('persona', persona)
        .eq('lang', lang);

    if (error) {

      const optionalTableMissing = error.code === 'PGRST205' || error.code === '42P01'
      if (!optionalTableMissing) {
        console.warn(`Failed to load optional persona content (${persona}, ${lang})`, error.message)
      }
      return {}
    }

    if (!data || data.length === 0) {
      return {}
    }

    const content: Record<string, string> = {};
    data.forEach((row: PersonaContentRow) => {
      content[row.key] = row.value;
    });
    return content;
    } catch (err) {
    console.error('Unexpected error loading optional persona content', err)
    return {}
  }

}
