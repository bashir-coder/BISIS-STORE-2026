import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { supabase } from './lib/supabase'
import { fallbackResources, type SupportedLanguage } from './i18n-fallback'

const languages: SupportedLanguage[] = ['ar', 'en', 'tr']

i18n
  .use(initReactI18next)
  .init({
    fallbackLng: 'ar',
    supportedLngs: languages,
    ns: ['common'],
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    resources: fallbackResources,
    react: { useSuspense: false },
  })

const loadTranslationsFromSupabase = async () => {
  for (const lang of languages) {
    try {
      const { data, error } = await supabase
        .from('translations')
        .select('key, value')
        .eq('lang', lang)
        .eq('ns', 'common')

      if (error) {
        console.warn(`⚠️ تعذر تحميل ترجمة ${lang}:`, error.message)
        continue
      }

      if (data?.length) {
        const resource: Record<string, string> = {}
        data.forEach((row) => { resource[row.key] = row.value })
        i18n.addResourceBundle(lang, 'common', resource, true, true)
      }
    } catch (error) {
      console.warn(`⚠️ فشل تحميل ترجمة ${lang}:`, error)
    }
  }
}

void loadTranslationsFromSupabase()

export default i18n
