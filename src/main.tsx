import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Self-hosted so the app keeps its typography with no network — it runs on
// localhost and is expected to work offline.
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'

// Design system load order: token values, then this app's own layout, then the
// component layer — which must come last so its rules win.
import './styles/tokens.css'
import './styles.css'
import './styles/ds-components.css'

import { App } from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
