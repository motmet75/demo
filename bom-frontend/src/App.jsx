import React from 'react'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'

import MaterialPage from './features/material/MaterialPage'
import ModelPage from './features/model/ModelPage'

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ padding: 20 }}>
        <h1>BOM System</h1>

        {/* Simple navigation */}
        <nav style={{ marginBottom: 16 }}>
          <Link to="/materials" style={{ marginRight: 12 }}>Materials</Link>
          <Link to="/models">Models</Link>
        </nav>

        <Routes>
          <Route path="/" element={<MaterialPage />} />
          <Route path="/materials" element={<MaterialPage />} />
          <Route path="/models" element={<ModelPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
} 