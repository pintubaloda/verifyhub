import { useState } from 'react'

function CodeBlock({ code, lang = 'csharp' }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div style={{ position:'relative', marginBottom:24 }}>
      <div style={{
        background:'#050810', border:'1px solid #162040', borderRadius:12, overflow:'hidden',
      }}>
        <div style={{
          display:'flex', justifyContent:'space-between', alignItems:'center',
          padding:'10px 16px', borderBottom:'1px solid #162040', background:'#0a0f1e',
        }}>
          <span style={{ fontSize:12, color:'#5A6A8A', fontWeight:600, fontFamily:'JetBrains Mono,monospace' }}>{lang}</span>
          <button onClick={copy} style={{
            background: copied ? 'rgba(0,229,200,.1)' : '#162040',
            border:`1px solid ${copied ? '#00E5C8' : '#2a3f5e'}`,
            color: copied ? '#00E5C8' : '#5A6A8A',
            padding:'4px 12px', borderRadius:8, fontSize:12, cursor:'pointer',
            fontFamily:'DM Sans,sans-serif',
          }}>{copied ? '✓ Copied' : 'Copy'}</button>
        </div>
        <pre style={{
          padding:'20px', margin:0, fontSize:13, lineHeight:1.7,
          fontFamily:'JetBrains Mono,monospace', color:'#a0aabf',
          overflowX:'auto', whiteSpace:'pre',
        }}>{code}</pre>
      </div>
    </div>
  )
}

function StepCard({ num, title, children }) {
  return (
    <div style={{
      background:'#0a0f1e', border:'1px solid #162040', borderRadius:16,
      padding:28, marginBottom:20, position:'relative', overflow:'hidden',
    }}>
      <div style={{
        position:'absolute', top:-16, right:-16, width:80, height:80,
        background:'linear-gradient(135deg,rgba(79,143,255,.06),transparent)',
        borderRadius:'50%',
      }}/>
      <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:16 }}>
        <div style={{
          width:36, height:36, borderRadius:10, flexShrink:0,
          background:'linear-gradient(135deg,#4F8FFF,#B06AFF)',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontFamily:'Syne,sans-serif', fontSize:16, fontWeight:800, color:'#fff',
        }}>{num}</div>
        <h3 style={{ fontFamily:'Syne,sans-serif', fontSize:18, fontWeight:700 }}>{title}</h3>
      </div>
      {children}
    </div>
  )
}

export default function InstallGuidePage({ pluginType = 'email' }) {
  const [tab, setTab] = useState(pluginType)

  const emailCode = {
    programCs: `// Program.cs
using VerifyHub.EmailPlugin;

var builder = WebApplication.CreateBuilder(args);

// ✅ Register VerifyHub Email Plugin (one line)
builder.Services.AddEmailVerifyPlugin(builder.Configuration);

builder.Services.AddControllers();
var app = builder.Build();

// ✅ Mount all /magiclink/* routes (one line)
app.UseEmailVerifyPlugin();

app.MapControllers();
app.Run();`,

    appsettings: `// appsettings.json
{
  "EmailVerifyPlugin": {
    "LicenseKey": "EML-XXXX-XXXX-XXXX",
    "BaseDomain": "https://api.verifyhub.io",
    "CompanyName": "Your Company",
    "LogoUrl": "",
    "PrimaryColor": "#6366F1",
    "SupportEmail": "support@yourcompany.com",
    "TokenExpiryMinutes": 15,
    "Smtp": {
      "Host": "smtp.gmail.com",
      "Port": 587,
      "EnableSsl": true,
      "Username": "you@gmail.com",
      "Password": "your-app-password",
      "FromEmail": "noreply@yourcompany.com",
      "FromName": "Your Company"
    }
  }
}`,

    sendEmail: `// Send a verification email from anywhere in your app
app.MapPost("/verify", async (HttpContext ctx, EmailVerifyService svc) => {
    var email  = ctx.Request.Form["email"].ToString();
    var baseUrl = $"{ctx.Request.Scheme}://{ctx.Request.Host}";
    var (ok, error) = await svc.SendMagicLinkAsync(email, baseUrl);
    return ok ? Results.Ok(new { sent = true }) : Results.BadRequest(new { error });
});`,

    verifyCode: `// Check verification result after user confirms
app.MapPost("/confirm", (EmailVerifyService svc, string token, string code) => {
    var (ok, email, error) = svc.VerifyCode(token, code);
    if (ok) {
        // Issue your own session/JWT here
        return Results.Ok(new { verified = true, email });
    }
    return Results.BadRequest(new { error });
});`,
  }

  const mobileCode = {
    programCs: `// Program.cs
using VerifyHub.MobilePlugin;

var builder = WebApplication.CreateBuilder(args);

// ✅ Register VerifyHub Mobile QR Plugin (one line)
builder.Services.AddMobileQrPlugin(builder.Configuration);

builder.Services.AddControllers();
var app = builder.Build();

// ✅ Mount all /mobileverify/* routes + SignalR hub
app.UseMobileQrPlugin();
app.MapHub<MobileQrHub>("/mobilehub");

app.MapControllers();
app.Run();`,

    appsettings: `// appsettings.json
{
  "MobileQrPlugin": {
    "LicenseKey": "MOB-XXXX-XXXX-XXXX",
    "BaseDomain": "https://api.verifyhub.io",
    "CompanyName": "Your Company",
    "PrimaryColor": "#6366F1",
    "QrExpiryMinutes": 5,
    "TelemetryInterval": 5
  }
}`,

    displayQr: `// Embed the QR page in your flow
// Option A: Full page redirect
return Redirect("/mobileverify");

// Option B: Fetch session and show your own UI
app.MapPost("/start-verify", async (MobileQrService svc, HttpContext ctx) => {
    var ip = ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown";
    var session = svc.CreateSession(ip);
    var baseUrl = $"{ctx.Request.Scheme}://{ctx.Request.Host}";
    return Results.Ok(new {
        qrUrl   = $"{baseUrl}/mobileverify/scan/{session.QrToken}",
        session = session.SessionId,
    });
});`,

    checkStatus: `// Poll from your frontend to get verification result
app.MapGet("/verify-status/{id}", (MobileQrService svc, string id) => {
    var session = svc.GetBySession(id);
    if (session == null) return Results.NotFound();
    return Results.Ok(new {
        status  = session.Status,  // pending | scanned | verified
        phone   = session.PhoneNumber,
        email   = session.Email,
    });
});`,
  }

  const routes = tab === 'email' ? [
    ['GET',  '/magiclink/verify', 'Verification page (users land here after clicking email link)'],
    ['GET',  '/magiclink/license-status', 'License validity check (called by JS to show renewal popup)'],
    ['POST', '/magiclink/send', 'Send magic link email { email: string }'],
    ['POST', '/magiclink/api/click', 'Handle token click → returns code { token }'],
    ['POST', '/magiclink/api/confirm', 'Verify 6-digit code { token, code }'],
    ['POST', '/magiclink/api/fingerprint', 'Receive + forward device fingerprint data'],
  ] : [
    ['GET',  '/mobileverify', 'Desktop QR code display page'],
    ['GET',  '/mobileverify/scan/{token}', 'Mobile scan landing page'],
    ['GET',  '/mobileverify/license-status', 'License validity check for renewal popup'],
    ['POST', '/mobileverify/create', 'Create new QR session'],
    ['GET',  '/mobileverify/status/{sessionId}', 'Poll session status'],
    ['POST', '/mobileverify/api/scan', 'Mobile registers QR scan'],
    ['POST', '/mobileverify/api/telemetry', 'Mobile pushes device snapshot every 5s'],
    ['POST', '/mobileverify/api/verify', 'Mobile confirms phone number → marks verified'],
  ]

  return (
    <div style={{ minHeight:'100vh', background:'#050810', padding:'80px 40px' }}>
      <div style={{ maxWidth:860, margin:'0 auto' }}>
        <div style={{ marginBottom:48 }}>
          <div style={{
            display:'inline-flex', alignItems:'center', gap:8, marginBottom:16,
            padding:'5px 16px', borderRadius:30,
            background:'rgba(0,229,200,.06)', border:'1px solid rgba(0,229,200,.15)',
            fontSize:12, fontWeight:700, color:'#00E5C8',
          }}>📦 INSTALL GUIDE</div>
          <h1 style={{
            fontFamily:'Syne,sans-serif', fontSize:'clamp(32px,5vw,54px)',
            fontWeight:800, letterSpacing:'-1.5px', marginBottom:14,
          }}>Get Running in 5 Minutes</h1>
          <p style={{ color:'#5A6A8A', fontSize:18, lineHeight:1.7 }}>
            Single .cs file. Two lines of code. License key. That's it.
          </p>
        </div>

        {/* Plugin selector */}
        <div style={{
          display:'flex', background:'#0a0f1e', borderRadius:12,
          border:'1px solid #162040', padding:5, gap:4, marginBottom:40, width:'fit-content',
        }}>
          {[['email','✉ Email Plugin'],['mobile','📱 Mobile QR Plugin']].map(([id,label]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              padding:'10px 24px', borderRadius:9, border:'none', cursor:'pointer',
              background: tab === id ? 'linear-gradient(135deg,#4F8FFF,#B06AFF)' : 'transparent',
              color: tab === id ? '#fff' : '#5A6A8A',
              fontSize:14, fontWeight:700, fontFamily:'Syne,sans-serif', transition:'all .2s',
            }}>{label}</button>
          ))}
        </div>

        {/* Steps */}
        <StepCard num="1" title="Copy the plugin file">
          <p style={{ color:'#5A6A8A', fontSize:14, lineHeight:1.7, marginBottom:16 }}>
            Copy the single <code style={{ background:'#162040', padding:'2px 8px', borderRadius:6, fontFamily:'JetBrains Mono,monospace', fontSize:13, color:'#4F8FFF' }}>
              {tab === 'email' ? 'EmailVerifyPlugin.cs' : 'MobileQrPlugin.cs'}
            </code> file into your ASP.NET Core project directory.
            {tab === 'mobile' && ' Also ensure you have the SignalR package installed.'}
          </p>
          {tab === 'mobile' && (
            <CodeBlock lang="bash" code={`dotnet add package Microsoft.AspNetCore.SignalR`} />
          )}
        </StepCard>

        <StepCard num="2" title="Register in Program.cs">
          <p style={{ color:'#5A6A8A', fontSize:14, marginBottom:16, lineHeight:1.6 }}>
            Two lines. One registers the services, one mounts the routes.
          </p>
          <CodeBlock lang="csharp" code={tab === 'email' ? emailCode.programCs : mobileCode.programCs} />
        </StepCard>

        <StepCard num="3" title="Add your license key to appsettings.json">
          <p style={{ color:'#5A6A8A', fontSize:14, marginBottom:16, lineHeight:1.6 }}>
            Copy your license key from the{' '}
            <a href="/dashboard" style={{ color:'#4F8FFF', textDecoration:'none', fontWeight:600 }}>dashboard</a>
            {tab === 'email' ? ' and add your SMTP settings.' : '.'}
          </p>
          <CodeBlock lang="json" code={tab === 'email' ? emailCode.appsettings : mobileCode.appsettings} />
        </StepCard>

        <StepCard num="4" title="Use in your app">
          <p style={{ color:'#5A6A8A', fontSize:14, marginBottom:16, lineHeight:1.6 }}>
            {tab === 'email'
              ? 'Send magic links and verify codes by injecting EmailVerifyService.'
              : 'Create QR sessions and check results by injecting MobileQrService.'}
          </p>
          <CodeBlock lang="csharp" code={tab === 'email' ? emailCode.sendEmail : mobileCode.displayQr} />
          <CodeBlock lang="csharp" code={tab === 'email' ? emailCode.verifyCode : mobileCode.checkStatus} />
        </StepCard>

        {/* Auto-created routes */}
        <div style={{
          background:'#0a0f1e', border:'1px solid #162040', borderRadius:16, padding:28, marginBottom:32,
        }}>
          <h3 style={{ fontFamily:'Syne,sans-serif', fontSize:17, fontWeight:700, marginBottom:20 }}>
            🗺️ Routes Auto-Created on Startup
          </h3>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  {['Method','Route','Description'].map(h => (
                    <th key={h} style={{
                      padding:'10px 14px', textAlign:'left', fontSize:11, fontWeight:700,
                      color:'#5A6A8A', textTransform:'uppercase', letterSpacing:'.8px',
                      borderBottom:'1px solid #162040', background:'#050810',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {routes.map(([method, route, desc]) => (
                  <tr key={route}>
                    <td style={{ padding:'11px 14px', borderBottom:'1px solid rgba(22,32,64,.6)' }}>
                      <span style={{
                        background: method === 'GET' ? 'rgba(0,229,200,.08)' : 'rgba(79,143,255,.08)',
                        color: method === 'GET' ? '#00E5C8' : '#4F8FFF',
                        border: `1px solid ${method === 'GET' ? 'rgba(0,229,200,.2)' : 'rgba(79,143,255,.2)'}`,
                        padding:'2px 10px', borderRadius:8, fontSize:11, fontWeight:700,
                        fontFamily:'JetBrains Mono,monospace',
                      }}>{method}</span>
                    </td>
                    <td style={{
                      padding:'11px 14px', borderBottom:'1px solid rgba(22,32,64,.6)',
                      fontFamily:'JetBrains Mono,monospace', fontSize:13, color:'#B06AFF',
                    }}>{route}</td>
                    <td style={{
                      padding:'11px 14px', borderBottom:'1px solid rgba(22,32,64,.6)',
                      fontSize:13, color:'#5A6A8A',
                    }}>{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Telemetry flow */}
        <div style={{
          background:'linear-gradient(135deg,rgba(79,143,255,.06),rgba(176,106,255,.04))',
          border:'1px solid rgba(79,143,255,.2)',
          borderRadius:16, padding:28, marginBottom:32,
        }}>
          <h3 style={{ fontFamily:'Syne,sans-serif', fontSize:17, fontWeight:700, marginBottom:12 }}>
            📡 Telemetry Routing Explained
          </h3>
          <p style={{ color:'#a0aabf', fontSize:14, lineHeight:1.7, marginBottom:16 }}>
            All device data is forwarded to <strong style={{ color:'#F0F4FF' }}>VerifyHub's servers</strong>, not stored on your server.
            Your server acts only as a relay — user device data streams straight to the VerifyHub base domain.
          </p>
          <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:12, color:'#5A6A8A', lineHeight:2 }}>
            <span style={{ color:'#4F8FFF' }}>End-user browser</span>
            {' → '}
            <span style={{ color:'#B06AFF' }}>Customer server (relay)</span>
            {' → '}
            <span style={{ color:'#00E5C8' }}>api.verifyhub.io/api/telemetry/push</span>
            <br/>
            <span style={{ color:'#F0F4FF' }}>GPS, canvas, WebGL, battery, network, sensors...</span>
            <br/>
            <span style={{ color:'#00C896' }}>→ Stored securely in VerifyHub database</span>
            <br/>
            <span style={{ color:'#FFB300' }}>→ Visible in your /dashboard/telemetry</span>
          </div>
        </div>

        {/* Renewal popup */}
        <div style={{
          background:'rgba(255,77,106,.04)', border:'1px solid rgba(255,77,106,.15)',
          borderRadius:16, padding:28,
        }}>
          <h3 style={{ fontFamily:'Syne,sans-serif', fontSize:17, fontWeight:700, marginBottom:12, color:'#FF4D6A' }}>
            ⚠️ License Expiry — Zero Maintenance Needed
          </h3>
          <p style={{ color:'#a0aabf', fontSize:14, lineHeight:1.7 }}>
            When your license expires, the plugin automatically shows a renewal popup to end-users.
            No code changes needed. The plugin polls <code style={{ background:'#162040', padding:'1px 8px', borderRadius:6, fontFamily:'JetBrains Mono,monospace', fontSize:12, color:'#FF4D6A' }}>/magiclink/license-status</code> every page load.
            The popup links directly to your VerifyHub dashboard to renew.
          </p>
        </div>
      </div>
    </div>
  )
}
