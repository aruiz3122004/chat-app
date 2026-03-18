import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { decryptMessage } from '../../lib/crypto'
import MessageList from './MessageList'
import MessageInput from './MessageInput'

interface Message {
  id: string; content: string; sender_id: string
  created_at: string; is_file?: boolean; profiles?: { username: string }
}
interface Props { groupId: string; groupName: string; currentUserId: string }

export default function ChatWindow({ groupId, groupName, currentUserId }: Props) {
  const [messages, setMessages] = useState<Message[]>([])

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
        setMessages(prev => [...prev, msgWithProfile])
        if (newMsg.sender_id !== currentUserId) {
          const text = decryptMessage(newMsg.content)
          toast(`${profile?.username ?? 'Usuario'}: ${text.slice(0, 50)}`, {
            icon: '💬', duration: 4000
          })
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [groupId])

  const fetchMessages = async () => {
    const { data } = await supabase.from('messages')
      .select('*, profiles(username)').eq('group_id', groupId)
      .order('created_at', { ascending: true })
    if (data) setMessages(data)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: '#080b12' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
            style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', fontFamily: 'Syne, sans-serif' }}>
            #
          </div>
          <div>
            <h2 className="text-white text-sm font-semibold" style={{ fontFamily: 'Syne, sans-serif' }}>
              {groupName}
            </h2>
            <p className="text-xs" style={{ color: '#334155' }}>Canal de mensajes</p>
          </div>
        </div>
        <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs"
          style={{ background: 'rgba(34,197,94,0.08)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.15)' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
          AES-256
        </div>
      </div>

      <MessageList messages={messages} currentUserId={currentUserId} />
      <MessageInput groupId={groupId} senderId={currentUserId} />
    </div>
  )
}