import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth'
import { CampProvider } from './campContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import SellerPanel from './pages/SellerPanel'
import Participants from './pages/Participants'
import Products from './pages/Products'
import Review from './pages/Review'
import SalesLog from './pages/SalesLog'
import Admin from './pages/Admin'
import Overview from './pages/Overview'

// where "/" should take you, depending on who you are. A super admin oversees every
// camp, so they land on the cross-camp overview rather than a single camp's dashboard.
function Home() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={user.role === 'SUPER_ADMIN' ? '/overview' : '/sell'} replace />
}

export default function App() {
  return (
    <AuthProvider>
      <CampProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            {/* everything inside Layout requires login (Layout redirects otherwise) */}
            <Route element={<Layout />}>
              <Route path="/overview" element={<Overview />} />
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
      </CampProvider>
    </AuthProvider>
  )
}
