import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth'
import Layout from './components/Layout'
import Login from './pages/Login'
import SellerPanel from './pages/SellerPanel'
import Participants from './pages/Participants'
import Products from './pages/Products'
import Review from './pages/Review'
import SalesLog from './pages/SalesLog'
import Admin from './pages/Admin'

// where "/" should take you, depending on who you are
function Home() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={user.role === 'SUPER_ADMIN' ? '/admin' : '/sell'} replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          {/* everything inside Layout requires login (Layout redirects otherwise) */}
          <Route element={<Layout />}>
            <Route path="/sell" element={<SellerPanel />} />
            <Route path="/participants" element={<Participants />} />
            <Route path="/products" element={<Products />} />
            <Route path="/review" element={<Review />} />
            <Route path="/sales" element={<SalesLog />} />
            <Route path="/admin" element={<Admin />} />
          </Route>
          <Route path="/" element={<Home />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
