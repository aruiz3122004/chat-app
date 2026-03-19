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
  const [creating, setCreating] = useState(false)
  const [showInput, setShowInput] = useState(false)

  useEffect(() => { fetchGroups() }, [])

  const fetchGroups = async () => {
    const { data } = await supabase
      .from('group_members')
      .select('group_id, groups(id, name)')
      .eq('user_id', userId)
    if (data) {
      const parsed = data.map((row: any) => row.groups).filter(Boolean)
      setGroups(parsed)
    }
  }

const createGroup = async () => {
  if (!newGroupName.trim() || creating) return
  setCreating(true)

  const { data, error } = await supabase
    .from('groups')
    .insert({ name: newGroupName.trim(), created_by: userId })
    .select().single()

  if (error) {
    alert('Error grupos: ' + error.message + ' | code: ' + error.code)
    setCreating(false)
    return
  }

  if (data) {
    const { error: memberError } = await supabase
      .from('group_members')
      .insert({ group_id: data.id, user_id: userId })

    if (memberError) {
      alert('Error miembros: ' + memberError.message + ' | code: ' + memberError.code)
    } else {
      setGroups(prev => [...prev, data])
      setNewGroupName('')
      setShowInput(false)
    }
  }
  setCreating(false)
}

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <span style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.1em', color: '#475569', fontFamily: 'Syne, sans-serif' }}>
          CANALES
        </span>
        <button
          onClick={() => setShowInput(!showInput)}
          style={{
            width: '24px', height: '24px', borderRadius: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '14px', border: 'none', cursor: 'pointer',
            background: 'rgba(99,102,241,0.15)', color: '#818cf8'
          }}>
          +
        </button>
      </div>

      {showInput && (
        <div style={{ marginBottom: '12px' }}>
          {/* Input + botón crear en la misma fila */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              autoFocus
              style={{
                flex: 1, padding: '8px 12px', borderRadius: '8px',
                fontSize: '13px', color: 'white', outline: 'none',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(99,102,241,0.4)'
              }}
              placeholder="nombre-del-canal"
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') createGroup()
                if (e.key === 'Escape') { setShowInput(false); setNewGroupName('') }
              }}
            />
            {/* Botón alternativo para móvil donde Enter no funciona bien */}
            <button
              onClick={createGroup}
              disabled={creating || !newGroupName.trim()}
              style={{
                padding: '8px 12px', borderRadius: '8px', border: 'none',
                cursor: 'pointer', fontSize: '13px', fontWeight: '600',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: 'white', flexShrink: 0
              }}>
              {creating ? '...' : '✓'}
            </button>
          </div>
          <p style={{ fontSize: '11px', marginTop: '4px', color: '#475569' }}>
            Enter o ✓ para crear · Esc para cancelar
          </p>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {groups.length === 0 && (
          <p style={{ fontSize: '12px', color: '#334155', padding: '0 4px' }}>
            Sin canales aún
          </p>
        )}
        {groups.map(group => (
          <button
            key={group.id}
            onClick={() => onSelectGroup(group)}
            style={{
              width: '100%', textAlign: 'left', padding: '8px 12px',
              borderRadius: '12px', fontSize: '13px', border: 'none',
              cursor: 'pointer', display: 'flex', alignItems: 'center',
              gap: '8px', marginBottom: '4px',
              background: selectedGroupId === group.id ? 'rgba(99,102,241,0.2)' : 'transparent',
              color: selectedGroupId === group.id ? '#a5b4fc' : '#64748b',
              outline: selectedGroupId === group.id ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent'
            }}>
            <span style={{ color: selectedGroupId === group.id ? '#818cf8' : '#334155' }}>#</span>
            {group.name}
          </button>
        ))}
      </div>
    </div>
  )
}