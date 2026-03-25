import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// Warm spectrum — amber through cool teal, intentional not random
const COLORS = [
  '#f0a020', '#e47830', '#d45040', '#c03860',
  '#a02878', '#7828a0', '#4840b8', '#2870c0',
  '#1898c0', '#20b870',
]

const GRID   = { strokeDasharray: '3 3', stroke: '#1e1b12' }
const AXIS   = { tick: { fill: '#50493f', fontSize: 10, fontFamily: "'JetBrains Mono', monospace" } }
const TIP    = {
  contentStyle: {
    background: '#131109',
    border: '1px solid #2c2820',
    borderRadius: 0,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    color: '#ddd8ce',
    padding: '8px 12px',
  },
  labelStyle: { color: '#f0a020', marginBottom: 4 },
  cursor:     { fill: 'rgba(240,160,32,0.05)' },
}

function Section({ num, title, note, children }) {
  return (
    <div className="mb-12">
      <div className="section-head">
        <span className="section-num">{num} /</span>
        <span className="section-title">{title}</span>
      </div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border-hi)', padding: '16px' }}>
        {children}
      </div>
      {note && (
        <p style={{
          marginTop: '10px',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '11px',
          color: 'var(--text-3)',
          lineHeight: 1.75,
        }}>
          {note}
        </p>
      )}
    </div>
  )
}

export default function Insights() {
  const [data,  setData]  = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch(`${API}/insights`)
      .then(r => r.json())
      .then(setData)
      .catch(e => setError(e.message))
  }, [])

  if (error) {
    return <div className="alert-error">&#x2715; {error}</div>
  }

  if (!data) {
    return (
      <div className="flex items-center gap-3 py-20">
        <span
          className="inline-block w-4 h-4 rounded-full animate-spin"
          style={{ border: '2px solid var(--amber)', borderTopColor: 'transparent' }}
        />
        <span className="label" style={{ color: 'var(--text-3)' }}>Loading insights...</span>
      </div>
    )
  }

  const distData = Object.entries(data.class_distribution || {}).map(([name, count]) => ({
    name: name.replace(/_/g, ' '), count,
  }))

  const durData = Object.entries(data.avg_duration_per_class || {}).map(([name, sec]) => ({
    name: name.replace(/_/g, ' '), seconds: sec,
  })).sort((a, b) => b.seconds - a.seconds)

  const mfccData = Object.entries(data.top_mfcc_variance_per_class || {}).map(([name, v]) => ({
    name: name.replace(/_/g, ' '), variance: v,
  })).sort((a, b) => b.variance - a.variance)

  return (
    <div>
      {/* Page header */}
      <div className="mb-8">
        <div className="label mb-1" style={{ color: 'var(--amber)' }}>02 / ANALYTICS</div>
        <h1 className="display" style={{ fontSize: '52px', color: 'var(--text)' }}>Dataset Insights</h1>
      </div>

      <Section
        num="01"
        title="Sample Count per Class"
        note="The dataset is broadly balanced across all 10 urban sound classes, each contributing roughly 700–1000 samples. Drilling and jackhammer tend to have slightly more samples."
      >
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={distData} margin={{ top: 5, right: 16, left: 0, bottom: 60 }}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="name" {...AXIS} angle={-35} textAnchor="end" interval={0} />
            <YAxis {...AXIS} />
            <Tooltip {...TIP} />
            <Bar dataKey="count" radius={0}>
              {distData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Section>

      <Section
        num="02"
        title="Average Audio Duration per Class"
        note="Most classes cluster around 3–4 seconds, consistent with the dataset's 4-second clip maximum. Car horn bursts are typically shorter; ambient sounds like air conditioner run longer."
      >
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={durData} layout="vertical" margin={{ top: 5, right: 16, left: 120, bottom: 5 }}>
            <CartesianGrid {...GRID} />
            <XAxis type="number" {...AXIS} unit="s" />
            <YAxis type="category" dataKey="name" {...AXIS} width={120} />
            <Tooltip {...TIP} formatter={(v) => [`${v.toFixed(2)}s`, 'Avg duration']} />
            <Bar dataKey="seconds" radius={0}>
              {durData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Section>

      <Section
        num="03"
        title="MFCC Feature Variance per Class"
        note="Higher MFCC variance indicates greater timbral complexity. Street music and children playing show the most spectral variation; steady mechanical sounds have lower MFCC variance."
      >
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={mfccData} margin={{ top: 5, right: 16, left: 0, bottom: 60 }}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="name" {...AXIS} angle={-35} textAnchor="end" interval={0} />
            <YAxis {...AXIS} />
            <Tooltip {...TIP} />
            <Bar dataKey="variance" radius={0}>
              {mfccData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Section>
    </div>
  )
}
