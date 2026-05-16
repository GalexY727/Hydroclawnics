import React from 'react'
import ReactDOM from 'react-dom/client'
import './globals.css'
import App from './app/App.jsx'
import appIcon from '../../../media/icon.ico'

document.querySelector("link[rel='icon']").href = appIcon

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
