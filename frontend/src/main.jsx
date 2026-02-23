import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import LandingPage from './pages/LandingPage.jsx'
import AuthPage from './pages/AuthPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import InstallGuidePage from './pages/InstallGuidePage.jsx'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{
        style: { background: '#0e1320', color: '#f1f5f9', border: '1px solid #1e2d4a' },
      }}/>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
        <Route path="/dashboard/*" element={<DashboardPage />} />
        <Route path="/docs/email" element={<InstallGuidePage pluginType="email" />} />
        <Route path="/docs/mobile" element={<InstallGuidePage pluginType="mobile" />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)
