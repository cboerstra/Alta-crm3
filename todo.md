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
