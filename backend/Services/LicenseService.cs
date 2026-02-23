using Microsoft.EntityFrameworkCore;
using VerifyHubPortal.Data;
using VerifyHubPortal.Models;

namespace VerifyHubPortal.Services
{
    public interface ILicenseService
    {
        Task<License> CreateAsync(Guid userId, Guid productId, Guid planId, Guid? orderId = null);
        Task<(bool valid, License? license, string? error)> ActivateAsync(string key, string domain, string pluginVersion, string serverInfo);
        Task<LicenseValidationResponse> ValidateAsync(string key, string domain);
        Task<bool> IncrementUsageAsync(string key);
        Task ExpireOverdueAsync();
        Task<List<License>> GetUserLicensesAsync(Guid userId);
    }

    public class LicenseService : ILicenseService
    {
        private readonly AppDbContext _db;
        private readonly ILicenseKeyGenerator _gen;
        private readonly ILogger<LicenseService> _log;

        public LicenseService(AppDbContext db, ILicenseKeyGenerator gen, ILogger<LicenseService> log)
        { _db = db; _gen = gen; _log = log; }

        public async Task<License> CreateAsync(Guid userId, Guid productId, Guid planId, Guid? orderId = null)
        {
            var product = await _db.Products.FindAsync(productId)
                ?? throw new InvalidOperationException("Product not found.");
            var plan = await _db.Plans.FindAsync(planId)
                ?? throw new InvalidOperationException("Plan not found.");

            // Determine prefix from product slug
            var prefix = product.Slug == "email-verify" ? "EML" : "MOB";
            var key    = _gen.Generate(prefix);

            var license = new License
            {
                UserId    = userId,
                ProductId = productId,
                PlanId    = planId,
                OrderId   = orderId,
                Key       = key,
                KeyPrefix = prefix,
                Status    = LicenseStatus.Active,
                IssuedAt  = DateTime.UtcNow,
                ExpiresAt = DateTime.UtcNow.AddDays(plan.DurationDays),
                UsageResetDate = DateTime.UtcNow.AddMonths(1)
            };

            _db.Licenses.Add(license);
            await _db.SaveChangesAsync();
            _log.LogInformation("License {Key} issued to user {UserId}", key, userId);
            return license;
        }

        public async Task<(bool valid, License? license, string? error)> ActivateAsync(
            string key, string domain, string pluginVersion, string serverInfo)
        {
            var license = await _db.Licenses
                .Include(l => l.Plan)
                .Include(l => l.Product)
                .FirstOrDefaultAsync(l => l.Key == key);

            if (license == null) return (false, null, "License key not found.");
            if (license.Status == LicenseStatus.Revoked)   return (false, null, "License has been revoked.");
            if (license.Status == LicenseStatus.Suspended) return (false, null, "License is suspended.");
            if (license.IsExpired) { license.Status = LicenseStatus.Expired; await _db.SaveChangesAsync(); return (false, null, "License has expired. Please renew."); }

            // Domain enforcement
            if (!string.IsNullOrEmpty(license.InstalledDomain) &&
                license.InstalledDomain != domain &&
                license.Plan?.MaxDomains == 1)
                return (false, null, $"This license is bound to domain '{license.InstalledDomain}'. Upgrade for multi-domain support.");

            license.InstalledDomain = domain;
            license.ActivatedAt     = DateTime.UtcNow;
            license.InstalledBy     = serverInfo;
            license.ActivationCount++;
            await _db.SaveChangesAsync();
            return (true, license, null);
        }

        public async Task<LicenseValidationResponse> ValidateAsync(string key, string domain)
        {
            var license = await _db.Licenses
                .Include(l => l.Plan)
                .FirstOrDefaultAsync(l => l.Key == key);

            if (license == null) return new(false, "NotFound", 0, 0, "License not found.");
            if (license.IsExpired)
            {
                if (license.Status == LicenseStatus.Active) { license.Status = LicenseStatus.Expired; await _db.SaveChangesAsync(); }
                return new(false, "Expired", 0, 0, "License expired. Please renew your subscription.");
            }
            if (license.Status != LicenseStatus.Active) return new(false, license.Status.ToString(), 0, 0, "License is not active.");
            if (!string.IsNullOrEmpty(license.InstalledDomain) && license.InstalledDomain != domain)
                return new(false, "DomainMismatch", 0, 0, "Domain mismatch.");

            // Reset monthly usage if needed
            if (DateTime.UtcNow > license.UsageResetDate)
            {
                license.VerificationsThisMonth = 0;
                license.UsageResetDate = DateTime.UtcNow.AddMonths(1);
                await _db.SaveChangesAsync();
            }

            int left = (license.Plan?.MaxVerificationsPerMonth ?? 999999) - license.VerificationsThisMonth;
            return new(true, "Active", license.DaysLeft, Math.Max(0, left), null);
        }

        public async Task<bool> IncrementUsageAsync(string key)
        {
            var license = await _db.Licenses.Include(l => l.Plan).FirstOrDefaultAsync(l => l.Key == key);
            if (license == null || license.IsExpired) return false;
            license.VerificationsThisMonth++;
            await _db.SaveChangesAsync();
            return true;
        }

        public async Task ExpireOverdueAsync()
        {
            var overdue = await _db.Licenses
                .Where(l => l.Status == LicenseStatus.Active && l.ExpiresAt < DateTime.UtcNow)
                .ToListAsync();
            foreach (var l in overdue) l.Status = LicenseStatus.Expired;
            if (overdue.Any()) await _db.SaveChangesAsync();
            _log.LogInformation("Expired {Count} overdue licenses", overdue.Count);
        }

        public async Task<List<License>> GetUserLicensesAsync(Guid userId)
        {
            return await _db.Licenses
                .Include(l => l.Product)
                .Include(l => l.Plan)
                .Where(l => l.UserId == userId)
                .OrderByDescending(l => l.IssuedAt)
                .ToListAsync();
        }
    }
}
