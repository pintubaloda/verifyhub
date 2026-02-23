import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { apiFetch } from '../utils/api'

const API = (path, opts = {}) => {
  const token = localStorage.getItem('vh_access')
  return apiFetch(path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...opts.headers },
  })
}

function Sidebar({ active, setActive, user, onLogout }) {
  const items = [
    { id:'overview',  icon:'⬛', label:'Overview' },
    { id:'licenses',  icon:'🔑', label:'My Licenses' },
    { id:'telemetry', icon:'📡', label:'Telemetry' },
    { id:'orders',    icon:'🛒', label:'Orders' },
    { id:'billing',   icon:'💳', label:'Billing' },
  ]
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
            <div style={{ fontSize:11, color:'#5A6A8A' }}>{user?.email}</div>
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
                }}>${p.price}/yr</div>
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
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const q = channel ? `?channel=${channel}` : ''
      const r = await API(`/api/telemetry/mine${q}`)
      const d = await r.json()
      setData(d)
    } catch {}
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [channel])

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
                    {t.userEmail || t.userPhone || 'Anonymous'}
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
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [active, setActive] = useState('overview')
  const [user, setUser] = useState(null)
  const [stats, setStats] = useState(null)
  const [licenses, setLicenses] = useState([])
  const nav = useNavigate()

  useEffect(() => {
    const u = localStorage.getItem('vh_user')
    if (!u) { nav('/login'); return }
    setUser(JSON.parse(u))
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [sR, lR] = await Promise.all([
        API('/api/portal/dashboard-stats'),
        API('/api/portal/licenses'),
      ])
      if (sR.ok) setStats(await sR.json())
      if (lR.ok) setLicenses(await lR.json())
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
        {active === 'overview'  && <OverviewTab  stats={stats} />}
        {active === 'licenses'  && <LicensesTab  licenses={licenses} onRefresh={loadData} />}
        {active === 'telemetry' && <TelemetryTab />}
        {active === 'orders'    && <div style={{ color:'#5A6A8A', padding:40, textAlign:'center' }}>Orders coming soon</div>}
        {active === 'billing'   && <div style={{ color:'#5A6A8A', padding:40, textAlign:'center' }}>Billing portal coming soon</div>}
      </main>
    </div>
  )
}
