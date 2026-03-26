'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

interface RefreshStatus {
  status: 'none' | 'running' | 'success' | 'partial' | 'error'
  trigger?: string
  started_at?: string
  completed_at?: string
  sources_completed?: string[]
  error_message?: string
  duration_ms?: number
}

export function DateRefreshBar() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentDate = searchParams.get('date') || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })

  const [availableDates, setAvailableDates] = useState<Record<string, string[]>>({})
  const [refreshStatus, setRefreshStatus] = useState<RefreshStatus>({ status: 'none' })
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Fetch available dates
  useEffect(() => {
    fetch('/api/dates')
      .then(r => r.json())
      .then(setAvailableDates)
      .catch(() => {})
  }, [isRefreshing])

  // Get unique dates across all sources
  const allDates = [...new Set([
    ...(availableDates.periskope || []),
    ...(availableDates.slack || []),
    ...(availableDates.metabase || []),
  ])].sort().reverse()

  const handleDateChange = (date: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('date', date)
    router.push(`?${params.toString()}`)
  }

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    setRefreshStatus({ status: 'running' })

    try {
      await fetch('/api/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger: 'manual' }),
      })
      // Refresh runs in background — start polling for status
    } catch {
      setRefreshStatus({ status: 'error', error_message: 'Network error' })
      setIsRefreshing(false)
    }
  }, [])

  // Poll for refresh status while refreshing
  useEffect(() => {
    if (!isRefreshing) return

    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/refresh/status')
        const data = await res.json()
        setRefreshStatus(data)

        if (data.status !== 'running') {
          setIsRefreshing(false)
          router.refresh()
          clearInterval(interval)
        }
      } catch {
        // Keep polling
      }
    }, 5000) // Poll every 5 seconds

    return () => clearInterval(interval)
  }, [isRefreshing, router])

  // Fetch last refresh status on mount
  useEffect(() => {
    fetch('/api/refresh/status')
      .then(r => r.json())
      .then((data) => {
        setRefreshStatus(data)
        if (data.status === 'running') {
          setIsRefreshing(true) // Resume polling if a refresh is in progress
        }
      })
      .catch(() => {})
  }, [])

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${Math.round(ms / 1000)}s`
    return `${Math.round(ms / 60000)}min`
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="flex items-center justify-between gap-4 px-6 py-3 bg-white border-b border-[var(--border)]">
      {/* Date selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-[var(--muted)]">Fecha:</label>
        <input
          type="date"
          value={currentDate}
          onChange={(e) => handleDateChange(e.target.value)}
          className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-lg bg-white focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent outline-none"
        />
        {allDates.length > 0 && (
          <select
            value={currentDate}
            onChange={(e) => handleDateChange(e.target.value)}
            className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-lg bg-white focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent outline-none"
          >
            {allDates.map(d => (
              <option key={d} value={d}>
                {new Date(d + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Refresh section */}
      <div className="flex items-center gap-3">
        {/* Status indicator */}
        {refreshStatus.status !== 'none' && !isRefreshing && (
          <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
            {refreshStatus.status === 'success' && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                {refreshStatus.sources_completed?.length || 0}/3 fuentes
                {refreshStatus.duration_ms && ` · ${formatDuration(refreshStatus.duration_ms)}`}
              </span>
            )}
            {refreshStatus.status === 'partial' && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                {refreshStatus.sources_completed?.length || 0}/3 fuentes
              </span>
            )}
            {refreshStatus.status === 'error' && (
              <span className="flex items-center gap-1 text-red-600">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                Error
              </span>
            )}
            {refreshStatus.completed_at && (
              <span>· {formatDate(refreshStatus.completed_at)}</span>
            )}
          </div>
        )}

        {/* Refresh button */}
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className={`
            flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-lg
            transition-all duration-200
            ${isRefreshing
              ? 'bg-[var(--accent)]/10 text-[var(--accent)] cursor-wait'
              : 'bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90 active:scale-95'
            }
          `}
        >
          {isRefreshing ? (
            <>
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Actualizando...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </>
          )}
        </button>
      </div>
    </div>
  )
}
