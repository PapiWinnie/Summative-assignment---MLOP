import { Routes, Route, NavLink, Navigate } from 'react-router-dom'
import Predict from './pages/Predict'
import Insights from './pages/Insights'
import Retrain from './pages/Retrain'
import Status from './pages/Status'

const NAV = [
  { to: '/predict',  label: 'Predict',  num: '01' },
  { to: '/insights', label: 'Insights', num: '02' },
  { to: '/retrain',  label: 'Retrain',  num: '03' },
  { to: '/status',   label: 'Status',   num: '04' },
]

export default function App() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>

      {/* amber top rule */}
      <div style={{ height: '2px', background: 'var(--amber)' }} />

      <nav
        className="flex items-stretch px-6"
        style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border-hi)' }}
      >
        {/* Logo */}
        <div
          className="flex flex-col justify-center py-3 pr-8 mr-2 flex-shrink-0"
          style={{ borderRight: '1px solid var(--border-hi)' }}
        >
          <div className="display" style={{ fontSize: '21px', color: 'var(--text)', lineHeight: 1 }}>
            URBANSOUND
          </div>
          <div className="label" style={{ color: 'var(--amber)', marginTop: '3px' }}>
            8K · CLASSIFIER
          </div>
        </div>

        {/* Nav links */}
        <div className="flex items-stretch">
          {NAV.map(({ to, label, num }) => (
            <NavLink
              key={to}
              to={to}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0 16px',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '11px',
                fontWeight: isActive ? 600 : 400,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                textDecoration: 'none',
                color: isActive ? 'var(--amber)' : 'var(--text-2)',
                borderBottom: isActive ? '2px solid var(--amber)' : '2px solid transparent',
                transition: 'color 0.12s, border-color 0.12s',
              })}
            >
              <span style={{ fontSize: '9px', opacity: 0.6 }}>{num}</span>
              {label}
            </NavLink>
          ))}
        </div>

        {/* Online indicator */}
        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
          <span style={{ width: '6px', height: '6px', background: 'var(--green)', display: 'inline-block', flexShrink: 0 }} />
          <span className="label">ONLINE</span>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <Routes>
          <Route path="/"         element={<Navigate to="/predict" replace />} />
          <Route path="/predict"  element={<Predict />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/retrain"  element={<Retrain />} />
          <Route path="/status"   element={<Status />} />
        </Routes>
      </main>
    </div>
  )
}
