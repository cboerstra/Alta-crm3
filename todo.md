# Clarke & Associates CRM — Project TODO

## Core Infrastructure
- [x] Database schema (12 tables: users, leads, webinars, webinar_sessions, landing_pages, activity_log, sms_messages, email_reminders, deals, availability, bookings, integrations)
- [x] tRPC backend with 8 feature routers
- [x] Authentication via Manus OAuth
- [x] DashboardLayout with sidebar navigation
- [x] Alta Mortgage Group branding (green/gold, Raleway/Montserrat fonts)

## Landing Page System
- [x] Create and manage multiple landing pages
- [x] Custom URL slugs (/lp/:slug)
- [x] Lead capture forms (First Name, Last Name, Email, Phone)
- [x] Automatic lead tagging by source/campaign
- [x] Public landing page renderer
- [x] Accent color customization
- [x] Configurable form fields (toggle which fields to show)
- [x] Artwork/hero image upload per landing page
- [x] Opt-in consent checkbox (configurable label)
- [x] Body text / description field
- [x] Confirmation email settings (subject, body, template variables)
- [x] PDF attachment upload for confirmation emails

## Zoom Integration
- [x] Connect company Zoom account (Settings page)
- [x] Create and manage webinars inside CRM
- [x] Register leads to webinars
- [x] Store join link per lead
- [x] Track attendance status (Registered, Attended, No Show)
- [x] Simulated Zoom API (ready for real API keys)

## Google Calendar Integration
- [x] Connect company Google account (Settings page)
- [x] Calendar event ID storage on webinars and bookings
- [x] Integration status display

## CRM Lead Management
- [x] Central lead database with search/filter
- [x] Lead profile view with notes
- [x] Activity timeline (notes, stage changes, emails, SMS, webinar events)
- [x] Lead creation form
- [x] Lead editing

## Kanban Pipeline
- [x] Drag-and-drop pipeline with 7 stages
- [x] Stages: New Lead, Registered, Attended, No Show, Consultation Booked, Under Contract, Closed
- [x] Lead cards with score badges and source tags
- [x] Click-through to lead profile

## Email Reminder Automation
- [x] Immediately after registration
- [x] 24 hours before webinar
- [x] 1 hour before webinar
- [x] 10 minutes before webinar
- [x] Automated no-show follow-up with replay link
- [x] Confirmation email with PDF attachment support

## Analytics Dashboard
- [x] Total leads KPI card
- [x] Attendance rate KPI card
- [x] Closed deals KPI card
- [x] Revenue KPI card
- [x] Pipeline overview bar chart
- [x] Leads by source pie chart
- [x] Recent leads list

## Deal Value Tracking & Revenue Dashboard
- [x] Deals management page with create/edit
- [x] Deal stages: Prospect, Qualified, Proposal, Negotiation, Closed Won, Closed Lost
- [x] Revenue dashboard with Total Pipeline, Closed Revenue, Avg Deal Size, Win Rate
- [x] Pipeline value by stage chart
- [x] Deal outcomes donut chart
- [x] Revenue metrics API

## Scheduling System (Calendly-style)
- [x] Agent availability management (day/time slots)
- [x] Custom scheduling slug per agent
- [x] Public booking page (/schedule/:slug)
- [x] Calendar date picker with availability check
- [x] Time slot selection
- [x] Guest booking form
- [x] Booking confirmation
- [x] Bookings list view

## SMS Integration
- [x] SMS consent tracking per lead
- [x] Send SMS from lead profile
- [x] SMS message history (outbound/inbound)
- [x] SMS activity logging
- [x] Consent validation before sending

## LLM Lead Scoring
- [x] AI-powered lead scoring (0-100)
- [x] Score based on engagement, attendance, interaction history
- [x] Score reason explanation
- [x] Score display on pipeline cards and lead profiles

## Settings
- [x] Zoom integration connect/disconnect
- [x] Google Calendar integration connect/disconnect
- [x] Integration status display

## Testing
- [x] Auth logout test (1 test)
- [x] CRM core tests (37 tests)
- [x] Enhanced feature tests (12 tests)
- [x] RBAC tests (21 tests)
- [x] Total: 71 tests passing

## Branding Update
- [x] Match branding and colors from altamortgagegroup.net
- [x] Apply brand colors to global CSS design tokens
- [x] Use brand fonts and visual style throughout the platform

## Enhanced Webinar & Landing Page Flow (User Request)
- [x] Webinar creation initiates calendar event and creates linked landing page
- [x] Landing page builder: configurable form fields (toggle first name, last name, phone, email)
- [x] Landing page builder: date/time picker for webinar sessions (multiple dates available)
- [x] Landing page builder: opt-in consent checkbox (optional, configurable)
- [x] Landing page builder: artwork/image upload for each webinar event
- [x] Landing page: leads can select from available seminar dates
- [x] Confirmation email sent automatically on lead signup
- [x] Confirmation email supports PDF document attachment
- [x] Webinar-to-landing-page linking (create LP from webinar screen)
- [x] Email service with template variable rendering

## Installation & Requirements Data Sheet
- [x] Create comprehensive installation guide document
- [x] Include server requirements (OS, Node.js, MySQL, RAM, CPU, disk)
- [x] Include all environment variables with descriptions
- [x] Include dependency list and versions
- [x] Include step-by-step deployment instructions
- [x] Include Zoom API setup instructions
- [x] Include Google Calendar API setup instructions
- [x] Include SMS provider (Twilio) setup instructions
- [x] Include SSL/TLS and domain configuration
- [x] Include backup and maintenance procedures
- [x] Include file structure documentation
- [x] Include troubleshooting guide
- [x] Include security considerations

## Landing Page UX Improvements (User Request)
- [x] Add required field indicators (red asterisk) on landing page creation form
- [x] Show validation errors clearly before allowing form submission
- [x] Display webinar event date and time on each landing page card in the list view
- [x] Display full clickable URL on each landing page card

## Landing Page Background & Media Library (User Request)
- [x] Uploaded artwork fills entire background of public landing page
- [x] Text inputs and form appear in the foreground over the background
- [x] Corporate logos and artwork displayed in the foreground
- [x] Media Library in Settings: upload multiple logos and images
- [x] Landing page builder: select multiple foreground logos/images from media library
- [x] Public landing page renders selected foreground logos over background

## AWS CloudFormation Template (User Request)
- [x] Generate comprehensive CloudFormation template for full AWS infrastructure
- [x] Create Dockerfile for production container builds
- [x] Create AWS Deployment Guide with step-by-step instructions

## Landing Page Redesign (User Clarification)
- [x] Remove split-image layout from public landing page
- [x] Full-bleed uploaded artwork as background covering entire page
- [x] Form fields displayed in foreground overlay on top of background
- [x] Corporate logos/images from media library shown in foreground
- [x] Landing page builder: add media picker to select foreground images from library

## Role-Based Access Control (User Request)
- [x] Owner automatically assigned admin role on login
- [x] Admin can view all users in a User Management page
- [x] Admin can assign admin or user roles to any user
- [x] Admin can deactivate/activate user accounts (via role management)
- [x] Protected backend procedures: admin-only operations gated by role check (integrations, media, userManagement)
- [x] Protected frontend routes: admin-only pages hidden from regular users (AdminRoute wrapper)
- [x] User Management page in sidebar (admin only, under ADMINISTRATION section)
- [x] Role badges displayed on user list and sidebar footer
- [x] Regular users see limited sidebar (no Settings, no User Management)
- [x] RBAC tests: 21 tests covering admin/user/public access to all routers

## Railway Deployment Guide (User Request)
- [x] Add RAILWAY_DEPLOYMENT_GUIDE.md with step-by-step deployment instructions

## UI Polish & Feature Additions (Continued)
- [x] Webinars page: search bar, status filter dropdown, delete with confirmation dialog
- [x] Landing pages: lead count badge on each card
- [x] Landing pages: duplicate button on each card
- [x] Dashboard: improved KPI cards with trend indicators
- [x] Dashboard: upcoming webinars section with countdown badges
- [x] Dashboard: quick action buttons (Add Lead, Schedule Webinar)
- [x] Dashboard: clickable recent leads rows linking to lead profile
- [x] Dashboard: improved pipeline bar chart with per-bar color coding
- [x] Dashboard: improved source pie chart with inline legend

## Admin: Add Employee Logins & Delete Leads (User Request)
- [x] Admin can create employee logins from User Management page (Add Employee dialog)
- [x] Employee invite stores name, email, role in the system
- [x] Invite link generated and displayed to admin (7-day expiry)
- [x] Delete individual leads from the Leads list with confirmation dialog
- [ ] Bulk delete selected leads from Leads list

## Testing Update
- [x] Invite system tests (5 tests: admin can list/create invites, user cannot, admin-level invite, unauthenticated blocked)
- [x] Lead deletion tests (2 tests: authenticated can delete, unauthenticated blocked)
- [x] Total: 78 tests passing

## Bulk Lead Deletion (User Request)
- [x] Add checkboxes to each lead row in the Leads list
- [x] Add "select all" checkbox in the table header
- [x] Show bulk-action toolbar when any leads are selected (count + Delete Selected button)
- [x] Confirm bulk delete with count in AlertDialog
- [x] Keep individual per-row delete button (hover trash icon)

## Bulk Webinar Deletion (User Request)
- [x] Add checkboxes to each webinar card on the Webinars page
- [x] Add "select all" checkbox above the list
- [x] Show bulk-action toolbar when any webinars are selected (count + Delete Selected button)
- [x] Confirm bulk delete with count in AlertDialog
- [x] Keep individual per-card delete button (hover trash icon)
- [x] Add bulkDelete backend procedure to webinars router

## SMS Integration Settings (User Request)
- [x] SMS settings panel in the Settings page (admin-only)
- [x] Fields: Twilio Account SID, Auth Token, From phone number
- [x] Save/update credentials securely in the database (validated against Twilio API on save)
- [x] Test connection button (sends a live test SMS to admin-specified number)
- [x] Enable/disable SMS toggle (without disconnecting)
- [x] Show current connection status (connected / not configured) with green dot on tab
- [x] Mask Auth Token after saving (show only last 4 chars)
- [x] Disconnect Twilio button
- [x] All 82 tests passing

## Twilio Error Fixes (User Report)
- [x] Error 1: "Invalid 'To' Phone Number" — auto-strip spaces/dashes/parens from phone, validate E.164 before sending, show clear format hint; trial account warning added
- [x] Error 2: "Invalid Twilio credentials" — 401 now shows specific message: check SID starts with 'AC', copy token exactly; other HTTP errors surface Twilio's own message
- [x] Strip spaces/dashes/parens from phone numbers automatically before sending to Twilio
- [x] Account SID field shows inline red error if value doesn't start with 'AC'
- [x] Setup form now shows step-by-step guide to find credentials in Twilio Console
- [x] All 82 tests passing

## Gmail Email Integration (User Request)
- [x] Extend integrations provider enum to include "gmail" and push schema migration
- [x] Install nodemailer for SMTP sending
- [x] Backend: connectGmail — validates App Password via SMTP verify() before saving
- [x] Backend: testGmail — sends a live test email to admin-specified address
- [x] Backend: toggleGmail — pause/resume without disconnecting
- [x] Backend: disconnectGmail — removes credentials
- [x] Backend: getStatus returns Gmail connection status (address, password hint, enabled)
- [x] Backend: sendEmail helper using nodemailer + Gmail SMTP (server/email.ts)
- [x] emailService.ts updated: uses real Gmail SMTP when connected, falls back to owner notification log
- [x] Email reminder scheduler wired into server startup (every 60s, joins leads table for recipient email)
- [x] Frontend: Email tab in Settings with step-by-step App Password guide, setup form, connected state, test email panel, enable/disable toggle, disconnect button
- [x] All 82 tests passing

## Link Deals to Leads (User Request)
- [x] leadId FK already existed as NOT NULL on deals table (no migration needed)
- [x] Update getDeals and getDealById to INNER JOIN leads table, returning leadFirstName/leadLastName/leadEmail
- [x] deals.create enforces leadId required (z.number().min(1))
- [x] deals.list now accepts optional leadId filter
- [x] deals.update allows changing the associated lead
- [x] New deals.searchLeads procedure for live lead search in the picker
- [x] Deals UI: searchable lead picker (type to search, dropdown results, clear/change)
- [x] Deals UI: show lead avatar, full name, and email on each deal row
- [x] Deals UI: clicking lead row navigates to lead profile page
- [x] Deals UI: stage filter pills added
- [x] Deals UI: colored stage badges replace plain text
- [x] All 82 tests passing

## Node 20/Hostinger Compatibility (User Request)
- [x] Check for Node 22-only features in server code (import.meta.dirname in vite.ts — requires Node 22+)
- [x] Recommend Hostinger use Node 22 or 24 (both supported)
- [x] Add postinstall script to fix esbuild binary permissions (EACCES error on Hostinger)
- [x] postinstall: find + chmod +x all esbuild binaries in node_modules
- [x] Added engines field: node >=22.0.0
- [x] Build produces both dist/index.js and dist/server.js for any entry file config

## TypeError: Invalid URL on Hostinger Production (User Report)
- [x] Root cause: VITE_OAUTH_PORTAL_URL is undefined on Hostinger, making new URL("undefined/app-auth") crash
- [x] Fixed: DashboardLayout now detects missing OAuth env vars and redirects to /login instead of calling getLoginUrl()
- [x] Fixed: /login page guards getLoginUrl() with isManus check before rendering the Manus button

## Custom Email/Password Auth for Hostinger (User Request)
- [x] Add passwordHash column to users table, push migration (0007_high_agent_brand.sql)
- [x] Install bcrypt 6.0.0 for password hashing (added to onlyBuiltDependencies)
- [x] Backend: auth.login procedure (email + password → JWT session cookie)
- [x] Backend: auth.register procedure (first-time admin setup only, blocked if users exist)
- [x] Backend: auth.setPassword procedure (admin can set/reset any user's password)
- [x] Backend: getUserByEmail and updateUserPassword db helpers
- [x] Frontend: /login page with email/password form + optional Manus OAuth button
- [x] Frontend: /setup page for first-time admin account creation
- [x] DashboardLayout: auto-detects Manus vs standalone, redirects to /login when no OAuth configured
- [x] All 82 tests passing, production build clean

## Fix Setup Page "Failed to create user" Error (User Report)
- [x] Fix register procedure to use direct INSERT via new createUserWithPassword() helper
- [x] Real DB errors now surface in the UI (e.g. "Database connection unavailable — check DATABASE_URL")
- [x] getUserByEmail now throws on DB unavailability instead of silently returning undefined
- [x] All 82 tests passing

## Fix "Database connection unavailable" on Hostinger (User Report)
- [x] Rewrote getDb() to use explicit mysql2.createPool() instead of drizzle(url-string)
- [x] Auto-adds ssl:{rejectUnauthorized:false} for remote MySQL hosts unless URL already has ssl= params
- [x] Runs SELECT 1 test query at startup so connection failures are logged immediately
- [x] Clear error message when DATABASE_URL env var is missing (tells user exactly where to add it)
- [x] All 82 tests passing, production build clean (126.6kb)

## Fix "Zero-length key is not supported" on Hostinger /setup (User Report)
- [x] Add clear error when JWT_SECRET is missing/empty in signSession
- [x] Generate a fallback secret at startup with a warning log if JWT_SECRET is not set
- [x] Add startup validation that logs all missing required env vars

## Landing Page Slug Auto-Generation (User Request)
- [x] Auto-generate slug from title as admin types (e.g. "Spring Webinar 2026" → "spring-webinar-2026")
- [x] Show full public URL preview in the form (e.g. https://altamortgagecrm.net/lp/spring-webinar-2026)
- [x] Allow admin to manually edit the slug before saving
- [x] Slug field locked/readonly after page is created (edit via separate edit flow)

## Fix enabledFields JSON Parsing Error on Landing Page Update (User Report)
- [x] Parse enabledFields from string to array when reading from MySQL (MySQL returns JSON columns as strings)
- [x] Apply same fix to any other JSON columns returned from landing_pages

## Fix Missing Columns in Hostinger leads Table (User Report)
- [x] Generate definitive up-to-date schema SQL with all columns from current Drizzle schema (v4)
- [x] Provide ALTER TABLE fix for leads table missing columns

## Replace Twilio with Telnyx SMS Integration (User Request)
- [x] Research Telnyx API (send SMS, inbound webhook format)
- [x] Update integrations router: replace Twilio connect/send/test with Telnyx
- [x] Add Telnyx inbound webhook HTTP endpoint (not tRPC — must be unauthenticated)
- [x] Add Telnyx status callback webhook endpoint
- [x] Update Settings UI to show Telnyx fields instead of Twilio
- [x] Update sms.send procedure to call Telnyx API
- [x] All 82 tests passing, production build clean (130.3kb)

## Telnyx From-Phone Number (User Request)
- [x] Pre-fill from phone with +18017840672 in the Telnyx connect form
- [x] Add editable "From Phone" field in SMS settings when already connected (update without full reconnect)

## Test SMS to From Number (User Request)
- [x] Update testTelnyx procedure to accept optional toPhone — default to the configured from number if omitted
- [x] Replace the existing "enter a phone number" test panel with a single "Test SMS" button that sends to the from number
- [x] Show the destination number in the button label so it's clear where the message is going

## SMS Templates for Lead Stages (User Request)
- [ ] Add sms_templates table to drizzle/schema.ts (trigger, body, isActive, createdBy)
- [ ] Push migration to Manus sandbox DB
- [ ] Add getSmsTemplates / upsertSmsTemplate DB helpers
- [ ] Add smsTemplates tRPC router (list, upsert, reset to default)
- [ ] Build SMS Templates tab in Settings with per-stage editor and live character count
- [ ] Seed default templates for all lead stages
- [ ] Generate ALTER TABLE SQL for Hostinger

## Optional Webinar Link in SMS Compose (User Request)
- [x] Add backend query to get next upcoming Zoom join URL for a lead (from their registered session, or next available session)
- [x] Add "Include webinar link" toggle to SMS compose interface on lead profile
- [x] When toggled on, append the join URL to the message body preview
- [x] Show which webinar/session the link is for so the user knows what's being included
- [x] All 82 tests passing

## {{webinar_link}} Placeholder in SMS Templates (User Request)
- [x] Add server-side placeholder resolution: replace {{webinar_link}} with lead's Zoom join URL before sending
- [x] Support {{first_name}}, {{last_name}}, {{full_name}}, {{webinar_title}}, {{session_date}} as additional variables
- [x] Show available placeholder variables in the SMS Templates editor UI (click to copy)
- [x] All 82 tests passing, TypeScript 0 errors

## Default Registered SMS Template with Webinar Link (User Request)
- [x] Update default "Registered" template body to include {{webinar_link}}
- [x] Reset existing "registered" template rows in the DB to pick up the new default

## Admin SMS Notification on Lead Registration (User Request)
- [x] When a lead registers via a landing page, automatically send SMS to all admin users who have a phone number
- [x] Admin notification message includes lead name, phone, email, and which landing page they registered on
- [x] Only fires when Telnyx is configured and enabled
- [x] Graceful failure — notification errors never block the lead capture response

## Edit Team Member in User Management (User Request)
- [x] Add Edit button to each row in User Management
- [x] Edit dialog: name, email, phone, role fields
- [x] Optional new password field (leave blank to keep existing)
- [x] Backend: userManagement.updateUser admin procedure
- [x] Show success/error toast on save
- [x] Make Delete/Revoke button always visible on pending invitations (not hover-only)

## Telnyx Invalid Source Number Fix (User Request)
- [x] Add dedicated updateTelnyxFromPhone procedure that only updates the phone, never the API key
- [x] Normalize from phone to E.164 (+1XXXXXXXXXX) on save in the backend
- [x] Normalize stored from phone to E.164 on every SMS send (belt-and-suspenders)
- [x] Fix Settings UI to call the new procedure instead of re-calling connectTelnyx with masked API key

## Improved Default SMS Templates (User Request)
- [x] Update all five default template bodies with professional messages using correct placeholders
- [x] DB migration auto-updates existing rows to new defaults on server start

## Attended & No-Show Auto-Send SMS (User Request)
- [x] Enable Attended and No-Show templates by default (isActive: true)
- [x] After a webinar session ends, auto-send Attended SMS to leads marked as attended
- [x] After a webinar session ends, auto-send No-Show SMS to leads marked as no_show
- [x] Only send to leads with SMS consent and a valid phone number
- [x] Log each auto-send in activity log

## Landing Page Email Template Defaults (User Request)
- [x] Pre-fill default subject and body in the Email tab with a natural-sounding confirmation template
- [x] Show available placeholders as a reference guide below the body field
- [x] Ensure new landing pages start with the default template pre-filled

## Telnyx E.164 Normalization Bug Fix (User Request)
- [ ] Fix normalization so 10-digit US numbers get +1 prefix (not just +)
- [ ] Fix normalization so 11-digit numbers starting with 1 get + prefix correctly
- [ ] Update stored from number in DB to correct E.164 format

## Test SMS Source=Destination Bug Fix (User Request)
- [x] Fix testSms to use admin user's phone number as default destination (not the from number)
- [x] If admin has no phone number, show a clear error message instead of sending to self

## Two-Way SMS Inbox for Admins (User Request)
- [x] SMS Inbox page with conversation list (one row per lead phone number)
- [x] Message thread view showing sent and received messages in chat bubble style
- [x] Reply box to send a message directly from the inbox
- [x] Inbound webhook stores messages in sms_messages table with direction=inbound
- [x] Unread badge on sidebar nav item when new inbound messages arrive
- [x] Link each conversation to the matching lead profile
- [x] Both admin users can see and reply to all conversations

## Add Session Bug Fix (User Request)
- [x] Fix "Add Session" so the new session is saved to the DB after Zoom meeting is created
- [x] Fix webinar detail page to refresh/display new session immediately after creation
- [x] Add "Add Session" button directly on the Webinar Detail page (not just in create dialog)
- [x] Sessions panel shows all sessions with date, time, duration, Zoom join link, and delete button

## Real Zoom API Integration for Add Session (User Request)
- [x] Create server/zoom.ts helper: getZoomAccessToken (Server-to-Server OAuth), createZoomMeeting (POST /users/me/meetings)
- [x] Update Settings Zoom connect form to collect Account ID, Client ID, Client Secret (S2S OAuth credentials)
- [x] Update connectZoom procedure to store Account ID, Client ID, Client Secret
- [x] Replace createZoomWebinar stub with real Zoom API call
- [x] Wire addSession mutation to call Zoom API and populate zoomWebinarId, zoomJoinUrl, zoomStartUrl on the session
- [x] Frontend: Add Session dialog shows "Creating Zoom meeting..." loading state
- [x] Frontend: After session created, display the Zoom join URL and meeting ID returned from Zoom
- [x] Graceful fallback: if Zoom not connected, show amber warning and allow manual URL entry (existing behavior)

## Zoom Session Fields & Landing Page Editor Integration (User Request)
- [x] Add zoomWebinarId and replayUrl columns to webinarSessions schema
- [x] Update addSession mutation to store zoomWebinarId from Zoom API response
- [x] Update createWebinarSession DB helper to accept zoomWebinarId and replayUrl
- [x] Display Zoom Webinar ID, Join URL, and Replay URL on session rows in WebinarDetail
- [x] Make session Zoom fields (webinarId, joinUrl, replayUrl) available in Landing Page Editor
- [x] Auto-populate landing page Zoom fields from the selected session's data
- [x] Update tests for new schema fields

## Production DB Schema Mismatch Bug (User Report)
- [x] Production webinar_sessions table missing zoomWebinarId, replayUrl columns
- [x] Added runAutoMigrations() that runs on every server start to auto-add missing columns
- [x] Migration SQL file 0010_right_paibok.sql exists in drizzle folder
- [x] All 82 tests pass, 0 TypeScript errors

## Create Webinar Zoom Integration Bug (User Report)
- [x] The "Schedule New Webinar" create flow now calls Zoom API to create a meeting
- [x] Fix create webinar procedure to call Zoom API when Zoom is connected
- [x] Store Zoom-returned zoomWebinarId, zoomJoinUrl, zoomStartUrl on the webinar AND primary session
- [x] Frontend: after webinar creation, navigate to detail page showing Zoom-populated fields
- [x] Zoom Integration section shows auto-create messaging with manual fallback fields

## Rename "Primary Session" to "Add Zoom Session" (User Request)
- [x] Rename "Primary Session" label in the create webinar form to "Add Zoom Session"
- [x] Ensure the "Add Zoom Session" section triggers the Zoom API call on create

## Zoom Credential Storage Bug (User Report - 3 fields entered, only 2 showing)
- [x] Audited connectZoom mutation - all 3 fields stored correctly (accountId, accessToken=ClientID, refreshToken=ClientSecret)
- [x] DB columns map correctly verified
- [x] Added dynamic Zoom status check to Schedule Webinar dialog (green=connected, amber=not connected)
- [x] Added detailed logging to connectZoom for debugging
- [x] Added DB save error handling with clear error message
- [x] Root cause: user deleted Zoom creds, Settings showed stale cached state, DB had 0 Zoom rows

## Zoom fields not populating after Add Session (User Report)
- [ ] The "+ Add Session" button in Schedule Webinar dialog only adds a blank form row — it does NOT call Zoom API
- [ ] The Zoom API should be called when user clicks "Schedule Webinar & Create Event" and results should display on the detail page
- [ ] Verify the backend create mutation actually calls Zoom API and returns the Zoom fields
- [ ] Verify the WebinarDetail page displays the Zoom fields from the created sessions

## Redesign Schedule Webinar Flow (User Request)
- [x] After clicking "Create Webinar & Zoom Session", stay in dialog and show Zoom credentials (Webinar ID, Join URL, Start URL, Replay URL)
- [x] Move "Add Additional Session" form below the Zoom credentials display
- [x] Remove the pre-creation "Additional Sessions" section — sessions are added after the primary is created
- [x] Each additional session also calls Zoom API and shows its credentials inline
- [x] Added copy-to-clipboard buttons for all Zoom fields
- [x] Dynamic Zoom status banner (green=connected, amber=not connected)
- [x] All 82 tests pass, 0 TypeScript errors

## Local File System Storage for Media Library (Hostinger)
- [x] Audit current Media Library upload code and storage implementation
- [x] Add multer dependency for multipart file uploads
- [x] Create /uploads directory served as static files by Express
- [x] Add POST /api/upload endpoint that saves files to /uploads
- [x] Update media.upload tRPC mutation to accept URL instead of base64
- [x] Update frontend Media Library to use /api/upload multipart endpoint
- [x] Removed dependency on BUILT_IN_FORGE_API_URL/BUILT_IN_FORGE_API_KEY for uploads
- [x] All 82 tests pass, 0 TypeScript errors

## Bug Fixes
- [x] Fix background image upload not persisting (switch from storagePut tRPC to /api/upload multipart endpoint)
- [x] Fix PDF upload not persisting (switch from storagePut tRPC to /api/upload-pdf multipart endpoint)
- [x] Add "Set as Background" button on media library images in Landing Page editor
- [x] Add "Update Media" save button to Media tab to persist foreground selections and background image
- [x] Fix media tab changes not saving to DB (background image + foreground selections)
- [x] Add explicit "Save Media" button to Media tab
- [x] Update default confirmation email template with all placeholders (professional copy)
- [x] Add background image preview with headline/subheadline text overlay on Media tab
- [ ] Update confirmation email body in DB for all existing landing pages to new professional template
- [x] Fix background image not rendering as full-page background on public landing page (switched to S3 storage for permanent URLs)
- [x] Add focal-point/position picker for background image in editor
- [x] Fix logo not displaying correctly on landing page preview
