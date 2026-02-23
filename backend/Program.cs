using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Npgsql;
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
    db.Database.EnsureCreated();
    await EnsurePlatformSettingsTableAsync(db);
    await EnsureBootstrapAdminAsync(scope.ServiceProvider, db);
}

app.UseCors("frontend");
app.UseAuthentication();
app.UseAuthorization();
app.UseStaticFiles();
app.MapControllers();

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
        SslMode = Enum.TryParse<SslMode>(sslMode, ignoreCase: true, out var mode) ? mode : SslMode.Require,
        TrustServerCertificate = true
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
