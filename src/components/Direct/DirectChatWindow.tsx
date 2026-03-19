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
  const [targetAvatar, setTargetAvatar] = useState<string | null>(targetUser.avatar_url ?? null)
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
        event: 'INSERT',
        schema: 'public',
        table: 'direct_messages'
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
        event: 'UPDATE',
        schema: 'public',
        table: 'direct_messages'
      }, payload => {
        const updated = payload.new as Message
        setMessages(prev =>
          prev.map(m => m.id === updated.id ? { ...m, status: updated.status } : m)
        )
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles'
      }, payload => {
        const updated = payload.new as any
        if (updated.id === targetUser.id) setTargetAvatar(updated.avatar_url)
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
      if (data) setTargetAvatar(data.avatar_url)
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

  // ✅ NUEVO: manejo de archivos multimedia
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
        <div className="flex items-center gap-2" style={{ minWidth: '200px' }}>
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
            className="max-w-xs rounded-lg cursor-pointer"
            onClick={() => window.open(fileUrl, '_blank')} />
          <p className="text-xs mt-1 opacity-70">{fileName}</p>
        </div>
      ) : (
        <a href={fileUrl} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 underline">
          📄 {fileName}
        </a>
      )
    }
    return <p>{t}</p>
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 flex items-center justify-between"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: '#080b12' }}>
        <div className="flex items-center gap-3">
          {targetAvatar ? (
            <img src={targetAvatar} alt={targetUser.username}
              className="w-8 h-8 rounded-full object-cover flex-shrink-0"
              style={{ border: '2px solid rgba(99,102,241,0.3)' }} />
          ) : (
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
              style={{ background: 'rgba(99,102,241,0.2)', color: '#818cf8' }}>
              {targetUser.username[0].toUpperCase()}
            </div>
          )}
          <div>
            <h2 className="text-white text-sm font-semibold" style={{ fontFamily: 'Syne, sans-serif' }}>
              {targetUser.username}
            </h2>
            <p className="text-xs" style={{ color: '#334155' }}>Mensaje directo</p>
          </div>
        </div>
        <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs"
          style={{ background: 'rgba(34,197,94,0.08)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.15)' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
          AES-256
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map(msg => {
          const isOwn = msg.sender_id === currentUserId
          return (
            <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-xs lg:max-w-md`}>
                <div className={`p-3 rounded-2xl text-sm msg-bubble ${isOwn ? 'rounded-br-none' : 'rounded-bl-none'}`}
                  style={{
                    background: isOwn ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(255,255,255,0.06)',
                    color: 'white'
                  }}>
                  {renderContent(msg.content)}
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-xs" style={{ color: '#334155' }}>
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

      {/* ✅ Input con 📎 añadido */}
      <div className="px-4 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
          style={{ display: 'none' }}
          onChange={handleFile}
        />
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: `1px solid ${recording ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.07)'}`
          }}>
          {recording ? (
            <>
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
              <span className="text-red-400 text-sm flex-1">{formatTime(recordingTime)} Grabando...</span>
              <button onClick={stopRecording}
                className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171' }}>
                ■
              </button>
            </>
          ) : (
            <>
              {/* ✅ Botón 📎 siempre visible */}
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                title="Adjuntar archivo"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '18px', flexShrink: 0, padding: '2px',
                  color: uploading ? '#6366f1' : '#475569'
                }}>
                {uploading ? '⏳' : '📎'}
              </button>

              <input
                className="flex-1 bg-transparent text-white text-sm outline-none placeholder-gray-600"
                placeholder={`Mensaje a ${targetUser.username}...`}
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              />
              {text.trim() ? (
                <button onClick={sendMessage} disabled={sending || !text.trim()}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-sm transition-all flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white' }}>
                  ➤
                </button>
              ) : (
                <button onClick={startRecording}
                  className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}
                  title="Grabar audio">
                  🎙️
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}