import { useTranslation } from 'react-i18next'

export const useTranslate = () => {
  const { t: i18nT } = useTranslation()

  const translate = (key: string, fallback?: string): string => {
    const result = i18nT(key)

    if (result === key && fallback) {
      return fallback
    }

    return result
  }

  return { t: translate }
}