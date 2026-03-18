import { useEffect, useRef } from 'react'
import { decryptMessage } from '../../lib/crypto'

interface Message {
  id: string
  content: string
  sender_id: string
  created_at: string
  is_file?: boolean
  profiles?: { username: string }
}

interface Props {
  messages: Message[]
  currentUserId: string
}

export default function MessageList({ messages, currentUserId }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const renderContent = (msg: Message) => {
  const text = decryptMessage(msg.content)

  if (text.startsWith('AUDIO:')) {
    const parts = text.split(':')
    const fileUrl = parts.slice(2).join(':')
    return (
      <div className="flex items-center gap-3 min-w-48">
        <span className="text-lg">🎙️</span>
        <audio controls className="h-8 flex-1" style={{ maxWidth: '200px' }}>
          <source src={fileUrl} type="audio/webm" />
        </audio>
      </div>
    )
  }

  if (text.startsWith('FILE:')) {
    const parts = text.split(':')
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

  return <p>{text}</p>
}

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {messages.map(msg => {
        const isOwn = msg.sender_id === currentUserId
        return (
          <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-xs lg:max-w-md flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
              {!isOwn && (
                <span className="text-gray-400 text-xs mb-1">
                  {msg.profiles?.username ?? 'Usuario'}
                </span>
              )}
              <div className={`p-3 rounded-2xl text-sm ${
                isOwn
                  ? 'bg-blue-600 text-white rounded-br-none'
                  : 'bg-gray-700 text-gray-100 rounded-bl-none'
              }`}>
                {renderContent(msg)}
              </div>
              <span className="text-gray-500 text-xs mt-1">
                {new Date(msg.created_at).toLocaleTimeString([], {
                  hour: '2-digit', minute: '2-digit'
                })}
              </span>
            </div>
          </div>
        )
      })}
      <div ref={bottomRef} />
    </div>
  )
}