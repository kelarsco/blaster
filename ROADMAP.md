# wiblaster — Product Description & Feature Roadmap

## What is wiblaster?

**wiblaster** is an automated store email extraction and cold outreach platform. It helps businesses find publicly available contact emails on eCommerce store websites, organize them by source store, and send personalized cold outreach emails at scale—with smart sender rotation, timing controls, and campaign management.

---

## What the App Offers

wiblaster connects two core workflows:

1. **Discovery** — Scan store websites (privacy policies, contact pages, about pages) to extract business contact emails automatically.
2. **Outreach** — Send cold emails to those contacts with configurable templates, multiple sender accounts, and rate limiting to avoid spam filters.

The app is built for:
- eCommerce agencies doing outreach to store owners
- Brands looking to partner with other stores
- Sales teams prospecting store-based businesses
- Anyone needing to collect and contact store owners at scale

---

## Feature Overview

### Core Features

| Feature | Description |
|--------|-------------|
| **Store Scanner** | Paste store URLs (one per line or comma-separated); the app crawls privacy, contact, and about pages to find business emails. |
| **Email Extraction** | Extracts emails from common pages like `/policies/privacy-policy`, `/pages/contact`, `/contact-us`, `/impressum`, and more. Configurable paths. |
| **Results Dashboard** | View results by store, search/filter, add notes per store, and export to Excel. |
| **Campaign Automation** | Run cold email campaigns with subject lines, templates (e.g. `{{store_url}}`), and configurable delays between sends. |
| **Sender Management** | Add multiple SMTP senders (Gmail, Outlook, Yahoo, etc.) with App Passwords. Group senders for rotation. |
| **Campaign Presets** | Save and reuse automation setups (subject, body, sender group, delays) across campaigns. |

### Account & User Management

| Feature | Description |
|--------|-------------|
| **Account** | Profile page with photo upload, basic info (name, email), and Google sign-in management. |
| **Users** | Invite team members by email. Invitees receive a login link; they sign in with Google and get access to features you're eligible for. |
| **Manage Plan** | Pause or cancel subscription, delete account. |
| **Billing** | Overview, monthly plan, billing info, and billing history. |
| **Pricing Plans** | Free, Essentials, Standard, Premium tiers with different email limits, seats, and support levels. |

### Scan Settings

| Feature | Description |
|--------|-------------|
| **URL Paths** | Add/edit paths the crawler visits (e.g. `/contact`, `/legal`). |
| **Crawler Limits** | Max concurrent crawlers, max URLs per scan. |
| **Email Delay** | Default delay between emails for new campaigns. |

### Automation & Campaigns

| Feature | Description |
|--------|-------------|
| **Recipient Sources** | Use scan results, CSV upload, or saved email lists as recipients. |
| **Sender Groups** | Group multiple senders; the app rotates through them during sends. |
| **Subject & Templates** | Multiple subject line variants and email body templates with placeholders like `{{store_url}}`. |
| **Delay Controls** | Min/max seconds between emails to reduce spam risk. |
| **One Per Store** | Option to send at most one email per store URL. |
| **Campaign Status** | View sent/failed counts, start time, and last error. Clear errors and retry logic. |

### Export & Data

| Feature | Description |
|--------|-------------|
| **Excel Export** | Export scan results to .xlsx with selectable fields (store URL, email). |
| **Activity Log** | Timeline of scans, exports, campaigns, and sender changes. |

### UI & Experience

| Feature | Description |
|--------|-------------|
| **Dashboard** | Stats (total/sent/failed), campaign list, date range filter, quick links to Scanner and Campaigns. |
| **Preloader & Skeletons** | Loading states on page transitions and initial load. |
| **Help Panel** | In-app help accessible from the header. |
| **Theme** | Light/dark support with glass-style UI. |

---

## Technical Summary

- **Frontend:** React (Vite), Tailwind CSS
- **Backend:** Node.js (Express)
- **Database:** PostgreSQL (Neon)
- **Auth:** Google OAuth + email/password (bcrypt)
- **Crawling:** Cheerio + Node https/http
- **Email:** Nodemailer + SMTP (Gmail, Outlook, etc.)

---

## Compliance

The app includes a compliance confirmation before starting campaigns. You are responsible for following outreach regulations (e.g. CAN-SPAM, GDPR).
