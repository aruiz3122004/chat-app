import { useState, useRef, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

interface Profile { id: string; username: string }
interface Group { id: string; name: string }

interface Props {
  currentUserId: string
  onStartChat: (user: Profile) => void
}

export default function UserSearch({ currentUserId, onStartChat }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Profile[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [addingToGroup, setAddingToGroup] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      return
    }
    const timeout = setTimeout(async () => {
      setLoading(true)
      const { data } = await supabase
        .from('profiles')
        .select('id, username')
        .ilike('username', `%${query}%`)
        .neq('id', currentUserId)
        .limit(8)
      if (data) setResults(data)
      setLoading(false)
    }, 300)
    return () => clearTimeout(timeout)
  }, [query])

  const fetchGroups = async () => {
    const { data } = await supabase
      .from('groups')
      .select('id, name')
      .eq('created_by', currentUserId)
    if (data) setGroups(data)
  }

  const openModal = async (user: Profile) => {
    setSelectedUser(user)
    setShowModal(true)
    setSuccessMsg('')
    await fetchGroups()
  }

  const addToGroup = async (groupId: string, groupName: string) => {
    if (!selectedUser) return
    setAddingToGroup(true)
    const { error } = await supabase.from('group_members').insert({
      group_id: groupId,
      user_id: selectedUser.id
    })
    setAddingToGroup(false)
    if (error) {
      setSuccessMsg('Ya está en ese grupo')
    } else {
      setSuccessMsg(`✅ ${selectedUser.username} añadido a ${groupName}`)
    }
  }

  const handleStartChat = (user: Profile) => {
    setShowModal(false)
    setQuery('')
    setResults([])
    onStartChat(user)
  }

  return (
    <>
      {/* Barra de búsqueda */}
      <div className="relative mb-4">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <span style={{ color: '#334155' }}>🔍</span>
          <input
            ref={inputRef}
            className="flex-1 bg-transparent text-white text-xs outline-none placeholder-gray-600"
            placeholder="Buscar usuario..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {query && (
            <button onClick={() => { setQuery(''); setResults([]) }}
              style={{ color: '#334155', fontSize: '12px' }}>✕</button>
          )}
        </div>

        {/* Resultados */}
        {(results.length > 0 || loading) && (
          <div className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-50"
            style={{ background: '#0f1420', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
            {loading && (
              <p className="text-xs px-3 py-2" style={{ color: '#334155' }}>Buscando...</p>
            )}
            {results.map(user => (
              <button
                key={user.id}
                onClick={() => openModal(user)}
                className="w-full flex items-center gap-3 px-3 py-2 transition-all text-left"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.1)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: 'rgba(99,102,241,0.2)', color: '#818cf8' }}>
                  {user.username[0].toUpperCase()}
                </div>
                <span className="text-sm text-white">{user.username}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Modal de acciones */}
      {showModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={() => setShowModal(false)}>
          <div className="w-80 rounded-2xl p-6 animate-fade-up"
            style={{ background: '#0f1420', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}
            onClick={e => e.stopPropagation()}>

            {/* Header del modal */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white' }}>
                {selectedUser.username[0].toUpperCase()}
              </div>
              <div>
                <h3 className="text-white font-semibold" style={{ fontFamily: 'Syne, sans-serif' }}>
                  {selectedUser.username}
                </h3>
                <p className="text-xs" style={{ color: '#475569' }}>¿Qué deseas hacer?</p>
              </div>
            </div>

            {/* Botón mensaje directo */}
            <button
              onClick={() => handleStartChat(selectedUser)}
              className="w-full py-3 px-4 rounded-xl text-sm font-medium mb-3 flex items-center gap-3 transition-all"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white' }}>
              <span>💬</span> Enviar mensaje directo
            </button>

            {/* Añadir a grupo */}
            {groups.length > 0 && (
              <div>
                <p className="text-xs mb-2" style={{ color: '#475569' }}>AÑADIR A UN GRUPO</p>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {groups.map(group => (
                    <button
                      key={group.id}
                      onClick={() => addToGroup(group.id, group.name)}
                      disabled={addingToGroup}
                      className="w-full py-2 px-4 rounded-xl text-sm flex items-center gap-3 transition-all text-left"
                      style={{ background: 'rgba(255,255,255,0.04)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.06)' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.1)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'}
                    >
                      <span style={{ color: '#475569' }}>#</span> {group.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {groups.length === 0 && (
              <p className="text-xs text-center py-2" style={{ color: '#334155' }}>
                No tienes grupos creados
              </p>
            )}

            {/* Mensaje de éxito */}
            {successMsg && (
              <p className="text-xs text-center mt-3 py-2 rounded-lg animate-fade-in"
                style={{ background: 'rgba(34,197,94,0.1)', color: '#4ade80' }}>
                {successMsg}
              </p>
            )}

            {/* Cerrar */}
            <button
              onClick={() => setShowModal(false)}
              className="w-full mt-3 py-2 text-xs rounded-xl transition-all"
              style={{ color: '#475569' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </>
  )
}