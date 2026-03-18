import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

interface Profile {
  id: string
  username: string
}

interface Props {
  currentUserId: string
  onSelectUser: (user: Profile) => void
  selectedUserId: string | null
}

export default function UserList({ currentUserId, onSelectUser, selectedUserId }: Props) {
  const [users, setUsers] = useState<Profile[]>([])

  useEffect(() => {
    const fetchUsers = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, username')
        .neq('id', currentUserId)
      if (data) setUsers(data)
    }
    fetchUsers()
  }, [])

  return (
    <div>
      <span className="text-xs font-semibold tracking-widest block mb-3"
        style={{ color: '#475569', fontFamily: 'Syne, sans-serif' }}>
        MENSAJES DIRECTOS
      </span>
      <div className="space-y-1">
        {users.length === 0 && (
          <p className="text-xs" style={{ color: '#334155' }}>Sin usuarios aún</p>
        )}
        {users.map(user => (
          <button
            key={user.id}
            onClick={() => onSelectUser(user)}
            className="w-full text-left px-3 py-2 rounded-xl transition-all text-sm flex items-center gap-2"
            style={{
              background: selectedUserId === user.id ? 'rgba(99,102,241,0.2)' : 'transparent',
              color: selectedUserId === user.id ? '#a5b4fc' : '#64748b',
              border: selectedUserId === user.id
                ? '1px solid rgba(99,102,241,0.3)'
                : '1px solid transparent'
            }}
          >
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ background: 'rgba(99,102,241,0.2)', color: '#818cf8' }}>
              {user.username[0].toUpperCase()}
            </div>
            {user.username}
          </button>
        ))}
      </div>
    </div>
  )
}