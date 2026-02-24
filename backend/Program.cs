using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Npgsql;
using VerifyHub.EmailPlugin;
using VerifyHub.MobilePlugin;
using VerifyHubPortal.Data;
using VerifyHubPortal.Models;
using VerifyHubPortal.Services;

var builder = WebApplication.CreateBuilder(args);

// ── Database ──────────────────────────────────────────────────────────────
var configuredConnection = builder.Configuration.GetConnectionString("Default");
var databaseUrl = Environment.GetEnvironmentVariable("DATABASE_URL");
var connectionString = !string.IsNullOrWhiteSpace(databaseUrl)
    ? BuildNpgsqlConnectionString(databaseUrl)
    : configuredConnection;

builder.Services.AddDbContext<AppDbContext>(opts =>
{
    if (LooksLikePostgres(connectionString))
    {
        opts.UseNpgsql(connectionString);
    }
    else
    {
        opts.UseSqlite(connectionString ?? "Data Source=verifyhub.db");
    }
});

// ── CORS ──────────────────────────────────────────────────────────────────
builder.Services.AddCors(o => o.AddPolicy("frontend", p =>
{
    var origins = builder.Configuration.GetSection("AllowedOrigins").Get<string[]>()
        ?? new[] { "http://localhost:5173", "http://localhost:3000" };
    p.SetIsOriginAllowed(origin =>
    {
        if (origins.Contains(origin, StringComparer.OrdinalIgnoreCase)) return true;
        if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri)) return false;
        return uri.Host.EndsWith(".onrender.com", StringComparison.OrdinalIgnoreCase);
    })
    .AllowAnyMethod()
    .AllowAnyHeader()
    .AllowCredentials();
}));

// ── JWT Auth ──────────────────────────────────────────────────────────────
var jwtKey = builder.Configuration["Jwt:Secret"] ?? "super-secret-key-min-32-chars-xxxx";
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opts =>
    {
        opts.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey         = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ValidateIssuer           = false,
            ValidateAudience         = false,
            ClockSkew                = TimeSpan.Zero,
        };
    });
builder.Services.AddAuthorization();

// ── Services ──────────────────────────────────────────────────────────────
builder.Services.AddSingleton<ILicenseKeyGenerator, LicenseKeyGenerator>();
builder.Services.AddSingleton<ITokenService,        TokenService>();
builder.Services.AddSingleton<IPluginAuthService,   PluginAuthService>();
builder.Services.AddScoped<ILicenseService,         LicenseService>();
builder.Services.AddEmailVerifyPlugin(builder.Configuration);
builder.Services.AddMobileQrPlugin(builder.Configuration);

// ── Controllers + SignalR ─────────────────────────────────────────────────
builder.Services.AddControllers();
builder.Services.AddSignalR();
builder.Services.AddEndpointsApiExplorer();

// ── Background: expire licenses ───────────────────────────────────────────
builder.Services.AddHostedService<LicenseExpiryWorker>();

var portVar = Environment.GetEnvironmentVariable("PORT");
if (int.TryParse(portVar, out var port))
{
    builder.WebHost.UseUrls($"http://0.0.0.0:{port}");
}

var app = builder.Build();

// ── Auto-migrate on startup ───────────────────────────────────────────────
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var cfg = scope.ServiceProvider.GetRequiredService<IConfiguration>();
    var keyGen = scope.ServiceProvider.GetRequiredService<ILicenseKeyGenerator>();
    var log = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("PlatformBootstrap");
    db.Database.EnsureCreated();
    await EnsureUserVerificationColumnsAsync(db);
    await EnsurePlatformSettingsTableAsync(db);
    await EnsurePlatformLifetimeLicensesAsync(db, cfg, keyGen, log);
    await EnsureBootstrapAdminAsync(scope.ServiceProvider, db);
}

app.UseCors("frontend");
app.UseAuthentication();
app.UseAuthorization();
app.UseStaticFiles();
app.UseEmailVerifyPlugin();
app.UseMobileQrPlugin();
app.MapControllers();
app.MapHub<MobileQrHub>("/mobilehub");

// Health check
app.MapGet("/health", () => Results.Ok(new { status = "ok", time = DateTime.UtcNow }));

// SPA fallback for React frontend (in production)
app.MapFallbackToFile("index.html");

app.Run();

static async Task EnsurePlatformSettingsTableAsync(AppDbContext db)
{
    await db.Database.ExecuteSqlRawAsync("""
        CREATE TABLE IF NOT EXISTS "PlatformSettings" (
            "Key" TEXT PRIMARY KEY,
            "Value" TEXT NOT NULL
        );
    """);
}

static async Task EnsureUserVerificationColumnsAsync(AppDbContext db)
{
    if (db.Database.IsNpgsql())
    {
        await db.Database.ExecuteSqlRawAsync("""ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "EmailVerified" boolean NOT NULL DEFAULT FALSE;""");
        await db.Database.ExecuteSqlRawAsync("""ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "EmailVerifiedAt" timestamp with time zone NULL;""");
        await db.Database.ExecuteSqlRawAsync("""ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "MobileVerified" boolean NOT NULL DEFAULT FALSE;""");
        await db.Database.ExecuteSqlRawAsync("""ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "MobileVerifiedAt" timestamp with time zone NULL;""");
        await db.Database.ExecuteSqlRawAsync("""ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "VerificationCompletedAt" timestamp with time zone NULL;""");
        await db.Database.ExecuteSqlRawAsync("""ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "PhoneNumber" text NULL;""");
        return;
    }

    try { await db.Database.ExecuteSqlRawAsync("""ALTER TABLE "Users" ADD COLUMN "EmailVerified" INTEGER NOT NULL DEFAULT 0;"""); } catch { }
    try { await db.Database.ExecuteSqlRawAsync("""ALTER TABLE "Users" ADD COLUMN "EmailVerifiedAt" TEXT NULL;"""); } catch { }
    try { await db.Database.ExecuteSqlRawAsync("""ALTER TABLE "Users" ADD COLUMN "MobileVerified" INTEGER NOT NULL DEFAULT 0;"""); } catch { }
    try { await db.Database.ExecuteSqlRawAsync("""ALTER TABLE "Users" ADD COLUMN "MobileVerifiedAt" TEXT NULL;"""); } catch { }
    try { await db.Database.ExecuteSqlRawAsync("""ALTER TABLE "Users" ADD COLUMN "VerificationCompletedAt" TEXT NULL;"""); } catch { }
    try { await db.Database.ExecuteSqlRawAsync("""ALTER TABLE "Users" ADD COLUMN "PhoneNumber" TEXT NULL;"""); } catch { }
}

static async Task EnsurePlatformLifetimeLicensesAsync(
    AppDbContext db,
    IConfiguration cfg,
    ILicenseKeyGenerator keyGen,
    ILogger logger)
{
    var ownerEmail = (Environment.GetEnvironmentVariable("PLATFORM_OWNER_EMAIL")
        ?? "platform@verifyhub.local").Trim().ToLowerInvariant();
    var ownerName = Environment.GetEnvironmentVariable("PLATFORM_OWNER_NAME")?.Trim();
    var domainRaw = (Environment.GetEnvironmentVariable("PLATFORM_DOMAIN")
        ?? cfg["VerifyHub:BaseDomain"]
        ?? "https://api.verifyhub.io").Trim();

    string domain;
    if (Uri.TryCreate(domainRaw, UriKind.Absolute, out var uri)) domain = uri.Host.ToLowerInvariant();
    else domain = domainRaw.Replace("http://", "").Replace("https://", "").Trim('/').ToLowerInvariant();

    var owner = await db.Users.FirstOrDefaultAsync(u => u.Email == ownerEmail);
    if (owner == null)
    {
        owner = new User
        {
            Name = string.IsNullOrWhiteSpace(ownerName) ? "Platform Owner" : ownerName,
            Email = ownerEmail,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(Guid.NewGuid().ToString("N")),
            Role = UserRole.Admin,
            IsActive = true,
            Company = "VerifyHub Platform"
        };
        db.Users.Add(owner);
        await db.SaveChangesAsync();
    }

    var products = await db.Products.Include(p => p.Plans).Where(p => p.IsActive).ToListAsync();
    var targets = new[] { ("email-verify", "EML"), ("mobile-qr", "MOB") };

    foreach (var (slug, prefix) in targets)
    {
        var product = products.FirstOrDefault(p => p.Slug == slug);
        if (product == null) continue;
        var plan = product.Plans.OrderByDescending(p => p.MaxDomains).ThenByDescending(p => p.MaxVerificationsPerMonth).FirstOrDefault();
        if (plan == null) continue;

        var existing = await db.Licenses
            .FirstOrDefaultAsync(l => l.UserId == owner.Id && l.ProductId == product.Id && l.KeyPrefix == prefix);

        if (existing == null)
        {
            var key = keyGen.Generate(prefix);
            while (await db.Licenses.AnyAsync(l => l.Key == key)) key = keyGen.Generate(prefix);

            existing = new License
            {
                UserId = owner.Id,
                ProductId = product.Id,
                PlanId = plan.Id,
                Key = key,
                KeyPrefix = prefix,
                Status = LicenseStatus.Active,
                IssuedAt = DateTime.UtcNow,
                ExpiresAt = DateTime.UtcNow.AddYears(75),
                UsageResetDate = DateTime.UtcNow.AddYears(1),
                InstalledDomain = domain,
                ActivatedAt = DateTime.UtcNow,
                InstalledBy = "platform-bootstrap",
                ActivationCount = 1
            };
            db.Licenses.Add(existing);
            await db.SaveChangesAsync();
            logger.LogInformation("Platform lifetime key created for {Slug}: {Key}", slug, existing.Key);
        }
        else
        {
            var changed = false;
            if (existing.PlanId != plan.Id) { existing.PlanId = plan.Id; changed = true; }
            if (existing.Status != LicenseStatus.Active) { existing.Status = LicenseStatus.Active; changed = true; }
            if (string.IsNullOrWhiteSpace(existing.InstalledDomain)) { existing.InstalledDomain = domain; changed = true; }
            if (existing.ExpiresAt <= DateTime.UtcNow) { existing.ExpiresAt = DateTime.UtcNow.AddYears(75); changed = true; }
            if (changed) await db.SaveChangesAsync();
        }
    }
}

static async Task EnsureBootstrapAdminAsync(IServiceProvider services, AppDbContext db)
{
    var email = Environment.GetEnvironmentVariable("ADMIN_EMAIL")?.Trim().ToLowerInvariant();
    var password = Environment.GetEnvironmentVariable("ADMIN_PASSWORD");
    var name = Environment.GetEnvironmentVariable("ADMIN_NAME")?.Trim();
    var resetPassword = string.Equals(
        Environment.GetEnvironmentVariable("ADMIN_RESET_PASSWORD"),
        "true",
        StringComparison.OrdinalIgnoreCase
    );
    var logger = services.GetRequiredService<ILoggerFactory>().CreateLogger("AdminBootstrap");

    if (string.IsNullOrWhiteSpace(email))
    {
        return;
    }

    var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email);
    if (user == null)
    {
        if (string.IsNullOrWhiteSpace(password))
        {
            logger.LogWarning("ADMIN_EMAIL is set but ADMIN_PASSWORD is missing. Admin bootstrap skipped.");
            return;
        }

        user = new User
        {
            Name = string.IsNullOrWhiteSpace(name) ? "Admin" : name,
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
            Role = UserRole.Admin,
            IsActive = true
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();
        logger.LogInformation("Bootstrap admin user created for {Email}", email);
        return;
    }

    var changed = false;
    if (user.Role != UserRole.Admin)
    {
        user.Role = UserRole.Admin;
        changed = true;
    }

    if (resetPassword && !string.IsNullOrWhiteSpace(password) && !BCrypt.Net.BCrypt.Verify(password, user.PasswordHash))
    {
        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(password);
        changed = true;
    }

    if (changed)
    {
        await db.SaveChangesAsync();
        logger.LogInformation("Bootstrap admin user updated for {Email}", email);
    }
}

static bool LooksLikePostgres(string? connectionString)
{
    if (string.IsNullOrWhiteSpace(connectionString)) return false;
    return connectionString.Contains("Host=", StringComparison.OrdinalIgnoreCase)
        || connectionString.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase)
        || connectionString.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase);
}

static string BuildNpgsqlConnectionString(string databaseUrl)
{
    if (databaseUrl.StartsWith("Host=", StringComparison.OrdinalIgnoreCase))
    {
        return databaseUrl;
    }

    var uri = new Uri(databaseUrl);
    var userInfo = uri.UserInfo.Split(':', 2);
    var username = userInfo[0];
    var password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : string.Empty;
    var database = uri.AbsolutePath.TrimStart('/');
    var sslMode = "Require";
    if (!string.IsNullOrWhiteSpace(uri.Query))
    {
        var parts = uri.Query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries);
        foreach (var part in parts)
        {
            var kv = part.Split('=', 2);
            if (kv.Length == 2 && kv[0].Equals("sslmode", StringComparison.OrdinalIgnoreCase))
            {
                sslMode = Uri.UnescapeDataString(kv[1]);
                break;
            }
        }
    }

    var builder = new NpgsqlConnectionStringBuilder
    {
        Host = uri.Host,
        Port = uri.Port > 0 ? uri.Port : 5432,
        Username = username,
        Password = password,
        Database = database,
        SslMode = Enum.TryParse<SslMode>(sslMode, ignoreCase: true, out var mode) ? mode : SslMode.Require
    };
    return builder.ConnectionString;
}

// ── Background worker: expire licenses every hour ─────────────────────────
public class LicenseExpiryWorker : BackgroundService
{
    private readonly IServiceScopeFactory _factory;
    private readonly ILogger<LicenseExpiryWorker> _log;

    public LicenseExpiryWorker(IServiceScopeFactory f, ILogger<LicenseExpiryWorker> l) { _factory = f; _log = l; }

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            try
            {
                using var scope = _factory.CreateScope();
                var svc = scope.ServiceProvider.GetRequiredService<ILicenseService>();
                await svc.ExpireOverdueAsync();
            }
            catch (Exception ex) { _log.LogError(ex, "Expiry worker failed"); }
            await Task.Delay(TimeSpan.FromHours(1), ct);
        }
    }
}
