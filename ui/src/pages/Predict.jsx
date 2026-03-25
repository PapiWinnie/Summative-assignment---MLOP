import { useState, useRef, useCallback } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const CLASS_COLORS = {
  air_conditioner: '#f0a020',
  car_horn:        '#e47830',
  children_playing:'#44c87c',
  dog_bark:        '#e07040',
  drilling:        '#e04848',
  engine_idling:   '#a040b8',
  gun_shot:        '#c02838',
  jackhammer:      '#d83858',
  siren:           '#20b8d0',
  street_music:    '#28c890',
}

function drawWaveform(canvas, audioBuffer) {
  const ctx  = canvas.getContext('2d')
  const data = audioBuffer.getChannelData(0)
  const W    = canvas.width
  const H    = canvas.height
  const step = Math.ceil(data.length / W)
  const amp  = H / 2

  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = '#0c0b09'
  ctx.fillRect(0, 0, W, H)

  // faint grid lines
  ctx.strokeStyle = '#1e1b12'
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let y = 0; y <= H; y += H / 4) {
    ctx.moveTo(0, y); ctx.lineTo(W, y)
  }
  ctx.stroke()

  // waveform
  ctx.strokeStyle = '#f0a020'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  for (let i = 0; i < W; i++) {
    let min = 1, max = -1
    for (let j = 0; j < step; j++) {
      const v = data[i * step + j] || 0
      if (v < min) min = v
      if (v > max) max = v
    }
    ctx.moveTo(i, (1 + min) * amp)
    ctx.lineTo(i, (1 + max) * amp)
  }
  ctx.stroke()
}

export default function Predict() {
  const [file,     setFile]     = useState(null)
  const [result,   setResult]   = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)
  const [dragging, setDragging] = useState(false)
  const canvasRef = useRef(null)
  const inputRef  = useRef(null)

  const handleFile = useCallback(async (f) => {
    if (!f || !f.name.toLowerCase().endsWith('.wav')) {
      setError('Please select a .wav file.')
      return
    }
    setFile(f)
    setResult(null)
    setError(null)

    const arrayBuffer = await f.arrayBuffer()
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    try {
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)
      if (canvasRef.current) drawWaveform(canvasRef.current, audioBuffer)
    } catch { /* non-fatal */ }
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }, [handleFile])

  const handlePredict = async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    setResult(null)

    const form = new FormData()
    form.append('file', file)

    try {
      const res = await fetch(`${API}/predict`, { method: 'POST', body: form })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.detail || `HTTP ${res.status}`)
      }
      setResult(await res.json())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Page header */}
      <div className="mb-8">
        <div className="label mb-1" style={{ color: 'var(--amber)' }}>01 / CLASSIFICATION</div>
        <h1 className="display" style={{ fontSize: '52px', color: 'var(--text)' }}>Audio Prediction</h1>
      </div>

      {/* Drop zone */}
      <div
        className={`drop-zone py-10 text-center ${dragging ? 'is-dragging' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".wav"
          className="hidden"
          onChange={(e) => handleFile(e.target.files[0])}
        />
        <div className="relative z-10">
          {file ? (
            <>
              <div className="label mb-2" style={{ color: 'var(--amber)' }}>FILE LOADED</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', color: 'var(--text)' }}>
                {file.name}
              </div>
            </>
          ) : (
            <>
              <div
                className="display"
                style={{ fontSize: '28px', color: 'var(--text-2)', letterSpacing: '0.05em', marginBottom: '8px' }}
              >
                Drop .wav here
              </div>
              <div className="label">or click to browse</div>
            </>
          )}
        </div>
      </div>

      {/* Waveform */}
      {file && (
        <div className="mt-2 overflow-hidden" style={{ border: '1px solid var(--border-hi)' }}>
          <canvas ref={canvasRef} width={800} height={72} className="w-full block" />
        </div>
      )}

      {/* Analyze */}
      <div className="mt-5">
        <button className="btn btn-primary" onClick={handlePredict} disabled={!file || loading}>
          {loading ? (
            <>
              <span
                className="inline-block w-3 h-3 rounded-full border border-black border-t-transparent animate-spin"
                style={{ borderColor: '#000', borderTopColor: 'transparent' }}
              />
              Analyzing...
            </>
          ) : 'Analyze File'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="alert-error mt-4">&#x2715; {error}</div>
      )}

      {/* Result */}
      {result && (
        <div className="mt-8" style={{ border: '1px solid var(--border-hi)', borderLeft: '3px solid var(--amber)' }}>
          {/* Class name */}
          <div className="px-6 pt-5 pb-4" style={{ borderBottom: '1px solid var(--border-hi)' }}>
            <div className="label mb-3">PREDICTION RESULT</div>
            <div className="display" style={{ fontSize: '60px', color: 'var(--text)', letterSpacing: '0.01em' }}>
              {result.class.replace(/_/g, ' ')}
            </div>
            <div className="flex items-center gap-2 mt-3">
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  background: CLASS_COLORS[result.class] || 'var(--text-3)',
                  display: 'inline-block',
                  flexShrink: 0,
                }}
              />
              <span className="label">CLASS {result.class_id}</span>
            </div>
          </div>

          {/* Confidence bar */}
          <div className="px-6 py-5">
            <div className="flex justify-between items-center mb-2">
              <span className="label">CONFIDENCE</span>
              <span
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: '22px',
                  fontWeight: 700,
                  color: 'var(--amber)',
                }}
              >
                {(result.confidence * 100).toFixed(1)}%
              </span>
            </div>
            <div style={{ height: '3px', background: 'var(--border-hi)' }}>
              <div
                style={{
                  height: '100%',
                  width: `${(result.confidence * 100).toFixed(1)}%`,
                  background: 'var(--amber)',
                  transition: 'width 0.7s cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
