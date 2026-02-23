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

const isAdminRole = (role) => role === 1 || role === 'Admin'

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

function VerifyUserTab() {
  const [status, setStatus] = useState(null)
  const [emailInput, setEmailInput] = useState('')
  const [loading, setLoading] = useState(false)

  const loadStatus = async () => {
    setLoading(true)
    try {
      const r = await API('/api/portal/verification-status')
      if (r.ok) {
        const d = await r.json()
        setStatus(d)
        setEmailInput(d.email || '')
      }
    } catch {}
    finally { setLoading(false) }
  }

  useEffect(() => { loadStatus() }, [])

  const sendMagicLink = async () => {
    try {
      const r = await fetch('/magiclink/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput }),
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
          <a href="/magiclink/verify" target="_blank" rel="noreferrer" style={{ padding:'10px 14px', borderRadius:10, border:'1px solid #162040', color:'#F0F4FF', textDecoration:'none', fontSize:13 }}>
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
          <a href="/mobileverify" target="_blank" rel="noreferrer" style={{ padding:'10px 14px', borderRadius:10, border:'1px solid #162040', color:'#F0F4FF', textDecoration:'none', fontSize:13 }}>
            Open Mobile QR Plugin UI
          </a>
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
        <StatCard icon="💰" label="Total Revenue (USD)" value={stats?.totalRevenue ?? '—'} color="#00C896" />
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
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const r = await API('/api/admin/telemetry')
      if (r.ok) setData(await r.json())
    } catch {}
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const items = data?.items ?? []
  return (
    <div>
      <h2 style={{ fontFamily:'Syne,sans-serif', fontSize:24, fontWeight:800, marginBottom:24 }}>Platform Telemetry</h2>
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
            <div style={{ fontSize:13, color:'#F0F4FF' }}>{t.channel} · {t.pluginDomain || '-'}</div>
            <div style={{ fontSize:12, color:'#5A6A8A' }}>{new Date(t.receivedAt).toLocaleString()}</div>
          </div>
          <div style={{ fontSize:12, color:'#5A6A8A', marginTop:6 }}>
            {t.ipAddress || '-'} · {t.countryCode || '-'} · {t.city || '-'} · risk {t.riskScore ?? 0}
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
  const [baseDomain, setBaseDomain] = useState(defaults?.baseDomain || '')
  const [saving, setSaving] = useState(false)
  const [keyForm, setKeyForm] = useState({})
  const [keySaving, setKeySaving] = useState({})
  const [planForm, setPlanForm] = useState({})
  const [planSaving, setPlanSaving] = useState({})

  useEffect(() => {
    setBaseDomain(defaults?.baseDomain || '')
  }, [defaults?.baseDomain])

  useEffect(() => {
    const next = {}
    for (const k of (platform?.lifetimeKeys || [])) {
      next[k.id] = k.key
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

  const setPlanField = (planId, key, value) => {
    setPlanForm(prev => ({
      ...prev,
      [planId]: { ...(prev[planId] || {}), [key]: value }
    }))
  }

  const savePlatformKey = async (id) => {
    const key = (keyForm[id] || '').trim()
    if (!key) { toast.error('Key is required.'); return }

    setKeySaving(prev => ({ ...prev, [id]: true }))
    try {
      const r = await API(`/api/admin/platform-keys/${id}`, {
        method: 'POST',
        body: JSON.stringify({ key }),
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
                  value={keyForm[k.id] ?? ''}
                  onChange={e => setKeyForm(prev => ({ ...prev, [k.id]: e.target.value }))}
                  style={{ width:'100%', margin:'6px 0', fontFamily:'JetBrains Mono,monospace', background:'#0a0f1e', border:'1px solid #162040', color:'#4F8FFF', padding:'6px 8px', borderRadius:8, fontSize:12 }}
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
                <div style={{ color:'#5A6A8A', fontSize:12 }}>Domain: {k.installedDomain || '-'}</div>
                <div style={{ color:'#5A6A8A', fontSize:12 }}>Expires: {k.expiresAt ? new Date(k.expiresAt).toLocaleDateString() : '-'}</div>
              </div>
            ))}
          </div>
        )}
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
  const isAdmin = isAdminRole(user?.role)

  useEffect(() => {
    const u = localStorage.getItem('vh_user')
    if (!u) { nav('/login'); return }
    const parsed = JSON.parse(u)
    setUser(parsed)
    if (isAdminRole(parsed?.role)) setActive('admin-overview')
    loadData(parsed)
  }, [])

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
        const [sR, lR] = await Promise.all([
          API('/api/portal/dashboard-stats'),
          API('/api/portal/licenses'),
        ])
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
        {!isAdmin && active === 'orders'    && <div style={{ color:'#5A6A8A', padding:40, textAlign:'center' }}>Orders coming soon</div>}
        {!isAdmin && active === 'billing'   && <div style={{ color:'#5A6A8A', padding:40, textAlign:'center' }}>Billing portal coming soon</div>}
        {isAdmin && active === 'admin-overview'  && <AdminOverviewTab stats={adminStats} />}
        {isAdmin && active === 'admin-users'     && <AdminUsersTab users={adminUsers} />}
        {isAdmin && active === 'admin-licenses'  && <AdminLicensesTab licenses={adminLicenses} />}
        {isAdmin && active === 'admin-telemetry' && <AdminTelemetryTab />}
        {isAdmin && active === 'admin-plugin-settings' && <AdminPluginSettingsTab settings={adminPluginSettings} onRefresh={() => loadData(user)} />}
      </main>
    </div>
  )
}
