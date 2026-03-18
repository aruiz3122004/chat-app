import { useState, useEffect } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import GroupList from '../components/Groups/GroupList'
import ChatWindow from '../components/Chat/ChatWindow'
import UserList from '../components/Direct/UserList'
import DirectChatWindow from '../components/Direct/DirectChatWindow'
import UserSearch from '../components/Direct/UserSearch'
import EditProfile from '../components/Profile/EditProfile'

interface Props { session: Session }
interface Group { id: string; name: string }
interface Profile { id: string; username: string; avatar_url?: string | null }
type ActiveView = { type: 'group'; data: Group } | { type: 'direct'; data: Profile } | null

export default function Chat({ session }: Props) {
  const [activeView, setActiveView] = useState<ActiveView>(null)
  const [showEditProfile, setShowEditProfile] = useState(false)
  const [username, setUsername] = useState('')
  const [avatar, setAvatar] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (Notification.permission === 'default') Notification.requestPermission()
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('username, avatar_url')
      .eq('id', session.user.id)
      .single()
    if (data) {
      setUsername(data.username)
      setAvatar(data.avatar_url)
    }
  }

  const handleLogout = async () => { await supabase.auth.signOut() }

  const handleSelectView = (view: ActiveView) => {
    setActiveView(view)
    setSidebarOpen(false)
  }

  const Sidebar = () => (
    <div className="flex flex-col h-full w-full py-5 px-3"
      style={{ background: '#0a0e17' }}>
      <button className="px-2 mb-4 text-left w-full rounded-xl p-2 transition-all"
        onClick={() => setShowEditProfile(true)}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
        <div className="flex items-center gap-2 mb-1">
          {avatar ? (
            <img src={avatar} alt="avatar" className="w-7 h-7 rounded-lg object-cover flex-shrink-0" />
          ) : (
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white' }}>
              {username[0]?.toUpperCase()}
            </div>
          )}
          <h1 className="text-white font-bold text-sm truncate" style={{ fontFamily: 'Syne, sans-serif' }}>
            {username || 'ChatApp'}
          </h1>
        </div>
        <p className="text-xs truncate pl-9" style={{ color: '#334155' }}>
          {session.user.email}
        </p>
      </button>

      <div className="mb-4">
        <UserSearch
          currentUserId={session.user.id}
          onStartChat={u => handleSelectView({ type: 'direct', data: u })}
        />
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', marginBottom: '16px' }} />

      <div className="mb-4">
        <GroupList
          userId={session.user.id}
          onSelectGroup={g => handleSelectView({ type: 'group', data: g })}
          selectedGroupId={activeView?.type === 'group' ? activeView.data.id : null}
        />
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', marginBottom: '16px' }} />

      <div className="flex-1 overflow-y-auto">
        <UserList
          currentUserId={session.user.id}
          onSelectUser={u => handleSelectView({ type: 'direct', data: u })}
          selectedUserId={activeView?.type === 'direct' ? activeView.data.id : null}
        />
      </div>

      <div className="pt-4 px-1" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <button onClick={handleLogout}
          className="w-full py-2 px-3 rounded-xl text-xs font-medium transition-all flex items-center gap-2"
          style={{ color: '#475569' }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)'
            ;(e.currentTarget as HTMLElement).style.color = '#fca5a5'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'transparent'
            ;(e.currentTarget as HTMLElement).style.color = '#475569'
          }}>
          <span>→</span> Cerrar sesión
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen w-screen overflow-hidden" style={{ background: '#080b12' }}>

      {showEditProfile && (
        <EditProfile
          userId={session.user.id}
          currentUsername={username}
          currentAvatar={avatar}
          onClose={() => setShowEditProfile(false)}
          onUpdated={(u, a) => { setUsername(u); setAvatar(a) }}
        />
      )}

      {/* SIDEBAR DESKTOP */}
      <div className="hidden md:flex flex-col w-60 flex-shrink-0"
        style={{ borderRight: '1px solid rgba(255,255,255,0.05)' }}>
        <Sidebar />
      </div>

      {/* SIDEBAR MÓVIL */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={() => setSidebarOpen(false)} />
          <div className="relative w-72 h-full z-50 flex flex-col"
            style={{ borderRight: '1px solid rgba(255,255,255,0.05)' }}>
            <Sidebar />
          </div>
        </div>
      )}

      {/* ÁREA PRINCIPAL */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ✅ CAMBIO: Barra superior móvil con botón de regreso */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: '#0a0e17' }}>

          {activeView ? (
            // ✅ NUEVO: Botón ← para volver cuando hay un chat abierto
            <button onClick={() => setActiveView(null)}
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
              ←
            </button>
          ) : (
            // Botón ☰ para abrir el menú cuando no hay chat abierto
            <button onClick={() => setSidebarOpen(true)}
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.05)', color: '#64748b' }}>
              ☰
            </button>
          )}

          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-6 h-6 rounded-md flex items-center justify-center text-xs flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              💬
            </div>
            <span className="text-white text-sm font-bold truncate" style={{ fontFamily: 'Syne, sans-serif' }}>
              {activeView?.type === 'group'
                ? `# ${activeView.data.name}`
                : activeView?.type === 'direct'
                ? activeView.data.username
                : 'ChatApp'}
            </span>
          </div>

          {/* ✅ NUEVO: Botón ☰ siempre visible cuando hay chat abierto */}
          {activeView && (
            <button onClick={() => setSidebarOpen(true)}
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.05)', color: '#64748b' }}>
              ☰
            </button>
          )}
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-hidden">
          {activeView?.type === 'group' && (
            <ChatWindow
              groupId={activeView.data.id}
              groupName={activeView.data.name}
              currentUserId={session.user.id}
            />
          )}
          {activeView?.type === 'direct' && (
            <DirectChatWindow
              currentUserId={session.user.id}
              targetUser={activeView.data}
            />
          )}
          {!activeView && (
            <div className="flex flex-col items-center justify-center h-full animate-fade-in">
              <div className="text-6xl mb-4 opacity-10">💬</div>
              <p className="text-base font-semibold px-4 text-center"
                style={{ fontFamily: 'Syne, sans-serif', color: '#1e293b' }}>
                Selecciona un canal o usuario
              </p>
              <button
                className="md:hidden mt-4 px-6 py-3 rounded-xl text-sm font-medium"
                style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}
                onClick={() => setSidebarOpen(true)}>
                Ver canales y usuarios
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}