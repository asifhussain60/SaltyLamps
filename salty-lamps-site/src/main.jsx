import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/saltylamps.css'
// admin.css is deliberately NOT imported here. It is 36 KB that no shopper needs,
// and importing it globally made every storefront visit download the back office's
// stylesheet. It is imported by AdminApp.jsx instead, so Vite splits it into the
// same lazy chunk as the portal itself and it is fetched only by someone opening
// the admin. The one rule that must survive without it — .admin-boot, the frame
// shown while that chunk loads — lives in saltylamps.css.

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
