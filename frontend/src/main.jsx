import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Self-hosted so it works on flaky camp wifi - a Google Fonts request would
// block text rendering exactly when the stand is busy.
import '@fontsource-variable/plus-jakarta-sans'
import './index.css'
import App from './App.jsx'
import { initTheme } from './theme'

initTheme() // before mount, so the saved theme never flashes the default first

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
