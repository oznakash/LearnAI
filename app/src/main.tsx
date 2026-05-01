import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { disablePageZoomGestures } from './lib/no-zoom'
import { trackInitialVisit } from './lib/track-visit'

disablePageZoomGestures()
// Anonymous traffic beacon — fires once per browser session so Admin →
// Analytics → Traffic can attribute visits to referrers and to
// utm_source / ref / from query params on share URLs.
trackInitialVisit()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
