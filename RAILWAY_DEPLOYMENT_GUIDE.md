# Railway Deployment Guide — Clarke & Associates CRM

This guide walks you through deploying the Clarke & Associates CRM on [Railway](https://railway.app), a platform-as-a-service that handles infrastructure, SSL, and auto-deployments so you can focus on your business.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Export Code to GitHub](#2-export-code-to-github)
3. [Create a Railway Account](#3-create-a-railway-account)
4. [Create a New Project](#4-create-a-new-project)
5. [Add a MySQL Database](#5-add-a-mysql-database)
6. [Configure Environment Variables](#6-configure-environment-variables)
7. [Configure Build and Start Commands](#7-configure-build-and-start-commands)
8. [Deploy](#8-deploy)
9. [Run Database Migrations](#9-run-database-migrations)
10. [Set Up a Custom Domain](#10-set-up-a-custom-domain)
11. [Verify Everything Works](#11-verify-everything-works)
12. [Ongoing Maintenance](#12-ongoing-maintenance)
13. [Estimated Monthly Cost](#13-estimated-monthly-cost)
14. [Troubleshooting](#14-troubleshooting)
15. [Railway CLI Reference](#15-railway-cli-reference)

---

## 1. Prerequisites

Before you begin, ensure you have the following ready:

| Requirement | Where to Get It |
|---|---|
| GitHub account | [github.com](https://github.com) |
| Railway account | [railway.app](https://railway.app) (free to sign up) |
| Manus OAuth credentials | Your Manus developer settings (App ID, OAuth URLs, Owner Open ID) |
| Zoom API keys (optional) | [Zoom Marketplace](https://marketplace.zoom.us) — create a Server-to-Server OAuth app |
| Google OAuth credentials (optional) | [Google Cloud Console](https://console.cloud.google.com) — create OAuth 2.0 credentials |
| Twilio credentials (optional) | [Twilio Console](https://console.twilio.com) — for SMS functionality |
| SendGrid API key (optional) | [SendGrid](https://sendgrid.com) — for email delivery |

The optional integrations can be added later. The CRM functions fully without them, using simulated responses for Zoom and Google Calendar until real credentials are provided.

---

## 2. Export Code to GitHub

In the Manus Management UI:

1. Open the **Settings** panel (gear icon in the sidebar).
2. Navigate to the **GitHub** tab.
3. Click **Export to GitHub**.
4. Choose your GitHub account as the owner.
5. Enter a repository name (e.g., `clarke-crm`).
6. Click **Export** — this creates a private repository with the full project code.

Alternatively, if you have the code locally, push it to a new GitHub repository:

```bash
git init
git add .
git commit -m "Initial commit - Clarke & Associates CRM"
git remote add origin https://github.com/YOUR_USERNAME/clarke-crm.git
git push -u origin main
```

---

## 3. Create a Railway Account

1. Go to [railway.app](https://railway.app) and click **Sign Up**.
2. Choose **Sign in with GitHub** — this links your GitHub account for seamless repository access.
3. Complete the onboarding flow. Railway offers a free trial with $5 of credits to get started.
4. You will land on your Railway dashboard, ready to create your first project.

---

## 4. Create a New Project

1. On the Railway dashboard, click **New Project**.
2. Select **Deploy from GitHub repo**.
3. If prompted, authorize Railway to access your GitHub repositories.
4. Find and select the `clarke-crm` repository from the list.
5. Railway will detect the project and begin preparing for deployment (do not deploy yet — you need to configure the database and environment variables first).

---

## 5. Add a MySQL Database

The CRM requires a MySQL 8.0+ database. Railway provisions managed databases with one click.

1. Inside your Railway project canvas, click **New** (the "+" button).
2. Select **Database** → **MySQL**.
3. Railway provisions a MySQL instance in seconds. You will see it appear as a separate service on the project canvas.
4. Click on the MySQL service to view its details.
5. Go to the **Variables** tab and note the `DATABASE_URL` — Railway formats it as:
   ```
   mysql://root:PASSWORD@HOST:PORT/railway
   ```
6. You will reference this variable in the next step.

---

## 6. Configure Environment Variables

Click on your **clarke-crm** web service (not the database) and navigate to the **Variables** tab. Add each variable below.

### Required Variables

| Variable | Value | How to Set |
|---|---|---|
| `DATABASE_URL` | *(reference from MySQL service)* | Click **Add Reference Variable** → select the MySQL service → choose `DATABASE_URL`. Railway auto-links it. |
| `JWT_SECRET` | A random 64-character string | Generate one at [randomkeygen.com](https://randomkeygen.com) or run `openssl rand -hex 32` in your terminal. |
| `NODE_ENV` | `production` | Type it directly. |
| `VITE_APP_TITLE` | `Clarke & Associates CRM` | Your application display name. |
| `VITE_APP_ID` | *(your Manus OAuth App ID)* | From your Manus developer settings. |
| `OAUTH_SERVER_URL` | *(your Manus OAuth base URL)* | From your Manus developer settings. |
| `VITE_OAUTH_PORTAL_URL` | *(your Manus login portal URL)* | From your Manus developer settings. |
| `OWNER_OPEN_ID` | *(your Manus Open ID)* | Your unique account identifier from Manus. |
| `OWNER_NAME` | Your full name | e.g., `Scott Boerstra` |

### Optional Integration Variables

Add these when you are ready to activate each integration:

| Variable | Purpose | Where to Get It |
|---|---|---|
| `ZOOM_CLIENT_ID` | Zoom webinar creation | Zoom Marketplace → your Server-to-Server OAuth app |
| `ZOOM_CLIENT_SECRET` | Zoom API authentication | Same Zoom app settings |
| `GOOGLE_CLIENT_ID` | Google Calendar sync | Google Cloud Console → APIs & Services → Credentials |
| `GOOGLE_CLIENT_SECRET` | Google Calendar authentication | Same Google credentials page |
| `TWILIO_ACCOUNT_SID` | SMS sending | Twilio Console dashboard |
| `TWILIO_AUTH_TOKEN` | SMS authentication | Twilio Console dashboard |
| `TWILIO_PHONE_NUMBER` | SMS sender number | Your Twilio phone number (e.g., `+15551234567`) |
| `SENDGRID_API_KEY` | Email delivery | SendGrid → Settings → API Keys → Create API Key |

### S3 Storage Variables (for media uploads)

If you want to use your own S3 bucket for media library uploads (artwork, logos, PDFs):

| Variable | Purpose |
|---|---|
| `S3_BUCKET` | Your S3 bucket name |
| `S3_REGION` | AWS region (e.g., `us-east-1`) |
| `S3_ACCESS_KEY_ID` | IAM access key with S3 permissions |
| `S3_SECRET_ACCESS_KEY` | IAM secret key |
| `S3_ENDPOINT` | Custom endpoint (leave blank for AWS S3) |

---

## 7. Configure Build and Start Commands

In your clarke-crm service, go to **Settings** and configure:

| Setting | Value |
|---|---|
| **Build Command** | `pnpm install && pnpm build` |
| **Start Command** | `pnpm start` |
| **Root Directory** | *(leave blank — uses repository root)* |
| **Watch Paths** | *(leave default)* |

Railway automatically detects the `package.json` and uses pnpm as the package manager.

---

## 8. Deploy

Once environment variables and build commands are configured:

1. Railway triggers an automatic deployment. If it does not, click **Deploy** manually.
2. Watch the **Deploy Logs** tab. You will see:
   - **Build phase:** Installing dependencies, compiling TypeScript, bundling with Vite and esbuild.
   - **Start phase:** The Express server starting on the assigned port.
3. A typical build takes 2–3 minutes.
4. When the deployment status changes to **Active** with a green indicator, the app is live.

If the build fails, check the deploy logs for error messages. Common issues are covered in the Troubleshooting section below.

---

## 9. Run Database Migrations

The database tables need to be created on first deployment. There are two approaches:

### Option A: Temporary Start Command (No CLI Required)

1. In your clarke-crm service, go to **Settings**.
2. Change the **Start Command** to:
   ```
   pnpm db:push && pnpm start
   ```
3. Click **Redeploy** to trigger a new deployment.
4. Watch the deploy logs — you will see Drizzle generating and running migrations.
5. After successful deployment, change the Start Command back to:
   ```
   pnpm start
   ```
6. Redeploy one more time.

### Option B: Railway CLI (Recommended)

Install the Railway CLI and run migrations directly:

```bash
# Install the Railway CLI
npm install -g @railway/cli

# Log in to your Railway account
railway login

# Link to your project (follow the interactive prompts)
railway link

# Run database migrations
railway run pnpm db:push

# Verify tables were created
railway run npx drizzle-kit studio
```

---

## 10. Set Up a Custom Domain

### Using Railway's Free Domain

Railway automatically provides a domain like:
```
clarke-crm-production.up.railway.app
```

This works immediately with HTTPS. You can find it in your service's **Settings** → **Networking** section.

### Adding a Custom Domain

To use your own domain (e.g., `crm.clarkeandassociates.com`):

1. In your clarke-crm service, go to **Settings** → **Networking**.
2. Click **Custom Domain**.
3. Enter your domain name: `crm.clarkeandassociates.com`.
4. Railway displays a **CNAME record** value.
5. Go to your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.) and add a DNS record:

   | Type | Name | Value |
   |---|---|---|
   | CNAME | `crm` | *(the value Railway provided)* |

6. Wait for DNS propagation (typically 5–30 minutes, up to 48 hours).
7. Railway automatically provisions an SSL certificate once DNS resolves.

---

## 11. Verify Everything Works

After deployment completes and the domain is active:

1. **Visit your URL** — you should see the Clarke & Associates CRM login page.
2. **Log in** with your Manus OAuth credentials.
3. **Check the Dashboard** — verify KPI cards and charts render.
4. **Create a test lead** — go to Leads → New Lead, fill in details, and save.
5. **Check the Pipeline** — verify the lead appears in the "New Lead" column.
6. **Create a landing page** — go to Landing Pages → Create Page, set a slug, and publish.
7. **Test the public page** — visit `/lp/your-slug` to verify the lead capture form works.
8. **Check User Management** — verify you appear as Admin with full access.

---

## 12. Ongoing Maintenance

### Auto-Deployments

Every push to the `main` branch on GitHub triggers an automatic rebuild and deployment. No manual intervention is required. To disable this:

1. Go to service **Settings** → **Deploy**.
2. Toggle off **Auto Deploy**.

### Monitoring

Railway provides built-in observability:

- **Metrics:** CPU usage, memory consumption, and network I/O are visible in the service dashboard.
- **Logs:** Real-time application logs are available in the **Deploy Logs** and **Logs** tabs.
- **Alerts:** Configure alerts in Railway settings to notify you of deployment failures or resource limits.

### Database Backups

Railway's managed MySQL includes automatic daily backups. To create a manual backup:

1. Click on the MySQL service.
2. Go to **Settings** → **Backups**.
3. Click **Create Backup**.

To restore from a backup, select the backup and click **Restore**.

### Updating the Application

To deploy updates:

```bash
# Make changes locally
git add .
git commit -m "Update: description of changes"
git push origin main
# Railway auto-deploys within 2-3 minutes
```

### Scaling

If you need more resources as your team and lead volume grow:

1. Go to service **Settings**.
2. Adjust **Memory** and **CPU** limits.
3. Railway charges per-second based on actual usage, so scaling up only costs more during peak times.

---

## 13. Estimated Monthly Cost

Railway uses usage-based pricing. Here is a typical cost breakdown for the Clarke CRM:

| Component | Estimated Cost | Notes |
|---|---|---|
| Web Service (512 MB RAM, 0.5 vCPU) | $5–10/mo | Scales with traffic |
| MySQL Database (1 GB RAM) | $5–10/mo | Scales with data volume |
| Network Egress | $0–2/mo | First 100 GB free |
| **Total** | **$10–20/month** | For a small team (5–10 users) |

Railway offers a **Hobby plan** at $5/month that includes $5 of resource credits, which is often sufficient for low-traffic internal tools. The **Pro plan** at $20/month includes $20 of credits and additional features like team collaboration and priority support.

---

## 14. Troubleshooting

### Build Fails with "pnpm not found"

Railway should detect pnpm automatically. If it does not, add a **Nixpacks** configuration by creating a `nixpacks.toml` file in your project root:

```toml
[phases.setup]
nixPkgs = ["nodejs_22", "pnpm"]

[phases.build]
cmds = ["pnpm install", "pnpm build"]

[start]
cmd = "pnpm start"
```

### "Cannot connect to database" Error

Verify the `DATABASE_URL` variable is correctly referenced from the MySQL service. In the Variables tab, it should show a linked reference icon, not a plain text value. If it shows plain text, delete it and re-add it using **Add Reference Variable**.

### Application Crashes on Start

Check the deploy logs for the specific error. Common causes:

| Error | Solution |
|---|---|
| `Missing JWT_SECRET` | Add the `JWT_SECRET` environment variable |
| `ECONNREFUSED` on database | Ensure `DATABASE_URL` is linked correctly |
| `PORT already in use` | Remove the `PORT` variable — Railway assigns it automatically |
| `Module not found` | Run a fresh deploy with `pnpm install && pnpm build` as the build command |

### Database Migration Fails

If `pnpm db:push` fails, check that:

1. The MySQL service is running (green status indicator).
2. The `DATABASE_URL` is correctly formatted as `mysql://user:password@host:port/database`.
3. The MySQL version is 8.0+ (Railway uses 8.0 by default).

### Custom Domain Not Working

1. Verify the CNAME record is correctly configured in your DNS provider.
2. Use [dnschecker.org](https://dnschecker.org) to verify DNS propagation.
3. Wait up to 48 hours for full propagation.
4. Ensure there is no conflicting A record for the same subdomain.

---

## 15. Railway CLI Reference

The Railway CLI is useful for running one-off commands, viewing logs, and managing deployments from your terminal.

```bash
# Install
npm install -g @railway/cli

# Login
railway login

# Link to an existing project
railway link

# Run a command in the Railway environment
railway run <command>

# View logs
railway logs

# Open the project dashboard
railway open

# Deploy manually
railway up

# View environment variables
railway variables

# Add an environment variable
railway variables set KEY=VALUE
```

### Common CLI Workflows

```bash
# Run database migrations
railway run pnpm db:push

# Open a database shell
railway run mysql -h $MYSQLHOST -u $MYSQLUSER -p$MYSQLPASSWORD $MYSQLDATABASE

# Check application health
railway run curl http://localhost:$PORT/api/trpc/auth.me

# View recent logs
railway logs --tail 100
```

---

## Quick Reference Card

| Action | Command / Location |
|---|---|
| **Deploy** | Push to `main` branch (auto-deploys) |
| **View logs** | Railway Dashboard → Logs tab |
| **Run migrations** | `railway run pnpm db:push` |
| **Add env variable** | Dashboard → Variables tab → New Variable |
| **Custom domain** | Dashboard → Settings → Networking → Custom Domain |
| **Scale resources** | Dashboard → Settings → adjust Memory/CPU |
| **Database backup** | Dashboard → MySQL service → Backups |
| **Rollback** | Dashboard → Deployments → select previous → Rollback |

---

*This guide was prepared for the Clarke & Associates CRM. For Railway platform documentation, visit [docs.railway.app](https://docs.railway.app).*
