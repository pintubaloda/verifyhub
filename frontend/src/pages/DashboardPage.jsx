import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { apiFetch, apiUrl } from '../utils/api'

const API = (path, opts = {}) => {
  const token = localStorage.getItem('vh_access')
  return apiFetch(path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...opts.headers },
  })
}

const isAdminRole = (role) => role === 1 || role === 'Admin'
const USD_TO_INR = 83
const inr = (usd) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format((Number(usd) || 0) * USD_TO_INR)

function Sidebar({ active, setActive, user, onLogout }) {
  const customerItems = [
    { id:'overview',  icon:'⬛', label:'Overview' },
    { id:'verify-user', icon:'🧩', label:'Verify User' },
    { id:'licenses',  icon:'🔑', label:'My Licenses' },
    { id:'telemetry', icon:'📡', label:'Telemetry' },
    { id:'orders',    icon:'🛒', label:'Orders' },
    { id:'billing',   icon:'💳', label:'Billing' },
  ]
  const adminItems = [
    { id:'admin-overview',  icon:'🛡️', label:'Admin Overview' },
    { id:'admin-users',     icon:'👥', label:'Users' },
    { id:'admin-licenses',  icon:'🔑', label:'Licenses' },
    { id:'admin-telemetry', icon:'📡', label:'Telemetry' },
    { id:'admin-plugin-settings', icon:'⚙️', label:'Plugin Settings' },
  ]
  const items = isAdminRole(user?.role) ? adminItems : customerItems
  return (
    <aside style={{
      width:240, background:'#0a0f1e', borderRight:'1px solid #162040',
      display:'flex', flexDirection:'column', position:'fixed', top:0, left:0, bottom:0,
    }}>
      <div style={{ padding:'24px 20px 20px', borderBottom:'1px solid #162040' }}>
        <Link to="/" style={{ display:'flex', alignItems:'center', gap:10, textDecoration:'none' }}>
          <div style={{ width:32, height:32, borderRadius:8,
            background:'linear-gradient(135deg,#4F8FFF,#B06AFF)',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>🔐</div>
          <span style={{ fontFamily:'Syne,sans-serif', fontSize:17, fontWeight:800, color:'#F0F4FF' }}>
            Verify<span style={{ color:'#4F8FFF' }}>Hub</span>
          </span>
        </Link>
      </div>

      <nav style={{ flex:1, padding:'16px 12px' }}>
        {items.map(i => (
          <button key={i.id} onClick={() => setActive(i.id)} style={{
            display:'flex', alignItems:'center', gap:10, width:'100%',
            padding:'10px 12px', borderRadius:10, border:'none', cursor:'pointer',
            background: active === i.id ? 'rgba(79,143,255,.1)' : 'transparent',
            color: active === i.id ? '#4F8FFF' : '#5A6A8A',
            fontSize:14, fontWeight: active === i.id ? 600 : 400,
            textAlign:'left', transition:'all .15s', fontFamily:'DM Sans,sans-serif',
            borderLeft: active === i.id ? '2px solid #4F8FFF' : '2px solid transparent',
          }}>
            <span style={{ fontSize:16 }}>{i.icon}</span>
            {i.label}
          </button>
        ))}
      </nav>

      <div style={{ padding:'16px 12px', borderTop:'1px solid #162040' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', marginBottom:8 }}>
          <div style={{ width:32, height:32, borderRadius:8,
            background:'linear-gradient(135deg,#4F8FFF,#B06AFF)',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:14, fontWeight:800, fontFamily:'Syne,sans-serif' }}>
            {user?.name?.[0] ?? '?'}
          </div>
          <div>
            <div style={{ fontSize:13, fontWeight:600, color:'#F0F4FF' }}>{user?.name ?? 'User'}</div>
            <div style={{ fontSize:11, color:'#5A6A8A' }}>
              {user?.email} {isAdminRole(user?.role) ? '· Admin' : '· Customer'}
            </div>
          </div>
        </div>
        <button onClick={onLogout} style={{
          width:'100%', padding:'9px 12px', borderRadius:10, border:'1px solid #162040',
          background:'transparent', color:'#5A6A8A', fontSize:13, cursor:'pointer',
          fontFamily:'DM Sans,sans-serif', transition:'all .2s',
        }}
        onMouseEnter={e=>{e.target.style.borderColor='#FF4D6A';e.target.style.color='#FF4D6A'}}
        onMouseLeave={e=>{e.target.style.borderColor='#162040';e.target.style.color='#5A6A8A'}}
        >Sign Out</button>
      </div>
    </aside>
  )
}

function StatCard({ icon, label, value, color = '#4F8FFF' }) {
  return (
    <div style={{ background:'#0a0f1e', border:'1px solid #162040', borderRadius:16, padding:'22px 24px' }}>
      <div style={{ fontSize:26, marginBottom:12 }}>{icon}</div>
      <div style={{ fontFamily:'Syne,sans-serif', fontSize:32, fontWeight:800,
        background:`linear-gradient(135deg,${color},#B06AFF)`,
        WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text',
        marginBottom:4 }}>{value}</div>
      <div style={{ fontSize:13, color:'#5A6A8A', fontWeight:500 }}>{label}</div>
    </div>
  )
}

function LicenseBadge({ status, daysLeft }) {
  const configs = {
    Active:    { bg:'rgba(0,200,150,.08)', border:'rgba(0,200,150,.2)', color:'#00C896', text:'Active' },
    Expired:   { bg:'rgba(255,77,106,.08)', border:'rgba(255,77,106,.2)', color:'#FF4D6A', text:'Expired' },
    Suspended: { bg:'rgba(255,179,0,.08)', border:'rgba(255,179,0,.2)', color:'#FFB300', text:'Suspended' },
    Revoked:   { bg:'rgba(90,106,138,.08)', border:'rgba(90,106,138,.2)', color:'#5A6A8A', text:'Revoked' },
  }
  const c = configs[status] || configs.Suspended
  return (
    <span style={{
      display:'inline-block', padding:'3px 10px', borderRadius:12, fontSize:11, fontWeight:700,
      background:c.bg, border:`1px solid ${c.border}`, color:c.color,
    }}>
      {c.text}{status === 'Active' && daysLeft <= 30 ? ` · ${daysLeft}d left` : ''}
    </span>
  )
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }
  return (
    <button onClick={copy} style={{
      background: copied ? 'rgba(0,229,200,.1)' : '#162040',
      border: `1px solid ${copied ? '#00E5C8' : '#2a3f5e'}`,
      color: copied ? '#00E5C8' : '#5A6A8A',
      padding:'4px 12px', borderRadius:8, fontSize:12, cursor:'pointer',
      fontFamily:'DM Sans,sans-serif', transition:'all .2s',
    }}>{copied ? '✓ Copied' : 'Copy'}</button>
  )
}

// ── Tab views ─────────────────────────────────────────────────────────────
function OverviewTab({ stats }) {
  return (
    <div>
      <h2 style={{ fontFamily:'Syne,sans-serif', fontSize:24, fontWeight:800, marginBottom:24 }}>Dashboard Overview</h2>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:16, marginBottom:32 }}>
        <StatCard icon="🔑" label="Total Licenses" value={stats?.totalLicenses ?? '—'} color="#4F8FFF" />
        <StatCard icon="✅" label="Active Licenses" value={stats?.activeLicenses ?? '—'} color="#00C896" />
        <StatCard icon="📡" label="Total Verifications" value={stats?.totalVerifications ?? '—'} color="#B06AFF" />
        <StatCard icon="📊" label="This Month" value={stats?.verificationsThisMonth ?? '—'} color="#FFB300" />
      </div>
      <div style={{
        background:'#0a0f1e', border:'1px solid #162040', borderRadius:16, padding:28,
      }}>
        <h3 style={{ fontFamily:'Syne,sans-serif', fontSize:18, fontWeight:700, marginBottom:16 }}>🚀 Quick Start</h3>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          {[
            { icon:'✉', title:'Email Verify Plugin', desc:'Magic link + 6-digit code flow with device fingerprinting.', href:'/dashboard', action:'Buy EML License', color:'#4F8FFF' },
            { icon:'📱', title:'Mobile QR Plugin', desc:'QR-scan mobile verification with real-time GPS telemetry.', href:'/dashboard', action:'Buy MOB License', color:'#B06AFF' },
          ].map(c => (
            <div key={c.title} style={{
              background:'#050810', border:'1px solid #162040', borderRadius:12, padding:20,
            }}>
              <div style={{ fontSize:32, marginBottom:10 }}>{c.icon}</div>
              <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:16, marginBottom:6 }}>{c.title}</div>
              <p style={{ fontSize:13, color:'#5A6A8A', lineHeight:1.6, marginBottom:16 }}>{c.desc}</p>
              <button style={{
                padding:'9px 18px', borderRadius:10, border:'none',
                background:`linear-gradient(135deg,${c.color},#B06AFF)`,
                color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'Syne,sans-serif',
              }}>{c.action}</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function LicensesTab({ licenses, onRefresh }) {
  const [buying, setBuying] = useState(null)
  const buyPlan = async (planId) => {
    setBuying(planId)
    try {
      const r = await API('/api/portal/orders', { method:'POST', body:JSON.stringify({ planId }) })
      const d = await r.json()
      if (r.ok) { toast.success(`License issued: ${d.licenseKey}`); onRefresh() }
      else toast.error(d.error || 'Purchase failed.')
    } catch { toast.error('Network error.') }
    finally { setBuying(null) }
  }

  const PLANS = {
    email: [
      { id:'22222222-0000-0000-0000-000000000001', name:'Starter', price:29, color:'#4F8FFF' },
      { id:'22222222-0000-0000-0000-000000000002', name:'Pro', price:79, color:'#4F8FFF' },
      { id:'22222222-0000-0000-0000-000000000003', name:'Business', price:199, color:'#4F8FFF' },
    ],
    mobile: [
      { id:'22222222-0000-0000-0000-000000000004', name:'Starter', price:39, color:'#B06AFF' },
      { id:'22222222-0000-0000-0000-000000000005', name:'Pro', price:99, color:'#B06AFF' },
      { id:'22222222-0000-0000-0000-000000000006', name:'Business', price:249, color:'#B06AFF' },
    ],
  }

  return (
    <div>
      <h2 style={{ fontFamily:'Syne,sans-serif', fontSize:24, fontWeight:800, marginBottom:24 }}>My Licenses</h2>

      {/* Active licenses */}
      {licenses.length > 0 ? (
        <div style={{ marginBottom:32 }}>
          {licenses.map(l => (
            <div key={l.id} style={{
              background:'#0a0f1e', border:'1px solid #162040', borderRadius:16,
              padding:24, marginBottom:16, display:'grid',
              gridTemplateColumns:'auto 1fr auto', gap:20, alignItems:'center',
            }}>
              <div style={{ fontSize:32 }}>{l.keyPrefix === 'EML' ? '✉' : '📱'}</div>
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                  <span style={{ fontFamily:'Syne,sans-serif', fontSize:17, fontWeight:700 }}>{l.productName}</span>
                  <span style={{ background:'#162040', padding:'2px 10px', borderRadius:8, fontSize:12, color:'#5A6A8A' }}>{l.planName}</span>
                  <LicenseBadge status={l.status} daysLeft={l.daysLeft} />
                </div>
                <div style={{
                  fontFamily:'JetBrains Mono,monospace', fontSize:14, color:'#4F8FFF',
                  background:'#050810', border:'1px solid #162040', borderRadius:8,
                  padding:'7px 12px', display:'inline-block', letterSpacing:'1px', marginBottom:8,
                }}>{l.key}</div>
                <div style={{ fontSize:12, color:'#5A6A8A', display:'flex', gap:20 }}>
                  <span>Expires: <strong style={{ color:'#F0F4FF' }}>{new Date(l.expiresAt).toLocaleDateString()}</strong></span>
                  {l.installedDomain && <span>Domain: <strong style={{ color:'#F0F4FF' }}>{l.installedDomain}</strong></span>}
                  <span>Verifications: <strong style={{ color:'#F0F4FF' }}>{l.verificationsThisMonth}</strong>/mo</span>
                </div>
              </div>
              <CopyButton text={l.key} />
            </div>
          ))}
        </div>
      ) : (
        <div style={{
          background:'#0a0f1e', border:'1px dashed #162040', borderRadius:16,
          padding:40, textAlign:'center', marginBottom:32, color:'#5A6A8A',
        }}>
          <div style={{ fontSize:40, marginBottom:14 }}>🔑</div>
          <div style={{ fontSize:16, marginBottom:8, color:'#F0F4FF' }}>No licenses yet</div>
          <div style={{ fontSize:14 }}>Purchase a plan below to get your license key</div>
        </div>
      )}

      {/* Purchase section */}
      <h3 style={{ fontFamily:'Syne,sans-serif', fontSize:18, fontWeight:700, marginBottom:20 }}>Purchase a License</h3>
      {['email', 'mobile'].map(type => (
        <div key={type} style={{ marginBottom:24 }}>
          <div style={{ fontSize:14, fontWeight:600, color:'#5A6A8A', marginBottom:12, display:'flex', alignItems:'center', gap:8 }}>
            {type === 'email' ? '✉' : '📱'}
            {type === 'email' ? 'Email Verify Plugin' : 'Mobile QR Plugin'}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
            {PLANS[type].map(p => (
              <div key={p.id} style={{
                background:'#050810', border:'1px solid #162040', borderRadius:14, padding:20,
                transition:'border-color .2s',
              }}
              onMouseEnter={e=>e.currentTarget.style.borderColor=p.color+'60'}
              onMouseLeave={e=>e.currentTarget.style.borderColor='#162040'}
              >
                <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:17, marginBottom:4 }}>{p.name}</div>
                <div style={{
                  fontFamily:'Syne,sans-serif', fontSize:30, fontWeight:800, marginBottom:14,
                  background:`linear-gradient(135deg,${p.color},#B06AFF)`,
                  WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text',
                }}>{inr(p.price)}/yr</div>
                <button onClick={() => buyPlan(p.id)} disabled={buying === p.id} style={{
                  width:'100%', padding:'10px', borderRadius:10, border:'none', cursor:buying===p.id?'not-allowed':'pointer',
                  background:buying===p.id?'#162040':`linear-gradient(135deg,${p.color},#B06AFF)`,
                  color:'#fff', fontSize:13, fontWeight:700, fontFamily:'Syne,sans-serif',
                }}>{buying === p.id ? '...' : 'Buy Now'}</button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function TelemetryTab() {
  const [data, setData] = useState(null)
  const [channel, setChannel] = useState('')
  const [query, setQuery] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [expanded, setExpanded] = useState({})
  const [loading, setLoading] = useState(false)
  const parseAll = (raw) => {
    try {
      const obj = JSON.parse(raw || '{}')
      return Object.entries(obj || {})
    } catch {
      return []
    }
  }
  const getFromRaw = (raw, key) => {
    try {
      const obj = JSON.parse(raw || '{}')
      return obj?.[key]
    } catch {
      return null
    }
  }
  const getFromRaw = (raw, key) => {
    try {
      const obj = JSON.parse(raw || '{}')
      return obj?.[key]
    } catch {
      return null
    }
  }

  const load = async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      if (channel) qs.set('channel', channel)
      if (query.trim()) qs.set('q', query.trim())
      if (fromDate) qs.set('from', `${fromDate}T00:00:00Z`)
      if (toDate) qs.set('to', `${toDate}T23:59:59Z`)
      const r = await API(`/api/telemetry/mine?${qs.toString()}`)
      const d = await r.json()
      setData(d)
    } catch {}
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [channel, fromDate, toDate])

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <h2 style={{ fontFamily:'Syne,sans-serif', fontSize:24, fontWeight:800 }}>Device Telemetry</h2>
        <div style={{ display:'flex', gap:8 }}>
          {['','email','mobile'].map(c => (
            <button key={c} onClick={() => setChannel(c)} style={{
              padding:'8px 16px', borderRadius:10, border:'none', cursor:'pointer',
              background: channel === c ? 'rgba(79,143,255,.15)' : '#0a0f1e',
              color: channel === c ? '#4F8FFF' : '#5A6A8A',
              border: `1px solid ${channel === c ? 'rgba(79,143,255,.4)' : '#162040'}`,
              fontSize:13, fontWeight:600, fontFamily:'DM Sans,sans-serif',
            }}>{c || 'All'}</button>
          ))}
        </div>
      </div>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by email, phone, IP, session" style={{ minWidth:280, background:'#0a0f1e', border:'1px solid #162040', color:'#F0F4FF', padding:'8px 10px', borderRadius:10, fontSize:12 }} />
        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ background:'#0a0f1e', border:'1px solid #162040', color:'#F0F4FF', padding:'8px 10px', borderRadius:10, fontSize:12 }} />
        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={{ background:'#0a0f1e', border:'1px solid #162040', color:'#F0F4FF', padding:'8px 10px', borderRadius:10, fontSize:12 }} />
        <button onClick={load} style={{ padding:'8px 12px', borderRadius:10, border:'1px solid #162040', background:'#0a0f1e', color:'#F0F4FF', fontSize:12, cursor:'pointer' }}>Apply</button>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:'#5A6A8A' }}>Loading telemetry…</div>
      ) : !data?.items?.length ? (
        <div style={{
          background:'#0a0f1e', border:'1px dashed #162040', borderRadius:16,
          padding:60, textAlign:'center', color:'#5A6A8A',
        }}>
          <div style={{ fontSize:48, marginBottom:16 }}>📡</div>
          <div style={{ fontSize:16, color:'#F0F4FF', marginBottom:8 }}>No telemetry records yet</div>
          <div style={{ fontSize:14 }}>Records appear here as users verify through your plugin</div>
        </div>
      ) : (
        <div>
          <div style={{ color:'#5A6A8A', fontSize:13, marginBottom:16 }}>
            Showing {data.items.length} of {data.total} records
          </div>
          {data.items.map(t => (
            <div key={t.id} style={{
              background:'#0a0f1e', border:'1px solid #162040', borderRadius:14, padding:20, marginBottom:12,
            }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12, flexWrap:'wrap', gap:8 }}>
                <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                  <span style={{ fontSize:18 }}>{t.channel === 'email' ? '✉' : '📱'}</span>
                  <span style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:15 }}>
                    {getFromRaw(t.rawJson, 'userName') || t.userEmail || t.userPhone || 'Anonymous'}
                  </span>
                  <span style={{ background:'#162040', padding:'2px 10px', borderRadius:8, fontSize:11, color:'#5A6A8A' }}>
                    {t.channel}
                  </span>
                </div>
                <div style={{ fontSize:12, color:'#5A6A8A', fontFamily:'JetBrains Mono,monospace' }}>
                  {new Date(t.receivedAt).toLocaleString()}
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:8 }}>
                {[
                  ['IP', t.ipAddress], ['Country', t.countryCode], ['City', t.city], ['ISP', t.isp],
                  ['Device ID', getFromRaw(t.rawJson, 'deviceId') || '—'],
                  ['Email', t.userEmail || getFromRaw(t.rawJson, 'contactEmail') || '—'],
                  ['Mobile', t.userPhone || getFromRaw(t.rawJson, 'phoneNumber') || '—'],
                  ['Browser', t.browserName], ['OS', t.osName],
                  ['Device', t.isMobile?'📱 Mobile':'🖥 Desktop'],
                  ['GPS', t.gpsLatitude ? `${t.gpsLatitude?.toFixed(4)}, ${t.gpsLongitude?.toFixed(4)}` : '—'],
                  ['Battery', t.batteryLevel != null ? `${(t.batteryLevel*100).toFixed(0)}%` : '—'],
                  ['Risk', `${t.riskScore}/100`],
                  ['Proxy', t.isProxy ? '⚠ Yes' : 'No'], ['VPN', t.isVpn ? '⚠ Yes' : 'No'],
                ].map(([k,v]) => (
                  <div key={k} style={{ background:'#050810', borderRadius:8, padding:'8px 10px' }}>
                    <div style={{ fontSize:10, color:'#5A6A8A', fontWeight:600, textTransform:'uppercase', marginBottom:3 }}>{k}</div>
                    <div style={{ fontSize:12, fontFamily:'JetBrains Mono,monospace', color: (k==='Proxy'||k==='VPN')&&v!=='No' ? '#FF4D6A' : '#4F8FFF', fontWeight:600 }}>{v||'—'}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop:10 }}>
                <button onClick={() => setExpanded(prev => ({ ...prev, [t.id]: !prev[t.id] }))} style={{ padding:'6px 10px', borderRadius:8, border:'1px solid #162040', background:'#050810', color:'#5A6A8A', fontSize:12, cursor:'pointer' }}>
                  {expanded[t.id] ? 'Hide Full Telemetry' : 'Show Full Telemetry'}
                </button>
                {expanded[t.id] && (
                  <div style={{ marginTop:8, background:'#050810', border:'1px solid #162040', borderRadius:8, padding:10 }}>
                    <div style={{ fontSize:11, color:'#5A6A8A', marginBottom:8 }}>All fields received from verification payload</div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:8 }}>
                      {parseAll(t.rawJson).map(([k, v]) => (
                        <div key={`${t.id}-${k}`} style={{ background:'#0a0f1e', border:'1px solid #162040', borderRadius:8, padding:'8px 10px' }}>
                          <div style={{ fontSize:10, color:'#5A6A8A', textTransform:'uppercase', marginBottom:4 }}>{k}</div>
                          <div style={{ fontSize:12, color:'#F0F4FF', fontFamily:'JetBrains Mono,monospace', wordBreak:'break-word' }}>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</div>
                        </div>
                      ))}
                    </div>
                    <pre style={{ marginTop:10, whiteSpace:'pre-wrap', wordBreak:'break-word', fontSize:10, color:'#5A6A8A' }}>{t.rawJson || '{}'}</pre>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function OrdersTab() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const r = await API('/api/portal/orders')
        if (r.ok) setOrders(await r.json())
      } catch {}
      finally { setLoading(false) }
    }
    load()
  }, [])

  return (
    <div>
      <h2 style={{ fontFamily:'Syne,sans-serif', fontSize:24, fontWeight:800, marginBottom:24 }}>Purchase Management</h2>
      {loading ? (
        <div style={{ color:'#5A6A8A', padding:40, textAlign:'center' }}>Loading orders…</div>
      ) : !orders.length ? (
        <div style={{ color:'#5A6A8A', padding:40, textAlign:'center', border:'1px dashed #162040', borderRadius:12 }}>No orders yet.</div>
      ) : (
        orders.map(o => (
          <div key={o.id} style={{ background:'#0a0f1e', border:'1px solid #162040', borderRadius:14, padding:18, marginBottom:10 }}>
            <div style={{ display:'flex', justifyContent:'space-between', gap:10, flexWrap:'wrap' }}>
              <div style={{ fontFamily:'JetBrains Mono,monospace', color:'#4F8FFF', fontSize:13 }}>{o.id}</div>
              <div style={{ fontSize:12, color:'#5A6A8A' }}>{new Date(o.createdAt).toLocaleString()}</div>
            </div>
            <div style={{ fontSize:13, color:'#5A6A8A', marginTop:6 }}>
              {(o.product || '-')} · {(o.plan || '-')} · {(o.status || '-')}
            </div>
            <div style={{ marginTop:8, color:'#F0F4FF', fontWeight:700 }}>{inr(o.amountUsd || 0)}</div>
          </div>
        ))
      )}
    </div>
  )
}

function BillingTab() {
  const [orders, setOrders] = useState([])
  useEffect(() => {
    const load = async () => {
      try {
        const r = await API('/api/portal/orders')
        if (r.ok) setOrders(await r.json())
      } catch {}
    }
    load()
  }, [])
  const completed = orders.filter(o => String(o.status) === 'Completed')
  const totalInr = completed.reduce((sum, o) => sum + ((Number(o.amountUsd) || 0) * USD_TO_INR), 0)
  const thisMonthInr = completed
    .filter(o => new Date(o.createdAt) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
    .reduce((sum, o) => sum + ((Number(o.amountUsd) || 0) * USD_TO_INR), 0)

  return (
    <div>
      <h2 style={{ fontFamily:'Syne,sans-serif', fontSize:24, fontWeight:800, marginBottom:24 }}>Billing</h2>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:12, marginBottom:18 }}>
        <StatCard icon="💰" label="Total Paid (INR)" value={new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(totalInr)} color="#00C896" />
        <StatCard icon="📅" label="Last 30 Days (INR)" value={new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(thisMonthInr)} color="#4F8FFF" />
        <StatCard icon="🧾" label="Invoices" value={completed.length} color="#B06AFF" />
      </div>
      <div style={{ color:'#5A6A8A', fontSize:13, background:'#0a0f1e', border:'1px solid #162040', borderRadius:12, padding:14 }}>
        All prices and billing displays are now shown in INR (converted from base plan USD values).
      </div>
    </div>
  )
}

function VerifyUserTab() {
  const [status, setStatus] = useState(null)
  const [emailInput, setEmailInput] = useState('')
  const [phoneInput, setPhoneInput] = useState('')
  const [loading, setLoading] = useState(false)

  const loadStatus = async () => {
    setLoading(true)
    try {
      const r = await API('/api/portal/verification-status')
      if (r.ok) {
        const d = await r.json()
        setStatus(d)
        setEmailInput(d.email || '')
        const cached = localStorage.getItem('vh_user')
        if (cached) {
          const parsed = JSON.parse(cached)
          localStorage.setItem('vh_user', JSON.stringify({
            ...parsed,
            emailVerified: !!d.emailVerified,
            emailVerifiedAt: d.emailVerifiedAt || null,
            mobileVerified: !!d.mobileVerified,
            mobileVerifiedAt: d.mobileVerifiedAt || null,
            verificationCompletedAt: d.verificationCompletedAt || null,
          }))
        }
      }
    } catch {}
    finally { setLoading(false) }
  }

  useEffect(() => { loadStatus() }, [])

  const sendMagicLink = async () => {
    try {
      const r = await API('/api/portal/verification-status/email-start', {
        method: 'POST',
        body: JSON.stringify({ email: emailInput, phoneNumber: phoneInput || null }),
      })
      const d = await r.json()
      if (!r.ok) toast.error(d.error || 'Failed to send magic link.')
      else toast.success('Magic link sent. Complete email verification from your inbox.')
    } catch {
      toast.error('Failed to send magic link.')
    }
  }

  const markEmailDone = async () => {
    try {
      const r = await API('/api/portal/verification-status/email-complete', {
        method: 'POST',
        body: JSON.stringify({ email: emailInput }),
      })
      const d = await r.json()
      if (!r.ok) toast.error(d.error || 'Failed to mark email step.')
      else { toast.success('Email step completed.'); loadStatus() }
    } catch {
      toast.error('Failed to mark email step.')
    }
  }

  const markMobileDone = async () => {
    try {
      const r = await API('/api/portal/verification-status/mobile-complete', {
        method: 'POST',
        body: JSON.stringify({ sessionId: null }),
      })
      const d = await r.json()
      if (!r.ok) toast.error(d.error || 'Failed to mark mobile step.')
      else { toast.success('Mobile step completed. User is fully verified.'); loadStatus() }
    } catch {
      toast.error('Failed to mark mobile step.')
    }
  }

  const startMobileFlow = async () => {
    try {
      if (!phoneInput.trim()) {
        toast.error('Enter phone number before generating QR.')
        return
      }
      const r = await API('/api/portal/verification-status/mobile-start', {
        method: 'POST',
        body: JSON.stringify({ phoneNumber: phoneInput.trim() }),
      })
      const d = await r.json()
      if (!r.ok) {
        toast.error(d.error || 'Failed to start mobile verification.')
        return
      }
      const url = apiUrl(`/mobileverify?vtoken=${encodeURIComponent(d.verifyToken)}`)
      window.open(url, '_blank', 'noopener,noreferrer')
      toast.success('QR session started. Scan and complete verification.')
    } catch {
      toast.error('Failed to start mobile verification.')
    }
  }

  return (
    <div>
      <h2 style={{ fontFamily:'Syne,sans-serif', fontSize:24, fontWeight:800, marginBottom:24 }}>Verify User</h2>

      <div style={{ background:'#0a0f1e', border:'1px solid #162040', borderRadius:16, padding:20, marginBottom:16 }}>
        <div style={{ fontSize:13, color:'#5A6A8A', marginBottom:12 }}>Current status</div>
        {loading ? (
          <div style={{ color:'#5A6A8A' }}>Loading...</div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:10, fontSize:13, color:'#5A6A8A' }}>
            <div>Email: <strong style={{ color:'#F0F4FF' }}>{status?.email || '-'}</strong></div>
            <div>Email Verified: <strong style={{ color: status?.emailVerified ? '#00C896' : '#FF4D6A' }}>{status?.emailVerified ? 'Yes' : 'No'}</strong></div>
            <div>Mobile Verified: <strong style={{ color: status?.mobileVerified ? '#00C896' : '#FF4D6A' }}>{status?.mobileVerified ? 'Yes' : 'No'}</strong></div>
            <div>Final Status: <strong style={{ color: status?.verificationCompletedAt ? '#00C896' : '#FFB300' }}>{status?.verificationCompletedAt ? 'Verified' : 'Pending'}</strong></div>
          </div>
        )}
      </div>

      <div style={{ background:'#0a0f1e', border:'1px solid #162040', borderRadius:16, padding:20, marginBottom:16 }}>
        <h3 style={{ fontFamily:'Syne,sans-serif', fontSize:16, marginBottom:12 }}>Step 1: Email Verification (Plugin UI)</h3>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center', marginBottom:10 }}>
          <input
            value={emailInput}
            onChange={e => setEmailInput(e.target.value)}
            placeholder="user email"
            style={{ minWidth:280, background:'#050810', border:'1px solid #162040', color:'#F0F4FF', padding:'10px 12px', borderRadius:10, fontSize:13 }}
          />
          <button onClick={sendMagicLink} style={{ padding:'10px 14px', border:'none', borderRadius:10, background:'linear-gradient(135deg,#4F8FFF,#B06AFF)', color:'#fff', fontWeight:700, cursor:'pointer' }}>
            Send Magic Link
          </button>
          <a href={apiUrl('/magiclink/verify')} target="_blank" rel="noreferrer" style={{ padding:'10px 14px', borderRadius:10, border:'1px solid #162040', color:'#F0F4FF', textDecoration:'none', fontSize:13 }}>
            Open Email Plugin UI
          </a>
          <button onClick={markEmailDone} style={{ padding:'10px 14px', border:'none', borderRadius:10, background:'#162040', color:'#fff', fontWeight:700, cursor:'pointer' }}>
            Mark Email Completed
          </button>
        </div>
      </div>

      <div style={{ background:'#0a0f1e', border:'1px solid #162040', borderRadius:16, padding:20 }}>
        <h3 style={{ fontFamily:'Syne,sans-serif', fontSize:16, marginBottom:12 }}>Step 2: Mobile QR Verification (Plugin UI)</h3>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
          <input
            value={phoneInput}
            onChange={e => setPhoneInput(e.target.value)}
            placeholder="user mobile number"
            style={{ minWidth:240, background:'#050810', border:'1px solid #162040', color:'#F0F4FF', padding:'10px 12px', borderRadius:10, fontSize:13 }}
          />
          <button onClick={startMobileFlow} style={{ padding:'10px 14px', border:'none', borderRadius:10, background:'linear-gradient(135deg,#4F8FFF,#00C896)', color:'#fff', fontWeight:700, cursor:'pointer' }}>
            Generate QR
          </button>
          <button onClick={markMobileDone} style={{ padding:'10px 14px', border:'none', borderRadius:10, background:'#162040', color:'#fff', fontWeight:700, cursor:'pointer' }}>
            Mark Mobile Completed
          </button>
        </div>
      </div>
    </div>
  )
}

function AdminOverviewTab({ stats }) {
  return (
    <div>
      <h2 style={{ fontFamily:'Syne,sans-serif', fontSize:24, fontWeight:800, marginBottom:24 }}>Admin Overview</h2>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:16, marginBottom:32 }}>
        <StatCard icon="👥" label="Total Users" value={stats?.totalUsers ?? '—'} color="#4F8FFF" />
        <StatCard icon="🔑" label="Total Licenses" value={stats?.totalLicenses ?? '—'} color="#00C896" />
        <StatCard icon="✅" label="Active Licenses" value={stats?.activeLicenses ?? '—'} color="#B06AFF" />
        <StatCard icon="📡" label="Telemetry Records" value={stats?.totalTelemetryRecords ?? '—'} color="#FFB300" />
        <StatCard icon="💰" label="Total Revenue (INR)" value={stats?.totalRevenue == null ? '—' : inr(stats.totalRevenue)} color="#00C896" />
        <StatCard icon="🛒" label="Orders (30d)" value={stats?.ordersThisMonth ?? '—'} color="#4F8FFF" />
      </div>
    </div>
  )
}

function AdminUsersTab({ users }) {
  const items = users?.items ?? []
  return (
    <div>
      <h2 style={{ fontFamily:'Syne,sans-serif', fontSize:24, fontWeight:800, marginBottom:24 }}>All Users</h2>
      <div style={{ color:'#5A6A8A', fontSize:13, marginBottom:16 }}>
        Total: {users?.total ?? 0}
      </div>
      {!items.length ? (
        <div style={{ color:'#5A6A8A', padding:40, textAlign:'center' }}>No users found.</div>
      ) : items.map(u => (
        <div key={u.id} style={{ background:'#0a0f1e', border:'1px solid #162040', borderRadius:14, padding:18, marginBottom:10 }}>
          <div style={{ display:'flex', justifyContent:'space-between', gap:10, flexWrap:'wrap' }}>
            <div style={{ fontFamily:'Syne,sans-serif', fontSize:16, fontWeight:700 }}>{u.name}</div>
            <div style={{ fontSize:12, color:'#5A6A8A' }}>{new Date(u.createdAt).toLocaleString()}</div>
          </div>
          <div style={{ fontSize:13, color:'#5A6A8A', marginTop:6 }}>
            {u.email} · {u.role === 1 || u.role === 'Admin' ? 'Admin' : 'Customer'} · {u.isActive ? 'Active' : 'Inactive'}
          </div>
        </div>
      ))}
    </div>
  )
}

function AdminLicensesTab({ licenses }) {
  const items = licenses?.items ?? []
  return (
    <div>
      <h2 style={{ fontFamily:'Syne,sans-serif', fontSize:24, fontWeight:800, marginBottom:24 }}>All Licenses</h2>
      <div style={{ color:'#5A6A8A', fontSize:13, marginBottom:16 }}>
        Total: {licenses?.total ?? 0}
      </div>
      {!items.length ? (
        <div style={{ color:'#5A6A8A', padding:40, textAlign:'center' }}>No licenses found.</div>
      ) : items.map(l => (
        <div key={l.id} style={{ background:'#0a0f1e', border:'1px solid #162040', borderRadius:14, padding:18, marginBottom:10 }}>
          <div style={{ display:'flex', justifyContent:'space-between', gap:10, flexWrap:'wrap' }}>
            <div style={{ fontFamily:'JetBrains Mono,monospace', color:'#4F8FFF', fontSize:13 }}>{l.key}</div>
            <div style={{ fontSize:12, color:'#5A6A8A' }}>{new Date(l.issuedAt).toLocaleString()}</div>
          </div>
          <div style={{ fontSize:13, color:'#5A6A8A', marginTop:6 }}>
            {l.product} · {l.plan} · {l.user} · {l.status}
          </div>
        </div>
      ))}
    </div>
  )
}

function AdminTelemetryTab() {
  const [data, setData] = useState(null)
  const [domain, setDomain] = useState('')
  const [expanded, setExpanded] = useState({})
  const [loading, setLoading] = useState(false)
  const parseAll = (raw) => {
    try {
      const obj = JSON.parse(raw || '{}')
      return Object.entries(obj || {})
    } catch {
      return []
    }
  }

  const load = async () => {
    setLoading(true)
    try {
      const q = domain.trim() ? `?domain=${encodeURIComponent(domain.trim())}` : ''
      const r = await API(`/api/admin/telemetry${q}`)
      if (r.ok) setData(await r.json())
    } catch {}
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const items = data?.items ?? []
  return (
    <div>
      <h2 style={{ fontFamily:'Syne,sans-serif', fontSize:24, fontWeight:800, marginBottom:24 }}>Platform Telemetry</h2>
      <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' }}>
        <input value={domain} onChange={e => setDomain(e.target.value)} placeholder="Filter by domain" style={{ background:'#050810', border:'1px solid #162040', color:'#F0F4FF', padding:'8px 10px', borderRadius:8, fontSize:12, minWidth:220 }} />
        <button onClick={load} style={{ padding:'8px 12px', borderRadius:8, border:'1px solid #162040', background:'#0a0f1e', color:'#F0F4FF', fontSize:12, cursor:'pointer' }}>Apply</button>
      </div>
      <div style={{ color:'#5A6A8A', fontSize:13, marginBottom:16 }}>
        Total: {data?.total ?? 0}
      </div>
      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:'#5A6A8A' }}>Loading telemetry…</div>
      ) : !items.length ? (
        <div style={{ color:'#5A6A8A', padding:40, textAlign:'center' }}>No telemetry records.</div>
      ) : items.map(t => (
        <div key={t.id} style={{ background:'#0a0f1e', border:'1px solid #162040', borderRadius:14, padding:18, marginBottom:10 }}>
          <div style={{ display:'flex', justifyContent:'space-between', gap:10, flexWrap:'wrap' }}>
            <div style={{ fontSize:13, color:'#F0F4FF' }}>{t.channel} · {t.pluginDomain || '-'} · {(getFromRaw(t.rawJson, 'userName') || t.userEmail || t.userPhone || 'Anonymous')}</div>
            <div style={{ fontSize:12, color:'#5A6A8A' }}>{new Date(t.receivedAt).toLocaleString()}</div>
          </div>
          <div style={{ fontSize:12, color:'#5A6A8A', marginTop:6 }}>
            {t.ipAddress || '-'} · {t.countryCode || '-'} · {t.city || '-'} · {getFromRaw(t.rawJson, 'deviceId') || '-'} · risk {t.riskScore ?? 0}
          </div>
          <div style={{ marginTop:10 }}>
            <button onClick={() => setExpanded(prev => ({ ...prev, [t.id]: !prev[t.id] }))} style={{ padding:'6px 10px', borderRadius:8, border:'1px solid #162040', background:'#050810', color:'#5A6A8A', fontSize:12, cursor:'pointer' }}>
              {expanded[t.id] ? 'Hide Full Telemetry' : 'Show Full Telemetry'}
            </button>
            {expanded[t.id] && (
              <div style={{ marginTop:8, background:'#050810', border:'1px solid #162040', borderRadius:8, padding:10 }}>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:8 }}>
                  {parseAll(t.rawJson).map(([k, v]) => (
                    <div key={`${t.id}-${k}`} style={{ background:'#0a0f1e', border:'1px solid #162040', borderRadius:8, padding:'8px 10px' }}>
                      <div style={{ fontSize:10, color:'#5A6A8A', textTransform:'uppercase', marginBottom:4 }}>{k}</div>
                      <div style={{ fontSize:12, color:'#F0F4FF', fontFamily:'JetBrains Mono,monospace', wordBreak:'break-word' }}>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function AdminPluginSettingsTab({ settings, onRefresh }) {
  const plugins = settings?.plugins ?? []
  const defaults = settings?.defaults
  const security = settings?.security
  const platform = settings?.platform
  const smtp = settings?.smtp
  const [baseDomain, setBaseDomain] = useState(defaults?.baseDomain || '')
  const [saving, setSaving] = useState(false)
  const [smtpSaving, setSmtpSaving] = useState(false)
  const [smtpTesting, setSmtpTesting] = useState(false)
  const [smtpTestEmail, setSmtpTestEmail] = useState('')
  const [smtpForm, setSmtpForm] = useState({
    host: '',
    port: 587,
    enableSsl: true,
    username: '',
    password: '',
    fromEmail: '',
    fromName: 'VerifyHub',
  })
  const [keyForm, setKeyForm] = useState({})
  const [keySaving, setKeySaving] = useState({})
  const [planForm, setPlanForm] = useState({})
  const [planSaving, setPlanSaving] = useState({})

  useEffect(() => {
    setBaseDomain(defaults?.baseDomain || '')
  }, [defaults?.baseDomain])

  useEffect(() => {
    setSmtpForm({
      host: smtp?.host || '',
      port: smtp?.port ?? 587,
      enableSsl: smtp?.enableSsl ?? true,
      username: smtp?.username || '',
      password: '',
      fromEmail: smtp?.fromEmail || '',
      fromName: smtp?.fromName || 'VerifyHub',
    })
  }, [smtp?.host, smtp?.port, smtp?.enableSsl, smtp?.username, smtp?.fromEmail, smtp?.fromName])

  useEffect(() => {
    const next = {}
    for (const k of (platform?.lifetimeKeys || [])) {
      next[k.id] = {
        key: k.key || '',
        domain: k.installedDomain || '',
        expiresAt: k.expiresAt ? new Date(k.expiresAt).toISOString().slice(0, 10) : '',
      }
    }
    setKeyForm(next)
  }, [platform?.lifetimeKeys])

  useEffect(() => {
    const next = {}
    for (const plugin of plugins) {
      for (const pl of (plugin.plans || [])) {
        next[pl.id] = {
          name: pl.name,
          priceUsd: pl.priceUsd,
          cycle: pl.cycle,
          durationDays: pl.durationDays,
          maxDomains: pl.maxDomains,
          maxVerificationsPerMonth: pl.maxVerificationsPerMonth,
          isPopular: !!pl.isPopular,
        }
      }
    }
    setPlanForm(next)
  }, [settings])

  const saveBaseDomain = async () => {
    setSaving(true)
    try {
      const r = await API('/api/admin/plugin-settings/base-domain', {
        method: 'POST',
        body: JSON.stringify({ baseDomain }),
      })
      const d = await r.json()
      if (!r.ok) {
        toast.error(d.error || 'Failed to save base domain.')
      } else {
        toast.success('Plugin base domain updated.')
        onRefresh?.()
      }
    } catch {
      toast.error('Network error while saving base domain.')
    } finally {
      setSaving(false)
    }
  }

  const saveSmtp = async () => {
    setSmtpSaving(true)
    try {
      const body = {
        host: smtpForm.host,
        port: Number(smtpForm.port),
        enableSsl: !!smtpForm.enableSsl,
        username: smtpForm.username || '',
        password: smtpForm.password || '',
        fromEmail: smtpForm.fromEmail,
        fromName: smtpForm.fromName || 'VerifyHub',
      }
      const r = await API('/api/admin/plugin-settings/smtp', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      const d = await r.json()
      if (!r.ok) toast.error(d.error || 'Failed to save SMTP settings.')
      else { toast.success('SMTP settings saved.'); setSmtpForm(prev => ({ ...prev, password: '' })); onRefresh?.() }
    } catch {
      toast.error('Network error while saving SMTP settings.')
    } finally {
      setSmtpSaving(false)
    }
  }

  const testSmtp = async () => {
    setSmtpTesting(true)
    try {
      if (!smtpTestEmail.trim()) {
        toast.error('Enter test email.')
        return
      }
      const body = {
        host: smtpForm.host,
        port: Number(smtpForm.port),
        enableSsl: !!smtpForm.enableSsl,
        username: smtpForm.username || '',
        password: smtpForm.password || '',
        fromEmail: smtpForm.fromEmail,
        fromName: smtpForm.fromName || 'VerifyHub',
        testEmail: smtpTestEmail.trim(),
      }
      const r = await API('/api/admin/plugin-settings/smtp/test', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      const d = await r.json()
      if (!r.ok) toast.error(d.error || 'SMTP test failed.')
      else toast.success('SMTP test email sent.')
    } catch {
      toast.error('Network error during SMTP test.')
    } finally {
      setSmtpTesting(false)
    }
  }

  const setPlanField = (planId, key, value) => {
    setPlanForm(prev => ({
      ...prev,
      [planId]: { ...(prev[planId] || {}), [key]: value }
    }))
  }

  const savePlatformKey = async (id) => {
    const payload = keyForm[id] || {}
    const key = (payload.key || '').trim()
    const domain = (payload.domain || '').trim()
    const expiresAt = (payload.expiresAt || '').trim()

    if (!key) { toast.error('Key is required.'); return }
    if (!domain) { toast.error('Domain is required.'); return }

    setKeySaving(prev => ({ ...prev, [id]: true }))
    try {
      const r = await API(`/api/admin/platform-keys/${id}`, {
        method: 'POST',
        body: JSON.stringify({ key, domain, expiresAt: expiresAt ? new Date(`${expiresAt}T00:00:00Z`).toISOString() : null }),
      })
      const d = await r.json()
      if (!r.ok) toast.error(d.error || 'Failed to update key.')
      else { toast.success('Platform key updated.'); onRefresh?.() }
    } catch {
      toast.error('Network error while updating key.')
    } finally {
      setKeySaving(prev => ({ ...prev, [id]: false }))
    }
  }

  const savePlan = async (planId) => {
    const payload = planForm[planId]
    if (!payload) return

    setPlanSaving(prev => ({ ...prev, [planId]: true }))
    try {
      const body = {
        name: payload.name,
        priceUsd: Number(payload.priceUsd),
        cycle: payload.cycle,
        durationDays: Number(payload.durationDays),
        maxDomains: Number(payload.maxDomains),
        maxVerificationsPerMonth: Number(payload.maxVerificationsPerMonth),
        isPopular: !!payload.isPopular,
      }
      const r = await API(`/api/admin/plans/${planId}`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      const d = await r.json()
      if (!r.ok) {
        toast.error(d.error || 'Failed to update plan.')
      } else {
        toast.success('Plan updated.')
        onRefresh?.()
      }
    } catch {
      toast.error('Network error while updating plan.')
    } finally {
      setPlanSaving(prev => ({ ...prev, [planId]: false }))
    }
  }

  return (
    <div>
      <h2 style={{ fontFamily:'Syne,sans-serif', fontSize:24, fontWeight:800, marginBottom:24 }}>Plugin Settings</h2>

      <div style={{ background:'#0a0f1e', border:'1px solid #162040', borderRadius:16, padding:20, marginBottom:16 }}>
        <h3 style={{ fontFamily:'Syne,sans-serif', fontSize:16, marginBottom:12 }}>Platform Defaults</h3>
        <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:14, flexWrap:'wrap' }}>
          <input
            value={baseDomain}
            onChange={e => setBaseDomain(e.target.value)}
            placeholder="https://api.verifyhub.io"
            style={{
              minWidth: 320,
              background:'#050810',
              border:'1px solid #162040',
              color:'#F0F4FF',
              padding:'10px 12px',
              borderRadius:10,
              fontSize:13,
              fontFamily:'DM Sans,sans-serif',
            }}
          />
          <button
            onClick={saveBaseDomain}
            disabled={saving}
            style={{
              padding:'10px 14px',
              borderRadius:10,
              border:'none',
              cursor: saving ? 'not-allowed' : 'pointer',
              background: saving ? '#162040' : 'linear-gradient(135deg,#4F8FFF,#B06AFF)',
              color:'#fff',
              fontSize:13,
              fontWeight:700,
              fontFamily:'Syne,sans-serif',
            }}
          >
            {saving ? 'Saving...' : 'Save Base Domain'}
          </button>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:10, fontSize:13, color:'#5A6A8A' }}>
          <div>Base Domain: <strong style={{ color:'#F0F4FF' }}>{defaults?.baseDomain || '-'}</strong></div>
          <div>Email Token Expiry: <strong style={{ color:'#F0F4FF' }}>{defaults?.emailTokenExpiryMinutes ?? '-'} min</strong></div>
          <div>Mobile Telemetry Interval: <strong style={{ color:'#F0F4FF' }}>{defaults?.mobileTelemetryIntervalSeconds ?? '-'} sec</strong></div>
          <div>Mobile QR Expiry: <strong style={{ color:'#F0F4FF' }}>{defaults?.mobileQrExpiryMinutes ?? '-'} min</strong></div>
        </div>
      </div>

      <div style={{ background:'#0a0f1e', border:'1px solid #162040', borderRadius:16, padding:20, marginBottom:16 }}>
        <h3 style={{ fontFamily:'Syne,sans-serif', fontSize:16, marginBottom:12 }}>Platform Lifetime Keys</h3>
        <div style={{ color:'#5A6A8A', fontSize:13, marginBottom:8 }}>Owner: <strong style={{ color:'#F0F4FF' }}>{platform?.ownerEmail || '-'}</strong></div>
        {!(platform?.lifetimeKeys || []).length ? (
          <div style={{ color:'#5A6A8A', fontSize:13 }}>No platform keys available yet. Restart backend once.</div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:10 }}>
            {(platform?.lifetimeKeys || []).map(k => (
              <div key={k.id} style={{ background:'#050810', border:'1px solid #162040', borderRadius:10, padding:10 }}>
                <div style={{ color:'#F0F4FF', fontSize:13, fontWeight:700 }}>{k.product} ({k.keyPrefix})</div>
                <input
                  value={keyForm[k.id]?.key ?? ''}
                  onChange={e => setKeyForm(prev => ({ ...prev, [k.id]: { ...(prev[k.id] || {}), key: e.target.value } }))}
                  style={{ width:'100%', margin:'6px 0', fontFamily:'JetBrains Mono,monospace', background:'#0a0f1e', border:'1px solid #162040', color:'#4F8FFF', padding:'6px 8px', borderRadius:8, fontSize:12 }}
                />
                <input
                  value={keyForm[k.id]?.domain ?? ''}
                  onChange={e => setKeyForm(prev => ({ ...prev, [k.id]: { ...(prev[k.id] || {}), domain: e.target.value } }))}
                  placeholder="domain (e.g. verifyhub-3c9n.onrender.com)"
                  style={{ width:'100%', marginBottom:6, background:'#0a0f1e', border:'1px solid #162040', color:'#F0F4FF', padding:'6px 8px', borderRadius:8, fontSize:12 }}
                />
                <input
                  type="date"
                  value={keyForm[k.id]?.expiresAt ?? ''}
                  onChange={e => setKeyForm(prev => ({ ...prev, [k.id]: { ...(prev[k.id] || {}), expiresAt: e.target.value } }))}
                  style={{ width:'100%', marginBottom:6, background:'#0a0f1e', border:'1px solid #162040', color:'#F0F4FF', padding:'6px 8px', borderRadius:8, fontSize:12 }}
                />
                <button
                  onClick={() => savePlatformKey(k.id)}
                  disabled={!!keySaving[k.id]}
                  style={{
                    width:'100%',
                    marginBottom:6,
                    background: keySaving[k.id] ? '#162040' : 'linear-gradient(135deg,#4F8FFF,#B06AFF)',
                    color:'#fff',
                    border:'none',
                    borderRadius:8,
                    padding:'8px 10px',
                    cursor: keySaving[k.id] ? 'not-allowed' : 'pointer',
                    fontSize:12,
                    fontWeight:700,
                  }}
                >
                  {keySaving[k.id] ? 'Saving...' : `Save ${k.keyPrefix} Key`}
                </button>
                <div style={{ color:'#5A6A8A', fontSize:12 }}>Current Domain: {k.installedDomain || '-'}</div>
                <div style={{ color:'#5A6A8A', fontSize:12 }}>Current Expires: {k.expiresAt ? new Date(k.expiresAt).toLocaleDateString() : '-'}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ background:'#0a0f1e', border:'1px solid #162040', borderRadius:16, padding:20, marginBottom:16 }}>
        <h3 style={{ fontFamily:'Syne,sans-serif', fontSize:16, marginBottom:12 }}>SMTP Settings (Email Verify Plugin)</h3>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:8, marginBottom:10 }}>
          <input value={smtpForm.host} onChange={e => setSmtpForm(prev => ({ ...prev, host: e.target.value }))} placeholder="SMTP Host" style={{ background:'#050810', border:'1px solid #162040', color:'#F0F4FF', padding:'8px 10px', borderRadius:8, fontSize:12 }} />
          <input type="number" value={smtpForm.port} onChange={e => setSmtpForm(prev => ({ ...prev, port: e.target.value }))} placeholder="Port" style={{ background:'#050810', border:'1px solid #162040', color:'#F0F4FF', padding:'8px 10px', borderRadius:8, fontSize:12 }} />
          <input value={smtpForm.username} onChange={e => setSmtpForm(prev => ({ ...prev, username: e.target.value }))} placeholder="Username" style={{ background:'#050810', border:'1px solid #162040', color:'#F0F4FF', padding:'8px 10px', borderRadius:8, fontSize:12 }} />
          <input type="password" value={smtpForm.password} onChange={e => setSmtpForm(prev => ({ ...prev, password: e.target.value }))} placeholder={smtp?.passwordConfigured ? 'Password (leave blank to keep existing)' : 'Password'} style={{ background:'#050810', border:'1px solid #162040', color:'#F0F4FF', padding:'8px 10px', borderRadius:8, fontSize:12 }} />
          <input value={smtpForm.fromEmail} onChange={e => setSmtpForm(prev => ({ ...prev, fromEmail: e.target.value }))} placeholder="From Email" style={{ background:'#050810', border:'1px solid #162040', color:'#F0F4FF', padding:'8px 10px', borderRadius:8, fontSize:12 }} />
          <input value={smtpForm.fromName} onChange={e => setSmtpForm(prev => ({ ...prev, fromName: e.target.value }))} placeholder="From Name" style={{ background:'#050810', border:'1px solid #162040', color:'#F0F4FF', padding:'8px 10px', borderRadius:8, fontSize:12 }} />
        </div>
        <label style={{ color:'#5A6A8A', fontSize:12, display:'inline-flex', alignItems:'center', gap:6, marginBottom:10 }}>
          <input type="checkbox" checked={!!smtpForm.enableSsl} onChange={e => setSmtpForm(prev => ({ ...prev, enableSsl: e.target.checked }))} />
          Enable SSL
        </label>
        <div>
          <button
            onClick={saveSmtp}
            disabled={smtpSaving}
            style={{ padding:'10px 14px', borderRadius:10, border:'none', cursor:smtpSaving ? 'not-allowed' : 'pointer', background:smtpSaving ? '#162040' : 'linear-gradient(135deg,#4F8FFF,#B06AFF)', color:'#fff', fontSize:13, fontWeight:700 }}
          >
            {smtpSaving ? 'Saving...' : 'Save SMTP Settings'}
          </button>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center', marginTop:10, flexWrap:'wrap' }}>
          <input
            value={smtpTestEmail}
            onChange={e => setSmtpTestEmail(e.target.value)}
            placeholder="test@yourdomain.com"
            style={{ background:'#050810', border:'1px solid #162040', color:'#F0F4FF', padding:'8px 10px', borderRadius:8, fontSize:12, minWidth:220 }}
          />
          <button
            onClick={testSmtp}
            disabled={smtpTesting}
            style={{ padding:'9px 12px', borderRadius:8, border:'1px solid #162040', cursor:smtpTesting ? 'not-allowed' : 'pointer', background:smtpTesting ? '#162040' : '#0f1730', color:'#F0F4FF', fontSize:12, fontWeight:700 }}
          >
            {smtpTesting ? 'Testing...' : 'Send SMTP Test'}
          </button>
        </div>
      </div>

      <div style={{ background:'#0a0f1e', border:'1px solid #162040', borderRadius:16, padding:20, marginBottom:16 }}>
        <h3 style={{ fontFamily:'Syne,sans-serif', fontSize:16, marginBottom:12 }}>Security Status</h3>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:10, fontSize:13, color:'#5A6A8A' }}>
          <div>JWT Secret: <strong style={{ color: security?.jwtSecretConfigured ? '#00C896' : '#FF4D6A' }}>{security?.jwtSecretConfigured ? 'Configured' : 'Missing'}</strong></div>
          <div>Plugin JWT Secret: <strong style={{ color: security?.pluginSecretConfigured ? '#00C896' : '#FF4D6A' }}>{security?.pluginSecretConfigured ? 'Configured' : 'Missing'}</strong></div>
          <div>License HMAC Secret: <strong style={{ color: security?.licenseHmacConfigured ? '#00C896' : '#FF4D6A' }}>{security?.licenseHmacConfigured ? 'Configured' : 'Missing'}</strong></div>
          <div>Admin Bootstrap Email: <strong style={{ color:'#F0F4FF' }}>{security?.adminBootstrapEmail || '-'}</strong></div>
        </div>
      </div>

      <div style={{ background:'#0a0f1e', border:'1px solid #162040', borderRadius:16, padding:20 }}>
        <h3 style={{ fontFamily:'Syne,sans-serif', fontSize:16, marginBottom:12 }}>Plugin Catalog & Plans</h3>
        {!plugins.length ? (
          <div style={{ color:'#5A6A8A' }}>No plugin products found.</div>
        ) : plugins.map(p => (
          <div key={p.id} style={{ border:'1px solid #162040', borderRadius:12, padding:14, marginBottom:10, background:'#050810' }}>
            <div style={{ display:'flex', justifyContent:'space-between', gap:10, flexWrap:'wrap' }}>
              <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700 }}>{p.name}</div>
              <div style={{ color:'#5A6A8A', fontSize:12 }}>{p.slug}</div>
            </div>
            <div style={{ color:'#5A6A8A', fontSize:13, margin:'6px 0 10px' }}>{p.description}</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:8 }}>
              {(p.plans || []).map(pl => (
                <div key={pl.id} style={{ background:'#0a0f1e', border:'1px solid #162040', borderRadius:10, padding:10 }}>
                  <input
                    value={planForm[pl.id]?.name ?? ''}
                    onChange={e => setPlanField(pl.id, 'name', e.target.value)}
                    style={{ width:'100%', marginBottom:6, background:'#050810', border:'1px solid #162040', color:'#F0F4FF', padding:'6px 8px', borderRadius:8, fontSize:12 }}
                  />
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:6 }}>
                    <input
                      type="number"
                      step="0.01"
                      value={planForm[pl.id]?.priceUsd ?? 0}
                      onChange={e => setPlanField(pl.id, 'priceUsd', e.target.value)}
                      style={{ background:'#050810', border:'1px solid #162040', color:'#F0F4FF', padding:'6px 8px', borderRadius:8, fontSize:12 }}
                    />
                    <select
                      value={planForm[pl.id]?.cycle ?? 'Annual'}
                      onChange={e => setPlanField(pl.id, 'cycle', e.target.value)}
                      style={{ background:'#050810', border:'1px solid #162040', color:'#F0F4FF', padding:'6px 8px', borderRadius:8, fontSize:12 }}
                    >
                      <option value="Monthly">Monthly</option>
                      <option value="Annual">Annual</option>
                    </select>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:6 }}>
                    <input
                      type="number"
                      value={planForm[pl.id]?.durationDays ?? 365}
                      onChange={e => setPlanField(pl.id, 'durationDays', e.target.value)}
                      style={{ background:'#050810', border:'1px solid #162040', color:'#F0F4FF', padding:'6px 8px', borderRadius:8, fontSize:12 }}
                      title="Duration days"
                    />
                    <input
                      type="number"
                      value={planForm[pl.id]?.maxDomains ?? 1}
                      onChange={e => setPlanField(pl.id, 'maxDomains', e.target.value)}
                      style={{ background:'#050810', border:'1px solid #162040', color:'#F0F4FF', padding:'6px 8px', borderRadius:8, fontSize:12 }}
                      title="Max domains"
                    />
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:6, alignItems:'center', marginBottom:6 }}>
                    <input
                      type="number"
                      value={planForm[pl.id]?.maxVerificationsPerMonth ?? 1000}
                      onChange={e => setPlanField(pl.id, 'maxVerificationsPerMonth', e.target.value)}
                      style={{ background:'#050810', border:'1px solid #162040', color:'#F0F4FF', padding:'6px 8px', borderRadius:8, fontSize:12 }}
                      title="Max verifications per month"
                    />
                    <label style={{ color:'#5A6A8A', fontSize:11, display:'flex', gap:4, alignItems:'center' }}>
                      <input
                        type="checkbox"
                        checked={!!planForm[pl.id]?.isPopular}
                        onChange={e => setPlanField(pl.id, 'isPopular', e.target.checked)}
                      />
                      Popular
                    </label>
                  </div>
                  <button
                    onClick={() => savePlan(pl.id)}
                    disabled={!!planSaving[pl.id]}
                    style={{
                      width:'100%',
                      background: planSaving[pl.id] ? '#162040' : 'linear-gradient(135deg,#4F8FFF,#B06AFF)',
                      color:'#fff',
                      border:'none',
                      borderRadius:8,
                      padding:'8px 10px',
                      cursor: planSaving[pl.id] ? 'not-allowed' : 'pointer',
                      fontSize:12,
                      fontWeight:700,
                    }}
                  >
                    {planSaving[pl.id] ? 'Saving...' : 'Save Plan'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [active, setActive] = useState('overview')
  const [user, setUser] = useState(null)
  const [stats, setStats] = useState(null)
  const [licenses, setLicenses] = useState([])
  const [adminStats, setAdminStats] = useState(null)
  const [adminUsers, setAdminUsers] = useState(null)
  const [adminLicenses, setAdminLicenses] = useState(null)
  const [adminPluginSettings, setAdminPluginSettings] = useState(null)
  const nav = useNavigate()
  const location = useLocation()
  const isAdmin = isAdminRole(user?.role)

  useEffect(() => {
    const u = localStorage.getItem('vh_user')
    if (!u) { nav('/login'); return }
    const parsed = JSON.parse(u)
    setUser(parsed)
    const requestedTab = new URLSearchParams(location.search).get('tab')
    if (isAdminRole(parsed?.role)) setActive('admin-overview')
    else if (requestedTab) setActive(requestedTab)
    loadData(parsed)
  }, [])

  useEffect(() => {
    if (!user || isAdmin) return
    if (!user.emailVerified || !user.mobileVerified || !user.verificationCompletedAt) {
      setActive('verify-user')
    }
  }, [user, isAdmin])

  const loadData = async (u = user) => {
    try {
      if (isAdminRole(u?.role)) {
        const [sR, uR, lR] = await Promise.all([
          API('/api/admin/stats'),
          API('/api/admin/users'),
          API('/api/admin/licenses'),
        ])
        if (sR.ok) setAdminStats(await sR.json())
        if (uR.ok) setAdminUsers(await uR.json())
        if (lR.ok) setAdminLicenses(await lR.json())
        const pR = await API('/api/admin/plugin-settings')
        if (pR.ok) setAdminPluginSettings(await pR.json())
      }
      else
      {
        const [mR, sR, lR] = await Promise.all([
          API('/api/portal/me'),
          API('/api/portal/dashboard-stats'),
          API('/api/portal/licenses'),
        ])
        if (mR.ok) {
          const me = await mR.json()
          setUser(me)
          localStorage.setItem('vh_user', JSON.stringify(me))
        }
        if (sR.ok) setStats(await sR.json())
        if (lR.ok) setLicenses(await lR.json())
      }
    } catch {}
  }

  const logout = () => {
    localStorage.clear()
    nav('/login')
  }

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#050810' }}>
      <Sidebar active={active} setActive={setActive} user={user} onLogout={logout} />
      <main style={{ marginLeft:240, flex:1, padding:'32px 40px', overflowY:'auto' }}>
        {!isAdmin && active === 'overview'  && <OverviewTab  stats={stats} />}
        {!isAdmin && active === 'verify-user' && <VerifyUserTab />}
        {!isAdmin && active === 'licenses'  && <LicensesTab  licenses={licenses} onRefresh={loadData} />}
        {!isAdmin && active === 'telemetry' && <TelemetryTab />}
        {!isAdmin && active === 'orders'    && <OrdersTab />}
        {!isAdmin && active === 'billing'   && <BillingTab />}
        {isAdmin && active === 'admin-overview'  && <AdminOverviewTab stats={adminStats} />}
        {isAdmin && active === 'admin-users'     && <AdminUsersTab users={adminUsers} />}
        {isAdmin && active === 'admin-licenses'  && <AdminLicensesTab licenses={adminLicenses} />}
        {isAdmin && active === 'admin-telemetry' && <AdminTelemetryTab />}
        {isAdmin && active === 'admin-plugin-settings' && <AdminPluginSettingsTab settings={adminPluginSettings} onRefresh={() => loadData(user)} />}
      </main>
    </div>
  )
}
