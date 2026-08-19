import { createContext } from 'react'
import { type Language, getTranslations } from './i18n'

type Translations = ReturnType<typeof getTranslations>

interface LanguageContextType {
  lang: Language
  t: Translations
  setLang: (lang: Language) => void
}

export const LanguageContext = createContext<LanguageContextType>({
  lang: 'en',
  t: getTranslations('en'),
  setLang: () => {},
})
