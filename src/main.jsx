import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'

// Register Service Worker for PWA
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('يتوفر تحديث جديد للموقع. هل ترغب في تحديث الصفحة الآن؟')) {
      updateSW(true)
    }
  },
  onOfflineReady() {
    console.log('الموقع جاهز للاستخدام بدون إنترنت.')
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
