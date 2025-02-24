import React from 'react'
import { createRoot } from 'react-dom/client'
import PopupPage from './PopupPage'
import './popup.css'

const container = document.getElementById('root')
if (!container) {
  throw new Error('Root element not found')
}

const root = createRoot(container)
root.render(
  <React.StrictMode>
    <PopupPage />
  </React.StrictMode>
) 