using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using VerifyHubPortal.Models;

namespace VerifyHubPortal.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        public DbSet<User>            Users            { get; set; }
        public DbSet<Product>         Products         { get; set; }
        public DbSet<Plan>            Plans            { get; set; }
        public DbSet<Order>           Orders           { get; set; }
        public DbSet<License>         Licenses         { get; set; }
        public DbSet<TelemetryRecord> TelemetryRecords { get; set; }
        public DbSet<RefreshToken>    RefreshTokens    { get; set; }

        protected override void OnModelCreating(ModelBuilder b)
        {
            // JSON columns for lists
            b.Entity<Plan>().Property(p => p.Features)
                .HasConversion(
                    v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                    v => JsonSerializer.Deserialize<List<string>>(v, (JsonSerializerOptions?)null) ?? new());

            b.Entity<User>().HasIndex(u => u.Email).IsUnique();
            b.Entity<License>().HasIndex(l => l.Key).IsUnique();
            b.Entity<RefreshToken>().HasIndex(r => r.Token).IsUnique();

            // Cascade rules
            b.Entity<License>()
                .HasMany(l => l.Telemetry)
                .WithOne(t => t.License)
                .HasForeignKey(t => t.LicenseId)
                .OnDelete(DeleteBehavior.Cascade);

            // Seed products
            var emailProductId  = Guid.Parse("11111111-0000-0000-0000-000000000001");
            var mobileProductId = Guid.Parse("11111111-0000-0000-0000-000000000002");

            b.Entity<Product>().HasData(
                new Product { Id = emailProductId,  Name = "Email Verify Plugin",  Slug = "email-verify",  Description = "Magic link + 6-digit code email verification with device fingerprinting.", Icon = "✉",  IsActive = true },
                new Product { Id = mobileProductId, Name = "Mobile QR Plugin",     Slug = "mobile-qr",     Description = "QR-scan mobile verification with real-time GPS & sensor telemetry.",       Icon = "📱", IsActive = true }
            );

            // Seed plans
            b.Entity<Plan>().HasData(
                // Email Verify – Starter
                new Plan { Id = Guid.Parse("22222222-0000-0000-0000-000000000001"), ProductId = emailProductId,  Name = "Starter", PriceUsd = 29m,  Cycle = BillingCycle.Annual, DurationDays = 365, MaxDomains = 1, MaxVerificationsPerMonth = 500,    IsPopular = false, Features = new(){"Up to 500 verifications/mo","1 domain","Email magic link + code","Basic fingerprinting","Email support"} },
                new Plan { Id = Guid.Parse("22222222-0000-0000-0000-000000000002"), ProductId = emailProductId,  Name = "Pro",     PriceUsd = 79m,  Cycle = BillingCycle.Annual, DurationDays = 365, MaxDomains = 3, MaxVerificationsPerMonth = 5000,   IsPopular = true,  Features = new(){"Up to 5,000 verifications/mo","3 domains","Full device fingerprinting","IP geolocation + risk scoring","GPS capture","Canvas & WebGL fingerprint","Priority support","Admin dashboard access"} },
                new Plan { Id = Guid.Parse("22222222-0000-0000-0000-000000000003"), ProductId = emailProductId,  Name = "Enterprise", PriceUsd = 199m, Cycle = BillingCycle.Annual, DurationDays = 365, MaxDomains = 10, MaxVerificationsPerMonth = 50000, IsPopular = false, Features = new(){"Unlimited verifications","10 domains","All Pro features","Telemetry dashboard","CSV / JSON export","SLA + dedicated support","White-label option"} },
                // Mobile QR – Starter
                new Plan { Id = Guid.Parse("22222222-0000-0000-0000-000000000004"), ProductId = mobileProductId, Name = "Starter", PriceUsd = 39m,  Cycle = BillingCycle.Annual, DurationDays = 365, MaxDomains = 1, MaxVerificationsPerMonth = 200,    IsPopular = false, Features = new(){"Up to 200 QR sessions/mo","1 domain","Real-time GPS","Device & sensor telemetry","Email support"} },
                new Plan { Id = Guid.Parse("22222222-0000-0000-0000-000000000005"), ProductId = mobileProductId, Name = "Pro",     PriceUsd = 99m,  Cycle = BillingCycle.Annual, DurationDays = 365, MaxDomains = 3, MaxVerificationsPerMonth = 2000,   IsPopular = true,  Features = new(){"Up to 2,000 QR sessions/mo","3 domains","SignalR real-time push","GPS + motion sensor capture","Full network analysis","Risk scoring","Admin dashboard"} },
                new Plan { Id = Guid.Parse("22222222-0000-0000-0000-000000000006"), ProductId = mobileProductId, Name = "Enterprise", PriceUsd = 249m, Cycle = BillingCycle.Annual, DurationDays = 365, MaxDomains = 10, MaxVerificationsPerMonth = 20000, IsPopular = false, Features = new(){"Unlimited QR sessions","10 domains","All Pro features","Central telemetry dashboard","Dedicated telemetry stream","White-label ready","Priority SLA"} }
            );
        }
    }
}
