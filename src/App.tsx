import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Chat from './pages/Chat'
import type { Session } from '@supabase/supabase-js'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    // Reconexión automática cuando la página vuelve a estar visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        supabase.realtime.connect()
      }
    }

    // Reconexión cuando recupera conexión a internet
    const handleOnline = () => {
      supabase.realtime.connect()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('online', handleOnline)

    return () => {
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-screen"
      style={{ background: '#080b12' }}>
      <div className="text-center">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4"
          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
          💬
        </div>
        <p className="text-sm" style={{ color: '#334155' }}>Cargando...</p>
      </div>
    </div>
  )

  return session ? <Chat session={session} /> : <Login />
}

export default App