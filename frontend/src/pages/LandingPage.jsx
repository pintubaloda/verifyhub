import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'

const USD_TO_INR = 83
const toInr = (usd) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format((Number(usd) || 0) * USD_TO_INR)

// ── Animated background particles ────────────────────────────────────────
function ParticleField() {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let raf, w, h, particles = []

    const resize = () => {
      w = canvas.width  = window.innerWidth
      h = canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    for (let i = 0; i < 70; i++) particles.push({
      x: Math.random() * 1920,  y: Math.random() * 1080,
      vx: (Math.random() - .5) * .3, vy: (Math.random() - .5) * .3,
      r: Math.random() * 1.4 + .3,
      hue: Math.random() > .5 ? 215 : 270,
      alpha: Math.random() * .35 + .05
    })

    const draw = () => {
      ctx.clearRect(0, 0, w, h)
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy
        if (p.x < 0) p.x = w; if (p.x > w) p.x = 0
        if (p.y < 0) p.y = h; if (p.y > h) p.y = 0
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${p.hue},80%,70%,${p.alpha})`
        ctx.fill()
      })
      // Draw connecting lines
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx*dx + dy*dy)
          if (dist < 120) {
            ctx.beginPath()
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.strokeStyle = `rgba(79,143,255,${.08 * (1 - dist/120)})`
            ctx.lineWidth = .5
            ctx.stroke()
          }
        }
      }
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [])
  return <canvas ref={canvasRef} style={{ position:'fixed',inset:0,pointerEvents:'none',zIndex:0 }} />
}

// ── Animated counter ─────────────────────────────────────────────────────
function Counter({ end, suffix = '', duration = 2000 }) {
  const [n, setN] = useState(0)
  const ref = useRef(null)
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        const start = Date.now()
        const tick = () => {
          const elapsed = Date.now() - start
          const p = Math.min(elapsed / duration, 1)
          setN(Math.floor(p * end))
          if (p < 1) requestAnimationFrame(tick)
          else setN(end)
        }
        tick()
        obs.disconnect()
      }
    })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [end, duration])
  return <span ref={ref}>{n.toLocaleString()}{suffix}</span>
}

// ── Terminal animation component ─────────────────────────────────────────
function CodeTerminal() {
  const lines = [
    { t: 0,    text: '$ dotnet add package VerifyHub.EmailPlugin', color: '#5A6A8A' },
    { t: 600,  text: '✓ Package installed successfully', color: '#00E5C8' },
    { t: 1200, text: '// Program.cs', color: '#5A6A8A' },
    { t: 1500, text: 'builder.Services.AddEmailVerifyPlugin(config);', color: '#4F8FFF' },
    { t: 2000, text: 'app.UseEmailVerifyPlugin();', color: '#4F8FFF' },
    { t: 2600, text: '// appsettings.json', color: '#5A6A8A' },
    { t: 2900, text: '"LicenseKey": "EML-A3F2-9B1C-5E40"', color: '#B06AFF' },
    { t: 3500, text: '✓ Plugin activated on your-domain.com', color: '#00E5C8' },
    { t: 4100, text: '✓ /magiclink directory created', color: '#00E5C8' },
    { t: 4600, text: '✓ Device telemetry streaming to VerifyHub', color: '#00C896' },
  ]
  const [visible, setVisible] = useState([])
  const [active, setActive] = useState(true)
  useEffect(() => {
    if (!active) return
    let timers = lines.map(l => setTimeout(() => setVisible(v => [...v, l]), l.t))
    const reset = setTimeout(() => { setVisible([]); setActive(false); setTimeout(() => setActive(true), 800) }, 6000)
    return () => { timers.forEach(clearTimeout); clearTimeout(reset) }
  }, [active])

  return (
    <div style={{
      background: '#050810', border: '1px solid #162040',
      borderRadius: '14px', overflow: 'hidden', fontFamily: 'JetBrains Mono, monospace',
    }}>
      {/* Terminal chrome */}
      <div style={{ background: '#0a0f1e', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #162040' }}>
        <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#FF5F56' }}/>
        <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#FFBD2E' }}/>
        <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#27C93F' }}/>
        <span style={{ marginLeft: 8, fontSize: 12, color: '#5A6A8A' }}>VerifyHub Install</span>
      </div>
      <div style={{ padding: '20px', minHeight: 220, fontSize: 13, lineHeight: '1.8' }}>
        {visible.map((l, i) => (
          <div key={i} style={{ color: l.color, animation: 'fadeUp .25s ease' }}>
            {l.text}
            {i === visible.length - 1 && <span style={{ animation: 'pulse 1s infinite', marginLeft: 4 }}>▋</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Pricing card ─────────────────────────────────────────────────────────
function PricingCard({ name, price, features, popular, color, prefix }) {
  return (
    <div style={{
      background: popular ? 'linear-gradient(135deg, rgba(79,143,255,.08), rgba(176,106,255,.06))' : '#0a0f1e',
      border: `1px solid ${popular ? 'rgba(79,143,255,.4)' : '#162040'}`,
      borderRadius: 20, padding: '32px 28px', position: 'relative',
      transition: 'transform .25s, box-shadow .25s', cursor: 'default',
    }}
    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-6px)'; e.currentTarget.style.boxShadow = `0 24px 60px rgba(${popular ? '79,143,255' : '0,0,0'},.15)` }}
    onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
    >
      {popular && (
        <div style={{
          position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)',
          background: 'linear-gradient(90deg, #4F8FFF, #B06AFF)',
          borderRadius: 20, padding: '5px 18px', fontSize: 12, fontWeight: 700,
          whiteSpace: 'nowrap', fontFamily: 'Syne, sans-serif', letterSpacing: '.5px'
        }}>⭐ MOST POPULAR</div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 22 }}>{prefix === 'EML' ? '✉' : '📱'}</span>
        <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 700 }}>{name}</span>
      </div>
      <div style={{ marginBottom: 24 }}>
        <span style={{
          fontFamily: 'Syne, sans-serif', fontSize: 42, fontWeight: 800,
          background: `linear-gradient(135deg, ${color}, #B06AFF)`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text'
        }}>{toInr(price)}</span>
        <span style={{ color: '#5A6A8A', fontSize: 14, marginLeft: 6 }}>/year</span>
      </div>
      <ul style={{ listStyle: 'none', marginBottom: 28 }}>
        {features.map((f, i) => (
          <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10, fontSize: 14, color: '#a0aabf' }}>
            <span style={{ color: '#00E5C8', fontSize: 16, lineHeight: 1.4, flexShrink: 0 }}>✓</span>
            {f}
          </li>
        ))}
      </ul>
      <Link to="/register" style={{
        display: 'block', textAlign: 'center', padding: '13px',
        background: popular ? 'linear-gradient(135deg, #4F8FFF, #B06AFF)' : 'transparent',
        border: popular ? 'none' : '1px solid #162040',
        color: popular ? '#fff' : '#a0aabf',
        borderRadius: 12, textDecoration: 'none', fontWeight: 700, fontSize: 15,
        fontFamily: 'Syne, sans-serif', transition: 'all .2s',
      }}
      onMouseEnter={e => { if (!popular) { e.target.style.borderColor = '#4F8FFF'; e.target.style.color = '#4F8FFF' }}}
      onMouseLeave={e => { if (!popular) { e.target.style.borderColor = '#162040'; e.target.style.color = '#a0aabf' }}}
      >Get Started →</Link>
    </div>
  )
}

// ── Main Landing Page ─────────────────────────────────────────────────────
export default function LandingPage() {
  const [mobileTab, setMobileTab] = useState('email')
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const emailPlans = [
    { name:'Starter', price:29,  popular:false, color:'#4F8FFF', prefix:'EML', features:['Up to 500 verifications/mo','1 domain','Email magic link + code','Basic fingerprinting','Email support'] },
    { name:'Pro',     price:79,  popular:true,  color:'#4F8FFF', prefix:'EML', features:['Up to 5,000 verifications/mo','3 domains','Full device fingerprinting','IP geo + risk scoring','GPS capture','Canvas & WebGL fingerprint','Priority support'] },
    { name:'Business',price:199, popular:false, color:'#4F8FFF', prefix:'EML', features:['Unlimited verifications','10 domains','All Pro features','Central telemetry dashboard','CSV / JSON export','SLA + dedicated support'] },
  ]
  const mobilePlans = [
    { name:'Starter', price:39,  popular:false, color:'#B06AFF', prefix:'MOB', features:['Up to 200 QR sessions/mo','1 domain','Real-time GPS','Device & sensor telemetry','Email support'] },
    { name:'Pro',     price:99,  popular:true,  color:'#B06AFF', prefix:'MOB', features:['Up to 2,000 QR sessions/mo','3 domains','SignalR real-time push','GPS + motion sensors','Full network analysis','Risk scoring','Admin dashboard'] },
    { name:'Business',price:249, popular:false, color:'#B06AFF', prefix:'MOB', features:['Unlimited QR sessions','10 domains','All Pro features','Central telemetry stream','White-label ready','Priority SLA'] },
  ]

  const S = (style) => style // just for readability

  return (
    <div style={{ position:'relative', overflowX:'hidden' }}>
      <ParticleField />

      {/* ── NAVBAR ───────────────────────────────────────────────────── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        padding: '0 40px',
        background: scrolled ? 'rgba(5,8,16,.92)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom: scrolled ? '1px solid #162040' : '1px solid transparent',
        transition: 'all .3s', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', height: 68,
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{
            width:38, height:38, borderRadius:10,
            background:'linear-gradient(135deg,#4F8FFF,#B06AFF)',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:20
          }}>🔐</div>
          <span style={{ fontFamily:'Syne,sans-serif', fontSize:20, fontWeight:800, letterSpacing:'-.5px' }}>
            Verify<span style={{ color:'#4F8FFF' }}>Hub</span>
          </span>
        </div>
        <div style={{ display:'flex', gap:32, alignItems:'center' }}>
          {['Features','Pricing','Docs','Blog'].map(l => (
            <a key={l} href={`#${l.toLowerCase()}`} style={{
              color:'#5A6A8A', textDecoration:'none', fontSize:14, fontWeight:500,
              transition:'color .2s'
            }}
            onMouseEnter={e=>e.target.style.color='#F0F4FF'}
            onMouseLeave={e=>e.target.style.color='#5A6A8A'}
            >{l}</a>
          ))}
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <Link to="/login" style={{
            padding:'9px 20px', borderRadius:10, border:'1px solid #162040',
            color:'#a0aabf', textDecoration:'none', fontSize:14, fontWeight:600,
            transition:'all .2s',
          }}
          onMouseEnter={e=>{e.target.style.borderColor='#4F8FFF';e.target.style.color='#4F8FFF'}}
          onMouseLeave={e=>{e.target.style.borderColor='#162040';e.target.style.color='#a0aabf'}}
          >Log in</Link>
          <Link to="/register" style={{
            padding:'9px 20px', borderRadius:10,
            background:'linear-gradient(135deg,#4F8FFF,#B06AFF)',
            color:'#fff', textDecoration:'none', fontSize:14, fontWeight:700,
            fontFamily:'Syne,sans-serif',
          }}>Get Started Free</Link>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section style={{
        position:'relative', minHeight:'100vh', display:'flex', alignItems:'center',
        justifyContent:'center', padding:'120px 40px 80px',
        textAlign:'center', zIndex:1,
      }}>
        {/* Big radial glow behind */}
        <div style={{
          position:'absolute', top:'10%', left:'50%', transform:'translateX(-50%)',
          width:900, height:600,
          background:'radial-gradient(ellipse, rgba(79,143,255,.12) 0%, rgba(176,106,255,.08) 35%, transparent 70%)',
          pointerEvents:'none',
        }}/>

        <div style={{ maxWidth:860, position:'relative' }}>
          {/* Badge */}
          <div style={{
            display:'inline-flex', alignItems:'center', gap:8, marginBottom:28,
            padding:'7px 16px', borderRadius:30,
            background:'rgba(79,143,255,.08)', border:'1px solid rgba(79,143,255,.2)',
            fontSize:13, fontWeight:600, color:'#4F8FFF',
            animation:'fadeUp .5s ease both',
          }}>
            <span style={{ width:7, height:7, borderRadius:'50%', background:'#4F8FFF', animation:'pulse 2s infinite', display:'inline-block' }}/>
            Drop-in Identity Verification for ASP.NET Core
          </div>

          {/* Headline */}
          <h1 style={{
            fontFamily:'Syne,sans-serif', fontSize:'clamp(48px,7vw,90px)',
            fontWeight:800, lineHeight:1.05, marginBottom:24, letterSpacing:'-2px',
            animation:'fadeUp .6s ease both', animationDelay:'.1s',
          }}>
            Verify Identities.
            <br/>
            <span style={{
              background:'linear-gradient(135deg, #4F8FFF 0%, #B06AFF 50%, #00E5C8 100%)',
              WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text',
            }}>Capture Everything.</span>
          </h1>

          <p style={{
            fontSize:'clamp(16px,2vw,20px)', color:'#7A8AAA', maxWidth:580, margin:'0 auto 40px',
            lineHeight:1.7,
            animation:'fadeUp .6s ease both', animationDelay:'.2s',
          }}>
            Two powerful ASP.NET Core plugins. <strong style={{color:'#F0F4FF'}}>Email magic link</strong> and
            {' '}<strong style={{color:'#F0F4FF'}}>Mobile QR scanning</strong>. Install with one line.
            Stream GPS, device fingerprints, and network data directly to your secure dashboard.
          </p>

          {/* CTA buttons */}
          <div style={{
            display:'flex', gap:14, justifyContent:'center', flexWrap:'wrap',
            animation:'fadeUp .6s ease both', animationDelay:'.3s',
          }}>
            <Link to="/register" style={{
              padding:'15px 32px', borderRadius:14,
              background:'linear-gradient(135deg,#4F8FFF,#B06AFF)',
              color:'#fff', textDecoration:'none', fontSize:16, fontWeight:700,
              fontFamily:'Syne,sans-serif', letterSpacing:'-.2px',
              boxShadow:'0 0 40px rgba(79,143,255,.3)',
            }}>
              Start Free Trial →
            </Link>
            <a href="#features" style={{
              padding:'15px 32px', borderRadius:14,
              background:'rgba(255,255,255,.04)', border:'1px solid #162040',
              color:'#a0aabf', textDecoration:'none', fontSize:16, fontWeight:600,
            }}>See How It Works</a>
          </div>

          {/* Social proof row */}
          <div style={{
            display:'flex', alignItems:'center', justifyContent:'center',
            gap:32, marginTop:52, flexWrap:'wrap',
            animation:'fadeUp .6s ease both', animationDelay:'.4s',
          }}>
            {[['2,400+','Developers'], ['98.9%','Uptime SLA'], ['<50ms','Validation latency'], ['GDPR','Compliant']].map(([n,l]) => (
              <div key={l} style={{ textAlign:'center' }}>
                <div style={{ fontFamily:'Syne,sans-serif', fontSize:22, fontWeight:800, color:'#F0F4FF' }}>{n}</div>
                <div style={{ fontSize:12, color:'#5A6A8A', fontWeight:500 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────── */}
      <section id="features" style={{ padding:'100px 40px', position:'relative', zIndex:1 }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:72 }}>
            <div style={{ display:'inline-block', padding:'5px 16px', borderRadius:20,
              background:'rgba(0,229,200,.06)', border:'1px solid rgba(0,229,200,.15)',
              fontSize:12, fontWeight:700, color:'#00E5C8', letterSpacing:'1px',
              marginBottom:16 }}>HOW IT WORKS</div>
            <h2 style={{ fontFamily:'Syne,sans-serif', fontSize:'clamp(32px,4vw,52px)', fontWeight:800,
              letterSpacing:'-1px', lineHeight:1.1, marginBottom:16 }}>
              Install Once. Verify Forever.
            </h2>
            <p style={{ color:'#5A6A8A', fontSize:18, maxWidth:480, margin:'0 auto' }}>
              Three lines of code. A license key. Full device intelligence.
            </p>
          </div>

          {/* Two column: steps + code terminal */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:60, alignItems:'center' }}>
            <div>
              {[
                { n:'01', icon:'🛒', title:'Buy a License', desc:'Choose Email or Mobile plugin. Get your license key instantly after checkout.', color:'#4F8FFF' },
                { n:'02', icon:'⚡', title:'One-File Install', desc:'Drop the .cs file into your project. Two lines in Program.cs. License key in appsettings.json.', color:'#B06AFF' },
                { n:'03', icon:'📂', title:'Auto-Creates /magiclink', desc:'Plugin auto-creates the /magiclink directory and registers all routes on first run.', color:'#00E5C8' },
                { n:'04', icon:'🔭', title:'Telemetry to Base Domain', desc:'Every verification streams GPS, fingerprints, device data to YOUR secure VerifyHub dashboard — not your server.', color:'#FFB300' },
              ].map(s => (
                <div key={s.n} style={{
                  display:'flex', gap:20, marginBottom:36,
                  animation:`fadeUp .5s ease both`,
                }}>
                  <div style={{
                    width:48, height:48, borderRadius:12, flexShrink:0,
                    background:`rgba(${s.color === '#4F8FFF' ? '79,143,255' : s.color === '#B06AFF' ? '176,106,255' : s.color === '#00E5C8' ? '0,229,200' : '255,179,0'},.1)`,
                    border:`1px solid ${s.color}30`,
                    display:'flex', alignItems:'center', justifyContent:'center', fontSize:22,
                  }}>{s.icon}</div>
                  <div>
                    <div style={{ fontFamily:'Syne,sans-serif', fontSize:17, fontWeight:700, marginBottom:5 }}>
                      <span style={{ color:s.color, fontSize:13, fontWeight:800, marginRight:8 }}>{s.n}</span>
                      {s.title}
                    </div>
                    <p style={{ color:'#5A6A8A', fontSize:14, lineHeight:1.6 }}>{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <CodeTerminal />
          </div>
        </div>
      </section>

      {/* ── PLUGIN SHOWCASE ──────────────────────────────────────────── */}
      <section style={{ padding:'100px 40px', background:'linear-gradient(180deg,transparent,rgba(10,15,30,.6),transparent)', position:'relative', zIndex:1 }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:60 }}>
            <h2 style={{ fontFamily:'Syne,sans-serif', fontSize:'clamp(32px,4vw,52px)', fontWeight:800, letterSpacing:'-1px', marginBottom:16 }}>
              Two Plugins. One Ecosystem.
            </h2>
            <p style={{ color:'#5A6A8A', fontSize:18 }}>Each plugin works standalone. Or deploy both for complete coverage.</p>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24 }}>
            {/* Email Plugin */}
            <div style={{
              background:'#0a0f1e', border:'1px solid #162040', borderRadius:20, padding:36, overflow:'hidden', position:'relative',
            }}>
              <div style={{ position:'absolute', top:-80, right:-80, width:200, height:200,
                background:'radial-gradient(circle,rgba(79,143,255,.12),transparent)', pointerEvents:'none' }}/>
              <div style={{ fontSize:44, marginBottom:20 }}>✉</div>
              <h3 style={{ fontFamily:'Syne,sans-serif', fontSize:26, fontWeight:800, marginBottom:10 }}>Email Verify Plugin</h3>
              <p style={{ color:'#5A6A8A', fontSize:15, lineHeight:1.7, marginBottom:24 }}>
                Magic link flow → 6-digit code → device fingerprinting. Users click a link in their email,
                enter a code on your site, and you capture their full device fingerprint, IP geolocation, GPS, canvas hash, and more.
              </p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:28 }}>
                {['Magic Link Flow','6-digit OTP code','Device Fingerprint','IP Geolocation','GPS Capture','Risk Scoring','Canvas/WebGL Hash','Rate Limiting + CSRF'].map(f => (
                  <div key={f} style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'#a0aabf' }}>
                    <span style={{ color:'#4F8FFF', fontSize:14 }}>✓</span>{f}
                  </div>
                ))}
              </div>
              <div style={{
                background:'#050810', borderRadius:10, padding:'12px 16px',
                fontFamily:'JetBrains Mono,monospace', fontSize:13, color:'#4F8FFF',
                borderLeft:'3px solid #4F8FFF'
              }}>
                Key: <span style={{ color:'#00E5C8' }}>EML-XXXX-XXXX-XXXX</span>
              </div>
            </div>

            {/* Mobile Plugin */}
            <div style={{
              background:'#0a0f1e', border:'1px solid #162040', borderRadius:20, padding:36, overflow:'hidden', position:'relative',
            }}>
              <div style={{ position:'absolute', top:-80, right:-80, width:200, height:200,
                background:'radial-gradient(circle,rgba(176,106,255,.12),transparent)', pointerEvents:'none' }}/>
              <div style={{ fontSize:44, marginBottom:20 }}>📱</div>
              <h3 style={{ fontFamily:'Syne,sans-serif', fontSize:26, fontWeight:800, marginBottom:10 }}>Mobile QR Plugin</h3>
              <p style={{ color:'#5A6A8A', fontSize:15, lineHeight:1.7, marginBottom:24 }}>
                Desktop shows QR code → mobile scans → real-time device data streams via SignalR. 
                GPS, accelerometer, gyroscope, battery, network quality, and browser fingerprints —
                all flowing to your dashboard every 5 seconds.
              </p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:28 }}>
                {['QR Code Scanner','Real-time SignalR','GPS Streaming','Accelerometer/Gyro','Battery Status','Network Quality','Canvas Fingerprint','Phone Confirmation'].map(f => (
                  <div key={f} style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'#a0aabf' }}>
                    <span style={{ color:'#B06AFF', fontSize:14 }}>✓</span>{f}
                  </div>
                ))}
              </div>
              <div style={{
                background:'#050810', borderRadius:10, padding:'12px 16px',
                fontFamily:'JetBrains Mono,monospace', fontSize:13, color:'#B06AFF',
                borderLeft:'3px solid #B06AFF'
              }}>
                Key: <span style={{ color:'#00E5C8' }}>MOB-XXXX-XXXX-XXXX</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── DATA COLLECTED ───────────────────────────────────────────── */}
      <section style={{ padding:'100px 40px', position:'relative', zIndex:1 }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:64 }}>
            <div style={{ display:'inline-block', padding:'5px 16px', borderRadius:20,
              background:'rgba(176,106,255,.06)', border:'1px solid rgba(176,106,255,.15)',
              fontSize:12, fontWeight:700, color:'#B06AFF', letterSpacing:'1px', marginBottom:16 }}>
              INTELLIGENCE COLLECTED
            </div>
            <h2 style={{ fontFamily:'Syne,sans-serif', fontSize:'clamp(30px,4vw,48px)', fontWeight:800, letterSpacing:'-1px', marginBottom:16 }}>
              Know Everything About Every Verification
            </h2>
            <p style={{ color:'#5A6A8A', fontSize:18, maxWidth:500, margin:'0 auto' }}>
              60+ data points per session. Streaming to your dashboard in real time.
            </p>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16 }}>
            {[
              { icon:'🌐', title:'Network Intelligence', color:'#4F8FFF', items:['IP Address (direct + proxy chain)', 'ISP, ASN number', 'Country, region, city', 'Proxy / VPN / Tor detection', 'Datacenter IP detection'] },
              { icon:'📍', title:'Location', color:'#00E5C8', items:['IP-based geolocation', 'GPS precise lat/lon', 'Accuracy, altitude, speed', 'Heading & direction', 'Permission state tracking'] },
              { icon:'🖥️', title:'Device Identity', color:'#B06AFF', items:['Device vendor & model', 'OS name & version', 'Browser name & version', 'Device type (mobile/desktop)', 'Screen resolution + pixel ratio'] },
              { icon:'⚡', title:'Hardware Profile', color:'#FFB300', items:['CPU core count', 'RAM estimate (GB)', 'Max touch points', 'Battery level + charging', 'Sensor availability'] },
              { icon:'🔬', title:'Browser Fingerprint', color:'#FF4D6A', items:['Canvas 2D hash (SHA-256)', 'WebGL renderer + vendor', 'Cookies enabled/disabled', 'Do-Not-Track setting', 'Language(s) + timezone'] },
              { icon:'📡', title:'Network Quality', color:'#00C896', items:['Connection type (WiFi/LTE/5G)', 'Effective bandwidth', 'Round-trip latency', 'Save Data flag', 'Online/offline state'] },
            ].map(c => (
              <div key={c.title} style={{
                background:'#0a0f1e', border:'1px solid #162040', borderRadius:16, padding:24,
                transition:'border-color .2s',
              }}
              onMouseEnter={e=>e.currentTarget.style.borderColor=c.color+'50'}
              onMouseLeave={e=>e.currentTarget.style.borderColor='#162040'}
              >
                <div style={{ fontSize:28, marginBottom:12 }}>{c.icon}</div>
                <h4 style={{ fontFamily:'Syne,sans-serif', fontSize:16, fontWeight:700, color:c.color, marginBottom:14 }}>{c.title}</h4>
                {c.items.map(item => (
                  <div key={item} style={{ fontSize:13, color:'#5A6A8A', marginBottom:7, display:'flex', gap:8 }}>
                    <span style={{ color:c.color, flexShrink:0 }}>→</span>{item}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS COUNTER ────────────────────────────────────────────── */}
      <section style={{
        padding:'80px 40px',
        background:'linear-gradient(135deg,rgba(79,143,255,.05),rgba(176,106,255,.03))',
        borderTop:'1px solid #162040', borderBottom:'1px solid #162040',
        position:'relative', zIndex:1,
      }}>
        <div style={{ maxWidth:900, margin:'0 auto', display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:24, textAlign:'center' }}>
          {[
            { label:'Verifications Processed', end:4800000, suffix:'+' },
            { label:'Active Installations', end:2400, suffix:'+' },
            { label:'Data Points Per Session', end:60, suffix:'+' },
            { label:'Countries Covered', end:140, suffix:'+' },
          ].map(s => (
            <div key={s.label}>
              <div style={{ fontFamily:'Syne,sans-serif', fontSize:44, fontWeight:800,
                background:'linear-gradient(135deg,#4F8FFF,#00E5C8)',
                WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text',
                marginBottom:8,
              }}>
                <Counter end={s.end} suffix={s.suffix} />
              </div>
              <div style={{ color:'#5A6A8A', fontSize:14 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── LICENSE SECURITY CALLOUT ──────────────────────────────────── */}
      <section style={{ padding:'80px 40px', position:'relative', zIndex:1 }}>
        <div style={{ maxWidth:900, margin:'0 auto', background:'#0a0f1e',
          border:'1px solid #162040', borderRadius:24, padding:'48px 52px',
          display:'grid', gridTemplateColumns:'1fr auto', gap:40, alignItems:'center' }}>
          <div>
            <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'5px 14px',
              borderRadius:20, background:'rgba(255,77,106,.06)', border:'1px solid rgba(255,77,106,.15)',
              fontSize:12, fontWeight:700, color:'#FF4D6A', marginBottom:16 }}>
              🔑 LICENSE PROTECTION
            </div>
            <h3 style={{ fontFamily:'Syne,sans-serif', fontSize:'clamp(22px,3vw,34px)', fontWeight:800, lineHeight:1.2, marginBottom:14 }}>
              Secure license keys. Auto-expire protection. Domain locking.
            </h3>
            <p style={{ color:'#5A6A8A', fontSize:16, lineHeight:1.7, marginBottom:20 }}>
              Every license key is cryptographically signed and domain-locked. When expired, users see a
              {' '}<strong style={{ color:'#F0F4FF' }}>renewal popup automatically</strong> — no manual enforcement needed.
              License validation runs silently every hour, server-side.
            </p>
            <div style={{ display:'flex', gap:20, flexWrap:'wrap' }}>
              {['EML- and MOB- prefixed keys','Domain binding enforced','Automatic expiry popup','HMAC-signed key format','No license = no verification'].map(f => (
                <div key={f} style={{ display:'flex', alignItems:'center', gap:7, fontSize:13, color:'#a0aabf' }}>
                  <span style={{ color:'#00E5C8' }}>✓</span>{f}
                </div>
              ))}
            </div>
          </div>
          <div style={{
            background:'#050810', borderRadius:16, padding:'20px 24px',
            fontFamily:'JetBrains Mono,monospace', fontSize:12,
            border:'1px solid #162040', minWidth:280, flexShrink:0,
          }}>
            <div style={{ color:'#5A6A8A', marginBottom:8 }}>// License expired popup</div>
            <div style={{ color:'#FF4D6A' }}>⚠️ License Expired</div>
            <div style={{ color:'#5A6A8A', marginTop:8, lineHeight:1.8 }}>
              Your verification plugin<br/>license has expired.<br/><br/>
              <span style={{ color:'#4F8FFF' }}>→ Renew at verifyhub.io</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── PRICING ──────────────────────────────────────────────────── */}
      <section id="pricing" style={{ padding:'100px 40px', position:'relative', zIndex:1 }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:60 }}>
            <h2 style={{ fontFamily:'Syne,sans-serif', fontSize:'clamp(32px,4vw,52px)', fontWeight:800, letterSpacing:'-1px', marginBottom:16 }}>
              Simple, Transparent Pricing
            </h2>
            <p style={{ color:'#5A6A8A', fontSize:18, marginBottom:32 }}>Billed annually. Cancel any time. 14-day free trial included.</p>
            <div style={{
              display:'inline-flex', background:'#0a0f1e', borderRadius:12,
              border:'1px solid #162040', padding:5, gap:4,
            }}>
              {['email','mobile'].map(t => (
                <button key={t} onClick={() => setMobileTab(t)} style={{
                  padding:'9px 24px', borderRadius:9, border:'none', cursor:'pointer',
                  background: mobileTab === t ? 'linear-gradient(135deg,#4F8FFF,#B06AFF)' : 'transparent',
                  color: mobileTab === t ? '#fff' : '#5A6A8A',
                  fontSize:14, fontWeight:700, fontFamily:'Syne,sans-serif',
                  transition:'all .2s',
                }}>
                  {t === 'email' ? '✉ Email Plugin' : '📱 Mobile QR Plugin'}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:20 }}>
            {(mobileTab === 'email' ? emailPlans : mobilePlans).map(p => (
              <PricingCard key={p.name} {...p} />
            ))}
          </div>

          <p style={{ textAlign:'center', color:'#5A6A8A', fontSize:14, marginTop:32 }}>
            Need both plugins? <Link to="/register" style={{ color:'#4F8FFF', textDecoration:'none', fontWeight:600 }}>Contact us for bundle pricing →</Link>
          </p>
        </div>
      </section>

      {/* ── TESTIMONIALS ─────────────────────────────────────────────── */}
      <section style={{ padding:'80px 40px', position:'relative', zIndex:1 }}>
        <div style={{ maxWidth:1000, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:52 }}>
            <h2 style={{ fontFamily:'Syne,sans-serif', fontSize:'clamp(28px,3.5vw,44px)', fontWeight:800, letterSpacing:'-1px' }}>
              Trusted by Developers
            </h2>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:20 }}>
            {[
              { quote:"Dropped it into our .NET 8 app in 20 minutes. The device fingerprinting data we get is incredible for fraud detection.", author:"Marcus Chen", role:"CTO @ FintechCo", stars:5 },
              { quote:"The Mobile QR plugin's real-time GPS stream during verification caught three fraudulent account creations in the first week.", author:"Sarah Mitchell", role:"Security Lead @ SecureApp", stars:5 },
              { quote:"License renewal popup is seamless. No manual enforcement. When I forgot to renew, the popup handled everything automatically.", author:"David Park", role:"Solo Developer", stars:5 },
            ].map((t,i) => (
              <div key={i} style={{
                background:'#0a0f1e', border:'1px solid #162040', borderRadius:18, padding:28,
              }}>
                <div style={{ marginBottom:14 }}>{'⭐'.repeat(t.stars)}</div>
                <p style={{ fontSize:14, color:'#a0aabf', lineHeight:1.7, marginBottom:20 }}>"{t.quote}"</p>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ width:36, height:36, borderRadius:'50%',
                    background:'linear-gradient(135deg,#4F8FFF,#B06AFF)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:16, fontWeight:800, fontFamily:'Syne,sans-serif' }}>
                    {t.author[0]}
                  </div>
                  <div>
                    <div style={{ fontWeight:700, fontSize:14 }}>{t.author}</div>
                    <div style={{ color:'#5A6A8A', fontSize:12 }}>{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────────────────── */}
      <section style={{
        padding:'100px 40px', position:'relative', zIndex:1,
        textAlign:'center',
      }}>
        <div style={{ maxWidth:700, margin:'0 auto', position:'relative' }}>
          <div style={{
            position:'absolute', inset:-60,
            background:'radial-gradient(ellipse,rgba(79,143,255,.1),rgba(176,106,255,.06),transparent 70%)',
            pointerEvents:'none',
          }}/>
          <h2 style={{
            fontFamily:'Syne,sans-serif', fontSize:'clamp(36px,5vw,64px)',
            fontWeight:800, lineHeight:1.1, letterSpacing:'-2px', marginBottom:20,
          }}>
            Ready to know more<br/>about your users?
          </h2>
          <p style={{ color:'#5A6A8A', fontSize:18, marginBottom:40, lineHeight:1.6 }}>
            Get started in minutes. First 14 days free. No credit card required.
          </p>
          <div style={{ display:'flex', gap:14, justifyContent:'center' }}>
            <Link to="/register" style={{
              padding:'16px 40px', borderRadius:14, fontSize:17, fontWeight:800,
              background:'linear-gradient(135deg,#4F8FFF,#B06AFF)',
              color:'#fff', textDecoration:'none', fontFamily:'Syne,sans-serif',
              boxShadow:'0 0 60px rgba(79,143,255,.25)',
            }}>
              Get Your License Key →
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────── */}
      <footer style={{
        borderTop:'1px solid #162040', padding:'48px 40px',
        position:'relative', zIndex:1,
      }}>
        <div style={{ maxWidth:1100, margin:'0 auto', display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr', gap:40 }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
              <div style={{ width:32, height:32, borderRadius:8,
                background:'linear-gradient(135deg,#4F8FFF,#B06AFF)',
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>🔐</div>
              <span style={{ fontFamily:'Syne,sans-serif', fontSize:18, fontWeight:800 }}>
                Verify<span style={{ color:'#4F8FFF' }}>Hub</span>
              </span>
            </div>
            <p style={{ color:'#5A6A8A', fontSize:14, lineHeight:1.7, maxWidth:280 }}>
              Drop-in identity verification plugins for ASP.NET Core. Real-time device intelligence that streams to your secure dashboard.
            </p>
          </div>
          {[
            { title:'Product', links:['Email Plugin','Mobile QR Plugin','Pricing','Changelog'] },
            { title:'Developers', links:['Documentation','API Reference','Install Guide','GitHub'] },
            { title:'Company', links:['About','Blog','Privacy Policy','Terms of Service'] },
          ].map(col => (
            <div key={col.title}>
              <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, marginBottom:16, fontSize:14 }}>{col.title}</div>
              {col.links.map(l => (
                <a key={l} href="#" style={{ display:'block', color:'#5A6A8A', textDecoration:'none', fontSize:14, marginBottom:10, transition:'color .2s' }}
                onMouseEnter={e=>e.target.style.color='#F0F4FF'}
                onMouseLeave={e=>e.target.style.color='#5A6A8A'}
                >{l}</a>
              ))}
            </div>
          ))}
        </div>
        <div style={{ maxWidth:1100, margin:'32px auto 0', paddingTop:24,
          borderTop:'1px solid #162040', display:'flex', justifyContent:'space-between',
          alignItems:'center', color:'#5A6A8A', fontSize:13 }}>
          <span>© 2025 VerifyHub. All rights reserved.</span>
          <span>Made with precision for .NET developers</span>
        </div>
      </footer>
    </div>
  )
}
