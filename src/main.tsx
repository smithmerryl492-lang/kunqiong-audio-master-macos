import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// 隐藏 loading
const loadingEl = document.getElementById('loading')
if (loadingEl) loadingEl.style.display = 'none'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
