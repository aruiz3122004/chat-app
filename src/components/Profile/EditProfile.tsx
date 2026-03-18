import { useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'

interface Props {
  userId: string
  currentUsername: string
  currentAvatar: string | null
  onClose: () => void
  onUpdated: (username: string, avatar: string | null) => void
}

export default function EditProfile({ userId, currentUsername, currentAvatar, onClose, onUpdated }: Props) {
  const [username, setUsername] = useState(currentUsername)
  const [avatar, setAvatar] = useState<string | null>(currentAvatar)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const ext = file.name.split('.').pop()
    const fileName = `${userId}/avatar.${ext}`
    const { data, error } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, { upsert: true })
    if (!error && data) {
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(data.path)
      setAvatar(urlData.publicUrl + '?t=' + Date.now())
    }
    setUploading(false)
  }

  const handleSave = async () => {
    if (!username.trim()) return
    setSaving(true)
    setError('')
    const { error } = await supabase
      .from('profiles')
      .update({ username: username.trim(), avatar_url: avatar })
      .eq('id', userId)
    if (error) {
      setError(error.message.includes('unique') ? 'Ese nombre de usuario ya está en uso' : error.message)
    } else {
      onUpdated(username.trim(), avatar)
      onClose()
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}>
      <div className="w-96 rounded-2xl p-6 animate-fade-up"
        style={{ background: '#0f1420', border: '1px solid rgba(255,255,255,0.08)' }}
        onClick={e => e.stopPropagation()}>

        <h2 className="text-white font-bold text-lg mb-6" style={{ fontFamily: 'Syne, sans-serif' }}>
          Editar perfil
        </h2>

        {/* Avatar */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative cursor-pointer" onClick={() => fileRef.current?.click()}>
            {avatar ? (
              <img src={avatar} alt="avatar"
                className="w-24 h-24 rounded-full object-cover"
                style={{ border: '3px solid rgba(99,102,241,0.5)' }} />
            ) : (
              <div className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white' }}>
                {username[0]?.toUpperCase()}
              </div>
            )}
            <div className="absolute bottom-0 right-0 w-8 h-8 rounded-full flex items-center justify-center text-sm"
              style={{ background: '#6366f1', border: '2px solid #0f1420' }}>
              {uploading ? '⏳' : '📷'}
            </div>
          </div>
          <p className="text-xs mt-2" style={{ color: '#475569' }}>
            Clic para cambiar foto
          </p>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
        </div>

        {/* Username */}
        <div className="mb-4">
          <label className="text-xs font-medium mb-2 block" style={{ color: '#94a3b8' }}>
            NOMBRE DE USUARIO
          </label>
          <input
            className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            value={username}
            onChange={e => setUsername(e.target.value)}
            onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.5)'}
            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
          />
        </div>

        {error && (
          <p className="text-xs mb-4 px-3 py-2 rounded-lg"
            style={{ background: 'rgba(239,68,68,0.1)', color: '#fca5a5' }}>
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-xl text-sm transition-all"
            style={{ background: 'rgba(255,255,255,0.04)', color: '#64748b' }}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white' }}>
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}