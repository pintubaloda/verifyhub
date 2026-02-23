# 🔐 VerifyHub Platform — Complete Identity Verification SaaS

A full-stack SaaS for **selling** email and mobile QR verification plugins.
Customers buy a license key, install one `.cs` file, and all device telemetry streams to your secure base domain.

---

## 🏗️ Architecture Overview

```
VerifyHubPlatform/
├── backend/                       ← ASP.NET Core 8 API + SQLite
│   ├── Controllers/Controllers.cs ← Auth, Portal, Plugin, Telemetry, Admin
│   ├── Data/AppDbContext.cs        ← EF Core + seeded products & plans
│   ├── Models/Models.cs            ← All domain models + DTOs
│   ├── Services/AuthServices.cs   ← JWT, License key gen, Plugin auth
│   ├── Services/LicenseService.cs ← License lifecycle management
│   ├── Program.cs                 ← Startup, DI, background worker
│   └── appsettings.json           ← ⚠️  Change ALL secrets before deploy
│
├── frontend/                      ← React 18 + Vite (eye-catching UI)
│   └── src/pages/
│       ├── LandingPage.jsx        ← Animated marketing page
│       ├── AuthPage.jsx           ← Login + Register
│       └── DashboardPage.jsx      ← License management + telemetry viewer
│
└── plugins/                       ← Drop-in files for customer servers
    ├── email-plugin/
    │   └── EmailVerifyPlugin.cs   ← Complete email magic-link plugin
    └── mobile-plugin/
        └── MobileQrPlugin.cs      ← Complete mobile QR plugin
```

---

## 🌊 End-to-End Flow

### 1 — Selling Licenses (Your Platform)
```
Customer visits verifyhub.io  →  Eye-catching landing page
  ↓ Clicks "Get Started"
Registers account  →  Purchases plan  →  License key issued instantly
  EML-A3F2-9B1C-5E40-FF12   (Email plugin)
  MOB-7C1A-3D9E-2B80-AA44   (Mobile plugin)
```

### 2 — Plugin Install (Customer's ASP.NET Core App)
```
1. Copy EmailVerifyPlugin.cs (or MobileQrPlugin.cs) into project
2. Two lines in Program.cs:
     builder.Services.AddEmailVerifyPlugin(config);
     app.UseEmailVerifyPlugin();
3. License key in appsettings.json
4. dotnet run
```

**On first startup the plugin automatically:**
- Calls `POST https://api.verifyhub.io/api/plugin/activate`
- Validates license key, registers domain
- Creates `/magiclink` directory in wwwroot
- Receives a short-lived JWT plugin token

### 3 — Verification + Telemetry Routing
```
End-user on customer site → clicks Verify Email / Scan QR
     ↓
Browser collects: GPS, canvas hash, WebGL, battery, sensors...
     ↓
Plugin on customer server receives data
     ↓ [FORWARDED — not stored on customer server]
POST https://api.verifyhub.io/api/telemetry/push
     ↓
Stored in VerifyHub's own database
     ↓
Customer sees full device intelligence in /dashboard/telemetry
```

### 4 — License Expiry Protection
```
Background worker (hourly): marks overdue licenses as Expired
Plugin checks license every hour via /api/plugin/validate
  → { valid: false, status: "Expired" }
Plugin serves renewal popup to end-users automatically:
  ⚠️  "License Expired — Renew at verifyhub.io/dashboard"
No manual enforcement needed.
```

---

## 🚀 Running Locally

### Backend
```bash
cd backend
# ⚠️ Edit appsettings.json OR use .env with DATABASE_URL for PostgreSQL
dotnet restore
dotnet run
# → http://localhost:5000
# → DB auto-created with seed products & plans
```

**Use PostgreSQL locally (recommended):**
```bash
cd backend
cp .env.example .env
# set DATABASE_URL, Jwt__Secret, Jwt__PluginSecret, VerifyHub__LicenseHmacSecret
dotnet run
```

**Create first admin:**
```bash
# Register via API
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Admin","email":"admin@verifyhub.io","password":"Admin123!"}'

# Then open verifyhub.db in SQLite and set Role=1 for that user
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
# Proxies /api/* to localhost:5000 automatically
```

---

## ☁️ Deploying on Render (PostgreSQL)

This repository includes `/render.yaml` with:
- `verifyhub-postgres` (managed PostgreSQL)
- `verifyhub-api` (.NET 8 backend)
- `verifyhub-frontend` (static Vite frontend)

### Deploy steps
1. Push this project to GitHub.
2. In Render, create a **Blueprint** and select the repo.
3. Render will create DB + both services from `render.yaml`.
4. Wait for first deploy to finish.

### Important envs (already declared in blueprint)
- `DATABASE_URL` (from Render PostgreSQL connection string)
- `VITE_API_BASE_URL` (from backend service URL)
- `Jwt__Secret`, `Jwt__PluginSecret`, `VerifyHub__LicenseHmacSecret` (auto-generated)

### Notes
- Backend now supports `DATABASE_URL` in Postgres URL format.
- If `DATABASE_URL` is not provided, backend falls back to `ConnectionStrings:Default`.

---

## 🔌 Plugin Installation Guide (for customers)

### Email Verify Plugin

**Step 1** — Copy `plugins/email-plugin/EmailVerifyPlugin.cs` to your project.

**Step 2** — `Program.cs`:
```csharp
builder.Services.AddEmailVerifyPlugin(builder.Configuration);

var app = builder.Build();
app.UseEmailVerifyPlugin();
app.Run();
```

**Step 3** — `appsettings.json`:
```json
{
  "EmailVerifyPlugin": {
    "LicenseKey": "EML-XXXX-XXXX-XXXX",
    "BaseDomain": "https://api.verifyhub.io",
    "CompanyName": "Your Company",
    "PrimaryColor": "#6366F1",
    "Smtp": {
      "Host": "smtp.gmail.com",
      "Port": 587,
      "EnableSsl": true,
      "Username": "you@gmail.com",
      "Password": "your-app-password",
      "FromEmail": "noreply@yourcompany.com"
    }
  }
}
```

**Routes auto-created:**
| Route | Purpose |
|-------|---------|
| `GET  /magiclink/verify` | Verification page (shown to end-user) |
| `POST /magiclink/send` | Send magic link email |
| `POST /magiclink/api/click` | Handle token click |
| `POST /magiclink/api/confirm` | Verify 6-digit code |
| `POST /magiclink/api/fingerprint` | Receive + forward device data |
| `GET  /magiclink/license-status` | Check license validity |

---

### Mobile QR Plugin

**Step 1** — Copy `plugins/mobile-plugin/MobileQrPlugin.cs` to your project.

**Step 2** — `Program.cs`:
```csharp
builder.Services.AddMobileQrPlugin(builder.Configuration);

var app = builder.Build();
app.UseMobileQrPlugin();
app.MapHub<MobileQrHub>("/mobilehub"); // SignalR
app.Run();
```

**Step 3** — `appsettings.json`:
```json
{
  "MobileQrPlugin": {
    "LicenseKey": "MOB-XXXX-XXXX-XXXX",
    "BaseDomain": "https://api.verifyhub.io",
    "CompanyName": "Your Company",
    "PrimaryColor": "#6366F1",
    "QrExpiryMinutes": 5,
    "TelemetryInterval": 5
  }
}
```

**Routes auto-created:**
| Route | Purpose |
|-------|---------|
| `GET  /mobileverify` | Desktop QR display page |
| `GET  /mobileverify/scan/{token}` | Mobile scan page |
| `POST /mobileverify/create` | Create QR session |
| `GET  /mobileverify/status/{id}` | Poll session status |
| `POST /mobileverify/api/scan` | Mobile registers scan |
| `POST /mobileverify/api/telemetry` | Mobile pushes snapshots |
| `POST /mobileverify/api/verify` | Confirm phone number |

---

## 📡 API Reference (VerifyHub Backend)

### Public
| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/auth/register` | Register new user |
| `POST` | `/api/auth/login` | Login → JWT |
| `POST` | `/api/auth/refresh` | Refresh access token |
| `GET`  | `/api/products` | List all products + plans |

### Portal (requires user JWT)
| Method | Route | Description |
|--------|-------|-------------|
| `GET`  | `/api/portal/me` | Current user info |
| `GET`  | `/api/portal/licenses` | User's licenses |
| `POST` | `/api/portal/orders` | Purchase plan → license |
| `GET`  | `/api/portal/dashboard-stats` | Stats overview |
| `GET`  | `/api/telemetry/mine` | User's telemetry records |

### Plugin (called by installed plugins)
| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/plugin/activate` | Activate on install/startup |
| `POST` | `/api/plugin/validate` | Validate license + count usage |
| `GET`  | `/api/plugin/health` | Health ping |
| `POST` | `/api/telemetry/push` | Receive device telemetry |

### Admin (Admin role required)
| Method | Route | Description |
|--------|-------|-------------|
| `GET`  | `/api/admin/stats` | Platform-wide stats |
| `GET`  | `/api/admin/users` | All users |
| `GET`  | `/api/admin/licenses` | All licenses |
| `GET`  | `/api/admin/telemetry` | All telemetry |
| `POST` | `/api/admin/licenses/{id}/revoke` | Revoke a license |

---

## 🔑 License Key Format

```
Email plugin:  EML-A3F2-9B1C-5E40
Mobile plugin: MOB-7C1A-3D9E-2B80

Prefix  Segment1  Segment2  Segment3
 EML  -  A3F2   -  9B1C  -  5E40
```

- Cryptographically random (CSPRNG)
- Stored as unique index in DB
- Domain-locked on first activation (Starter/Pro plans)
- Multi-domain for Business plans

---

## 🛡️ Security Notes

| Feature | Detail |
|---------|--------|
| JWT Access Token | 1-hour expiry, HS256 |
| Refresh Token | 30-day rolling, revokable |
| Plugin Token | License-lifetime, separate secret |
| Password Hashing | BCrypt cost=10 |
| License Expiry | Background worker + plugin-side hourly check |
| Telemetry Auth | Requires valid plugin JWT in Authorization header |
| Domain Locking | First activation binds key to domain |

---

## ⚙️ Production Checklist

- [ ] Change `Jwt:Secret` in appsettings.json (min 32 chars)
- [ ] Change `Jwt:PluginSecret` 
- [ ] Change `VerifyHub:LicenseHmacSecret`
- [ ] Set `AllowedOrigins` to your real frontend domain
- [ ] Replace SQLite with PostgreSQL/SQL Server for production
- [ ] Add Stripe real keys for payments
- [ ] Add `[Authorize]` to admin routes
- [ ] Set up SSL/TLS (required for GPS on mobile)
- [ ] Configure SMTP for email sending
- [ ] Add Redis for distributed caching (multi-server)
- [ ] Set `BaseDomain` in plugins to your real API URL

---

## 📦 Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend API | ASP.NET Core 8, EF Core, SQLite |
| Auth | JWT Bearer + Refresh tokens |
| Plugins | Single-file .cs drop-ins, zero NuGet deps (Email) |
| Real-time | SignalR WebSockets (Mobile QR) |
| Frontend | React 18, Vite, React Router |
| Fonts | Syne (display) + DM Sans (body) + JetBrains Mono |
| Payments | Stripe (skeleton wired, needs real keys) |

---

## 📄 License

© 2025 VerifyHub. Proprietary.
