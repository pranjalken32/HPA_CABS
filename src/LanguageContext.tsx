import { useState } from 'react'
import type { ReactNode } from 'react'
import { getTranslations, getSavedLanguage, saveLanguage, type Language } from './i18n'
import { LanguageContext } from './language-context'

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
