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
import Drivers from './pages/Drivers'
import DriverHome from './pages/DriverHome'
import More from './pages/More'
import Login from './pages/Login'
import Logo from './components/Logo'
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
          <div className="animate-pulse flex justify-center">
            <Logo size={56} />
          </div>
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
        <Route path="/drivers" element={<Drivers />} />
        <Route path="/more" element={<More />} />
      </Route>
    </Routes>
  )
}
