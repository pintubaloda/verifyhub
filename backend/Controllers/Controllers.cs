using System.Security.Claims;
using System.Data;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using VerifyHubPortal.Data;
using VerifyHubPortal.Models;
using VerifyHubPortal.Services;

namespace VerifyHubPortal.Controllers
{
    // ══════════════════════════════════════════════════════════
    // AUTH
    // ══════════════════════════════════════════════════════════
    [ApiController, Route("api/auth")]
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly ITokenService _tokens;
        private readonly ILogger<AuthController> _log;

        public AuthController(AppDbContext db, ITokenService tokens, ILogger<AuthController> log)
        { _db = db; _tokens = tokens; _log = log; }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterRequest req)
        {
            if (await _db.Users.AnyAsync(u => u.Email == req.Email.ToLower()))
                return Conflict(new { error = "Email already registered." });

            var user = new User
            {
                Name         = req.Name.Trim(),
                Email        = req.Email.Trim().ToLower(),
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password),
                Company      = req.Company?.Trim()
            };
            _db.Users.Add(user);
            await _db.SaveChangesAsync();

            var access  = _tokens.GenerateAccessToken(user);
            var refresh = await CreateRefreshAsync(user.Id);
            return Ok(new AuthResponse(access, refresh, ToDto(user)));
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest req)
        {
            var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == req.Email.ToLower());
            if (user == null || !BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
                return Unauthorized(new { error = "Invalid credentials." });
            if (!user.IsActive) return Forbid();

            var access  = _tokens.GenerateAccessToken(user);
            var refresh = await CreateRefreshAsync(user.Id);
            return Ok(new AuthResponse(access, refresh, ToDto(user)));
        }

        [HttpPost("refresh")]
        public async Task<IActionResult> Refresh([FromBody] RefreshRequest req)
        {
            var rt = await _db.RefreshTokens.Include(r => r.User)
                .FirstOrDefaultAsync(r => r.Token == req.Token && !r.IsRevoked);
            if (rt == null || rt.ExpiresAt < DateTime.UtcNow) return Unauthorized();
            rt.IsRevoked = true;
            var newAccess  = _tokens.GenerateAccessToken(rt.User!);
            var newRefresh = await CreateRefreshAsync(rt.UserId);
            await _db.SaveChangesAsync();
            return Ok(new { accessToken = newAccess, refreshToken = newRefresh });
        }

        [HttpPost("logout"), Authorize]
        public async Task<IActionResult> Logout([FromBody] RefreshRequest req)
        {
            var rt = await _db.RefreshTokens.FirstOrDefaultAsync(r => r.Token == req.Token);
            if (rt != null) { rt.IsRevoked = true; await _db.SaveChangesAsync(); }
            return Ok();
        }

        private async Task<string> CreateRefreshAsync(Guid userId)
        {
            var token = new RefreshToken { UserId = userId, Token = _tokens.GenerateRefreshToken() };
            _db.RefreshTokens.Add(token);
            await _db.SaveChangesAsync();
            return token.Token;
        }

        private static UserDto ToDto(User u) => new(u.Id, u.Name, u.Email, u.Company, u.Role, u.CreatedAt);
    }

    // ══════════════════════════════════════════════════════════
    // PRODUCTS / PLANS (public)
    // ══════════════════════════════════════════════════════════
    [ApiController, Route("api/products")]
    public class ProductsController : ControllerBase
    {
        private readonly AppDbContext _db;
        public ProductsController(AppDbContext db) => _db = db;

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var products = await _db.Products
                .Include(p => p.Plans)
                .Where(p => p.IsActive)
                .ToListAsync();
            return Ok(products.Select(p => new ProductDto(
                p.Id, p.Name, p.Slug, p.Description, p.Icon,
                p.Plans.OrderBy(pl => pl.PriceUsd).Select(pl => new PlanDto(
                    pl.Id, pl.Name, pl.PriceUsd, pl.Cycle, pl.DurationDays,
                    pl.MaxDomains, pl.MaxVerificationsPerMonth, pl.IsPopular, pl.Features)).ToList()
            )));
        }
    }

    // ══════════════════════════════════════════════════════════
    // USER PORTAL (requires auth)
    // ══════════════════════════════════════════════════════════
    [ApiController, Route("api/portal"), Authorize]
    public class PortalController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly ILicenseService _licenseSvc;
        private readonly IPluginAuthService _pluginAuth;

        public PortalController(AppDbContext db, ILicenseService ls, IPluginAuthService pa)
        { _db = db; _licenseSvc = ls; _pluginAuth = pa; }

        private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        [HttpGet("me")]
        public async Task<IActionResult> Me()
        {
            var user = await _db.Users.FindAsync(UserId);
            if (user == null) return NotFound();
            return Ok(new UserDto(user.Id, user.Name, user.Email, user.Company, user.Role, user.CreatedAt));
        }

        [HttpGet("licenses")]
        public async Task<IActionResult> Licenses()
        {
            var licenses = await _licenseSvc.GetUserLicensesAsync(UserId);
            return Ok(licenses.Select(ToLicenseDto));
        }

        [HttpGet("licenses/{id}/plugin-token")]
        public async Task<IActionResult> GetPluginToken(Guid id)
        {
            var license = await _db.Licenses.Include(l => l.Plan).FirstOrDefaultAsync(l => l.Id == id && l.UserId == UserId);
            if (license == null) return NotFound();
            if (license.IsExpired) return BadRequest(new { error = "License expired." });
            var token = _pluginAuth.GeneratePluginToken(license);
            return Ok(new { pluginToken = token, expiresAt = license.ExpiresAt });
        }

        [HttpGet("orders")]
        public async Task<IActionResult> Orders()
        {
            var orders = await _db.Orders
                .Include(o => o.Plan).ThenInclude(p => p!.Product)
                .Where(o => o.UserId == UserId)
                .OrderByDescending(o => o.CreatedAt)
                .ToListAsync();
            return Ok(orders.Select(o => new {
                o.Id, o.AmountUsd, o.Status, o.CreatedAt, o.CompletedAt,
                plan     = o.Plan?.Name,
                product  = o.Plan?.Product?.Name,
            }));
        }

        [HttpGet("dashboard-stats")]
        public async Task<IActionResult> DashboardStats()
        {
            var licenses = await _db.Licenses.Where(l => l.UserId == UserId).ToListAsync();
            var telemetry = await _db.TelemetryRecords
                .Include(t => t.License)
                .Where(t => t.License!.UserId == UserId)
                .ToListAsync();
            return Ok(new {
                totalLicenses    = licenses.Count,
                activeLicenses   = licenses.Count(l => l.Status == LicenseStatus.Active && !l.IsExpired),
                expiredLicenses  = licenses.Count(l => l.IsExpired),
                totalVerifications = telemetry.Count,
                verificationsThisMonth = telemetry.Count(t => t.ReceivedAt >= DateTime.UtcNow.AddDays(-30)),
            });
        }

        // Create order (initiate purchase) — full Stripe integration needs real keys
        [HttpPost("orders")]
        public async Task<IActionResult> CreateOrder([FromBody] CreateOrderRequest req)
        {
            var plan = await _db.Plans.Include(p => p.Product).FirstOrDefaultAsync(p => p.Id == req.PlanId);
            if (plan == null) return NotFound();
            var order = new Order
            {
                UserId    = UserId,
                PlanId    = req.PlanId,
                AmountUsd = plan.PriceUsd,
                Status    = OrderStatus.Pending,
            };
            _db.Orders.Add(order);
            await _db.SaveChangesAsync();

            // TODO: Create Stripe checkout session here
            // For demo: auto-complete the order and issue license
            order.Status      = OrderStatus.Completed;
            order.CompletedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            var license = await _licenseSvc.CreateAsync(UserId, plan.ProductId, plan.Id, order.Id);
            return Ok(new { orderId = order.Id, licenseKey = license.Key, message = "License issued." });
        }

        private static LicenseDto ToLicenseDto(License l) => new(
            l.Id, l.Key, l.KeyPrefix,
            l.Product?.Name ?? "", l.Plan?.Name ?? "",
            l.Status, l.ExpiresAt, l.DaysLeft,
            l.InstalledDomain, l.ActivatedAt, l.VerificationsThisMonth);
    }

    // ══════════════════════════════════════════════════════════
    // PLUGIN API (called by installed plugins on user servers)
    // ══════════════════════════════════════════════════════════
    [ApiController, Route("api/plugin")]
    public class PluginController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly ILicenseService _licenseSvc;
        private readonly IPluginAuthService _pluginAuth;
        private readonly ILogger<PluginController> _log;

        public PluginController(AppDbContext db, ILicenseService ls, IPluginAuthService pa, ILogger<PluginController> log)
        { _db = db; _licenseSvc = ls; _pluginAuth = pa; _log = log; }

        // Called on plugin install/startup: validates key, registers domain, returns plugin token
        [HttpPost("activate")]
        public async Task<IActionResult> Activate([FromBody] ActivatePluginRequest req)
        {
            var (valid, license, error) = await _licenseSvc.ActivateAsync(
                req.LicenseKey, req.Domain, req.PluginVersion, req.ServerInfo);

            if (!valid || license == null) return BadRequest(new { error });

            var token = _pluginAuth.GeneratePluginToken(license);
            return Ok(new
            {
                activated    = true,
                pluginToken  = token,
                expiresAt    = license.ExpiresAt,
                daysLeft     = license.DaysLeft,
                pluginType   = license.KeyPrefix == "EML" ? "email" : "mobile",
                maxDomains   = license.Plan?.MaxDomains ?? 1,
                maxPerMonth  = license.Plan?.MaxVerificationsPerMonth ?? 500,
            });
        }

        // Called each time a verification is attempted: validate key + count usage
        [HttpPost("validate")]
        public async Task<IActionResult> Validate([FromBody] ValidateLicenseRequest req)
        {
            var result = await _licenseSvc.ValidateAsync(req.LicenseKey, req.Domain);
            return result.Valid ? Ok(result) : StatusCode(402, result);  // 402 = Payment Required (expired)
        }

        // Health check — plugin pings this periodically
        [HttpGet("health")]
        public IActionResult Health() => Ok(new { status = "ok", time = DateTime.UtcNow });
    }

    // ══════════════════════════════════════════════════════════
    // TELEMETRY (receives device data from plugins – synced to BASE domain)
    // ══════════════════════════════════════════════════════════
    [ApiController, Route("api/telemetry")]
    public class TelemetryController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly ILicenseService _licenseSvc;
        private readonly IPluginAuthService _pluginAuth;
        private readonly ILogger<TelemetryController> _log;

        public TelemetryController(AppDbContext db, ILicenseService ls, IPluginAuthService pa, ILogger<TelemetryController> log)
        { _db = db; _licenseSvc = ls; _pluginAuth = pa; _log = log; }

        // Receives ALL device fingerprint / GPS data from every installed plugin
        // This runs on the BASE DOMAIN (VerifyHub servers), not the customer domain
        [HttpPost("push")]
        public async Task<IActionResult> Push([FromBody] TelemetryPushRequest req)
        {
            // Validate the license key before accepting data
            var license = await _db.Licenses
                .Include(l => l.Plan)
                .FirstOrDefaultAsync(l => l.Key == req.LicenseKey);

            if (license == null) return Unauthorized(new { error = "Invalid license key." });
            if (license.IsExpired) return StatusCode(402, new { error = "License expired." });

            // Parse snapshot JSON safely
            JsonElement? snap = null;
            try { snap = JsonSerializer.Deserialize<JsonElement>(req.SnapshotJson); } catch { }

            string? S(string k) => snap?.TryGetProperty(k, out var v) == true ? v.GetString() : null;
            bool    B(string k) => snap?.TryGetProperty(k, out var v) == true && v.ValueKind == JsonValueKind.True;
            double? D(string k) => snap?.TryGetProperty(k, out var v) == true && v.TryGetDouble(out var d) ? d : null;
            int?    I(string k) => snap?.TryGetProperty(k, out var v) == true && v.TryGetInt32(out var i) ? i : null;

            var record = new TelemetryRecord
            {
                LicenseId    = license.Id,
                SessionId    = req.SessionId,
                Channel      = req.Channel,
                PluginDomain = license.InstalledDomain ?? "",
                ReceivedAt   = DateTime.UtcNow,
                IpAddress    = S("ipAddress"),
                CountryCode  = S("countryCode"),
                City         = S("city"),
                Isp          = S("isp"),
                IsProxy      = B("isProxy"),
                IsVpn        = B("isVpn"),
                IsTor        = B("isTor"),
                GpsLatitude  = D("gpsLatitude"),
                GpsLongitude = D("gpsLongitude"),
                BrowserName  = S("browserName"),
                OsName       = S("osName"),
                DeviceType   = S("deviceType"),
                IsMobile     = B("isMobile"),
                BatteryLevel = D("batteryLevel"),
                NetworkType  = S("networkType") ?? S("networkEffectiveType"),
                CanvasHash   = S("canvasHash"),
                RiskScore    = I("riskScore") ?? 0,
                UserEmail    = S("email") ?? S("contactEmail"),
                UserPhone    = S("phoneNumber"),
                RawJson      = req.SnapshotJson,
            };

            _db.TelemetryRecords.Add(record);
            await _licenseSvc.IncrementUsageAsync(req.LicenseKey);
            await _db.SaveChangesAsync();

            _log.LogInformation("Telemetry received from domain:{Domain} channel:{Channel} ip:{Ip}",
                license.InstalledDomain, req.Channel, record.IpAddress);

            return Ok(new { received = true, recordId = record.Id });
        }

        // User can view their own telemetry in the dashboard
        [HttpGet("mine"), Authorize]
        public async Task<IActionResult> Mine([FromQuery] string? channel, [FromQuery] int page = 1)
        {
            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var query  = _db.TelemetryRecords
                .Include(t => t.License)
                .Where(t => t.License!.UserId == userId);

            if (!string.IsNullOrEmpty(channel)) query = query.Where(t => t.Channel == channel);

            var total  = await query.CountAsync();
            var items  = await query.OrderByDescending(t => t.ReceivedAt)
                .Skip((page - 1) * 20).Take(20).ToListAsync();

            return Ok(new { total, page, items = items.Select(t => new {
                t.Id, t.SessionId, t.Channel, t.PluginDomain, t.ReceivedAt,
                t.IpAddress, t.CountryCode, t.City, t.Isp,
                t.IsProxy, t.IsVpn, t.IsTor,
                t.GpsLatitude, t.GpsLongitude,
                t.BrowserName, t.OsName, t.DeviceType, t.IsMobile,
                t.BatteryLevel, t.NetworkType, t.RiskScore,
                t.UserEmail, t.UserPhone,
            })});
        }
    }

    // ══════════════════════════════════════════════════════════
    // ADMIN (super-admin only)
    // ══════════════════════════════════════════════════════════
    [ApiController, Route("api/admin"), Authorize(Roles = "Admin")]
    public class AdminController : ControllerBase
    {
        private const string PluginBaseDomainSettingKey = "plugins.baseDomain";
        private readonly AppDbContext _db;
        private readonly ILicenseService _licenseSvc;
        private readonly IConfiguration _cfg;

        public AdminController(AppDbContext db, ILicenseService ls, IConfiguration cfg)
        { _db = db; _licenseSvc = ls; _cfg = cfg; }

        [HttpGet("stats")]
        public async Task<IActionResult> Stats()
        {
            var users    = await _db.Users.CountAsync();
            var licenses = await _db.Licenses.CountAsync();
            var active   = await _db.Licenses.CountAsync(l => l.Status == LicenseStatus.Active);
            var telemetry = await _db.TelemetryRecords.CountAsync();
            var revenue  = await _db.Orders.Where(o => o.Status == OrderStatus.Completed).SumAsync(o => o.AmountUsd);
            var monthlyOrders = await _db.Orders
                .CountAsync(o => o.Status == OrderStatus.Completed && o.CreatedAt >= DateTime.UtcNow.AddDays(-30));
            return Ok(new AdminStatsDto(users, licenses, active, telemetry, revenue, monthlyOrders));
        }

        [HttpGet("users")]
        public async Task<IActionResult> Users([FromQuery] int page = 1)
        {
            var q     = _db.Users.OrderByDescending(u => u.CreatedAt);
            var total = await q.CountAsync();
            var items = await q.Skip((page-1)*20).Take(20).ToListAsync();
            return Ok(new { total, items = items.Select(u => new {
                u.Id, u.Name, u.Email, u.Company, u.Role, u.IsActive, u.CreatedAt }) });
        }

        [HttpGet("licenses")]
        public async Task<IActionResult> Licenses([FromQuery] int page = 1)
        {
            var q = _db.Licenses
                .Include(l => l.User).Include(l => l.Product).Include(l => l.Plan)
                .OrderByDescending(l => l.IssuedAt);
            var total = await q.CountAsync();
            var items = await q.Skip((page-1)*20).Take(20).ToListAsync();
            return Ok(new { total, items = items.Select(l => new {
                l.Id, l.Key, l.KeyPrefix, l.Status, l.IssuedAt, l.ExpiresAt, l.DaysLeft,
                l.InstalledDomain, l.ActivationCount, l.VerificationsThisMonth,
                user    = l.User?.Email,
                product = l.Product?.Name,
                plan    = l.Plan?.Name,
            }) });
        }

        [HttpGet("telemetry")]
        public async Task<IActionResult> AllTelemetry([FromQuery] int page = 1, [FromQuery] string? domain = null)
        {
            var q = _db.TelemetryRecords.Include(t => t.License).AsQueryable();
            if (!string.IsNullOrEmpty(domain)) q = q.Where(t => t.PluginDomain.Contains(domain));
            var total = await q.CountAsync();
            var items = await q.OrderByDescending(t => t.ReceivedAt).Skip((page-1)*50).Take(50).ToListAsync();
            return Ok(new { total, items });
        }

        [HttpGet("plugin-settings")]
        public async Task<IActionResult> PluginSettings()
        {
            var baseDomain = await GetSettingAsync(PluginBaseDomainSettingKey)
                ?? _cfg["VerifyHub:BaseDomain"]
                ?? "https://api.verifyhub.io";

            var products = await _db.Products
                .Include(p => p.Plans)
                .Where(p => p.IsActive)
                .OrderBy(p => p.Name)
                .ToListAsync();

            var defaults = new
            {
                baseDomain,
                emailPrimaryColor = "#6366F1",
                mobilePrimaryColor = "#6366F1",
                mobileTelemetryIntervalSeconds = 5,
                mobileQrExpiryMinutes = 5,
                emailTokenExpiryMinutes = 15
            };

            var security = new
            {
                jwtSecretConfigured = !string.IsNullOrWhiteSpace(_cfg["Jwt:Secret"]),
                pluginSecretConfigured = !string.IsNullOrWhiteSpace(_cfg["Jwt:PluginSecret"]),
                licenseHmacConfigured = !string.IsNullOrWhiteSpace(_cfg["VerifyHub:LicenseHmacSecret"]),
                adminBootstrapEmail = Environment.GetEnvironmentVariable("ADMIN_EMAIL")
            };

            return Ok(new
            {
                defaults,
                security,
                plugins = products.Select(p => new
                {
                    p.Id,
                    p.Name,
                    p.Slug,
                    p.Description,
                    plans = p.Plans
                        .OrderBy(pl => pl.PriceUsd)
                        .Select(pl => new
                        {
                            pl.Id,
                            pl.Name,
                            pl.PriceUsd,
                            pl.Cycle,
                            pl.DurationDays,
                            pl.MaxDomains,
                            pl.MaxVerificationsPerMonth,
                            pl.IsPopular
                        })
                })
            });
        }

        [HttpPost("plugin-settings/base-domain")]
        public async Task<IActionResult> SetPluginBaseDomain([FromBody] UpdatePluginBaseDomainRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.BaseDomain))
                return BadRequest(new { error = "Base domain is required." });

            if (!Uri.TryCreate(req.BaseDomain, UriKind.Absolute, out var uri))
                return BadRequest(new { error = "Base domain must be a valid absolute URL." });

            if (uri.Scheme != Uri.UriSchemeHttps && uri.Scheme != Uri.UriSchemeHttp)
                return BadRequest(new { error = "Base domain must start with http:// or https://." });

            var normalized = $"{uri.Scheme}://{uri.Host}{(uri.IsDefaultPort ? "" : ":" + uri.Port)}".TrimEnd('/');
            await SetSettingAsync(PluginBaseDomainSettingKey, normalized);

            return Ok(new { saved = true, baseDomain = normalized });
        }

        [HttpPost("licenses/{id}/revoke")]
        public async Task<IActionResult> Revoke(Guid id)
        {
            var l = await _db.Licenses.FindAsync(id);
            if (l == null) return NotFound();
            l.Status = LicenseStatus.Revoked;
            await _db.SaveChangesAsync();
            return Ok(new { revoked = true });
        }

        [HttpPost("expire-check")]
        public async Task<IActionResult> ExpireCheck()
        {
            await _licenseSvc.ExpireOverdueAsync();
            return Ok(new { done = true });
        }

        private async Task EnsureSettingsTableAsync()
        {
            await _db.Database.ExecuteSqlRawAsync("""
                CREATE TABLE IF NOT EXISTS "PlatformSettings" (
                    "Key" TEXT PRIMARY KEY,
                    "Value" TEXT NOT NULL
                );
            """);
        }

        private async Task<string?> GetSettingAsync(string key)
        {
            await EnsureSettingsTableAsync();
            var conn = _db.Database.GetDbConnection();
            var closeAfter = conn.State != ConnectionState.Open;
            if (closeAfter) await conn.OpenAsync();

            try
            {
                await using var cmd = conn.CreateCommand();
                cmd.CommandText = """SELECT "Value" FROM "PlatformSettings" WHERE "Key" = @key LIMIT 1;""";
                var param = cmd.CreateParameter();
                param.ParameterName = "@key";
                param.Value = key;
                cmd.Parameters.Add(param);
                var value = await cmd.ExecuteScalarAsync();
                return value == null || value == DBNull.Value ? null : value.ToString();
            }
            finally
            {
                if (closeAfter) await conn.CloseAsync();
            }
        }

        private async Task SetSettingAsync(string key, string value)
        {
            await EnsureSettingsTableAsync();
            var conn = _db.Database.GetDbConnection();
            var closeAfter = conn.State != ConnectionState.Open;
            if (closeAfter) await conn.OpenAsync();

            try
            {
                await using var update = conn.CreateCommand();
                update.CommandText = """UPDATE "PlatformSettings" SET "Value" = @value WHERE "Key" = @key;""";
                var upKey = update.CreateParameter();
                upKey.ParameterName = "@key";
                upKey.Value = key;
                update.Parameters.Add(upKey);
                var upValue = update.CreateParameter();
                upValue.ParameterName = "@value";
                upValue.Value = value;
                update.Parameters.Add(upValue);
                var rows = await update.ExecuteNonQueryAsync();

                if (rows == 0)
                {
                    await using var insert = conn.CreateCommand();
                    insert.CommandText = """INSERT INTO "PlatformSettings" ("Key", "Value") VALUES (@key, @value);""";
                    var inKey = insert.CreateParameter();
                    inKey.ParameterName = "@key";
                    inKey.Value = key;
                    insert.Parameters.Add(inKey);
                    var inValue = insert.CreateParameter();
                    inValue.ParameterName = "@value";
                    inValue.Value = value;
                    insert.Parameters.Add(inValue);
                    await insert.ExecuteNonQueryAsync();
                }
            }
            finally
            {
                if (closeAfter) await conn.CloseAsync();
            }
        }

        public record UpdatePluginBaseDomainRequest(string BaseDomain);
    }
}
