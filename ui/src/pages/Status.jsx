import { useState, useEffect } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function Metric({ label, accent, children }) {
  return (
    <div
      className="p-5"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-hi)',
        borderLeft: accent ? `2px solid ${accent}` : undefined,
      }}
    >
      <div className="label mb-3">{label}</div>
      {children}
    </div>
  )
}

function BigVal({ color, children }) {
  return (
    <div
      className="display"
      style={{ fontSize: '42px', color: color || 'var(--text)', letterSpacing: '0.01em' }}
    >
      {children}
    </div>
  )
}

export default function Status() {
  const [status, setStatus] = useState(null)
  const [error,  setError]  = useState(null)

  const fetchStatus = () => {
    fetch(`${API}/status`)
      .then(r => r.json())
      .then(setStatus)
      .catch(e => setError(e.message))
  }

  useEffect(() => {
    fetchStatus()
    const id = setInterval(fetchStatus, 30000)
    return () => clearInterval(id)
  }, [])

  return (
    <div>
      {/* Page header */}
      <div className="mb-8">
        <div className="label mb-1" style={{ color: 'var(--amber)' }}>04 / MONITORING</div>
        <h1 className="display" style={{ fontSize: '52px', color: 'var(--text)' }}>System Status</h1>
      </div>

      {error && <div className="alert-error mb-4">&#x2715; {error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

        {/* API Health */}
        <Metric
          label="API HEALTH"
          accent={status ? (status.healthy ? 'var(--green)' : 'var(--red)') : 'var(--border-hi)'}
        >
          {status ? (
            <div className="flex items-center gap-3">
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  flexShrink: 0,
                  background: status.healthy ? 'var(--green)' : 'var(--red)',
                  display: 'inline-block',
                }}
              />
              <BigVal color={status.healthy ? 'var(--green)' : 'var(--red)'}>
                {status.healthy ? 'NOMINAL' : 'FAULT'}
              </BigVal>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span
                className="inline-block w-2 h-2 animate-pulse"
                style={{ background: 'var(--text-3)', display: 'inline-block' }}
              />
              <span className="label">Checking...</span>
            </div>
          )}
        </Metric>

        {/* Model Accuracy */}
        <Metric label="MODEL ACCURACY" accent="var(--amber)">
          {status?.model_accuracy != null ? (
            <BigVal color="var(--amber)">
              {(status.model_accuracy * 100).toFixed(1)}%
            </BigVal>
          ) : (
            <BigVal color="var(--text-3)">—</BigVal>
          )}
        </Metric>

        {/* Uptime */}
        <Metric label="UPTIME">
          <BigVal>
            {status ? formatUptime(status.uptime_seconds) : '—'}
          </BigVal>
        </Metric>

        {/* Last Retrained */}
        <Metric label="LAST RETRAINED">
          {status?.last_trained ? (
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '13px',
                color: 'var(--text)',
                lineHeight: 1.6,
              }}
            >
              {new Date(status.last_trained).toLocaleString()}
            </div>
          ) : (
            <BigVal color="var(--text-3)">NEVER</BigVal>
          )}
        </Metric>

      </div>

      <div className="label mt-5">AUTO-REFRESHES EVERY 30 SECONDS</div>
    </div>
  )
}
