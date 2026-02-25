# Clarke & Associates CRM — Installation & Requirements Data Sheet

**Version:** 1.0.0  
**Date:** February 2026  
**Author:** Manus AI  

---

## 1. System Overview

The Clarke & Associates CRM is a full-stack web application designed for real estate companies focused on webinar-based lead generation. It provides landing page management, webinar scheduling with Zoom integration, lead pipeline tracking, deal management, automated email/SMS reminders, and a built-in Calendly-style scheduling system. The application is built on a modern JavaScript/TypeScript stack with a React frontend and Express/tRPC backend.

---

## 2. Server Requirements

The following table outlines the minimum and recommended server specifications for running the CRM in production.

| Requirement | Minimum | Recommended |
|---|---|---|
| **Operating System** | Ubuntu 22.04 LTS (or any Linux with Node.js support) | Ubuntu 22.04/24.04 LTS |
| **CPU** | 1 vCPU | 2+ vCPU |
| **RAM** | 1 GB | 2+ GB |
| **Disk Space** | 5 GB | 20+ GB (for file uploads and logs) |
| **Node.js** | v20.x LTS | v22.x LTS |
| **Package Manager** | pnpm v10.x | pnpm v10.4+ |
| **Database** | MySQL 8.0 / TiDB Serverless | MySQL 8.0+ or TiDB |
| **SSL/TLS** | Required for production | Let's Encrypt or managed SSL |
| **Network** | Port 80/443 open | Reverse proxy (Nginx/Caddy) |

---

## 3. Technology Stack

The CRM is built with the following technologies. All dependencies are managed through `pnpm` and defined in `package.json`.

### 3.1 Frontend

| Technology | Version | Purpose |
|---|---|---|
| React | 19.2.x | UI framework |
| TypeScript | 5.9.x | Type safety |
| Tailwind CSS | 4.1.x | Utility-first styling |
| Vite | 7.1.x | Build tool and dev server |
| tRPC React Query | 11.6.x | Type-safe API client |
| Recharts | 2.15.x | Dashboard charts and analytics |
| Radix UI | Various | Accessible UI primitives (Dialog, Select, Tabs, etc.) |
| Framer Motion | 12.x | Animations and micro-interactions |
| Lucide React | 0.453.x | Icon library |
| Sonner | 2.x | Toast notifications |
| @dnd-kit | 6.x / 10.x | Drag-and-drop for Kanban pipeline |
| Wouter | 3.3.x | Client-side routing |
| date-fns | 4.1.x | Date formatting and manipulation |

### 3.2 Backend

| Technology | Version | Purpose |
|---|---|---|
| Express | 4.21.x | HTTP server |
| tRPC Server | 11.6.x | Type-safe RPC procedures |
| Drizzle ORM | 0.44.x | Database ORM and migrations |
| MySQL2 | 3.15.x | MySQL driver |
| Jose | 6.1.x | JWT session management |
| Zod | 4.1.x | Input validation |
| AWS SDK (S3) | 3.693.x | File storage (artwork, PDFs) |
| Superjson | 1.13.x | Serialization (Date, BigInt support) |
| Axios | 1.12.x | HTTP client for external APIs |

### 3.3 Development Tools

| Tool | Version | Purpose |
|---|---|---|
| Vitest | 2.1.x | Unit testing |
| Drizzle Kit | 0.31.x | Database migration management |
| esbuild | 0.25.x | Production server bundling |
| Prettier | 3.6.x | Code formatting |
| tsx | 4.19.x | TypeScript execution in development |

---

## 4. Database Schema

The CRM uses a MySQL-compatible database with 12 tables. The following diagram describes the table structure.

| Table | Description | Key Fields |
|---|---|---|
| `users` | CRM agents and admin accounts | id, openId, name, email, role, schedulingSlug |
| `integrations` | Zoom and Google Calendar OAuth tokens | provider, accessToken, refreshToken, accountEmail |
| `webinars` | Webinar events | title, scheduledAt, durationMinutes, zoomJoinUrl, landingPageId, status |
| `webinar_sessions` | Multiple date/time sessions per webinar | webinarId, sessionDate, label, zoomJoinUrl |
| `landing_pages` | Lead capture pages with configurable fields | slug, headline, enabledFields, artworkUrl, confirmationPdfUrl, webinarId |
| `leads` | Central lead database | firstName, lastName, email, phone, stage, score, webinarId, attendanceStatus |
| `activity_log` | Timeline of all lead interactions | leadId, type, title, content |
| `sms_messages` | Two-way SMS message history | leadId, direction, body, status |
| `email_reminders` | Scheduled email reminders and confirmations | leadId, webinarId, type, scheduledAt, attachmentUrl |
| `deals` | Deal/opportunity tracking with values | leadId, title, value, stage, propertyAddress |
| `availability` | Agent scheduling availability slots | userId, dayOfWeek, startTime, endTime |
| `bookings` | Consultation booking records | userId, leadId, guestName, scheduledAt, status |

### 4.1 Lead Pipeline Stages

The lead pipeline follows this progression through the CRM:

| Stage | Description |
|---|---|
| `new_lead` | Freshly captured lead, not yet engaged |
| `registered` | Registered for a webinar |
| `attended` | Attended the webinar |
| `no_show` | Registered but did not attend |
| `consultation_booked` | Booked a consultation call |
| `under_contract` | Active deal in progress |
| `closed` | Deal completed |

### 4.2 Deal Stages

| Stage | Description |
|---|---|
| `prospect` | Initial opportunity identified |
| `qualified` | Lead qualified for a deal |
| `proposal` | Proposal presented |
| `negotiation` | Active negotiation |
| `closed_won` | Deal successfully closed |
| `closed_lost` | Deal lost |

---

## 5. Environment Variables

The following environment variables must be configured for the application to function correctly. System-managed variables are automatically injected in the Manus hosting environment. For self-hosted deployments, these must be set manually.

### 5.1 Required System Variables

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | MySQL/TiDB connection string | `mysql://user:pass@host:3306/clarke_crm?ssl={"rejectUnauthorized":true}` |
| `JWT_SECRET` | Secret key for signing session cookies (min 32 chars) | `a-long-random-string-at-least-32-characters` |
| `NODE_ENV` | Runtime environment | `production` |

### 5.2 OAuth / Authentication Variables

| Variable | Description | Example |
|---|---|---|
| `VITE_APP_ID` | Manus OAuth application ID | `app_xxxx` |
| `OAUTH_SERVER_URL` | Manus OAuth backend base URL | `https://api.manus.im` |
| `VITE_OAUTH_PORTAL_URL` | Manus login portal URL (frontend) | `https://auth.manus.im` |
| `OWNER_OPEN_ID` | Owner's Manus OpenID | `user_xxxx` |
| `OWNER_NAME` | Owner's display name | `Clarke Admin` |

### 5.3 File Storage (S3-Compatible)

| Variable | Description | Example |
|---|---|---|
| `S3_BUCKET` | S3 bucket name | `clarke-crm-uploads` |
| `S3_REGION` | S3 region | `us-east-1` |
| `S3_ACCESS_KEY_ID` | S3 access key | `AKIAIOSFODNN7EXAMPLE` |
| `S3_SECRET_ACCESS_KEY` | S3 secret key | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| `S3_ENDPOINT` | S3 endpoint (for non-AWS providers) | `https://s3.us-east-1.amazonaws.com` |

### 5.4 API Services (Built-in)

| Variable | Description |
|---|---|
| `BUILT_IN_FORGE_API_URL` | Manus built-in API endpoint (LLM, notifications, etc.) |
| `BUILT_IN_FORGE_API_KEY` | Bearer token for server-side Manus API access |
| `VITE_FRONTEND_FORGE_API_KEY` | Bearer token for frontend Manus API access |
| `VITE_FRONTEND_FORGE_API_URL` | Manus API URL for frontend |

### 5.5 Optional Integration Variables

These are configured through the CRM Settings page at runtime, not as environment variables.

| Integration | Configuration Method |
|---|---|
| **Zoom** | OAuth tokens stored in `integrations` table via Settings UI |
| **Google Calendar** | OAuth tokens stored in `integrations` table via Settings UI |
| **SMS (Twilio)** | Add `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` as env vars |
| **Email (SendGrid)** | Add `SENDGRID_API_KEY` as env var and update `server/emailService.ts` |

---

## 6. Installation Steps

### 6.1 Prerequisites

Ensure the following are installed on your server before proceeding:

```bash
# Install Node.js 22.x (via nvm or NodeSource)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install pnpm
npm install -g pnpm@10

# Verify installations
node --version    # Should be v22.x.x
pnpm --version    # Should be v10.x.x
```

### 6.2 Clone and Install Dependencies

```bash
# Clone the repository (or copy the project files)
git clone <repository-url> /opt/clarke-crm
cd /opt/clarke-crm

# Install all dependencies
pnpm install
```

### 6.3 Configure Environment Variables

Create a `.env` file in the project root with all required variables:

```bash
cp .env.example .env
# Edit .env with your actual values
nano .env
```

Ensure `DATABASE_URL` points to your MySQL instance with SSL enabled for production:

```
DATABASE_URL=mysql://crm_user:secure_password@db-host:3306/clarke_crm?ssl={"rejectUnauthorized":true}
```

### 6.4 Initialize the Database

Run the Drizzle migration to create all tables:

```bash
pnpm db:push
```

This command generates SQL migration files and applies them to the database. Verify the tables were created:

```bash
# Connect to MySQL and check
mysql -u crm_user -p -h db-host clarke_crm -e "SHOW TABLES;"
```

You should see 12 tables: `users`, `integrations`, `webinars`, `webinar_sessions`, `landing_pages`, `leads`, `activity_log`, `sms_messages`, `email_reminders`, `deals`, `availability`, `bookings`.

### 6.5 Build for Production

```bash
pnpm build
```

This runs `vite build` for the frontend and `esbuild` for the server, outputting to the `dist/` directory.

### 6.6 Start the Application

```bash
# Production start
pnpm start

# Or with a process manager (recommended)
pm2 start dist/index.js --name clarke-crm
```

The server will start on the port defined by the `PORT` environment variable (defaults to 3000). In production, place a reverse proxy (Nginx or Caddy) in front to handle SSL termination.

### 6.7 Reverse Proxy Configuration (Nginx Example)

```nginx
server {
    listen 443 ssl http2;
    server_name crm.clarkeandassociates.com;

    ssl_certificate /etc/letsencrypt/live/crm.clarkeandassociates.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/crm.clarkeandassociates.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

server {
    listen 80;
    server_name crm.clarkeandassociates.com;
    return 301 https://$host$request_uri;
}
```

---

## 7. Post-Installation Setup

After the application is running, complete these steps through the CRM interface:

### 7.1 Create Admin Account

The first user to log in via Manus OAuth whose `openId` matches the `OWNER_OPEN_ID` environment variable will automatically be assigned the `admin` role. All subsequent users will be assigned the `user` role by default. To promote additional admins, update the `role` field in the `users` table directly:

```sql
UPDATE users SET role = 'admin' WHERE email = 'agent@clarkeandassociates.com';
```

### 7.2 Connect Zoom Integration

Navigate to **Settings > Integrations** in the CRM and enter your Zoom OAuth credentials. To obtain these credentials, create a Server-to-Server OAuth app in the Zoom Marketplace at [marketplace.zoom.us](https://marketplace.zoom.us):

1. Create a new Server-to-Server OAuth app
2. Add the required scopes: `webinar:read`, `webinar:write`, `user:read`
3. Copy the Account ID, Client ID, and Client Secret
4. Enter these in the CRM Settings page

### 7.3 Connect Google Calendar

Navigate to **Settings > Integrations** and enter your Google OAuth credentials. Create a project in the Google Cloud Console at [console.cloud.google.com](https://console.cloud.google.com):

1. Enable the Google Calendar API
2. Create OAuth 2.0 credentials
3. Add the redirect URI: `https://your-domain.com/api/oauth/google/callback`
4. Enter the Client ID and Client Secret in the CRM Settings page

### 7.4 Configure Email Provider (Optional)

To enable real email delivery (confirmation emails, reminders), integrate an email provider by editing `server/emailService.ts`. The default implementation logs emails and sends owner notifications. For SendGrid integration:

```typescript
import sgMail from "@sendgrid/mail";
sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  const msg = {
    to: payload.to,
    from: "noreply@clarkeandassociates.com",
    subject: payload.subject,
    html: payload.body,
    attachments: payload.attachmentUrl ? [{
      content: await fetchBase64(payload.attachmentUrl),
      filename: payload.attachmentName || "attachment.pdf",
      type: "application/pdf",
    }] : undefined,
  };
  await sgMail.send(msg);
  return true;
}
```

### 7.5 Configure SMS Provider (Optional)

To enable SMS messaging, integrate Twilio by adding the following environment variables and updating `server/routers/sms.ts`:

```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+15551234567
```

---

## 8. File Structure

The following is the complete project directory structure with descriptions of key files:

```
clarke-crm/
├── client/                      # Frontend application
│   ├── index.html               # HTML entry point (Google Fonts loaded here)
│   ├── public/                  # Static assets
│   └── src/
│       ├── App.tsx              # Route definitions and layout
│       ├── index.css            # Global styles and design tokens
│       ├── main.tsx             # React entry point with providers
│       ├── components/          # Reusable UI components
│       │   ├── DashboardLayout.tsx  # Sidebar navigation layout
│       │   └── ui/              # shadcn/ui component library
│       └── pages/               # Page-level components
│           ├── Home.tsx         # Analytics dashboard
│           ├── Leads.tsx        # Lead list with search/filter
│           ├── LeadProfile.tsx  # Individual lead view with timeline
│           ├── Pipeline.tsx     # Kanban drag-and-drop pipeline
│           ├── Webinars.tsx     # Webinar management
│           ├── WebinarDetail.tsx # Webinar detail with attendance
│           ├── LandingPages.tsx # Landing page builder
│           ├── Deals.tsx        # Deal management
│           ├── Revenue.tsx      # Revenue dashboard
│           ├── Scheduling.tsx   # Availability and bookings
│           ├── Settings.tsx     # Integration settings
│           ├── PublicLandingPage.tsx  # Public lead capture page
│           └── PublicBooking.tsx     # Public booking page
├── server/                      # Backend application
│   ├── _core/                   # Framework internals (do not modify)
│   │   ├── index.ts             # Express server entry point
│   │   ├── context.ts           # tRPC context builder
│   │   ├── trpc.ts              # tRPC initialization
│   │   ├── env.ts               # Environment variable access
│   │   ├── llm.ts               # LLM integration helper
│   │   ├── notification.ts      # Owner notification helper
│   │   └── oauth.ts             # OAuth flow handler
│   ├── db.ts                    # Database query helpers
│   ├── routers.ts               # Main router aggregation
│   ├── routers/                 # Feature-specific routers
│   │   ├── leads.ts             # Lead CRUD and capture
│   │   ├── webinars.ts          # Webinar management
│   │   ├── landingPages.ts      # Landing page builder
│   │   ├── deals.ts             # Deal tracking
│   │   ├── sms.ts               # SMS messaging
│   │   ├── analytics.ts         # Dashboard metrics
│   │   ├── scheduling.ts        # Availability and bookings
│   │   └── integrations.ts      # Zoom/Google Calendar
│   ├── emailService.ts          # Email sending and templates
│   ├── storage.ts               # S3 file upload helpers
│   ├── crm.test.ts              # Core feature tests (37 tests)
│   ├── enhanced.test.ts         # Enhanced feature tests (12 tests)
│   └── auth.logout.test.ts      # Auth test (1 test)
├── drizzle/                     # Database schema and migrations
│   └── schema.ts                # All table definitions
├── shared/                      # Shared constants and types
├── package.json                 # Dependencies and scripts
├── tsconfig.json                # TypeScript configuration
├── vite.config.ts               # Vite build configuration
└── drizzle.config.ts            # Drizzle ORM configuration
```

---

## 9. Available Scripts

| Script | Command | Description |
|---|---|---|
| Development server | `pnpm dev` | Start the dev server with hot reload |
| Production build | `pnpm build` | Build frontend and bundle server |
| Production start | `pnpm start` | Start the production server |
| Type check | `pnpm check` | Run TypeScript type checking |
| Run tests | `pnpm test` | Execute all Vitest test suites |
| Database migration | `pnpm db:push` | Generate and apply database migrations |
| Format code | `pnpm format` | Run Prettier on all files |

---

## 10. Feature Matrix

The following table provides a complete feature inventory with implementation status.

| Feature | Status | Description |
|---|---|---|
| Landing Page Builder | Implemented | Create pages with custom slugs, configurable fields, artwork upload |
| Lead Capture Forms | Implemented | First Name, Last Name, Email, Phone with opt-in consent |
| Seminar Date Selection | Implemented | Leads choose from available webinar sessions |
| Artwork Upload | Implemented | Hero image upload per landing page (S3 storage) |
| PDF Attachment | Implemented | Attach PDF to confirmation emails |
| Confirmation Emails | Implemented | Auto-send on registration with template placeholders |
| Zoom Integration | Implemented | Connect account, store join URLs, track attendance |
| Google Calendar Sync | Implemented | Create events for webinars and consultations |
| Lead Management | Implemented | Central database with search, filter, and profile view |
| Activity Timeline | Implemented | Notes, stage changes, emails, SMS history per lead |
| Kanban Pipeline | Implemented | 7-stage drag-and-drop pipeline |
| Email Reminders | Implemented | Immediate, 24h, 1h, 10min before webinar |
| No-Show Follow-up | Implemented | Auto-send replay link to no-shows |
| Deal Tracking | Implemented | Value tracking with 6-stage deal pipeline |
| Revenue Dashboard | Implemented | Pipeline value, closed revenue, win rate charts |
| Analytics Dashboard | Implemented | KPIs, leads by source, attendance rate |
| Scheduling System | Implemented | Calendly-style availability and booking |
| SMS Messaging | Implemented | Two-way SMS with consent tracking |
| LLM Lead Scoring | Implemented | AI-powered lead scoring 0-100 |
| Mobile Responsive | Implemented | Full responsive design across all pages |

---

## 11. Security Considerations

The following security measures are implemented or recommended for production deployment:

1. **Authentication** is handled via Manus OAuth with JWT session cookies. All CRM pages require authentication through `protectedProcedure` middleware.

2. **Input Validation** is enforced on all tRPC procedures using Zod schemas. No raw user input reaches the database without validation.

3. **SQL Injection Protection** is provided by Drizzle ORM's parameterized queries. No raw SQL strings are constructed from user input.

4. **File Upload Security**: Uploaded files (artwork, PDFs) are stored in S3 with unique keys. File size limits are enforced (10MB for images, 25MB for PDFs).

5. **SMS Consent**: SMS messages can only be sent to leads who have explicitly opted in (`smsConsent: true`). The system rejects messages to non-consenting leads.

6. **HTTPS**: All production deployments should use HTTPS. The session cookie is configured with `Secure`, `HttpOnly`, and `SameSite` attributes.

7. **Role-Based Access**: The `role` field on users supports `admin` and `user` roles. Admin-only operations check `ctx.user.role` before proceeding.

---

## 12. Backup and Maintenance

### 12.1 Database Backups

Schedule regular MySQL backups using `mysqldump` or your cloud provider's automated backup service:

```bash
# Daily backup script
mysqldump -u crm_user -p clarke_crm | gzip > /backups/clarke_crm_$(date +%Y%m%d).sql.gz
```

### 12.2 File Storage Backups

S3 files (artwork, PDFs) should be backed up using S3 versioning or cross-region replication. Enable versioning on your S3 bucket:

```bash
aws s3api put-bucket-versioning --bucket clarke-crm-uploads --versioning-configuration Status=Enabled
```

### 12.3 Application Updates

To update the application:

```bash
cd /opt/clarke-crm
git pull origin main
pnpm install
pnpm db:push       # Apply any new migrations
pnpm build
pm2 restart clarke-crm
```

### 12.4 Log Monitoring

Application logs are written to stdout. When using PM2, logs are stored in `~/.pm2/logs/`. Monitor for errors:

```bash
pm2 logs clarke-crm --lines 100
```

---

## 13. Troubleshooting

| Issue | Solution |
|---|---|
| Database connection fails | Verify `DATABASE_URL` is correct and the MySQL server is accessible. Ensure SSL is configured for remote connections. |
| OAuth login fails | Check that `VITE_APP_ID`, `OAUTH_SERVER_URL`, and `VITE_OAUTH_PORTAL_URL` are correctly set. |
| File uploads fail | Verify S3 credentials and bucket permissions. Ensure the bucket allows public read access for uploaded files. |
| Email reminders not sending | Check that the email service is configured in `server/emailService.ts`. The default implementation only logs emails. |
| SMS not sending | Ensure Twilio credentials are configured and the lead has `smsConsent: true`. |
| Zoom integration not working | Verify Zoom OAuth tokens in the Settings page. Tokens may need to be refreshed. |
| Build fails | Run `pnpm check` to identify TypeScript errors. Ensure all dependencies are installed with `pnpm install`. |
| Migration fails | Check database connectivity and permissions. The user needs CREATE, ALTER, DROP, INSERT, UPDATE, DELETE privileges. |

---

## 14. Support and Contact

For technical support, feature requests, or bug reports related to the Manus hosting platform, submit a request at [https://help.manus.im](https://help.manus.im).

For application-specific customization and development inquiries, refer to the codebase documentation in the `server/` and `client/` directories, or consult the inline code comments throughout the project.
