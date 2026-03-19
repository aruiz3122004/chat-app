import { useEffect, useState, useRef } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { encryptMessage, decryptMessage } from '../../lib/crypto'
import MessageStatus from '../Chat/MessageStatus'

interface Message {
  id: string
  content: string
  sender_id: string
  created_at: string
  status: 'sent' | 'delivered' | 'read'
}

interface Profile {
  id: string
  username: string
  avatar_url?: string | null
}

interface Props {
  currentUserId: string
  targetUser: Profile
}

export default function DirectChatWindow({ currentUserId, targetUser }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [_targetAvatar, setTargetAvatar] = useState<string | null>(targetUser.avatar_url ?? null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    fetchMessages()

    const channelId = [currentUserId, targetUser.id].sort().join('_')
    const channel = supabase
      .channel(`direct_${channelId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'direct_messages'
      }, async payload => {
        const msg = payload.new as any
        const isRelevant =
          (msg.sender_id === currentUserId && msg.receiver_id === targetUser.id) ||
          (msg.sender_id === targetUser.id && msg.receiver_id === currentUserId)
        if (isRelevant) {
          setMessages(prev => {
            if (prev.find(m => m.id === msg.id)) return prev
            return [...prev, msg]
          })
          if (msg.sender_id === targetUser.id) {
            await markAsRead(msg.id)
            toast(`${targetUser.username}: ${decryptMessage(msg.content).slice(0, 50)}`, {
              icon: '💬', duration: 3000
            })
          }
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'direct_messages'
      }, payload => {
        const updated = payload.new as Message
        setMessages(prev =>
          prev.map(m => m.id === updated.id ? { ...m, status: updated.status } : m)
        )
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'profiles'
      }, payload => {
        const updated = payload.new as any
        if (updated.id === targetUser.id) setTargetAvatar(updated.avatar_url ?? null)
      })
      .subscribe()

    pollRef.current = setInterval(async () => {
      const { data } = await supabase
        .from('direct_messages')
        .select('*')
        .or(
          `and(sender_id.eq.${currentUserId},receiver_id.eq.${targetUser.id}),` +
          `and(sender_id.eq.${targetUser.id},receiver_id.eq.${currentUserId})`
        )
        .order('created_at', { ascending: true })
      if (data) {
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id))
          const newMsgs = data.filter((m: Message) => !existingIds.has(m.id))
          if (newMsgs.length === 0) return prev
          newMsgs.forEach((msg: Message) => {
            if (msg.sender_id === targetUser.id) {
              toast(`${targetUser.username}: ${decryptMessage(msg.content).slice(0, 50)}`, {
                icon: '💬', duration: 3000
              })
            }
          })
          return [...prev, ...newMsgs]
        })
      }
    }, 3000)

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        supabase.realtime.connect()
        fetchMessages()
      }
    }
    const handleOnline = () => {
      supabase.realtime.connect()
      fetchMessages()
    }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('online', handleOnline)

    return () => {
      supabase.removeChannel(channel)
      if (pollRef.current) clearInterval(pollRef.current)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('online', handleOnline)
    }
  }, [targetUser.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    markAllAsRead()
    const fetchTargetProfile = async () => {
      const { data } = await supabase
        .from('profiles').select('avatar_url').eq('id', targetUser.id).single()
      if (data) setTargetAvatar(data.avatar_url ?? null)
    }
    fetchTargetProfile()
  }, [targetUser.id])

  const markAsRead = async (messageId: string) => {
    await supabase.from('direct_messages').update({ status: 'read' }).eq('id', messageId)
  }

  const markAllAsRead = async () => {
    await supabase.from('direct_messages')
      .update({ status: 'read' })
      .eq('sender_id', targetUser.id)
      .eq('receiver_id', currentUserId)
      .neq('status', 'read')
  }

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('direct_messages')
      .select('*')
      .or(
        `and(sender_id.eq.${currentUserId},receiver_id.eq.${targetUser.id}),` +
        `and(sender_id.eq.${targetUser.id},receiver_id.eq.${currentUserId})`
      )
      .order('created_at', { ascending: true })
    if (data) setMessages(data)
    await markAllAsRead()
  }

  const sendMessage = async () => {
    if (!text.trim()) return
    setSending(true)
    await supabase.from('direct_messages').insert({
      content: encryptMessage(text),
      sender_id: currentUserId,
      receiver_id: targetUser.id,
      is_encrypted: true,
      status: 'sent'
    })
    setText('')
    setSending(false)
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const fileName = `${Date.now()}_${file.name}`
    const { data, error } = await supabase.storage
      .from('chat-files').upload(`direct/${fileName}`, file)
    if (!error && data) {
      const { data: urlData } = supabase.storage.from('chat-files').getPublicUrl(data.path)
      await supabase.from('direct_messages').insert({
        content: encryptMessage(`FILE:${file.name}:${urlData.publicUrl}`),
        sender_id: currentUserId,
        receiver_id: targetUser.id,
        is_encrypted: true,
        status: 'sent'
      })
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []
      mediaRecorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const fileName = `audio_${Date.now()}.webm`
        const file = new File([blob], fileName, { type: 'audio/webm' })
        const { data, error } = await supabase.storage
          .from('chat-files').upload(`direct/${fileName}`, file)
        if (!error && data) {
          const { data: urlData } = supabase.storage.from('chat-files').getPublicUrl(data.path)
          await supabase.from('direct_messages').insert({
            content: encryptMessage(`AUDIO:${fileName}:${urlData.publicUrl}`),
            sender_id: currentUserId,
            receiver_id: targetUser.id,
            is_encrypted: true,
            status: 'sent'
          })
        }
        stream.getTracks().forEach(t => t.stop())
      }
      mediaRecorder.start()
      setRecording(true)
      setRecordingTime(0)
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000)
    } catch { alert('No se pudo acceder al micrófono') }
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    setRecording(false)
    if (timerRef.current) clearInterval(timerRef.current)
    setRecordingTime(0)
  }

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`

  const renderContent = (content: string) => {
    const t = decryptMessage(content)
    if (t.startsWith('AUDIO:')) {
      const parts = t.split(':')
      const fileUrl = parts.slice(2).join(':')
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '200px' }}>
          <span>🎙️</span>
          <audio controls style={{ height: '32px', maxWidth: '180px' }}>
            <source src={fileUrl} type="audio/webm" />
          </audio>
        </div>
      )
    }
    if (t.startsWith('FILE:')) {
      const parts = t.split(':')
      const fileName = parts[1]
      const fileUrl = parts.slice(2).join(':')
      const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName)
      return isImage ? (
        <div>
          <img src={fileUrl} alt={fileName}
            style={{ maxWidth: '200px', borderRadius: '8px', cursor: 'pointer' }}
            onClick={() => window.open(fileUrl, '_blank')} />
          <p style={{ fontSize: '11px', marginTop: '4px', opacity: 0.7 }}>{fileName}</p>
        </div>
      ) : (
        <a href={fileUrl} target="_blank" rel="noopener noreferrer"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'white' }}>
          📄 {fileName}
        </a>
      )
    }
    return <p style={{ margin: 0 }}>{t}</p>
  }

  // ✅ Sin header interno — el topbar de Chat.tsx lo maneja
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Mensajes */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {messages.map(msg => {
          const isOwn = msg.sender_id === currentUserId
          return (
            <div key={msg.id} style={{ display: 'flex', justifyContent: isOwn ? 'flex-end' : 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
                <div style={{
                  padding: '10px 14px', borderRadius: '18px', fontSize: '13px',
                  borderBottomRightRadius: isOwn ? '4px' : '18px',
                  borderBottomLeftRadius: isOwn ? '18px' : '4px',
                  background: isOwn ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(255,255,255,0.06)',
                  color: 'white'
                }}>
                  {renderContent(msg.content)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                  <span style={{ fontSize: '11px', color: '#334155' }}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <MessageStatus status={msg.status} isOwn={isOwn} />
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <input ref={fileRef} type="file" accept="image/*,video/*,.pdf,.doc,.docx" style={{ display: 'none' }} onChange={handleFile} />
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '10px 14px', borderRadius: '16px',
          background: 'rgba(255,255,255,0.04)',
          border: `1px solid ${recording ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.07)'}`
        }}>
          {recording ? (
            <>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
              <span style={{ color: '#f87171', fontSize: '13px', flex: 1 }}>{formatTime(recordingTime)} Grabando...</span>
              <button onClick={stopRecording} style={{
                width: '32px', height: '32px', borderRadius: '10px', border: 'none',
                cursor: 'pointer', background: 'rgba(239,68,68,0.2)', color: '#f87171', fontSize: '14px'
              }}>■</button>
            </>
          ) : (
            <>
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', flexShrink: 0, color: uploading ? '#6366f1' : '#475569' }}
                title="Adjuntar archivo">
                {uploading ? '⏳' : '📎'}
              </button>
              <input
                style={{ flex: 1, background: 'transparent', border: 'none', color: 'white', fontSize: '13px', outline: 'none' }}
                placeholder={`Mensaje a ${targetUser.username}...`}
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              />
              {text.trim() ? (
                <button onClick={sendMessage} disabled={sending} style={{
                  width: '32px', height: '32px', borderRadius: '10px', border: 'none',
                  cursor: 'pointer', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  color: 'white', fontSize: '14px', flexShrink: 0
                }}>➤</button>
              ) : (
                <button onClick={startRecording} style={{
                  width: '32px', height: '32px', borderRadius: '10px', border: 'none',
                  cursor: 'pointer', background: 'rgba(99,102,241,0.15)', color: '#818cf8',
                  fontSize: '16px', flexShrink: 0
                }} title="Grabar audio">🎙️</button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}