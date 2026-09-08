// src/utils/personaContent.ts
import { supabase } from '../lib/supabase'; // ✅ المسار الصحيح حسب مكان الملف
import { PostgrestError } from '@supabase/supabase-js';

// تعريف نوع الصف المسترجع
interface PersonaContentRow {
  key: string;
  value: string;
}

export async function fetchPersonaContent(persona: string, lang: string): Promise<Record<string, string>> {
  try {
    // ✅ تحديد نوع البيانات و الخطأ
    const { data, error }: { data: PersonaContentRow[] | null; error: PostgrestError | null } =
      await supabase
        .from('persona_content')
        .select('key, value')
        .eq('persona', persona)
        .eq('lang', lang);

    if (error) {
      // persona_content is optional in the narrow V1 contract; fall back to canonical i18n
      // when the table has not been provisioned instead of surfacing a console warning/crash.
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