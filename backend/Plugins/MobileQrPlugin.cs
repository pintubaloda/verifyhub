/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  VerifyHub — Mobile QR Verification Plugin  (Single-File Drop-In)
 *  
 *  Installation:
 *   1. Copy this file into your ASP.NET Core project
 *   2. Install Microsoft.AspNetCore.SignalR NuGet package
 *   3. Add to Program.cs:
 *       builder.Services.AddMobileQrPlugin(builder.Configuration);
 *       app.UseMobileQrPlugin();
 *       
 *   4. Add to appsettings.json:
 *       "MobileQrPlugin": {
 *         "LicenseKey": "MOB-XXXX-XXXX-XXXX",
 *         "BaseDomain": "https://api.verifyhub.io"
 *       }
 *
 *  All device telemetry is streamed to VerifyHub BASE DOMAIN, not your server.
 * ═══════════════════════════════════════════════════════════════════════════
 */

using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Configuration;

namespace VerifyHub.MobilePlugin
{
    // ── Options ────────────────────────────────────────────────────────────
    public class MobilePluginOptions
    {
        public const string Section = "MobileQrPlugin";
        public string LicenseKey        { get; set; } = string.Empty;
        public string BaseDomain        { get; set; } = "https://api.verifyhub.io";
        public string CompanyName       { get; set; } = "Your Company";
        public string PrimaryColor      { get; set; } = "#6366F1";
        public int    QrExpiryMinutes   { get; set; } = 5;
        public int    TelemetryInterval { get; set; } = 5;
    }

    // ── Session model ──────────────────────────────────────────────────────
    public class QrSession
    {
        public string   SessionId    { get; set; } = Guid.NewGuid().ToString("N");
        public string   QrToken      { get; set; } = string.Empty;
        public string?  PhoneNumber  { get; set; }
        public string?  Email        { get; set; }
        public string   Status       { get; set; } = "pending"; // pending|scanned|verified|expired
        public DateTime ExpiresAt    { get; set; }
        public bool     IsExpired    => DateTime.UtcNow > ExpiresAt;
        public string   DesktopIp    { get; set; } = string.Empty;
        public List<object> Snapshots { get; set; } = new();
    }

    // ── License state ──────────────────────────────────────────────────────
    public class MobilePluginState
    {
        public bool   IsValid    { get; set; }
        public string Status     { get; set; } = "Unknown";
        public int    DaysLeft   { get; set; }
        public string? Error     { get; set; }
        public string? PluginToken { get; set; }
    }

    // ── SignalR Hub ────────────────────────────────────────────────────────
    public class MobileQrHub : Hub
    {
        public async Task Join(string sessionId)  => await Groups.AddToGroupAsync(Context.ConnectionId, $"s:{sessionId}");
        public async Task Leave(string sessionId) => await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"s:{sessionId}");
    }

    // ── Core service ───────────────────────────────────────────────────────
    public class MobileQrService
    {
        private readonly MobilePluginOptions _opts;
        private readonly MobilePluginState _state = new();
        private readonly ConcurrentDictionary<string, QrSession> _byToken = new();
        private readonly ConcurrentDictionary<string, QrSession> _byId    = new();
        private static readonly HttpClient _http = new() { Timeout = TimeSpan.FromSeconds(10) };
        private readonly ILogger _log;

        public MobileQrService(IOptions<MobilePluginOptions> opts, ILogger<MobileQrService> log)
        { _opts = opts.Value; _log = log; }

        public MobilePluginState State => _state;

        public async Task InitAsync(string domain)
        {
            try
            {
                var body = JsonSerializer.Serialize(new
                { licenseKey = _opts.LicenseKey, domain, pluginVersion = "1.0.0", serverInfo = Environment.MachineName });
                var r = await _http.PostAsync($"{_opts.BaseDomain}/api/plugin/activate",
                    new StringContent(body, Encoding.UTF8, "application/json"));
                var d = JsonDocument.Parse(await r.Content.ReadAsStringAsync()).RootElement;
                _state.IsValid = r.IsSuccessStatusCode;
                _state.PluginToken = d.TryGetProperty("pluginToken", out var t) ? t.GetString() : null;
                if (!_state.IsValid) _state.Error = d.TryGetProperty("error", out var e) ? e.GetString() : "Activation failed.";
                _log.LogInformation("MobileQrPlugin init: valid={V}", _state.IsValid);
            }
            catch (Exception ex) { _state.Error = ex.Message; _log.LogError(ex, "MobileQrPlugin init error"); }
        }

        public QrSession CreateSession(string desktopIp)
        {
            var s = new QrSession
            {
                QrToken   = GenerateToken(),
                DesktopIp = desktopIp,
                ExpiresAt = DateTime.UtcNow.AddMinutes(_opts.QrExpiryMinutes),
            };
            _byToken[s.QrToken] = s; _byId[s.SessionId] = s;
            return s;
        }

        public QrSession? GetByToken(string t)    { _byToken.TryGetValue(t, out var s); return s; }
        public QrSession? GetBySession(string id) { _byId.TryGetValue(id, out var s); return s; }

        public bool Scan(string token, out QrSession? session)
        {
            session = GetByToken(token);
            if (session == null || session.IsExpired) return false;
            session.Status = "scanned"; _byToken[token] = session; _byId[session.SessionId] = session;
            return true;
        }

        public async Task<bool> ProcessSnapshotAsync(string token, JsonElement snap, HttpContext ctx)
        {
            var s = GetByToken(token); if (s == null || s.IsExpired) return false;
            var ip = ctx.Request.Headers["X-Forwarded-For"].FirstOrDefault()?.Split(',')[0].Trim()
                  ?? ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown";
            s.Snapshots.Add(snap);
            _byToken[token] = s; _byId[s.SessionId] = s;

            // Forward to VerifyHub base domain asynchronously
            _ = Task.Run(async () => await ForwardTelemetryAsync(s.SessionId, snap, ip));
            return true;
        }

        public bool Verify(string token, string? phone, string? email)
        {
            var s = GetByToken(token); if (s == null || s.IsExpired) return false;
            s.Status = "verified"; s.PhoneNumber = phone; s.Email = email;
            _byToken[token] = s; _byId[s.SessionId] = s;
            return true;
        }

        private async Task ForwardTelemetryAsync(string sessionId, JsonElement snap, string ip)
        {
            if (!_state.IsValid || string.IsNullOrEmpty(_state.PluginToken)) return;
            try
            {
                var snapWithIp = JsonSerializer.Serialize(new
                {
                    ipAddress  = ip,
                    snapshot   = snap,
                    channel    = "mobile",
                    sessionId,
                });
                var req = new HttpRequestMessage(HttpMethod.Post, $"{_opts.BaseDomain}/api/telemetry/push")
                {
                    Content = new StringContent(JsonSerializer.Serialize(new
                    {
                        licenseKey   = _opts.LicenseKey,
                        sessionId,
                        channel      = "mobile",
                        snapshotJson = snap.GetRawText(),
                    }), Encoding.UTF8, "application/json")
                };
                req.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _state.PluginToken);
                await _http.SendAsync(req);
            }
            catch (Exception ex) { _log.LogWarning("Telemetry forward error: {Msg}", ex.Message); }
        }

        private static string GenerateToken() =>
            Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
                .Replace("+", "-").Replace("/", "_").Replace("=", "");
    }

    // ── Extension methods ─────────────────────────────────────────────────
    public static class MobilePluginExtensions
    {
        public static IServiceCollection AddMobileQrPlugin(this IServiceCollection services, IConfiguration config)
        {
            services.Configure<MobilePluginOptions>(config.GetSection(MobilePluginOptions.Section));
            services.AddSingleton<MobileQrService>();
            services.AddSignalR();
            return services;
        }

        public static WebApplication UseMobileQrPlugin(this WebApplication app)
        {
            var opts    = app.Services.GetRequiredService<IOptions<MobilePluginOptions>>().Value;
            var service = app.Services.GetRequiredService<MobileQrService>();

            // SignalR hub
            app.MapHub<MobileQrHub>("/mobilehub");

            // Init on startup
            app.Lifetime.ApplicationStarted.Register(async () =>
            {
                var dir = Path.Combine(app.Environment.WebRootPath ?? "wwwroot", "magiclink");
                if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);
                await service.InitAsync("unknown");
                _ = Task.Run(async () =>
                {
                    while (true) { await Task.Delay(TimeSpan.FromHours(1)); await service.InitAsync("unknown"); }
                });
            });

            // License status
            app.MapGet("/mobileverify/license-status", () =>
            {
                var s = service.State;
                return Results.Json(new { valid = s.IsValid, status = s.Status, daysLeft = s.DaysLeft, error = s.Error, renewUrl = $"{opts.BaseDomain.Replace("api.","")}/dashboard" });
            });

            // Desktop: create QR session
            app.MapPost("/mobileverify/create", (HttpContext ctx) =>
            {
                if (!service.State.IsValid) return Results.StatusCode(402);
                var ip = ctx.Request.Headers["X-Forwarded-For"].FirstOrDefault()?.Split(',')[0].Trim()
                      ?? ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown";
                var s = service.CreateSession(ip);
                var baseUrl = $"{ctx.Request.Scheme}://{ctx.Request.Host}";
                return Results.Ok(new { sessionId = s.SessionId, qrUrl = $"{baseUrl}/mobileverify/scan/{s.QrToken}", qrToken = s.QrToken, expirySeconds = opts.QrExpiryMinutes * 60 });
            });

            // Desktop: get status
            app.MapGet("/mobileverify/status/{sessionId}", (string sessionId) =>
            {
                var s = service.GetBySession(sessionId);
                if (s == null) return Results.NotFound();
                return Results.Ok(new { status = s.Status, phone = s.PhoneNumber, email = s.Email, snapshotCount = s.Snapshots.Count });
            });

            // Desktop: show QR page
            app.MapGet("/mobileverify", async (HttpContext ctx) =>
            {
                ctx.Response.ContentType = "text/html";
                await ctx.Response.WriteAsync(GetDesktopPage(opts));
            });

            // Mobile: scan landing page (user opens link from phone)
            app.MapGet("/mobileverify/scan/{token}", async (string token, HttpContext ctx) =>
            {
                ctx.Response.ContentType = "text/html";
                await ctx.Response.WriteAsync(GetMobilePage(opts, token));
            });

            // Mobile API: register scan
            app.MapPost("/mobileverify/api/scan", (HttpContext ctx, [FromBody] JsonElement body) =>
            {
                var token = body.TryGetProperty("qrToken", out var t) ? t.GetString() ?? "" : "";
                if (!service.Scan(token, out var session)) return Results.BadRequest(new { error = "QR invalid or expired." });
                // Notify desktop via SignalR
                var hub = ctx.RequestServices.GetRequiredService<IHubContext<MobileQrHub>>();
                _ = hub.Clients.Group($"s:{session!.SessionId}").SendAsync("Scanned", new { ua = ctx.Request.Headers["User-Agent"].FirstOrDefault() });
                return Results.Ok(new { sessionId = session.SessionId, expiresAt = session.ExpiresAt });
            });

            // Mobile API: telemetry push
            app.MapPost("/mobileverify/api/telemetry", async (HttpContext ctx, [FromBody] JsonElement body) =>
            {
                var token = body.TryGetProperty("qrToken", out var t) ? t.GetString() ?? "" : "";
                var ok = await service.ProcessSnapshotAsync(token, body, ctx);
                if (!ok) return Results.NotFound();
                var session = service.GetByToken(token);
                if (session != null)
                {
                    var hub = ctx.RequestServices.GetRequiredService<IHubContext<MobileQrHub>>();
                    await hub.Clients.Group($"s:{session.SessionId}").SendAsync("Snapshot", body);
                }
                return Results.Ok(new { ok = true });
            });

            // Mobile API: verify confirmation
            app.MapPost("/mobileverify/api/verify", (HttpContext ctx, [FromBody] JsonElement body) =>
            {
                var token = body.TryGetProperty("qrToken", out var t) ? t.GetString() ?? "" : "";
                var phone = body.TryGetProperty("phoneNumber", out var p) ? p.GetString() : null;
                var email = body.TryGetProperty("email", out var e) ? e.GetString() : null;
                if (!service.Verify(token, phone, email)) return Results.BadRequest(new { error = "Session invalid." });
                var session = service.GetByToken(token);
                if (session != null)
                {
                    var hub = ctx.RequestServices.GetRequiredService<IHubContext<MobileQrHub>>();
                    _ = hub.Clients.Group($"s:{session.SessionId}").SendAsync("Verified", new { phone, email, at = DateTime.UtcNow });
                }
                return Results.Ok(new { verified = true });
            });

            return app;
        }

        private static string GetDesktopPage(MobilePluginOptions opts) => $$$"""
<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Mobile QR Verification</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/microsoft-signalr/7.0.5/signalr.min.js"></script>
<style>
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0} body{font-family:'Outfit',sans-serif;background:#07090f;color:#f1f5f9;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.card{background:#0e1320;border:1px solid #1e2d4a;border-radius:20px;padding:40px;max-width:440px;width:100%;text-align:center;position:relative}
.card::before{content:'';position:absolute;top:-1px;left:20%;right:20%;height:2px;background:linear-gradient(90deg,transparent,{{opts.PrimaryColor}},transparent)}
h2{font-size:22px;font-weight:700;margin-bottom:8px} .sub{color:#64748b;font-size:14px;margin-bottom:28px}
.qr-wrap{display:inline-block;background:#fff;border-radius:16px;padding:14px;position:relative;box-shadow:0 0 0 2px rgba(99,102,241,.2)}
.qr-corner{position:absolute;width:16px;height:16px;border-color:{{opts.PrimaryColor}};border-style:solid}
.tl{top:-2px;left:-2px;border-width:3px 0 0 3px;border-radius:3px 0 0 0}
.tr{top:-2px;right:-2px;border-width:3px 3px 0 0;border-radius:0 3px 0 0}
.bl{bottom:-2px;left:-2px;border-width:0 0 3px 3px;border-radius:0 0 0 3px}
.br{bottom:-2px;right:-2px;border-width:0 3px 3px 0;border-radius:0 0 3px 0}
.status{display:inline-flex;align-items:center;gap:8px;padding:8px 16px;border-radius:20px;border:1px solid #1e2d4a;font-size:13px;font-weight:600;margin-top:20px;color:#64748b}
.dot{width:7px;height:7px;border-radius:50%;background:#64748b;animation:pulse 2s infinite}
.status.scanning{border-color:rgba(245,158,11,.4);color:#F59E0B} .status.scanning .dot{background:#F59E0B}
.status.verified{border-color:rgba(16,185,129,.4);color:#10B981} .status.verified .dot{background:#10B981}
.timer{font-size:13px;color:#64748b;margin-top:12px;font-family:monospace}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
.verified-box{background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.2);border-radius:14px;padding:20px;margin-top:20px;display:none}
.verified-box.show{display:block} .verified-box h3{color:#10B981;font-size:18px;margin-bottom:6px}
.phone-big{font-size:28px;font-weight:800;font-family:monospace;margin-top:8px}
.expired-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:999;align-items:center;justify-content:center}
.expired-overlay.show{display:flex}
.expired-card{background:#0e1320;border:1px solid rgba(239,68,68,.3);border-radius:20px;padding:36px;max-width:360px;text-align:center}
.expired-card h2{color:#ef4444;margin-bottom:10px} .expired-card p{color:#94a3b8;font-size:14px;margin-bottom:20px;line-height:1.6}
.expired-card a{padding:12px 24px;background:#ef4444;color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:14px}
.btn{padding:11px 22px;background:#1e2d4a;border:1px solid #2a3f5e;color:#94a3b8;border-radius:10px;font-size:13px;cursor:pointer;font-family:'Outfit',sans-serif;margin-top:14px}
.btn:hover{border-color:{{opts.PrimaryColor}};color:#f1f5f9}
</style>
</head><body>
<div class="card">
  <div style="font-size:36px;margin-bottom:12px">📱</div>
  <h2>Scan to Verify</h2>
  <p class="sub">Scan this QR code with your phone camera to begin mobile verification</p>
  <div id="qr-loading" style="padding:40px;color:#64748b;font-size:14px">Generating QR code…</div>
  <div id="qr-ready" style="display:none">
    <div class="qr-wrap" id="qr-wrap">
      <div class="qr-corner tl"></div><div class="qr-corner tr"></div>
      <div class="qr-corner bl"></div><div class="qr-corner br"></div>
      <div id="qr-code"></div>
    </div>
    <div class="status" id="status-pill"><div class="dot"></div><span id="status-txt">Waiting for scan…</span></div>
    <div class="timer" id="timer">⏱ <span id="timer-val">5:00</span></div>
    <button class="btn" onclick="initQr()">↻ New QR Code</button>
    <div class="verified-box" id="verified-box">
      <h3>✅ Mobile Verified!</h3>
      <div style="color:#64748b;font-size:13px">Phone number confirmed</div>
      <div class="phone-big" id="verified-phone">—</div>
    </div>
  </div>
</div>
<div class="expired-overlay" id="expired-overlay">
  <div class="expired-card"><div style="font-size:48px;margin-bottom:14px">⚠️</div><h2>License Expired</h2><p>The mobile QR verification license has expired.</p><a id="renew-link" href="#">Renew License →</a></div>
</div>
<script>
let sessionData = null; let signalRConn = null; let qrTimer = null;
(async()=>{const r=await fetch('/mobileverify/license-status');const d=await r.json();if(!d.valid){document.getElementById('expired-overlay').classList.add('show');document.getElementById('renew-link').href=d.renewUrl||'#';}else{await initQr();}})();
async function initQr(){
  document.getElementById('qr-code').innerHTML=''; document.getElementById('qr-loading').style.display='block'; document.getElementById('qr-ready').style.display='none';
  const r=await fetch('/mobileverify/create',{method:'POST'});
  if(r.status===402){document.getElementById('expired-overlay').classList.add('show');return;}
  sessionData=await r.json();
  new QRCode(document.getElementById('qr-code'),{text:sessionData.qrUrl,width:200,height:200,colorDark:'#000',colorLight:'#fff',correctLevel:QRCode.CorrectLevel.H});
  document.getElementById('qr-loading').style.display='none';
  document.getElementById('qr-ready').style.display='block';
  setStatus('','Waiting for scan…');
  startTimer(sessionData.expirySeconds);
  await connectSignalR(sessionData.sessionId);
}
async function connectSignalR(sid){
  if(signalRConn){try{await signalRConn.stop();}catch{}}
  signalRConn=new signalR.HubConnectionBuilder().withUrl('/mobilehub').withAutomaticReconnect().build();
  signalRConn.on('Scanned',()=>{setStatus('scanning','📱 Mobile connected!');});
  signalRConn.on('Snapshot',s=>{setStatus('scanning','📡 Receiving data…');});
  signalRConn.on('Verified',d=>{setStatus('verified','✅ Verified!');const vb=document.getElementById('verified-box');vb.classList.add('show');document.getElementById('verified-phone').textContent=d.phone||'—';});
  signalRConn.on('SessionExpired',()=>setStatus('','⌛ Expired'));
  await signalRConn.start(); await signalRConn.invoke('Join',sid);
}
function setStatus(cls,txt){const p=document.getElementById('status-pill');p.className='status '+cls;document.getElementById('status-txt').textContent=txt;}
function startTimer(sec){clearInterval(qrTimer);const el=document.getElementById('timer-val');qrTimer=setInterval(()=>{sec--;if(sec<=0){clearInterval(qrTimer);el.textContent='Expired';return;}el.textContent=`${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;},1000);}
</script></body></html>
""";

        private static string GetMobilePage(MobilePluginOptions opts, string token) => $$$"""
<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><meta name="theme-color" content="#07090f">
<title>Mobile Verification — {{opts.CompanyName}}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&display=swap');
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent} body{font-family:'Outfit',sans-serif;background:#07090f;color:#f1f5f9;min-height:100vh}
.page{max-width:400px;margin:0 auto;padding:20px 20px 40px}
.header{display:flex;align-items:center;gap:10px;padding:20px 0 28px}
.logo{width:36px;height:36px;background:linear-gradient(135deg,{{opts.PrimaryColor}},#8B5CF6);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px}
.brand{font-size:17px;font-weight:700}
.screen{display:none} .screen.active{display:flex;flex-direction:column}
.hero{background:linear-gradient(135deg,rgba(99,102,241,.12),rgba(139,92,246,.08));border:1px solid #1e2d4a;border-radius:20px;height:140px;display:flex;align-items:center;justify-content:center;font-size:60px;margin-bottom:24px;position:relative;overflow:hidden}
.hero::after{content:'';position:absolute;inset:0;background:linear-gradient(135deg,transparent 40%,rgba(99,102,241,.08))}
h2{font-size:24px;font-weight:700;margin-bottom:8px} .sub{font-size:14px;color:#64748b;margin-bottom:24px;line-height:1.7}
.perm-list{margin-bottom:24px} .perm-item{display:flex;align-items:center;gap:14px;padding:13px 16px;border-radius:12px;border:1px solid #1e2d4a;background:#0e1320;margin-bottom:10px}
.perm-icon{font-size:20px;width:34px;text-align:center;flex-shrink:0} .perm-info{flex:1} .perm-info strong{display:block;font-size:14px;margin-bottom:2px} .perm-info span{font-size:12px;color:#64748b}
.perm-status{font-size:11px;font-weight:600;color:#64748b} .perm-status.ok{color:#10B981}
.phone-input{width:100%;background:#0e1320;border:1px solid #1e2d4a;color:#f1f5f9;padding:14px 16px;border-radius:12px;font-size:18px;font-family:monospace;font-weight:700;outline:none;margin-bottom:20px;transition:border-color .2s}
.phone-input:focus{border-color:{{opts.PrimaryColor}}}
.cta{width:100%;padding:16px;background:linear-gradient(135deg,{{opts.PrimaryColor}},#8B5CF6);border:none;border-radius:14px;color:#fff;font-size:16px;font-weight:700;cursor:pointer;font-family:'Outfit',sans-serif;position:relative;overflow:hidden}
.cta::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,.15),transparent)}
.cta:active{transform:scale(.98)}
.live-card{background:#0e1320;border:1px solid #1e2d4a;border-radius:14px;overflow:hidden;margin-bottom:14px}
.live-head{padding:11px 16px;border-bottom:1px solid #1e2d4a;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.8px;display:flex;justify-content:space-between;align-items:center}
.live-badge{display:flex;align-items:center;gap:5px;font-size:10px;color:#10B981;font-weight:700}
.live-dot{width:5px;height:5px;border-radius:50%;background:#10B981;animation:p 1s infinite}
@keyframes p{0%,100%{opacity:1}50%{opacity:.3}}
.live-row{display:flex;justify-content:space-between;padding:9px 16px;border-bottom:1px solid rgba(30,45,74,.5);font-size:13px}
.live-row:last-child{border-bottom:none} .lbl{color:#64748b} .val{font-family:monospace;font-size:12px;color:#06B6D4;font-weight:700}
.spinner{width:40px;height:40px;border:3px solid #1e2d4a;border-top-color:{{opts.PrimaryColor}};border-radius:50%;animation:spin .8s linear infinite;margin:40px auto 16px}
@keyframes spin{to{transform:rotate(360deg)}}
</style>
</head><body>
<div class="page">
<div class="header"><div class="logo">🔐</div><div class="brand">{{opts.CompanyName}}</div></div>

<div class="screen" id="screen-loading">
  <div class="spinner"></div>
  <p style="text-align:center;color:#64748b;font-size:14px">Loading…</p>
</div>

<div class="screen" id="screen-consent">
  <div class="hero">📱</div>
  <h2>Mobile Verification</h2>
  <p class="sub">Verify your identity by confirming your phone number. We'll request a few permissions to verify your device.</p>
  <div class="perm-list">
    <div class="perm-item"><div class="perm-icon">📍</div><div class="perm-info"><strong>Location</strong><span>Precise GPS for location verification</span></div><div class="perm-status" id="perm-gps">Optional</div></div>
    <div class="perm-item"><div class="perm-icon">📡</div><div class="perm-info"><strong>Network</strong><span>Connection quality & type</span></div><div class="perm-status ok">Auto</div></div>
    <div class="perm-item"><div class="perm-icon">📱</div><div class="perm-info"><strong>Device Info</strong><span>Browser & OS fingerprint</span></div><div class="perm-status ok">Auto</div></div>
    <div class="perm-item"><div class="perm-icon">🔋</div><div class="perm-info"><strong>Battery</strong><span>Device charge status</span></div><div class="perm-status" id="perm-batt">Optional</div></div>
  </div>
  <input class="phone-input" id="phone-input" type="tel" placeholder="+1 (555) 000-0000" autocomplete="tel"/>
  <button class="cta" onclick="startVerification()">Begin Verification →</button>
</div>

<div class="screen" id="screen-active">
  <div class="live-card">
    <div class="live-head">Live Status <div class="live-badge"><div class="live-dot"></div>ACTIVE</div></div>
    <div class="live-row"><span class="lbl">GPS</span><span class="val" id="li-gps">Requesting…</span></div>
    <div class="live-row"><span class="lbl">Network</span><span class="val" id="li-net">—</span></div>
    <div class="live-row"><span class="lbl">Battery</span><span class="val" id="li-batt">—</span></div>
    <div class="live-row"><span class="lbl">Syncs sent</span><span class="val" id="li-sends">0</span></div>
  </div>
  <button class="cta" style="margin-top:10px" onclick="confirmVerification()">✅ Confirm & Verify</button>
</div>

<div class="screen" id="screen-success">
  <div style="text-align:center;padding:40px 0">
    <div style="font-size:64px;margin-bottom:16px">✅</div>
    <h2 style="color:#10B981;margin-bottom:8px">Verified!</h2>
    <p style="color:#64748b;font-size:14px">Your phone number has been verified successfully.</p>
  </div>
</div>

<div class="screen" id="screen-error">
  <div style="text-align:center;padding:40px 0">
    <div style="font-size:56px;margin-bottom:14px">❌</div>
    <h2 style="color:#ef4444;margin-bottom:8px" id="err-title">Error</h2>
    <p style="color:#64748b;font-size:14px" id="err-msg">Something went wrong.</p>
  </div>
</div>
</div>

<script>
const qrToken='{{token}}';
let gpsPos=null,battery=null,accel={},gyro={},sendCount=0,interval=null;

show('screen-loading');

(async()=>{
  const r=await fetch('/mobileverify/api/scan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({qrToken})});
  if(!r.ok){const d=await r.json();showError('Invalid QR Code',d.error||'QR invalid or expired.');return;}
  show('screen-consent');
  requestGps();
  try{battery=await navigator.getBattery?.();if(battery)document.getElementById('perm-batt').textContent='✅';}catch{}
  if(typeof DeviceMotionEvent!=='undefined'){window.addEventListener('devicemotion',e=>{const a=e.acceleration||{};accel={x:a.x??0,y:a.y??0,z:a.z??0};});window.addEventListener('deviceorientation',e=>{gyro={alpha:e.alpha,beta:e.beta,gamma:e.gamma};});}
})();

function requestGps(){
  navigator.geolocation?.watchPosition(pos=>{gpsPos=pos;document.getElementById('perm-gps').textContent='✅';document.getElementById('perm-gps').className='perm-status ok';},()=>{document.getElementById('perm-gps').textContent='Denied';},{enableHighAccuracy:true,maximumAge:0});
}

async function startVerification(){
  show('screen-active');
  interval=setInterval(()=>sendTelemetry(),{{opts.TelemetryInterval}}*1000);
  sendTelemetry();
}

async function sendTelemetry(){
  const conn=navigator.connection||{};
  const snap={
    qrToken,phoneNumber:document.getElementById('phone-input')?.value?.trim()||null,
    screenWidth:screen.width,screenHeight:screen.height,devicePixelRatio:window.devicePixelRatio||1,
    hardwareConcurrency:navigator.hardwareConcurrency||0,deviceMemoryGb:navigator.deviceMemory||0,
    maxTouchPoints:navigator.maxTouchPoints||0,
    batteryLevel:battery?.level??null,isCharging:battery?.charging??false,chargingStatus:battery?.charging?'charging':'discharging',
    accelX:accel.x??null,accelY:accel.y??null,accelZ:accel.z??null,
    gyroAlpha:gyro.alpha??null,gyroBeta:gyro.beta??null,gyroGamma:gyro.gamma??null,
    isMoving:accel.x!=null&&(Math.abs(accel.x)+Math.abs(accel.y)+Math.abs(accel.z))>1.5,
    networkEffectiveType:conn.effectiveType||'',networkDownlinkMbps:conn.downlink??null,networkRttMs:conn.rtt??null,networkType:conn.type||'',isOnline:navigator.onLine,
    language:navigator.language,languages:(navigator.languages||[]).join(','),platform:navigator.platform,
    timezoneClient:Intl.DateTimeFormat().resolvedOptions().timeZone,timezoneOffsetMin:new Date().getTimezoneOffset(),
    cookiesEnabled:navigator.cookieEnabled,doNotTrack:navigator.doNotTrack==='1',
    orientation:screen.orientation?.type||'',
    gpsLatitude:gpsPos?.coords.latitude??null,gpsLongitude:gpsPos?.coords.longitude??null,gpsAccuracyMeters:gpsPos?.coords.accuracy??null,gpsAltitude:gpsPos?.coords.altitude??null,gpsSpeed:gpsPos?.coords.speed??null,gpsHeading:gpsPos?.coords.heading??null,gpsPermission:gpsPos?'granted':'prompt',
  };
  try{const cv=document.createElement('canvas');cv.width=200;cv.height=40;const cx=cv.getContext('2d');cx.fillStyle='#f60';cx.fillRect(80,1,40,18);cx.fillStyle='#069';cx.font='14px Arial';cx.fillText('VerifyHub🔐',2,14);const h=await hashStr(cv.toDataURL());snap.canvasHash=h;}catch{}
  try{const gl=document.createElement('canvas').getContext('webgl');if(gl){const e=gl.getExtension('WEBGL_debug_renderer_info');if(e){snap.webGlRenderer=gl.getParameter(e.UNMASKED_RENDERER_WEBGL)||'';snap.webGlVendor=gl.getParameter(e.UNMASKED_VENDOR_WEBGL)||'';}}}catch{}
  if(gpsPos){document.getElementById('li-gps').textContent=`${gpsPos.coords.latitude.toFixed(5)}, ${gpsPos.coords.longitude.toFixed(5)}`;}
  document.getElementById('li-net').textContent=conn.effectiveType||conn.type||'—';
  if(battery)document.getElementById('li-batt').textContent=`${battery.charging?'⚡':'🔋'} ${(battery.level*100).toFixed(0)}%`;
  sendCount++;document.getElementById('li-sends').textContent=sendCount;
  await fetch('/mobileverify/api/telemetry',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(snap),keepalive:true});
}

async function confirmVerification(){
  const phone=document.getElementById('phone-input')?.value?.trim()||null;
  await sendTelemetry();
  clearInterval(interval);
  const r=await fetch('/mobileverify/api/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({qrToken,phoneNumber:phone,email:null})});
  if(r.ok)show('screen-success');else showError('Error','Verification failed. Please try again.');
}

function show(id){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));document.getElementById(id).classList.add('active');}
function showError(title,msg){document.getElementById('err-title').textContent=title;document.getElementById('err-msg').textContent=msg;show('screen-error');}
async function hashStr(s){try{const b=new TextEncoder().encode(s);const h=await crypto.subtle.digest('SHA-256',b);return Array.from(new Uint8Array(h)).map(x=>x.toString(16).padStart(2,'0')).join('').substring(0,16);}catch{return '';}}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&interval)sendTelemetry();});
</script>
</body></html>
""";
    }
}
