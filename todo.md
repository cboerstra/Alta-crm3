# Clarke & Associates CRM — Project TODO

## Core Infrastructure
- [x] Database schema (11 tables: users, leads, webinars, landing_pages, activity_log, sms_messages, email_reminders, deals, availability, bookings, integrations)
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
- [x] Auth logout test
- [x] CRM router structure test
- [x] Leads CRUD tests (create, read, update stage, notes, activity, search)
- [x] Deals CRUD tests (create, update, revenue metrics)
- [x] Webinars tests (create, read, attendance stats)
- [x] Landing pages tests (create, slug lookup, duplicate rejection, delete)
- [x] Analytics tests (dashboard metrics, revenue data)
- [x] Integrations tests (status, connect, disconnect)
- [x] Scheduling tests (availability, bookings)
- [x] SMS tests (send with consent, reject without consent)

## Branding Update
- [x] Match branding and colors from altamortgagegroup.net
- [x] Apply brand colors to global CSS design tokens
- [x] Use brand fonts and visual style throughout the platform
