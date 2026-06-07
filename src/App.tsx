import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { useAuth } from './AuthContext'
import Layout from './components/Layout'
import DriverLayout from './components/DriverLayout'
import Dashboard from './pages/Dashboard'
import AddIncome from './pages/AddIncome'
import AddExpense from './pages/AddExpense'
import History from './pages/History'
import Cars from './pages/Cars'
import CarDetail from './pages/CarDetail'
import Analytics from './pages/Analytics'
import DriverSettlement from './pages/DriverSettlement'
import DriverHome from './pages/DriverHome'
import Login from './pages/Login'
import { processRecurringExpenses } from './hooks/useSupabase'
import { runAllAlerts } from './utils/notifications'

export default function App() {
  const { user, loading, role } = useAuth()

  useEffect(() => {
    if (user && role === 'owner') {
      processRecurringExpenses()
      runAllAlerts()
    }
  }, [user, role])

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <svg className="w-14 h-14 mx-auto mb-3 animate-pulse" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <rect width="100" height="100" rx="20" fill="#000000"/>
            <rect x="6" y="6" width="88" height="88" rx="16" fill="none" stroke="#222222" strokeWidth="1.5"/>
            <path d="M30 28 L30 72 M30 50 L70 50 M70 28 L70 72" stroke="#ffffff" strokeWidth="10" strokeLinecap="round" fill="none"/>
          </svg>
          <p className="text-text-muted text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) return <Login />

  if (role === 'driver') {
    return (
      <Routes>
        <Route element={<DriverLayout />}>
          <Route path="/" element={<DriverHome />} />
          <Route path="/cars/:id" element={<CarDetail />} />
        </Route>
      </Routes>
    )
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/add-income" element={<AddIncome />} />
        <Route path="/add-expense" element={<AddExpense />} />
        <Route path="/history" element={<History />} />
        <Route path="/cars" element={<Cars />} />
        <Route path="/cars/:id" element={<CarDetail />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/driver" element={<DriverSettlement />} />
      </Route>
    </Routes>
  )
}
