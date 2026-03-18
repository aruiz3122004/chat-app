import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [isRegister, setIsRegister] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    try {
      if (isRegister) {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        if (data.user) {
          await supabase.from('profiles').insert({ id: data.user.id, username })
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (err: any) {
      setError(err.message)
    }
    setLoading(false)
  }

  return (
    <div className="flex items-center justify-center h-screen w-screen overflow-hidden relative"
      style={{ background: '#080b12' }}>

      {/* Fondo decorativo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div style={{
          position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)',
          width: '600px', height: '600px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)'
        }} />
        <div style={{
          position: 'absolute', bottom: '-10%', right: '-10%',
          width: '400px', height: '400px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)'
        }} />
      </div>

      <div className="animate-fade-up w-full max-w-sm px-6 relative z-10">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
            <span className="text-2xl">💬</span>
          </div>
          <h1 className="text-3xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
            {isRegister ? 'Crear cuenta' : 'Bienvenido'}
          </h1>
          <p className="text-sm mt-2" style={{ color: '#64748b' }}>
            {isRegister ? 'Únete a la conversación' : 'Inicia sesión para continuar'}
          </p>
        </div>

        {/* Formulario */}
        <div className="glass rounded-2xl p-6 space-y-4">
          {error && (
            <div className="text-sm px-4 py-3 rounded-xl animate-fade-in"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}>
              {error}
            </div>
          )}

          {isRegister && (
            <div>
              <label className="text-xs font-medium mb-2 block" style={{ color: '#94a3b8' }}>
                NOMBRE DE USUARIO
              </label>
              <input
                className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none transition-all"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
                placeholder="tu_nombre"
                value={username}
                onChange={e => setUsername(e.target.value)}
                onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.5)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
              />
            </div>
          )}

          <div>
            <label className="text-xs font-medium mb-2 block" style={{ color: '#94a3b8' }}>
              CORREO ELECTRÓNICO
            </label>
            <input
              className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none transition-all"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
              type="email"
              placeholder="correo@ejemplo.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.5)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
            />
          </div>

          <div>
            <label className="text-xs font-medium mb-2 block" style={{ color: '#94a3b8' }}>
              CONTRASEÑA
            </label>
            <input
              className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none transition-all"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.5)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all mt-2"
            style={{
              background: loading
                ? 'rgba(99,102,241,0.5)'
                : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              boxShadow: loading ? 'none' : '0 4px 24px rgba(99,102,241,0.3)'
            }}
          >
            {loading ? '...' : isRegister ? 'Crear cuenta' : 'Iniciar sesión'}
          </button>
        </div>

        <p
          className="text-center text-sm mt-6 cursor-pointer transition-colors"
          style={{ color: '#64748b' }}
          onClick={() => setIsRegister(!isRegister)}
          onMouseEnter={e => (e.target as HTMLElement).style.color = '#a5b4fc'}
          onMouseLeave={e => (e.target as HTMLElement).style.color = '#64748b'}
        >
          {isRegister ? '¿Ya tienes cuenta? Inicia sesión →' : '¿No tienes cuenta? Regístrate →'}
        </p>
      </div>
    </div>
  )
}