import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { AuthProvider } from './AuthContext'
import { LanguageProvider } from './LanguageContext'
import { setupOfflineSync } from './utils/offline'
import './index.css'
import App from './App.tsx'

setupOfflineSync()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <LanguageProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </LanguageProvider>
    </HashRouter>
  </StrictMode>,
)
