import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { apiFetch } from '../utils/api'

export default function AuthPage({ mode }) {
  const [form, setForm] = useState({ name:'', email:'', password:'', company:'' })
  const [loading, setLoading] = useState(false)
  const nav = useNavigate()

  const S = (f) => (e) => setForm(p => ({ ...p, [f]: e.target.value }))

  const submit = async () => {
    setLoading(true)
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register'
      const body = mode === 'login'
        ? { email: form.email, password: form.password }
        : { name: form.name, email: form.email, password: form.password, company: form.company || null }

      const r = await apiFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const d = await r.json()
      if (!r.ok) { toast.error(d.error || 'Something went wrong.'); return }

      localStorage.setItem('vh_access', d.accessToken)
      localStorage.setItem('vh_refresh', d.refreshToken)
      localStorage.setItem('vh_user', JSON.stringify(d.user))
      toast.success(mode === 'login' ? 'Welcome back!' : 'Account created!')
      if (!d.user?.emailVerified || !d.user?.mobileVerified || !d.user?.verificationCompletedAt) {
        toast('Complete email and mobile verification to continue.')
        nav('/dashboard?tab=verify-user')
      } else {
        nav('/dashboard')
      }
    } catch { toast.error('Network error.') }
    finally { setLoading(false) }
  }

  return (
    <div style={{
      minHeight:'100vh', background:'#050810', display:'flex', alignItems:'center',
      justifyContent:'center', padding:20, position:'relative',
    }}>
      {/* Background glow */}
      <div style={{ position:'fixed', top:'20%', left:'50%', transform:'translateX(-50%)',
        width:600, height:600,
        background:'radial-gradient(circle,rgba(79,143,255,.08),transparent 70%)',
        pointerEvents:'none' }}/>

      <div style={{ width:'100%', maxWidth:440, position:'relative' }}>
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:36 }}>
          <Link to="/" style={{
            display:'inline-flex', alignItems:'center', gap:10, textDecoration:'none',
          }}>
            <div style={{ width:40, height:40, borderRadius:11,
              background:'linear-gradient(135deg,#4F8FFF,#B06AFF)',
              display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>🔐</div>
            <span style={{ fontFamily:'Syne,sans-serif', fontSize:22, fontWeight:800, color:'#F0F4FF' }}>
              Verify<span style={{ color:'#4F8FFF' }}>Hub</span>
            </span>
          </Link>
        </div>

        {/* Card */}
        <div style={{
          background:'#0a0f1e', border:'1px solid #162040', borderRadius:20, padding:40, position:'relative',
        }}>
          <div style={{ position:'absolute', top:-1, left:'20%', right:'20%', height:2,
            background:'linear-gradient(90deg,transparent,#4F8FFF,transparent)' }}/>

          <h1 style={{ fontFamily:'Syne,sans-serif', fontSize:26, fontWeight:800, marginBottom:6, textAlign:'center' }}>
            {mode === 'login' ? 'Welcome back' : 'Create account'}
          </h1>
          <p style={{ color:'#5A6A8A', fontSize:14, textAlign:'center', marginBottom:32 }}>
            {mode === 'login'
              ? 'Sign in to your VerifyHub dashboard'
              : 'Start your 14-day free trial. No card needed.'}
          </p>

          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {mode === 'register' && (
              <Field label="Full name" value={form.name} onChange={S('name')} placeholder="Jane Smith" />
            )}
            <Field label="Email address" value={form.email} onChange={S('email')} type="email" placeholder="you@yourcompany.com" />
            <Field label="Password" value={form.password} onChange={S('password')} type="password" placeholder="••••••••" />
            {mode === 'register' && (
              <Field label="Company (optional)" value={form.company} onChange={S('company')} placeholder="Acme Corp" />
            )}
          </div>

          <button onClick={submit} disabled={loading} style={{
            width:'100%', marginTop:24, padding:14,
            background: loading ? '#1a2640' : 'linear-gradient(135deg,#4F8FFF,#B06AFF)',
            border:'none', borderRadius:12, color:'#fff', fontSize:16, fontWeight:700,
            cursor: loading ? 'not-allowed' : 'pointer', fontFamily:'Syne,sans-serif',
            transition:'opacity .2s',
          }}>
            {loading ? '...' : mode === 'login' ? 'Sign In →' : 'Create Account →'}
          </button>

          <p style={{ textAlign:'center', marginTop:20, color:'#5A6A8A', fontSize:14 }}>
            {mode === 'login'
              ? <>Don't have an account? <Link to="/register" style={{ color:'#4F8FFF', fontWeight:600, textDecoration:'none' }}>Sign up free</Link></>
              : <>Already have an account? <Link to="/login" style={{ color:'#4F8FFF', fontWeight:600, textDecoration:'none' }}>Log in</Link></>
            }
          </p>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, type='text', placeholder }) {
  return (
    <div>
      <label style={{ fontSize:12, fontWeight:600, color:'#5A6A8A', display:'block', marginBottom:7, textTransform:'uppercase', letterSpacing:'.6px' }}>
        {label}
      </label>
      <input
        type={type} value={value} onChange={onChange} placeholder={placeholder}
        style={{
          width:'100%', background:'#050810', border:'1px solid #162040',
          color:'#F0F4FF', padding:'12px 16px', borderRadius:10, fontSize:15,
          outline:'none', fontFamily:'DM Sans,sans-serif', transition:'border-color .2s',
        }}
        onFocus={e => e.target.style.borderColor='#4F8FFF'}
        onBlur={e => e.target.style.borderColor='#162040'}
      />
    </div>
  )
}
