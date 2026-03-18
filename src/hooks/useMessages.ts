import { useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

interface UseMessagesOptions {
  table: 'messages' | 'direct_messages'
  filter: Record<string, string>
  onNewMessage: (msg: any) => void
}

export function useMessages({ table, filter, onNewMessage }: UseMessagesOptions) {
  const lastMessageTime = useRef<string>(new Date().toISOString())
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const channelRef = useRef<any>(null)

  const fetchNewMessages = useCallback(async () => {
    let query = supabase
      .from(table)
      .select('*, profiles(username, avatar_url)')
      .gt('created_at', lastMessageTime.current)
      .order('created_at', { ascending: true })

    Object.entries(filter).forEach(([key, value]) => {
      query = query.eq(key, value)
    })

    const { data } = await query
    if (data && data.length > 0) {
      data.forEach(msg => onNewMessage(msg))
      lastMessageTime.current = data[data.length - 1].created_at
    }
  }, [table, filter, onNewMessage])

  useEffect(() => {
    // Polling cada 3 segundos como respaldo
    pollingRef.current = setInterval(fetchNewMessages, 3000)

    // Reconectar cuando la página vuelve a estar visible
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchNewMessages()
        supabase.realtime.connect()
      }
    }

    const handleOnline = () => {
      fetchNewMessages()
      supabase.realtime.connect()
    }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('online', handleOnline)

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('online', handleOnline)
    }
  }, [fetchNewMessages])

  return { channelRef }
}