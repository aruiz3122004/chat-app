interface Props {
  status: 'sent' | 'delivered' | 'read'
  isOwn: boolean
}

export default function MessageStatus({ status, isOwn }: Props) {
  if (!isOwn) return null

  if (status === 'read') {
    return (
      <span title="Leído" style={{ color: '#60a5fa', fontSize: '11px' }}>
        ✓✓
      </span>
    )
  }
  if (status === 'delivered') {
    return (
      <span title="Entregado" style={{ color: '#94a3b8', fontSize: '11px' }}>
        ✓✓
      </span>
    )
  }
  return (
    <span title="Enviado" style={{ color: '#475569', fontSize: '11px' }}>
      ✓
    </span>
  )
}