import { useState, useRef, useEffect } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const CLASS_OPTIONS = [
  'air_conditioner', 'car_horn', 'children_playing', 'dog_bark', 'drilling',
  'engine_idling', 'gun_shot', 'jackhammer', 'siren', 'street_music',
]

function StepPanel({ num, title, children }) {
  return (
    <div className="mb-4" style={{ background: 'var(--surface)', border: '1px solid var(--border-hi)' }}>
      <div
        className="flex items-center gap-4 px-6 py-4"
        style={{ borderBottom: '1px solid var(--border-hi)' }}
      >
        <div className="display" style={{ fontSize: '36px', color: 'var(--amber)', lineHeight: 1 }}>{num}</div>
        <div className="section-title">{title}</div>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  )
}

export default function Retrain() {
  const [files,        setFiles]        = useState([])
  const [label,        setLabel]        = useState('')
  const [uploadResult, setUploadResult] = useState(null)
  const [uploadError,  setUploadError]  = useState(null)
  const [uploading,    setUploading]    = useState(false)
  const [retrainStatus,setRetrainStatus]= useState(null)
  const [retrainError, setRetrainError] = useState(null)
  const [accuracyBefore,setAccuracyBefore]=useState(null)
  const pollerRef = useRef(null)
  const inputRef  = useRef(null)

  useEffect(() => {
    fetch(`${API}/status`)
      .then(r => r.json())
      .then(d => setAccuracyBefore(d.model_accuracy))
      .catch(() => {})
  }, [])

  useEffect(() => () => clearInterval(pollerRef.current), [])

  const startPolling = () => {
    clearInterval(pollerRef.current)
    pollerRef.current = setInterval(async () => {
      try {
        const res  = await fetch(`${API}/retrain/status`)
        const data = await res.json()
        setRetrainStatus(data)
        if (!data.running) clearInterval(pollerRef.current)
      } catch {
        clearInterval(pollerRef.current)
      }
    }, 3000)
  }

  const handleUpload = async () => {
    if (!files.length) return
    setUploading(true)
    setUploadError(null)
    setUploadResult(null)

    const form = new FormData()
    files.forEach(f => form.append('files', f))
    if (label) form.append('label', label)

    try {
      const res = await fetch(`${API}/upload-training-data`, { method: 'POST', body: form })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.detail || `HTTP ${res.status}`)
      }
      setUploadResult(await res.json())
      setFiles([])
    } catch (e) {
      setUploadError(e.message)
    } finally {
      setUploading(false)
    }
  }

  const handleRetrain = async () => {
    setRetrainError(null)
    setRetrainStatus(null)

    try {
      const res = await fetch(`${API}/retrain`, { method: 'POST' })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.detail || `HTTP ${res.status}`)
      }
      const data = await res.json()
      setRetrainStatus({ running: true, status: data.status, files_queued: data.files_queued })
      startPolling()
    } catch (e) {
      setRetrainError(e.message)
    }
  }

  const isRunning = retrainStatus?.running === true
  const isDone    = retrainStatus && !retrainStatus.running && retrainStatus.last_completed

  return (
    <div>
      {/* Page header */}
      <div className="mb-8">
        <div className="label mb-1" style={{ color: 'var(--amber)' }}>03 / TRAINING</div>
        <h1 className="display" style={{ fontSize: '52px', color: 'var(--text)' }}>Retrain Model</h1>
      </div>

      {/* Step 01 — Upload */}
      <StepPanel num="01" title="Upload Training Files">
        {/* Drop zone */}
        <div
          className="drop-zone py-8 text-center mb-4"
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".wav"
            multiple
            className="hidden"
            onChange={e => setFiles(Array.from(e.target.files))}
          />
          <div className="relative z-10">
            {files.length > 0 ? (
              <>
                <div className="label mb-2" style={{ color: 'var(--amber)' }}>
                  {files.length} FILE{files.length > 1 ? 'S' : ''} SELECTED
                </div>
                <div className="space-y-1 mt-2">
                  {files.slice(0, 4).map((f, i) => (
                    <div key={i} className="label" style={{ color: 'var(--text-2)' }}>{f.name}</div>
                  ))}
                  {files.length > 4 && (
                    <div className="label">+{files.length - 4} more</div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div
                  className="display"
                  style={{ fontSize: '24px', color: 'var(--text-2)', letterSpacing: '0.05em', marginBottom: '6px' }}
                >
                  Select .wav files
                </div>
                <div className="label">click to browse</div>
              </>
            )}
          </div>
        </div>

        {/* Class label */}
        <div className="mb-4">
          <div className="label mb-2">SOUND CLASS LABEL</div>
          <select
            value={label}
            onChange={e => setLabel(e.target.value)}
            className="w-full px-3 py-2"
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border-hi)',
              color: label ? 'var(--text)' : 'var(--text-3)',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '12px',
              letterSpacing: '0.04em',
            }}
          >
            <option value="">-- select class --</option>
            {CLASS_OPTIONS.map(c => (
              <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>

        <button
          className="btn btn-primary"
          onClick={handleUpload}
          disabled={!files.length || uploading}
        >
          {uploading ? 'Uploading...' : 'Upload Files'}
        </button>

        {uploadError  && <div className="alert-error mt-3">&#x2715; {uploadError}</div>}
        {uploadResult && (
          <div className="alert-success mt-3">
            &#x2713; {uploadResult.count} file{uploadResult.count > 1 ? 's' : ''} saved and recorded in database.
          </div>
        )}
      </StepPanel>

      {/* Step 02 — Retrain */}
      <StepPanel num="02" title="Trigger Retraining">
        {accuracyBefore !== null && (
          <div className="flex items-center gap-4 mb-5">
            <div className="label">CURRENT ACCURACY</div>
            <div
              className="display"
              style={{ fontSize: '32px', color: 'var(--amber)' }}
            >
              {(accuracyBefore * 100).toFixed(1)}%
            </div>
          </div>
        )}

        <button
          className="btn btn-outline"
          onClick={handleRetrain}
          disabled={isRunning}
        >
          {isRunning ? (
            <>
              <span
                className="inline-block w-3 h-3 rounded-full animate-spin"
                style={{ border: '2px solid var(--amber)', borderTopColor: 'transparent' }}
              />
              Retraining...
            </>
          ) : 'Trigger Retraining'}
        </button>

        {retrainError && <div className="alert-error mt-3">&#x2715; {retrainError}</div>}

        {retrainStatus && (
          <div
            className="mt-4 px-5 py-4"
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border-hi)',
              borderLeft: `2px solid ${isRunning ? 'var(--amber)' : 'var(--green)'}`,
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  background: isRunning ? 'var(--amber)' : 'var(--green)',
                  display: 'inline-block',
                  flexShrink: 0,
                }}
              />
              <span className="label" style={{ color: isRunning ? 'var(--amber)' : 'var(--green)' }}>
                {isRunning ? 'RETRAINING IN PROGRESS' : 'RETRAINING COMPLETE'}
              </span>
            </div>

            {retrainStatus.files_queued > 0 && (
              <div className="label mt-1">FILES QUEUED: {retrainStatus.files_queued}</div>
            )}

            {isDone && retrainStatus.accuracy_after !== null && (
              <div className="flex gap-10 mt-4">
                {accuracyBefore !== null && (
                  <div>
                    <div className="label mb-1">BEFORE</div>
                    <div className="display" style={{ fontSize: '28px', color: 'var(--text-2)' }}>
                      {(accuracyBefore * 100).toFixed(1)}%
                    </div>
                  </div>
                )}
                <div>
                  <div className="label mb-1">AFTER</div>
                  <div className="display" style={{ fontSize: '28px', color: 'var(--green)' }}>
                    {(retrainStatus.accuracy_after * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            )}

            {isDone && (
              <div className="label mt-3">
                COMPLETED: {new Date(retrainStatus.last_completed).toLocaleString()}
              </div>
            )}
          </div>
        )}
      </StepPanel>
    </div>
  )
}
