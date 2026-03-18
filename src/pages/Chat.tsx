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

  const SidebarContent = () => (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', width: '100%',
      padding: '20px 12px',
      background: '#0a0e17'
    }}>
      {/* Perfil */}
      <button
        onClick={() => { setShowEditProfile(true); setSidebarOpen(false) }}
        style={{
          padding: '8px', marginBottom: '16px', textAlign: 'left',
          width: '100%', borderRadius: '12px', background: 'transparent',
          border: 'none', cursor: 'pointer'
        }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          {avatar ? (
            <img src={avatar} alt="avatar" style={{
              width: '28px', height: '28px', borderRadius: '8px',
              objectFit: 'cover', flexShrink: 0
            }} />
          ) : (
            <div style={{
              width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '12px', fontWeight: 'bold',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white'
            }}>
              {username[0]?.toUpperCase()}
            </div>
          )}
          <span style={{
            color: 'white', fontWeight: 'bold', fontSize: '14px',
            fontFamily: 'Syne, sans-serif', overflow: 'hidden',
            textOverflow: 'ellipsis', whiteSpace: 'nowrap'
          }}>
            {username || 'ChatApp'}
          </span>
        </div>
        <p style={{
          fontSize: '12px', color: '#334155', paddingLeft: '36px', margin: 0,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
        }}>
          {session.user.email}
        </p>
      </button>

      {/* Búsqueda */}
      <div style={{ marginBottom: '16px' }}>
        <UserSearch
          currentUserId={session.user.id}
          onStartChat={u => handleSelectView({ type: 'direct', data: u })}
        />
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', marginBottom: '16px' }} />

      {/* Grupos */}
      <div style={{ marginBottom: '16px' }}>
        <GroupList
          userId={session.user.id}
          onSelectGroup={g => handleSelectView({ type: 'group', data: g })}
          selectedGroupId={activeView?.type === 'group' ? activeView.data.id : null}
        />
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', marginBottom: '16px' }} />

      {/* Usuarios */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <UserList
          currentUserId={session.user.id}
          onSelectUser={u => handleSelectView({ type: 'direct', data: u })}
          selectedUserId={activeView?.type === 'direct' ? activeView.data.id : null}
        />
      </div>

      {/* Cerrar sesión */}
      <div style={{ paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <button
          onClick={handleLogout}
          style={{
            width: '100%', padding: '8px 12px', borderRadius: '12px',
            fontSize: '12px', fontWeight: '500', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '8px',
            color: '#475569', background: 'transparent'
          }}
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
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100vh', width: '100vw',
      overflow: 'hidden', background: '#080b12'
    }}>

      {showEditProfile && (
        <EditProfile
          userId={session.user.id}
          currentUsername={username}
          currentAvatar={avatar}
          onClose={() => setShowEditProfile(false)}
          onUpdated={(u, a) => { setUsername(u); setAvatar(a) }}
        />
      )}

      {/* SIDEBAR — siempre overlay en todos los dispositivos */}
      {sidebarOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex' }}>
          <div
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)' }}
            onClick={() => setSidebarOpen(false)}
          />
          <div style={{
            position: 'relative', zIndex: 10000,
            width: '280px', height: '100%',
            display: 'flex', flexDirection: 'column',
            borderRight: '1px solid rgba(255,255,255,0.08)'
          }}>
            <SidebarContent />
          </div>
        </div>
      )}

      {/* BARRA SUPERIOR — siempre visible en todos los dispositivos */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '12px 16px', flexShrink: 0,
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        background: '#0a0e17'
      }}>
        {activeView ? (
          <button
            onClick={() => setActiveView(null)}
            style={{
              width: '32px', height: '32px', borderRadius: '8px',
              border: 'none', cursor: 'pointer', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(99,102,241,0.15)', color: '#818cf8', fontSize: '16px'
            }}>
            ←
          </button>
        ) : (
          <button
            onClick={() => setSidebarOpen(true)}
            style={{
              width: '32px', height: '32px', borderRadius: '8px',
              border: 'none', cursor: 'pointer', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(255,255,255,0.05)', color: '#64748b', fontSize: '16px'
            }}>
            ☰
          </button>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
          <div style={{
            width: '24px', height: '24px', borderRadius: '6px', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)'
          }}>
            💬
          </div>
          <span style={{
            color: 'white', fontSize: '14px', fontWeight: 'bold',
            fontFamily: 'Syne, sans-serif',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
          }}>
            {activeView?.type === 'group'
              ? `# ${activeView.data.name}`
              : activeView?.type === 'direct'
              ? activeView.data.username
              : 'ChatApp'}
          </span>
        </div>

        {activeView && (
          <button
            onClick={() => setSidebarOpen(true)}
            style={{
              width: '32px', height: '32px', borderRadius: '8px',
              border: 'none', cursor: 'pointer', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(255,255,255,0.05)', color: '#64748b', fontSize: '16px'
            }}>
            ☰
          </button>
        )}
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
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
          <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', height: '100%'
          }}>
            <div style={{ fontSize: '60px', marginBottom: '16px', opacity: 0.1 }}>💬</div>
            <p style={{
              fontSize: '16px', fontWeight: '600', textAlign: 'center',
              padding: '0 16px', fontFamily: 'Syne, sans-serif', color: '#1e293b'
            }}>
              Selecciona un canal o usuario
            </p>
            <button
              onClick={() => setSidebarOpen(true)}
              style={{
                marginTop: '16px', padding: '12px 24px', borderRadius: '12px',
                fontSize: '14px', fontWeight: '500', border: 'none', cursor: 'pointer',
                background: 'rgba(99,102,241,0.15)', color: '#818cf8'
              }}>
              Ver canales y usuarios
            </button>
          </div>
        )}
      </div>
    </div>
  )
}