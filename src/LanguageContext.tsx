import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import { type Language, getTranslations, getSavedLanguage, saveLanguage } from './i18n'

type Translations = ReturnType<typeof getTranslations>

interface LanguageContextType {
  lang: Language
  t: Translations
  setLang: (lang: Language) => void
}

const LanguageContext = createContext<LanguageContextType>({
  lang: 'en',
  t: getTranslations('en'),
  setLang: () => {},
})

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(getSavedLanguage())
  const t = getTranslations(lang)

  const setLang = (newLang: Language) => {
    setLangState(newLang)
    saveLanguage(newLang)
  }

  return (
    <LanguageContext.Provider value={{ lang, t, setLang }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
