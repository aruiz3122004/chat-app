import { useState, useRef } from 'react'
import { encryptMessage } from '../../lib/crypto'
import { supabase } from '../../lib/supabase'

interface Props { groupId: string; senderId: string }

export default function MessageInput({ groupId, senderId }: Props) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const sendMessage = async (content: string, isFile = false) => {
    if (!content.trim()) return
    setSending(true)
    await supabase.from('messages').insert({
      content: encryptMessage(content),
      sender_id: senderId, group_id: groupId,
      is_encrypted: true, is_file: isFile
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
      .from('chat-files').upload(`${groupId}/${fileName}`, file)
    if (!error && data) {
      const { data: urlData } = supabase.storage.from('chat-files').getPublicUrl(data.path)
      await sendMessage(`FILE:${file.name}:${urlData.publicUrl}`, true)
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
      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const fileName = `audio_${Date.now()}.webm`
        const file = new File([blob], fileName, { type: 'audio/webm' })
        setUploading(true)
        const { data, error } = await supabase.storage
          .from('chat-files').upload(`${groupId}/${fileName}`, file)
        if (!error && data) {
          const { data: urlData } = supabase.storage.from('chat-files').getPublicUrl(data.path)
          await sendMessage(`AUDIO:${fileName}:${urlData.publicUrl}`, true)
        }
        setUploading(false)
        stream.getTracks().forEach(t => t.stop())
      }
      mediaRecorder.start()
      setRecording(true)
      setRecordingTime(0)
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000)
    } catch {
      alert('No se pudo acceder al micrófono')
    }
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    setRecording(false)
    if (timerRef.current) clearInterval(timerRef.current)
    setRecordingTime(0)
  }

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`

  return (
    <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
        style={{ display: 'none' }}
        onChange={handleFile}
      />

      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '10px 14px', borderRadius: '16px',
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${recording ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.07)'}`
      }}>
        {recording ? (
          /* Estado grabando */
          <>
            <span style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: '#ef4444', flexShrink: 0, animation: 'pulse 1s infinite'
            }} />
            <span style={{ color: '#f87171', fontSize: '13px', flex: 1 }}>
              {formatTime(recordingTime)} Grabando...
            </span>
            <button
              onClick={stopRecording}
              style={{
                width: '32px', height: '32px', borderRadius: '10px',
                border: 'none', cursor: 'pointer', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(239,68,68,0.2)', color: '#f87171', fontSize: '14px'
              }}>
              ■
            </button>
          </>
        ) : (
          /* Estado normal — 📎 y 🎙️ siempre visibles */
          <>
            {/* 📎 Adjuntar archivo — siempre visible */}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              title="Adjuntar archivo o imagen"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '18px', flexShrink: 0, padding: '2px',
                color: uploading ? '#6366f1' : '#475569',
                opacity: uploading ? 0.7 : 1
              }}>
              {uploading ? '⏳' : '📎'}
            </button>

            {/* Input de texto */}
            <input
              style={{
                flex: 1, background: 'transparent', border: 'none',
                color: 'white', fontSize: '13px', outline: 'none'
              }}
              placeholder="Escribe un mensaje..."
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(text)}
            />

            {/* 🎙️ Audio — siempre visible cuando no hay texto */}
            {/* ➤ Enviar — visible cuando hay texto */}
            {text.trim() ? (
              <button
                onClick={() => sendMessage(text)}
                disabled={sending}
                style={{
                  width: '32px', height: '32px', borderRadius: '10px',
                  border: 'none', cursor: 'pointer', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  color: 'white', fontSize: '14px'
                }}>
                ➤
              </button>
            ) : (
              <button
                onClick={startRecording}
                title="Grabar audio"
                style={{
                  width: '32px', height: '32px', borderRadius: '10px',
                  border: 'none', cursor: 'pointer', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(99,102,241,0.15)', color: '#818cf8', fontSize: '16px'
                }}>
                🎙️
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}