import { useEffect, useState, useRef } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { decryptMessage } from '../../lib/crypto'
import MessageList from './MessageList'
import MessageInput from './MessageInput'

interface Message {
  id: string
  content: string
  sender_id: string
  created_at: string
  is_file?: boolean
  profiles?: { username: string }
}

interface Props { groupId: string; groupName?: string; currentUserId: string }

export default function ChatWindow({ groupId, groupName, currentUserId }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    fetchMessages()

    const channel = supabase.channel(`messages:${groupId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `group_id=eq.${groupId}`
      }, async payload => {
        const newMsg = payload.new as Message
        const { data: profile } = await supabase
          .from('profiles').select('username').eq('id', newMsg.sender_id).single()
        const msgWithProfile = { ...newMsg, profiles: profile ?? { username: 'Usuario' } }
        setMessages(prev => {
          if (prev.find(m => m.id === msgWithProfile.id)) return prev
          return [...prev, msgWithProfile]
        })
        if (newMsg.sender_id !== currentUserId) {
          const text = decryptMessage(newMsg.content)
          toast(`${profile?.username ?? 'Usuario'}: ${text.slice(0, 50)}`, {
            icon: '💬', duration: 4000
          })
        }
      })
      .subscribe()

    pollRef.current = setInterval(async () => {
      const { data } = await supabase
        .from('messages')
        .select('*, profiles(username)')
        .eq('group_id', groupId)
        .order('created_at', { ascending: true })
      if (data) {
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id))
          const newMsgs = data.filter((m: Message) => !existingIds.has(m.id))
          if (newMsgs.length === 0) return prev
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
  }, [groupId])

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('messages')
      .select('*, profiles(username)')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true })
    if (data) setMessages(data)
  }

  // ✅ Sin header interno — el topbar de Chat.tsx lo maneja
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <MessageList messages={messages} currentUserId={currentUserId} />
      <MessageInput groupId={groupId} senderId={currentUserId} />
    </div>
  )
}