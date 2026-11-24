import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const root = document.getElementById('root')!
const app = (
  <StrictMode>
    <App />
  </StrictMode>
)

// index.html trae la landing ya dibujada (scripts/prerender.mjs). En "/"
// React la reutiliza; en las demás rutas se descarta y se arma como siempre.
if (root.hasAttribute('data-pre') && location.pathname === '/') {
  hydrateRoot(root, app)
} else {
  root.removeAttribute('data-pre')
  root.textContent = ''
  createRoot(root).render(app)
}
