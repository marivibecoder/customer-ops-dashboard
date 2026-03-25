'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface TabRefreshButtonProps {
  source: 'periskope' | 'slack' | 'metabase'
  label?: string
}

export function TabRefreshButton({ source, label }: TabRefreshButtonProps) {
  const router = useRouter()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const sourceLabels: Record<string, string> = {
    periskope: 'WhatsApp',
    slack: 'Slack',
    metabase: 'Metabase',
  }

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    setStatus('running')
    setMessage('')

    try {
      await fetch('/api/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger: 'manual', sources: [source] }),
      })
    } catch {
      setStatus('error')
      setMessage('Error de red')
      setIsRefreshing(false)
    }
  }, [source])

  // Poll status while refreshing
  useEffect(() => {
    if (!isRefreshing) return

    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/refresh/status')
        const data = await res.json()

        if (data.status !== 'running') {
          const completed = data.sources_completed || []
          if (completed.includes(source)) {
            setStatus('done')
            setMessage('Actualizado')
          } else if (data.error_message) {
            setStatus('error')
            setMessage('Error')
          } else {
            setStatus('done')
            setMessage('Completado')
          }
          setIsRefreshing(false)
          router.refresh()
          // Force re-fetch by reloading the page data
          window.location.reload()
          clearInterval(interval)
        }
      } catch {
        // Keep polling
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [isRefreshing, source, router])

  // Clear status message after 5 seconds
  useEffect(() => {
    if (status === 'done' || status === 'error') {
      const timeout = setTimeout(() => {
        setStatus('idle')
        setMessage('')
      }, 5000)
      return () => clearTimeout(timeout)
    }
  }, [status])

  return (
    <div className="flex items-center gap-2">
      {message && (
        <span className={`text-xs ${status === 'error' ? 'text-alta' : 'text-muted'}`}>
          {status === 'done' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 mr-1" />}
          {status === 'error' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 mr-1" />}
          {message}
        </span>
      )}
      <button
        onClick={handleRefresh}
        disabled={isRefreshing}
        className={`
          flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
          border transition-all duration-200
          ${isRefreshing
            ? 'border-border text-muted cursor-wait bg-surface2'
            : 'border-border text-foreground hover:bg-surface2 active:scale-95'
          }
        `}
        title={`Actualizar solo ${label || sourceLabels[source]}`}
      >
        {isRefreshing ? (
          <>
            <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Actualizando...
          </>
        ) : (
          <>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {label || sourceLabels[source]}
          </>
        )}
      </button>
    </div>
  )
}
