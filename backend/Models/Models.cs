using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace VerifyHubPortal.Models
{
    // ══════════════════════════════════════════
    // USERS
    // ══════════════════════════════════════════
    public class User
    {
        public Guid   Id           { get; set; } = Guid.NewGuid();
        [Required] public string Email    { get; set; } = string.Empty;
        [Required] public string Name     { get; set; } = string.Empty;
        [Required] public string PasswordHash { get; set; } = string.Empty;
        public UserRole Role       { get; set; } = UserRole.Customer;
        public bool IsActive       { get; set; } = true;
        public DateTime CreatedAt  { get; set; } = DateTime.UtcNow;
        public string? Company     { get; set; }
        public string? AvatarUrl   { get; set; }
        public bool EmailVerified  { get; set; } = false;
        public DateTime? EmailVerifiedAt { get; set; }
        public bool MobileVerified { get; set; } = false;
        public DateTime? MobileVerifiedAt { get; set; }
        public DateTime? VerificationCompletedAt { get; set; }
        public ICollection<License> Licenses { get; set; } = new List<License>();
        public ICollection<Order>   Orders   { get; set; } = new List<Order>();
    }

    public enum UserRole { Customer, Admin }

    // ══════════════════════════════════════════
    // PRODUCTS / PLANS
    // ══════════════════════════════════════════
    public class Product
    {
        public Guid   Id          { get; set; } = Guid.NewGuid();
        public string Name        { get; set; } = string.Empty;   // "Email Verify Plugin", "Mobile QR Plugin"
        public string Slug        { get; set; } = string.Empty;   // "email-verify", "mobile-qr"
        public string Description { get; set; } = string.Empty;
        public string Icon        { get; set; } = string.Empty;
        public bool   IsActive    { get; set; } = true;
        public ICollection<Plan>    Plans    { get; set; } = new List<Plan>();
        public ICollection<License> Licenses { get; set; } = new List<License>();
    }

    public class Plan
    {
        public Guid    Id              { get; set; } = Guid.NewGuid();
        public Guid    ProductId       { get; set; }
        public Product? Product        { get; set; }
        public string  Name            { get; set; } = string.Empty;  // "Starter", "Pro", "Enterprise"
        public decimal PriceUsd        { get; set; }
        public BillingCycle Cycle      { get; set; } = BillingCycle.Annual;
        public int     DurationDays    { get; set; } = 365;
        public int     MaxDomains      { get; set; } = 1;
        public int     MaxVerificationsPerMonth { get; set; } = 1000;
        public bool    IsPopular       { get; set; } = false;
        public string  StripeProductId { get; set; } = string.Empty;
        public string  StripePriceId   { get; set; } = string.Empty;
        public List<string> Features   { get; set; } = new();
    }

    public enum BillingCycle { Monthly, Annual }

    // ══════════════════════════════════════════
    // ORDERS
    // ══════════════════════════════════════════
    public class Order
    {
        public Guid    Id              { get; set; } = Guid.NewGuid();
        public Guid    UserId          { get; set; }
        public User?   User            { get; set; }
        public Guid    PlanId          { get; set; }
        public Plan?   Plan            { get; set; }
        public decimal AmountUsd       { get; set; }
        public OrderStatus Status      { get; set; } = OrderStatus.Pending;
        public string? StripeSessionId { get; set; }
        public string? StripePaymentId { get; set; }
        public DateTime CreatedAt      { get; set; } = DateTime.UtcNow;
        public DateTime? CompletedAt   { get; set; }
    }

    public enum OrderStatus { Pending, Completed, Refunded, Failed }

    // ══════════════════════════════════════════
    // LICENSE KEYS
    // ══════════════════════════════════════════
    public class License
    {
        public Guid    Id              { get; set; } = Guid.NewGuid();
        public Guid    UserId          { get; set; }
        public User?   User            { get; set; }
        public Guid    ProductId       { get; set; }
        public Product? Product        { get; set; }
        public Guid    PlanId          { get; set; }
        public Plan?   Plan            { get; set; }
        public Guid?   OrderId         { get; set; }

        // The key itself: EML-XXXX-XXXX-XXXX or MOB-XXXX-XXXX-XXXX
        [Required] public string Key   { get; set; } = string.Empty;
        public string KeyPrefix        { get; set; } = string.Empty;  // EML / MOB

        public LicenseStatus Status    { get; set; } = LicenseStatus.Active;
        public DateTime IssuedAt       { get; set; } = DateTime.UtcNow;
        public DateTime ExpiresAt      { get; set; }
        public bool IsExpired          => DateTime.UtcNow > ExpiresAt;
        public int DaysLeft            => Math.Max(0, (int)(ExpiresAt - DateTime.UtcNow).TotalDays);

        // Install / activation info
        public string? InstalledDomain { get; set; }  // domain where plugin is installed
        public DateTime? ActivatedAt   { get; set; }
        public string? InstalledBy     { get; set; }  // server hostname
        public int ActivationCount     { get; set; } = 0;

        // Usage counters (reset monthly)
        public int VerificationsThisMonth { get; set; } = 0;
        public DateTime UsageResetDate    { get; set; } = DateTime.UtcNow.AddMonths(1);

        public ICollection<TelemetryRecord> Telemetry { get; set; } = new List<TelemetryRecord>();
    }

    public enum LicenseStatus { Active, Expired, Suspended, Revoked }

    // ══════════════════════════════════════════
    // TELEMETRY (device data from plugin installs)
    // ══════════════════════════════════════════
    public class TelemetryRecord
    {
        public Guid    Id           { get; set; } = Guid.NewGuid();
        public Guid    LicenseId    { get; set; }
        public License? License     { get; set; }
        public string  SessionId    { get; set; } = string.Empty; // QR or Email session ID
        public string  Channel      { get; set; } = string.Empty; // "email" | "mobile"
        public string  PluginDomain { get; set; } = string.Empty; // where plugin is installed
        public DateTime ReceivedAt  { get; set; } = DateTime.UtcNow;

        // Device / network snapshot (mirror of MobileSnapshot)
        public string? IpAddress    { get; set; }
        public string? CountryCode  { get; set; }
        public string? City         { get; set; }
        public string? Isp          { get; set; }
        public bool    IsProxy      { get; set; }
        public bool    IsVpn        { get; set; }
        public bool    IsTor        { get; set; }
        public double? GpsLatitude  { get; set; }
        public double? GpsLongitude { get; set; }
        public string? BrowserName  { get; set; }
        public string? OsName       { get; set; }
        public string? DeviceType   { get; set; }
        public bool    IsMobile     { get; set; }
        public double? BatteryLevel { get; set; }
        public string? NetworkType  { get; set; }
        public string? CanvasHash   { get; set; }
        public int     RiskScore    { get; set; }
        public string? UserEmail    { get; set; }  // verified email or null
        public string? UserPhone    { get; set; }  // verified phone or null
        public string  RawJson      { get; set; } = "{}"; // full snapshot JSON
    }

    // ══════════════════════════════════════════
    // REFRESH TOKENS
    // ══════════════════════════════════════════
    public class RefreshToken
    {
        public Guid     Id        { get; set; } = Guid.NewGuid();
        public Guid     UserId    { get; set; }
        public User?    User      { get; set; }
        public string   Token     { get; set; } = string.Empty;
        public DateTime ExpiresAt { get; set; } = DateTime.UtcNow.AddDays(30);
        public bool     IsRevoked { get; set; } = false;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    // ══════════════════════════════════════════
    // DTOs
    // ══════════════════════════════════════════
    public record RegisterRequest(string Name, string Email, string Password, string? Company);
    public record LoginRequest(string Email, string Password);
    public record AuthResponse(string AccessToken, string RefreshToken, UserDto User);
    public record RefreshRequest(string Token);
    public record CreateOrderRequest(Guid PlanId);
    public record ActivatePluginRequest(string LicenseKey, string Domain, string PluginVersion, string ServerInfo);
    public record TelemetryPushRequest(string LicenseKey, string SessionId, string Channel, string SnapshotJson);
    public record ValidateLicenseRequest(string LicenseKey, string Domain);
    public record RenewLicenseRequest(Guid LicenseId);

    public record UserDto(
        Guid Id,
        string Name,
        string Email,
        string? Company,
        UserRole Role,
        DateTime CreatedAt,
        bool EmailVerified,
        DateTime? EmailVerifiedAt,
        bool MobileVerified,
        DateTime? MobileVerifiedAt,
        DateTime? VerificationCompletedAt
    );
    public record LicenseDto(Guid Id, string Key, string KeyPrefix, string ProductName, string PlanName,
        LicenseStatus Status, DateTime ExpiresAt, int DaysLeft, string? InstalledDomain,
        DateTime? ActivatedAt, int VerificationsThisMonth);
    public record ProductDto(Guid Id, string Name, string Slug, string Description, string Icon, List<PlanDto> Plans);
    public record PlanDto(Guid Id, string Name, decimal PriceUsd, BillingCycle Cycle, int DurationDays,
        int MaxDomains, int MaxVerificationsPerMonth, bool IsPopular, List<string> Features);
    public record LicenseValidationResponse(bool Valid, string Status, int DaysLeft,
        int VerificationsLeft, string? Error);
    public record AdminStatsDto(int TotalUsers, int TotalLicenses, int ActiveLicenses,
        int TotalTelemetryRecords, decimal TotalRevenue, int OrdersThisMonth);
}
