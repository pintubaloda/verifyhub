using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using VerifyHubPortal.Models;

namespace VerifyHubPortal.Services
{
    // ── License Key Generator ──────────────────────────────────────────────
    public interface ILicenseKeyGenerator
    {
        string Generate(string prefix);  // prefix = "EML" or "MOB"
        bool Verify(string key);
    }

    public class LicenseKeyGenerator : ILicenseKeyGenerator
    {
        private readonly string _secret;
        public LicenseKeyGenerator(IConfiguration cfg)
        {
            _secret = cfg["VerifyHub:LicenseHmacSecret"] ?? "change-this-in-production-32chars!!";
        }

        public string Generate(string prefix)
        {
            // Format: EML-XXXX-XXXX-XXXX-XXXX  (random 16 hex chars in groups of 4)
            var rng = RandomNumberGenerator.GetBytes(8);
            var hex = Convert.ToHexString(rng); // 16 chars
            var body = $"{hex[..4]}-{hex[4..8]}-{hex[8..12]}-{hex[12..16]}";
            return $"{prefix}-{body}".ToUpper();
        }

        public bool Verify(string key)
        {
            // Basic format check
            var parts = key?.Split('-');
            return parts?.Length >= 5;
        }
    }

    // ── JWT Auth Service ───────────────────────────────────────────────────
    public interface ITokenService
    {
        string GenerateAccessToken(User user);
        string GenerateRefreshToken();
        ClaimsPrincipal? ValidateAccessToken(string token);
    }

    public class TokenService : ITokenService
    {
        private readonly IConfiguration _cfg;
        public TokenService(IConfiguration cfg) => _cfg = cfg;

        public string GenerateAccessToken(User user)
        {
            var key     = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_cfg["Jwt:Secret"] ?? "super-secret-key-min-32-chars-xxxx"));
            var creds   = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
            var expiry  = DateTime.UtcNow.AddHours(1);
            var claims  = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Email,          user.Email),
                new Claim(ClaimTypes.Name,           user.Name),
                new Claim(ClaimTypes.Role,           user.Role.ToString()),
                new Claim("userId",                  user.Id.ToString()),
            };
            var token = new JwtSecurityToken(
                issuer:   _cfg["Jwt:Issuer"]   ?? "VerifyHubPortal",
                audience: _cfg["Jwt:Audience"] ?? "VerifyHubPortal",
                claims:   claims,
                expires:  expiry,
                signingCredentials: creds);
            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        public string GenerateRefreshToken()
        {
            var bytes = RandomNumberGenerator.GetBytes(64);
            return Convert.ToBase64String(bytes);
        }

        public ClaimsPrincipal? ValidateAccessToken(string token)
        {
            try
            {
                var handler   = new JwtSecurityTokenHandler();
                var key       = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_cfg["Jwt:Secret"] ?? "super-secret-key-min-32-chars-xxxx"));
                var principal = handler.ValidateToken(token, new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey         = key,
                    ValidateIssuer           = false,
                    ValidateAudience         = false,
                    ClockSkew                = TimeSpan.Zero
                }, out _);
                return principal;
            }
            catch { return null; }
        }
    }

    // ── Plugin Auth Service (validates plugin calls from user servers) ─────
    public interface IPluginAuthService
    {
        string GeneratePluginToken(License license);
        (bool valid, Guid? licenseId) ValidatePluginToken(string token);
    }

    public class PluginAuthService : IPluginAuthService
    {
        private readonly IConfiguration _cfg;
        public PluginAuthService(IConfiguration cfg) => _cfg = cfg;

        public string GeneratePluginToken(License license)
        {
            var key    = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_cfg["Jwt:PluginSecret"] ?? "plugin-secret-key-min-32-chars!!!"));
            var creds  = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
            var claims = new[]
            {
                new Claim("licenseId", license.Id.ToString()),
                new Claim("licenseKey", license.Key),
                new Claim("domain", license.InstalledDomain ?? ""),
            };
            var token = new JwtSecurityToken(
                issuer:   "VerifyHubPortal",
                audience: "VerifyHubPlugin",
                claims:   claims,
                expires:  license.ExpiresAt,
                signingCredentials: creds);
            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        public (bool valid, Guid? licenseId) ValidatePluginToken(string token)
        {
            try
            {
                var key    = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_cfg["Jwt:PluginSecret"] ?? "plugin-secret-key-min-32-chars!!!"));
                var handler = new JwtSecurityTokenHandler();
                handler.ValidateToken(token, new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey         = key,
                    ValidateIssuer           = true,
                    ValidIssuer              = "VerifyHubPortal",
                    ValidateAudience         = true,
                    ValidAudience            = "VerifyHubPlugin",
                    ClockSkew                = TimeSpan.Zero
                }, out var validated);
                var jwtToken = (JwtSecurityToken)validated;
                var claim    = jwtToken.Claims.FirstOrDefault(c => c.Type == "licenseId");
                if (claim == null || !Guid.TryParse(claim.Value, out var id)) return (false, null);
                return (true, id);
            }
            catch { return (false, null); }
        }
    }
}
