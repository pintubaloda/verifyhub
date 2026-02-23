/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  VerifyHub — Email Verification Plugin  (Single-File Drop-In)
 *  
 *  Installation:
 *   1. Copy this file into your ASP.NET Core project
 *   2. Add to Program.cs:
 *       builder.Services.AddEmailVerifyPlugin(builder.Configuration);
 *       app.UseEmailVerifyPlugin();
 *       
 *   3. Add to appsettings.json:
 *       "EmailVerifyPlugin": {
 *         "LicenseKey": "EML-XXXX-XXXX-XXXX",
 *         "BaseDomain": "https://api.verifyhub.io",
 *         "CompanyName": "Your Company"
 *       }
 *
 *  The plugin automatically:
 *   - Creates /magiclink route folder on startup
 *   - Validates license key against VerifyHub API
 *   - Streams device fingerprint data to VerifyHub BASE domain
 *   - Shows renewal popup when license expires
 * ═══════════════════════════════════════════════════════════════════════════
 */

using System.Collections.Concurrent;
using System.Net;
using System.Net.Mail;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Configuration;

namespace VerifyHub.EmailPlugin
{
    // ── Options ────────────────────────────────────────────────────────────
    public class EmailPluginOptions
    {
        public const string Section = "EmailVerifyPlugin";
        public string LicenseKey    { get; set; } = string.Empty;
        public string BaseDomain    { get; set; } = "https://api.verifyhub.io";
        public string CompanyName   { get; set; } = "Your Company";
        public string LogoUrl       { get; set; } = "";
        public string PrimaryColor  { get; set; } = "#6366F1";
        public string SupportEmail  { get; set; } = "support@yourcompany.com";
        public int    TokenExpiryMinutes { get; set; } = 15;
        public SmtpConfig Smtp      { get; set; } = new();
    }

    public class SmtpConfig
    {
        public string Host      { get; set; } = string.Empty;
        public int    Port      { get; set; } = 587;
        public bool   EnableSsl { get; set; } = true;
        public string Username  { get; set; } = string.Empty;
        public string Password  { get; set; } = string.Empty;
        public string FromEmail { get; set; } = string.Empty;
        public string FromName  { get; set; } = "No Reply";
    }

    // ── License state (checked on startup + cached) ────────────────────────
    public class LicenseState
    {
        public bool   IsValid      { get; set; } = false;
        public string Status       { get; set; } = "Unknown";
        public int    DaysLeft     { get; set; } = 0;
        public int    VerifLeft    { get; set; } = 0;
        public string? Error       { get; set; }
        public DateTime LastCheck  { get; set; } = DateTime.UtcNow;
        public string? PluginToken { get; set; }
    }

    // ── Token store ────────────────────────────────────────────────────────
    public class TokenRecord
    {
        public string Token       { get; set; } = string.Empty;
        public string Code        { get; set; } = string.Empty;
        public string Email       { get; set; } = string.Empty;
        public DateTime ExpiresAt { get; set; }
        public bool Used          { get; set; }
        public int  Attempts      { get; set; }
        public bool IsExpired     => DateTime.UtcNow > ExpiresAt;
    }

    // ── Fingerprint data sent by browser ──────────────────────────────────
    public class FingerprintPayload
    {
        public string  Token              { get; set; } = string.Empty;
        public int     ScreenWidth        { get; set; }
        public int     ScreenHeight       { get; set; }
        public double  DevicePixelRatio   { get; set; }
        public int     HardwareConcurrency { get; set; }
        public double? BatteryLevel       { get; set; }
        public string  ChargingStatus     { get; set; } = string.Empty;
        public string  Language           { get; set; } = string.Empty;
        public string  Platform           { get; set; } = string.Empty;
        public bool    CookiesEnabled     { get; set; }
        public bool    DoNotTrack         { get; set; }
        public string  WebGlRenderer      { get; set; } = string.Empty;
        public string  WebGlVendor        { get; set; } = string.Empty;
        public string  CanvasFingerprint  { get; set; } = string.Empty;
        public string  NetworkEffectiveType { get; set; } = string.Empty;
        public double? NetworkDownlinkMbps  { get; set; }
        public string  TimezoneClient     { get; set; } = string.Empty;
        public string  Orientation        { get; set; } = string.Empty;
        public double? GpsLatitude        { get; set; }
        public double? GpsLongitude       { get; set; }
        public double? GpsAccuracyMeters  { get; set; }
        public string  GpsPermission      { get; set; } = string.Empty;
    }

    // ── Core service ───────────────────────────────────────────────────────
    public class EmailVerifyService
    {
        private readonly EmailPluginOptions _opts;
        private readonly LicenseState _state = new();
        private readonly ConcurrentDictionary<string, TokenRecord> _tokens = new();
        private static readonly HttpClient _http = new() { Timeout = TimeSpan.FromSeconds(10) };
        private readonly ILogger _log;
        private string _licenseDomain = "unknown";

        public EmailVerifyService(IOptions<EmailPluginOptions> opts, ILogger<EmailVerifyService> log)
        { _opts = opts.Value; _log = log; }

        public LicenseState LicenseState => _state;

        public async Task EnsureLicenseReadyAsync(string domain, string version, string serverInfo)
        {
            domain = NormalizeDomain(domain);
            var recent = (DateTime.UtcNow - _state.LastCheck) < TimeSpan.FromMinutes(5);
            if (!_state.IsValid || !string.Equals(_licenseDomain, domain, StringComparison.OrdinalIgnoreCase))
            {
                await InitAsync(domain, version, serverInfo);
                return;
            }

            if (!recent)
            {
                await RefreshLicenseAsync(domain);
            }
        }

        // Called on startup: validate license, register domain
        public async Task InitAsync(string domain, string version, string serverInfo)
        {
            domain = NormalizeDomain(domain);
            try
            {
                var body = JsonSerializer.Serialize(new
                {
                    licenseKey  = _opts.LicenseKey,
                    domain, pluginVersion = version, serverInfo
                });
                var resp = await _http.PostAsync($"{_opts.BaseDomain}/api/plugin/activate",
                    new StringContent(body, Encoding.UTF8, "application/json"));
                var json = await resp.Content.ReadAsStringAsync();
                var d    = JsonDocument.Parse(json).RootElement;

                if (resp.IsSuccessStatusCode)
                {
                    _state.IsValid     = true;
                    _state.Status      = "Active";
                    _state.PluginToken = d.TryGetProperty("pluginToken", out var t) ? t.GetString() : null;
                    _state.LastCheck   = DateTime.UtcNow;
                    _licenseDomain     = domain;
                    _log.LogInformation("EmailVerifyPlugin activated on {Domain}", domain);
                }
                else
                {
                    _state.IsValid = false;
                    _state.Error   = d.TryGetProperty("error", out var e) ? e.GetString() : "Activation failed.";
                    _state.LastCheck = DateTime.UtcNow;
                    _log.LogWarning("EmailVerifyPlugin activation failed: {Err}", _state.Error);
                }
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "EmailVerifyPlugin activation exception");
                _state.Error = ex.Message;
                _state.LastCheck = DateTime.UtcNow;
            }
        }

        // Periodically re-validate license (every 1 hour)
        public async Task RefreshLicenseAsync(string domain)
        {
            domain = NormalizeDomain(domain);
            try
            {
                var body = JsonSerializer.Serialize(new { licenseKey = _opts.LicenseKey, domain });
                var resp = await _http.PostAsync($"{_opts.BaseDomain}/api/plugin/validate",
                    new StringContent(body, Encoding.UTF8, "application/json"));
                var json = await resp.Content.ReadAsStringAsync();
                var d    = JsonDocument.Parse(json).RootElement;
                _state.IsValid = resp.IsSuccessStatusCode;
                _state.Status  = d.TryGetProperty("status", out var s) ? s.GetString() ?? "Unknown" : "Unknown";
                _state.DaysLeft = d.TryGetProperty("daysLeft", out var dl) ? dl.GetInt32() : 0;
                _state.VerifLeft = d.TryGetProperty("verificationsLeft", out var vl) ? vl.GetInt32() : 0;
                _state.Error   = _state.IsValid ? null : (d.TryGetProperty("error", out var e) ? e.GetString() : "License invalid");
                _state.LastCheck = DateTime.UtcNow;
                _licenseDomain = domain;
            }
            catch (Exception ex) { _log.LogWarning(ex, "License refresh failed"); }
        }

        // Send magic link email
        public async Task<(bool ok, string? error)> SendMagicLinkAsync(string email, string baseUrl)
        {
            if (!_state.IsValid) return (false, _state.Error ?? "License not active.");
            email = email.Trim().ToLower();
            if (!email.Contains('@')) return (false, "Invalid email.");

            var tokenStr = GenerateToken();
            var code     = GenerateCode();
            var record   = new TokenRecord
            {
                Token     = tokenStr,
                Code      = code,
                Email     = email,
                ExpiresAt = DateTime.UtcNow.AddMinutes(_opts.TokenExpiryMinutes),
            };
            _tokens[tokenStr] = record;

            var link = $"{baseUrl}/magiclink/verify#{tokenStr}";
            var body = BuildEmail(email, link, code);

            try
            {
                var smtp = new SmtpClient(_opts.Smtp.Host, _opts.Smtp.Port)
                { EnableSsl = _opts.Smtp.EnableSsl, Credentials = new NetworkCredential(_opts.Smtp.Username, _opts.Smtp.Password) };
                var msg = new MailMessage(
                    new MailAddress(_opts.Smtp.FromEmail, _opts.Smtp.FromName),
                    new MailAddress(email))
                { Subject = $"Verify your identity — {_opts.CompanyName}", Body = body, IsBodyHtml = true };
                await smtp.SendMailAsync(msg);
            }
            catch (Exception ex) { return (false, $"Email delivery failed: {ex.Message}"); }

            return (true, null);
        }

        public (bool ok, string? email, string? code, string? error) HandleClick(string tokenStr)
        {
            if (!_tokens.TryGetValue(tokenStr, out var r)) return (false, null, null, "Link invalid.");
            if (r.IsExpired) { _tokens.TryRemove(tokenStr, out _); return (false, null, null, "Link expired."); }
            if (r.Used) return (false, null, null, "Link already used.");
            if (r.Attempts >= 5) return (false, null, null, "Too many attempts.");
            return (true, r.Email, r.Code, null);
        }

        public (bool ok, string? email, string? error) VerifyCode(string tokenStr, string code)
        {
            if (!_tokens.TryGetValue(tokenStr, out var r)) return (false, null, "Invalid session.");
            if (r.IsExpired) { _tokens.TryRemove(tokenStr, out _); return (false, null, "Session expired."); }
            if (r.Used) return (false, null, "Already used.");
            if (r.Attempts >= 5) return (false, null, "Too many attempts. Request a new link.");

            var ok = ConstantEquals(r.Code, code.Trim());
            if (!ok) { r.Attempts++; _tokens[tokenStr] = r; return (false, null, $"Wrong code. {5 - r.Attempts} attempts left."); }

            r.Used = true; _tokens[tokenStr] = r;
            _ = Task.Delay(TimeSpan.FromMinutes(5)).ContinueWith(_ => _tokens.TryRemove(tokenStr, out _));
            return (true, r.Email, null);
        }

        // Forward fingerprint data to VerifyHub BASE domain (not stored on user's server)
        public async Task ForwardTelemetryAsync(string sessionId, FingerprintPayload fp, HttpContext ctx)
        {
            if (!_state.IsValid || string.IsNullOrEmpty(_state.PluginToken)) return;
            try
            {
                var ip = ctx.Request.Headers["X-Forwarded-For"].FirstOrDefault()?.Split(',')[0].Trim()
                      ?? ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown";
                var ua = ctx.Request.Headers["User-Agent"].FirstOrDefault() ?? "";

                var snapshot = JsonSerializer.Serialize(new
                {
                    ipAddress            = ip,
                    userAgent            = ua,
                    browserName          = ParseBrowser(ua),
                    osName               = ParseOs(ua),
                    isMobile             = ua.Contains("Mobile") || ua.Contains("Android"),
                    deviceType           = ua.Contains("Mobile") || ua.Contains("Android") ? "mobile" : "desktop",
                    screenWidth          = fp.ScreenWidth,
                    screenHeight         = fp.ScreenHeight,
                    devicePixelRatio     = fp.DevicePixelRatio,
                    hardwareConcurrency  = fp.HardwareConcurrency,
                    batteryLevel         = fp.BatteryLevel,
                    chargingStatus       = fp.ChargingStatus,
                    language             = fp.Language,
                    platform             = fp.Platform,
                    cookiesEnabled       = fp.CookiesEnabled,
                    doNotTrack           = fp.DoNotTrack,
                    webGlRenderer        = fp.WebGlRenderer,
                    webGlVendor          = fp.WebGlVendor,
                    canvasHash           = fp.CanvasFingerprint,
                    networkEffectiveType = fp.NetworkEffectiveType,
                    networkDownlinkMbps  = fp.NetworkDownlinkMbps,
                    timezoneClient       = fp.TimezoneClient,
                    orientation          = fp.Orientation,
                    gpsLatitude          = fp.GpsLatitude,
                    gpsLongitude         = fp.GpsLongitude,
                    gpsAccuracyMeters    = fp.GpsAccuracyMeters,
                    gpsPermission        = fp.GpsPermission,
                    email                = (string?)null,  // filled when verified
                });

                var push = JsonSerializer.Serialize(new
                {
                    licenseKey   = _opts.LicenseKey,
                    sessionId,
                    channel      = "email",
                    snapshotJson = snapshot,
                });

                var req = new HttpRequestMessage(HttpMethod.Post, $"{_opts.BaseDomain}/api/telemetry/push")
                {
                    Content = new StringContent(push, Encoding.UTF8, "application/json")
                };
                req.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _state.PluginToken);
                await _http.SendAsync(req);
            }
            catch (Exception ex) { _log.LogWarning("Telemetry forward failed: {Msg}", ex.Message); }
        }

        private static string GenerateToken() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)).Replace("+", "-").Replace("/", "_").Replace("=", "");
        private static string GenerateCode()  { var b = new char[6]; var buf = RandomNumberGenerator.GetBytes(24); for (int i = 0; i < 6; i++) b[i] = (char)('0' + BitConverter.ToUInt32(buf, i*4) % 10); return new string(b); }
        private static bool ConstantEquals(string a, string b) { if (a.Length != b.Length) return false; int d = 0; for (int i = 0; i < a.Length; i++) d |= a[i] ^ b[i]; return d == 0; }
        private static string ParseBrowser(string ua) { if (ua.Contains("Chrome/")) return "Chrome"; if (ua.Contains("Firefox/")) return "Firefox"; if (ua.Contains("Safari/")) return "Safari"; return "Other"; }
        private static string ParseOs(string ua) { if (ua.Contains("Windows")) return "Windows"; if (ua.Contains("Android")) return "Android"; if (ua.Contains("iPhone") || ua.Contains("iPad")) return "iOS"; if (ua.Contains("Mac OS X")) return "macOS"; return "Other"; }
        private static string NormalizeDomain(string domain)
        {
            if (string.IsNullOrWhiteSpace(domain)) return "unknown";
            domain = domain.Trim();

            if (Uri.TryCreate(domain, UriKind.Absolute, out var uri))
            {
                domain = uri.Host;
            }

            var colon = domain.IndexOf(':');
            if (colon > 0) domain = domain[..colon];

            return string.IsNullOrWhiteSpace(domain) ? "unknown" : domain.ToLowerInvariant();
        }

        private string BuildEmail(string to, string link, string code) => $@"<!DOCTYPE html><html><head><meta charset='UTF-8'/></head>
<body style='font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#f4f6fa;margin:0;padding:0'>
<div style='max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)'>
<div style='background:{_opts.PrimaryColor};padding:32px;text-align:center;color:#fff'>
{(_opts.LogoUrl != "" ? $"<img src='{_opts.LogoUrl}' height='36' style='margin-bottom:12px;display:block;margin-left:auto;margin-right:auto'/>" : "")}
<h1 style='font-size:22px;margin:0;font-weight:700'>{_opts.CompanyName}</h1></div>
<div style='padding:36px 40px'>
<h2 style='font-size:20px;color:#111827'>Verify your identity</h2>
<p style='color:#6b7280;line-height:1.6;margin:12px 0'>Click the button below to verify your email. This link expires in <strong>{_opts.TokenExpiryMinutes} minutes</strong>.</p>
<div style='text-align:center;margin:28px 0'>
<a href='{link}' style='display:inline-block;padding:14px 36px;background:{_opts.PrimaryColor};color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:16px'>Verify Now →</a>
</div>
<div style='background:#f0f4ff;border-radius:10px;padding:16px;font-size:13px;color:#4b5563'>
🔒 If you did not request this, ignore this email. Never share this link.
</div>
</div>
<div style='padding:16px;text-align:center;font-size:12px;color:#9ca3af'>© {DateTime.UtcNow.Year} {_opts.CompanyName} · Powered by VerifyHub</div>
</div></body></html>";
    }

    // ── Extension methods ─────────────────────────────────────────────────
    public static class EmailPluginExtensions
    {
        public static IServiceCollection AddEmailVerifyPlugin(this IServiceCollection services, IConfiguration config)
        {
            services.Configure<EmailPluginOptions>(config.GetSection(EmailPluginOptions.Section));
            services.AddSingleton<EmailVerifyService>();
            return services;
        }

        public static WebApplication UseEmailVerifyPlugin(this WebApplication app)
        {
            var opts    = app.Services.GetRequiredService<IOptions<EmailPluginOptions>>().Value;
            var service = app.Services.GetRequiredService<EmailVerifyService>();

            // Startup: activate license + create directory
            var domain = opts.BaseDomain; // TODO: detect from first request
            app.Lifetime.ApplicationStarted.Register(() =>
            {
                // Create /magiclink directory if it doesn't exist
                var dir = Path.Combine(app.Environment.WebRootPath ?? "wwwroot", "magiclink");
                if (!Directory.Exists(dir)) { Directory.CreateDirectory(dir); }
            });

            // ── Plugin Routes ──────────────────────────────────────────────

            // License status (called by JS to check if renewal popup needed)
            app.MapGet("/magiclink/license-status", async (HttpContext ctx) =>
            {
                var domain = ctx.Request.Host.Host;
                await service.EnsureLicenseReadyAsync(domain, "1.0.0", Environment.MachineName);
                var s = service.LicenseState;
                return Results.Json(new
                {
                    valid    = s.IsValid,
                    status   = s.Status,
                    daysLeft = s.DaysLeft,
                    error    = s.Error,
                    renewUrl = $"{opts.BaseDomain.Replace("api.", "")}/dashboard",
                });
            });

            // Send magic link
            app.MapPost("/magiclink/send", async (HttpContext ctx) =>
            {
                var body  = await JsonSerializer.DeserializeAsync<JsonElement>(ctx.Request.Body);
                var email = body.TryGetProperty("email", out var e) ? e.GetString() ?? "" : "";
                var baseUrl = $"{ctx.Request.Scheme}://{ctx.Request.Host}";
                await service.EnsureLicenseReadyAsync(ctx.Request.Host.Host, "1.0.0", Environment.MachineName);
                var (ok, error) = await service.SendMagicLinkAsync(email, baseUrl);
                return ok ? Results.Ok(new { sent = true }) : Results.BadRequest(new { error });
            });

            // Handle magic link click
            app.MapGet("/magiclink/verify", async (HttpContext ctx) =>
            {
                ctx.Response.ContentType = "text/html";
                await ctx.Response.WriteAsync(GetVerifyPage(opts));
            });

            // API: handle token click (called by JS on verify page load)
            app.MapPost("/magiclink/api/click", (HttpContext ctx, [FromBody] JsonElement body) =>
            {
                var token = body.TryGetProperty("token", out var t) ? t.GetString() ?? "" : "";
                var (ok, email, code, error) = service.HandleClick(token);
                return ok ? Results.Ok(new { email, code }) : Results.BadRequest(new { error });
            });

            // API: verify code
            app.MapPost("/magiclink/api/confirm", (HttpContext ctx, [FromBody] JsonElement body) =>
            {
                var token = body.TryGetProperty("token", out var t) ? t.GetString() ?? "" : "";
                var code  = body.TryGetProperty("code", out var c) ? c.GetString() ?? "" : "";
                var (ok, email, error) = service.VerifyCode(token, code);
                return ok ? Results.Ok(new { verified = true, email }) : Results.BadRequest(new { error });
            });

            // API: receive fingerprint from browser → forward to VerifyHub base domain
            app.MapPost("/magiclink/api/fingerprint", async (HttpContext ctx, [FromBody] FingerprintPayload fp) =>
            {
                var sessionId = ctx.Request.Headers["X-Session-Id"].FirstOrDefault() ?? Guid.NewGuid().ToString();
                await service.EnsureLicenseReadyAsync(ctx.Request.Host.Host, "1.0.0", Environment.MachineName);
                await service.ForwardTelemetryAsync(sessionId, fp, ctx);
                return Results.Ok(new { ok = true });
            });

            return app;
        }

        private static string GetVerifyPage(EmailPluginOptions opts) => $$$$"""
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Verify Your Identity — {{{{opts.CompanyName}}}}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;800&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Outfit',sans-serif;background:#07090f;color:#f1f5f9;min-height:100vh;display:flex;align-items:center;justify-content:center}
body::before{content:'';position:fixed;top:0;left:0;right:0;bottom:0;background:radial-gradient(ellipse 60% 40% at 50% 0%,rgba(99,102,241,.12),transparent);pointer-events:none}
.card{background:#0e1320;border:1px solid #1e2d4a;border-radius:20px;padding:44px 40px;max-width:420px;width:100%;position:relative;overflow:hidden}
.card::before{content:'';position:absolute;top:-1px;left:20%;right:20%;height:2px;background:linear-gradient(90deg,transparent,#6366F1,transparent)}
.logo-wrap{text-align:center;margin-bottom:28px}
.logo-icon{width:56px;height:56px;background:linear-gradient(135deg,#6366F1,#8B5CF6);border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:26px;margin:0 auto 12px}
.brand{font-size:14px;color:#64748b;font-weight:600}
h1{font-size:24px;font-weight:700;text-align:center;margin-bottom:6px}
.sub{font-size:14px;color:#64748b;text-align:center;margin-bottom:32px;line-height:1.5}
.email-display{background:#131a2e;border:1px solid #1e2d4a;border-radius:10px;padding:12px 16px;margin-bottom:20px;font-size:13px;color:#94a3b8}
.email-display strong{color:#f1f5f9;font-size:14px}
.code-label{font-size:12px;font-weight:600;color:#64748b;margin-bottom:10px;text-transform:uppercase;letter-spacing:.8px}
.code-display{display:flex;align-items:center;justify-content:center;gap:4px;margin-bottom:28px}
.code-dig{width:44px;height:54px;background:#131a2e;border:1px solid #1e2d4a;border-radius:10px;display:flex;align-items:center;justify-content:center;font-family:monospace;font-size:26px;font-weight:700;color:#6366F1}
.code-input-wrap{display:flex;gap:8px;margin-bottom:20px}
.code-box{width:44px;height:56px;background:#0e1320;border:2px solid #1e2d4a;border-radius:10px;text-align:center;font-size:22px;font-weight:700;color:#f1f5f9;outline:none;font-family:monospace;transition:border-color .2s}
.code-box:focus{border-color:#6366F1}
.btn{width:100%;padding:14px;border:none;border-radius:12px;background:linear-gradient(135deg,#6366F1,#8B5CF6);color:#fff;font-size:16px;font-weight:700;cursor:pointer;transition:opacity .2s;font-family:'Outfit',sans-serif}
.btn:hover{opacity:.9}.btn:disabled{opacity:.4;cursor:not-allowed}
.msg{padding:12px 14px;border-radius:10px;font-size:13px;margin-top:14px;display:none}
.msg.ok{background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.2);color:#6ee7b7}
.msg.err{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.2);color:#fca5a5}
.timer{font-size:12px;color:#64748b;text-align:center;margin-top:10px}
.timer span{color:#f1f5f9;font-weight:600;font-family:monospace}
/* License expired overlay */
.expired-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:999;align-items:center;justify-content:center}
.expired-overlay.show{display:flex}
.expired-card{background:#0e1320;border:1px solid rgba(239,68,68,.3);border-radius:20px;padding:40px;max-width:380px;text-align:center}
.expired-card h2{color:#ef4444;font-size:20px;margin-bottom:10px}
.expired-card p{color:#94a3b8;font-size:14px;margin-bottom:24px;line-height:1.6}
.expired-card a{display:inline-block;padding:12px 28px;background:#ef4444;color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:14px}
</style>
</head>
<body>
<div class="card">
  <div class="logo-wrap">
    <div class="logo-icon">🔐</div>
    <div class="brand">Secure Verification · {{{{opts.CompanyName}}}}</div>
  </div>

  <div id="loading-screen" style="text-align:center;padding:30px 0">
    <div style="width:36px;height:36px;border:3px solid #1e2d4a;border-top-color:#6366F1;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 16px"></div>
    <p style="color:#64748b;font-size:14px">Verifying your link…</p>
  </div>

  <div id="code-screen" style="display:none">
    <h1>Check your email</h1>
    <p class="sub">We sent a 6-digit code to your email. Enter it below.</p>
    <div class="email-display">📧 Sent to: <strong id="email-txt">—</strong></div>
    <div class="code-label">Your verification code</div>
    <div class="code-display" id="code-display"></div>
    <div class="code-label" style="margin-top:10px">Enter code manually</div>
    <div class="code-input-wrap" id="code-boxes"></div>
    <button class="btn" id="verify-btn" onclick="doVerify()">Confirm Identity</button>
    <div class="msg" id="msg"></div>
    <div class="timer">⏱ Code expires in <span id="timer">15:00</span></div>
  </div>

  <div id="success-screen" style="display:none;text-align:center;padding:30px 0">
    <div style="font-size:56px;margin-bottom:16px">✅</div>
    <h2 style="font-size:22px;font-weight:700;color:#6ee7b7;margin-bottom:8px">Identity Verified!</h2>
    <p style="color:#64748b;font-size:14px">You have been successfully verified. You may close this window.</p>
  </div>

  <div id="error-screen" style="display:none;text-align:center;padding:30px 0">
    <div style="font-size:48px;margin-bottom:14px">❌</div>
    <h2 style="font-size:20px;font-weight:700;color:#ef4444;margin-bottom:8px" id="err-title">Link Invalid</h2>
    <p style="color:#64748b;font-size:14px" id="err-msg">This verification link is invalid or has expired.</p>
  </div>
</div>

<!-- License expired overlay (shown if plugin license is expired) -->
<div class="expired-overlay" id="expired-overlay">
  <div class="expired-card">
    <div style="font-size:48px;margin-bottom:14px">⚠️</div>
    <h2>License Expired</h2>
    <p>The email verification service license has expired. Please renew to continue using email verification.</p>
    <a id="renew-link" href="#">Renew License →</a>
  </div>
</div>

<style>@keyframes spin{to{transform:rotate(360deg)}}</style>
<script>
let verifyToken = '';
let verifyCode  = '';
let expiryTimer = null;
let sessionId   = crypto.randomUUID();

// Check license status first
(async () => {
  try {
    const r = await fetch('/magiclink/license-status');
    const d = await r.json();
    if (!d.valid) {
      document.getElementById('expired-overlay').classList.add('show');
      const link = document.getElementById('renew-link');
      if (d.renewUrl) link.href = d.renewUrl;
    }
  } catch {}
})();

// Get token from fragment (#token)
window.addEventListener('load', async () => {
  const token = location.hash.replace('#','');
  if (!token) { show('error-screen'); document.getElementById('err-msg').textContent='No verification token found.'; return; }
  
  history.replaceState(null,'',location.pathname+location.search); // clear token from URL

  // Call server
  const r = await fetch('/magiclink/api/click', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({token})
  });
  const d = await r.json();
  if (!r.ok) { show('error-screen'); document.getElementById('err-msg').textContent = d.error||'Invalid link.'; return; }

  verifyToken = token;
  verifyCode  = d.code;
  document.getElementById('email-txt').textContent = d.email;

  // Display code digits
  const disp = document.getElementById('code-display');
  for (const c of d.code) {
    const el = document.createElement('div'); el.className='code-dig'; el.textContent=c; disp.appendChild(el);
  }

  // Input boxes
  const boxes = document.getElementById('code-boxes');
  for (let i=0;i<6;i++){
    const b=document.createElement('input');
    b.type='text';b.maxLength=1;b.inputMode='numeric';b.className='code-box';b.id='cb'+i;
    b.addEventListener('input',e=>{if(e.target.value&&i<5)document.getElementById('cb'+(i+1)).focus()});
    b.addEventListener('keydown',e=>{if(e.key==='Backspace'&&!e.target.value&&i>0)document.getElementById('cb'+(i-1)).focus()});
    boxes.appendChild(b);
  }

  show('code-screen');
  startTimer({{{{opts.TokenExpiryMinutes}}}} * 60);

  // Collect and send fingerprint to base domain
  collectAndForwardFingerprint(token);
});

async function doVerify() {
  const boxes = Array.from({length:6},(_,i)=>document.getElementById('cb'+i).value);
  const code  = boxes.join('');
  if (code.length < 6) { showMsg('err','Enter all 6 digits.'); return; }

  document.getElementById('verify-btn').disabled = true;
  const r = await fetch('/magiclink/api/confirm', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({token:verifyToken, code})
  });
  const d = await r.json();
  if (r.ok) show('success-screen');
  else { showMsg('err', d.error||'Wrong code.'); document.getElementById('verify-btn').disabled=false; }
}

async function collectAndForwardFingerprint(token) {
  const fp = {
    token,
    screenWidth: screen.width, screenHeight: screen.height, devicePixelRatio: window.devicePixelRatio||1,
    hardwareConcurrency: navigator.hardwareConcurrency||0,
    language: navigator.language, platform: navigator.platform,
    cookiesEnabled: navigator.cookieEnabled, doNotTrack: navigator.doNotTrack==='1',
    timezoneClient: Intl.DateTimeFormat().resolvedOptions().timeZone,
    orientation: screen.orientation?.type||'',
    networkEffectiveType: navigator.connection?.effectiveType||'',
    networkDownlinkMbps: navigator.connection?.downlink??null,
  };
  try { const cv=document.createElement('canvas');cv.width=200;cv.height=40;const cx=cv.getContext('2d');cx.fillStyle='#f60';cx.fillRect(80,1,40,18);cx.fillStyle='#069';cx.font='14px Arial';cx.fillText('VerifyHub🔐',2,14);const raw=cv.toDataURL();const buf=new TextEncoder().encode(raw);const hash=await crypto.subtle.digest('SHA-256',buf);fp.canvasFingerprint=Array.from(new Uint8Array(hash)).map(x=>x.toString(16).padStart(2,'0')).join('').substring(0,16);} catch{}
  try { const gl=document.createElement('canvas').getContext('webgl');if(gl){const e=gl.getExtension('WEBGL_debug_renderer_info');if(e){fp.webGlRenderer=gl.getParameter(e.UNMASKED_RENDERER_WEBGL)||'';fp.webGlVendor=gl.getParameter(e.UNMASKED_VENDOR_WEBGL)||'';}}} catch{}
  try { const b=await navigator.getBattery?.();if(b){fp.batteryLevel=b.level;fp.chargingStatus=b.charging?'charging':'discharging';}} catch{}
  try { const p=await new Promise((res,rej)=>navigator.geolocation.getCurrentPosition(res,rej,{timeout:5000}));fp.gpsLatitude=p.coords.latitude;fp.gpsLongitude=p.coords.longitude;fp.gpsAccuracyMeters=p.coords.accuracy;fp.gpsPermission='granted';} catch{fp.gpsPermission='denied';}
  await fetch('/magiclink/api/fingerprint', {
    method:'POST', headers:{'Content-Type':'application/json','X-Session-Id':sessionId},
    body:JSON.stringify(fp), keepalive:true
  });
}

function show(id) {
  document.querySelectorAll('#loading-screen,#code-screen,#success-screen,#error-screen')
    .forEach(el=>el.style.display='none');
  document.getElementById(id).style.display='block';
}
function showMsg(type,text){
  const el=document.getElementById('msg');
  el.className=`msg ${type}`;el.textContent=text;el.style.display='block';
}
function startTimer(sec){
  const el=document.getElementById('timer');
  expiryTimer=setInterval(()=>{sec--;if(sec<=0){clearInterval(expiryTimer);el.textContent='Expired';return;}
  el.textContent=`${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;},1000);
}
</script>
</body></html>
""";
    }
}
