import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

interface Group { id: string; name: string }
interface Props {
  userId: string
  onSelectGroup: (group: Group) => void
  selectedGroupId: string | null
}

export default function GroupList({ userId, onSelectGroup, selectedGroupId }: Props) {
  const [groups, setGroups] = useState<Group[]>([])
  const [newGroupName, setNewGroupName] = useState('')
  const [, setCreating] = useState(false)
  const [showInput, setShowInput] = useState(false)

  useEffect(() => { fetchGroups() }, [])

  const fetchGroups = async () => {
    const { data } = await supabase
      .from('group_members')
      .select('group_id, groups(id, name)')
      .eq('user_id', userId)

    if (data) {
      const parsed = data
        .map((row: any) => row.groups)
        .filter(Boolean)
      setGroups(parsed)
    }
  }

  const createGroup = async () => {
    if (!newGroupName.trim()) return
    setCreating(true)
    const { data, error } = await supabase
      .from('groups').insert({ name: newGroupName, created_by: userId }).select().single()
    if (!error && data) {
      await supabase.from('group_members').insert({ group_id: data.id, user_id: userId })
      setGroups([...groups, data])
      setNewGroupName('')
      setShowInput(false)
    }
    setCreating(false)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold tracking-widest"
          style={{ color: '#475569', fontFamily: 'Syne, sans-serif' }}>
          CANALES
        </span>
        <button
          onClick={() => setShowInput(!showInput)}
          className="w-6 h-6 rounded-lg flex items-center justify-center text-sm transition-all"
          style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}
        >
          +
        </button>
      </div>

      {showInput && (
        <div className="mb-3 animate-fade-up">
          <input
            autoFocus
            className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(99,102,241,0.4)'
            }}
            placeholder="nombre-del-grupo"
            value={newGroupName}
            onChange={e => setNewGroupName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') createGroup()
              if (e.key === 'Escape') setShowInput(false)
            }}
          />
          <p className="text-xs mt-1" style={{ color: '#475569' }}>
            Enter para crear · Esc para cancelar
          </p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-1">
        {groups.length === 0 && (
          <p className="text-xs px-1" style={{ color: '#334155' }}>
            Sin canales aún
          </p>
        )}
        {groups.map((group, i) => (
          <button
            key={group.id}
            onClick={() => onSelectGroup(group)}
            className="w-full text-left px-3 py-2 rounded-xl transition-all text-sm flex items-center gap-2"
            style={{
              animationDelay: `${i * 50}ms`,
              background: selectedGroupId === group.id
                ? 'rgba(99,102,241,0.2)'
                : 'transparent',
              color: selectedGroupId === group.id ? '#a5b4fc' : '#64748b',
              border: selectedGroupId === group.id
                ? '1px solid rgba(99,102,241,0.3)'
                : '1px solid transparent'
            }}
          >
            <span style={{ color: selectedGroupId === group.id ? '#818cf8' : '#334155' }}>#</span>
            {group.name}
          </button>
        ))}
      </div>
    </div>
  )
}