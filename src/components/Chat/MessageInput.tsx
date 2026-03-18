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
        await uploadAudio(blob)
        stream.getTracks().forEach(t => t.stop())
      }

      mediaRecorder.start()
      setRecording(true)
      setRecordingTime(0)
      timerRef.current = setInterval(() => {
        setRecordingTime(t => t + 1)
      }, 1000)
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

  const uploadAudio = async (blob: Blob) => {
    setUploading(true)
    const fileName = `audio_${Date.now()}.webm`
    const file = new File([blob], fileName, { type: 'audio/webm' })
    const { data, error } = await supabase.storage
      .from('chat-files').upload(`${groupId}/${fileName}`, file)
    if (!error && data) {
      const { data: urlData } = supabase.storage.from('chat-files').getPublicUrl(data.path)
      await sendMessage(`AUDIO:${fileName}:${urlData.publicUrl}`, true)
    }
    setUploading(false)
  }

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`

  return (
    <div className="px-4 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
        style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${recording ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.07)'}` }}>
        
        <input ref={fileRef} type="file" className="hidden" onChange={handleFile} />
        
        {recording ? (
          <>
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
            <span className="text-red-400 text-sm flex-1">{formatTime(recordingTime)} Grabando...</span>
            <button onClick={stopRecording}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0"
              style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171' }}>
              ■
            </button>
          </>
        ) : (
          <>
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="text-lg transition-all flex-shrink-0"
              style={{ color: uploading ? '#6366f1' : '#334155' }}
              title="Adjuntar archivo">
              {uploading ? '⏳' : '📎'}
            </button>

            <input
              className="flex-1 bg-transparent text-white text-sm outline-none placeholder-gray-600"
              placeholder="Escribe un mensaje..."
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(text)}
            />

            {text.trim() ? (
              <button onClick={() => sendMessage(text)} disabled={sending}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-sm transition-all flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white' }}>
                ➤
              </button>
            ) : (
              <button onClick={startRecording}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-sm transition-all flex-shrink-0"
                style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}
                title="Grabar audio">
                🎙️
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}