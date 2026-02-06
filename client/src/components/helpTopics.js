/**
 * wiblaster Help & Support – all topics for the in-app Help panel.
 * Each topic has: id, section, title, description (short), content (full body).
 */
export const HELP_TOPICS = [
  // ─── 1. Getting Started ────────────────────────────────────────────────
  {
    id: 'what-is-wiblaster',
    section: 'Getting Started',
    title: 'What is wiblaster?',
    description:
      'wiblaster is an automated platform that helps you find business email addresses from eCommerce store websites and send cold outreach emails at scale.',
    content: `wiblaster is an automated platform that helps you **find business email addresses from eCommerce store websites** and **send cold outreach emails at scale**—safely and efficiently.

Instead of manually searching websites and sending emails one by one, wiblaster automates the entire workflow:

* Scan store websites for public contact emails
* Organize results by store
* Send personalized cold emails using multiple sender accounts`,
  },
  {
    id: 'how-wiblaster-works',
    section: 'Getting Started',
    title: 'How wiblaster Works (Workflow Overview)',
    description: 'wiblaster operates in two main steps: Discovery (scan store sites for emails) and Outreach (create campaigns and send emails).',
    content: `wiblaster operates in **two main steps**:

1. **Discovery**
   You scan store websites to extract publicly available business emails from pages like:
   * Contact pages
   * Privacy policies
   * About pages
   * Legal or Impressum pages

2. **Outreach**
   You use the extracted emails to create automated email campaigns with:
   * Custom templates
   * Multiple sender accounts
   * Smart delays to avoid spam filters`,
  },
  // ─── 2. Dashboard Overview ─────────────────────────────────────────────
  {
    id: 'dashboard-overview',
    section: 'Dashboard Overview',
    title: 'Dashboard Overview',
    description: 'The Dashboard gives you a quick summary of everything happening in your account.',
    content: `The Dashboard gives you a **quick summary of everything happening in your account**.

You can see:
* Total emails sent
* Successful vs failed sends
* Active and completed campaigns
* Recent scans and activities

It also provides **quick access** to:
* Store Scanner
* Campaigns
* Sender settings`,
  },
  {
    id: 'dashboard-statistics',
    section: 'Dashboard Overview',
    title: 'Dashboard Statistics',
    description: 'Track performance with total emails sent, failed emails, campaign count, and date filters.',
    content: `These stats help you track performance:

* **Total Emails Sent** – Number of emails successfully delivered
* **Failed Emails** – Emails that could not be sent
* **Campaign Count** – Total campaigns created
* **Date Filter** – View stats for a specific time range`,
  },
  // ─── 3. Store Scanner ───────────────────────────────────────────────────
  {
    id: 'what-is-store-scanner',
    section: 'Store Scanner',
    title: 'What is the Store Scanner?',
    description: 'The Store Scanner automatically visits store websites and extracts business contact emails.',
    content: `The Store Scanner automatically visits store websites and **extracts business contact emails**.

You simply paste store URLs, and wiblaster handles the rest.`,
  },
  {
    id: 'how-to-scan-urls',
    section: 'Store Scanner',
    title: 'How to Scan Store URLs',
    description: 'Paste store URLs, click Start Scan, and the scanner crawls common pages to find emails.',
    content: `1. Paste store URLs into the scanner input
   * One URL per line
   * Or comma-separated
2. Click **Start Scan**
3. The scanner crawls common pages to find emails`,
  },
  {
    id: 'pages-wiblaster-scans',
    section: 'Store Scanner',
    title: 'Pages wiblaster Scans',
    description: 'By default the scanner looks at contact, privacy, about, legal, and impressum pages. Paths can be customized in Scan Settings.',
    content: `By default, the scanner looks for emails on pages such as:

* /contact
* /contact-us
* /pages/contact
* /privacy-policy
* /policies/privacy-policy
* /about
* /legal
* /impressum

These paths can be customized in **Scan Settings**.`,
  },
  {
    id: 'scan-results',
    section: 'Store Scanner',
    title: 'Scan Results',
    description:
      'After a scan completes, results show per store: URL, extracted emails, status. You can search, filter, add notes, or export.',
    content: `After a scan completes, results are shown per store:

* Store URL
* Extracted email(s)
* Scan status
* Notes (optional)

You can search, filter, edit notes, or export results.`,
  },
  // ─── 4. Results Dashboard ───────────────────────────────────────────────
  {
    id: 'viewing-scan-results',
    section: 'Results Dashboard',
    title: 'Viewing Scan Results',
    description: 'Organize and manage extracted emails: search by store or email, filter, view status per store.',
    content: `The Results Dashboard helps you **organize and manage extracted emails**.

You can:
* Search by store URL or email
* Filter results
* View scan status per store`,
  },
  {
    id: 'adding-notes-to-stores',
    section: 'Results Dashboard',
    title: 'Adding Notes to Stores',
    description: 'Add follow-up status, custom comments, or priority level to each store so teams stay aligned.',
    content: `You can add notes to each store, such as:
* Follow-up status
* Custom comments
* Priority level

Notes help teams stay aligned.`,
  },
  {
    id: 'exporting-scan-results',
    section: 'Results Dashboard',
    title: 'Exporting Scan Results',
    description: 'Export results as an Excel (.xlsx) file with store URL, email, notes—useful for backups or external analysis.',
    content: `You can export results as an **Excel (.xlsx) file**, selecting fields such as:
* Store URL
* Email address
* Notes

This is useful for backups or external analysis.`,
  },
  // ─── 5. Campaigns & Outreach ───────────────────────────────────────────
  {
    id: 'what-is-a-campaign',
    section: 'Campaigns & Outreach',
    title: 'What is a Campaign?',
    description:
      'A campaign is an automated email outreach process using recipients, template, sender accounts, and sending delays.',
    content: `A campaign is an automated email outreach process where wiblaster sends emails to selected recipients using your configured settings.

Each campaign includes:
* Recipients
* Email template
* Sender accounts
* Sending delays`,
  },
  {
    id: 'creating-a-campaign',
    section: 'Campaigns & Outreach',
    title: 'Creating a Campaign',
    description: 'Choose recipient source, select sender group, add subject and body, configure delays, then start.',
    content: `To create a campaign:

1. Choose recipient source
2. Select sender or sender group
3. Add subject line(s)
4. Write email template
5. Configure delays
6. Start campaign`,
  },
  {
    id: 'recipient-sources',
    section: 'Campaigns & Outreach',
    title: 'Recipient Sources',
    description: 'Choose recipients from scan results, uploaded CSV files, or saved email lists.',
    content: `You can choose recipients from:
* Scan results
* Uploaded CSV files
* Saved email lists

This gives you flexibility in how you build campaigns.`,
  },
  {
    id: 'email-templates-placeholders',
    section: 'Campaigns & Outreach',
    title: 'Email Templates & Placeholders',
    description: 'Use placeholders like {{store_url}} to personalize emails. Add multiple subject lines to improve open rates.',
    content: `Templates allow you to personalize emails automatically.

Example placeholders:
* \`{{store_url}}\` – Inserts the store website
* Other dynamic values as supported

You can add **multiple subject lines** to improve open rates.`,
  },
  {
    id: 'one-email-per-store',
    section: 'Campaigns & Outreach',
    title: 'One Email Per Store',
    description:
      'When enabled, only one email is sent per store even if multiple emails were found—avoids over-contacting businesses.',
    content: `When enabled, wiblaster ensures **only one email is sent per store**, even if multiple emails were found.

This helps avoid over-contacting businesses.`,
  },
  {
    id: 'delay-controls',
    section: 'Campaigns & Outreach',
    title: 'Delay Controls',
    description: 'Set minimum and maximum delay between emails to reduce spam risk and keep sending natural.',
    content: `You can set:
* Minimum delay between emails
* Maximum delay between emails

This reduces spam risk and keeps sending natural.`,
  },
  {
    id: 'campaign-status-monitoring',
    section: 'Campaigns & Outreach',
    title: 'Campaign Status & Monitoring',
    description: 'Track emails sent, failed emails, start time, and errors. Clear errors and retry failed emails.',
    content: `Each campaign shows:
* Emails sent
* Failed emails
* Start time
* Error messages (if any)

You can clear errors and retry failed emails.`,
  },
  // ─── 6. Sender Management ──────────────────────────────────────────────
  {
    id: 'what-is-a-sender',
    section: 'Sender Management',
    title: 'What is a Sender?',
    description: 'A sender is an email account used to send outreach emails. Supported: Gmail, Outlook, Yahoo, custom SMTP.',
    content: `A sender is an email account used to send outreach emails.

Supported providers include:
* Gmail
* Outlook
* Yahoo
* Custom SMTP providers`,
  },
  {
    id: 'adding-a-sender',
    section: 'Sender Management',
    title: 'Adding a Sender',
    description: 'Enter sender email, provide SMTP details, use an App Password (recommended), and test connection.',
    content: `To add a sender:

1. Enter sender email
2. Provide SMTP details
3. Use an **App Password** (recommended)
4. Test connection`,
  },
  {
    id: 'sender-groups',
    section: 'Sender Management',
    title: 'Sender Groups',
    description:
      'Combine multiple senders and rotate them automatically during campaigns to improve deliverability.',
    content: `Sender Groups allow you to:
* Combine multiple senders
* Rotate them automatically during campaigns

This improves deliverability and reduces spam flags.`,
  },
  // ─── 7. Campaign Presets ────────────────────────────────────────────────
  {
    id: 'what-are-campaign-presets',
    section: 'Campaign Presets',
    title: 'What are Campaign Presets?',
    description: 'Save commonly used campaign settings: subject, body, sender group, delays. Reuse with one click.',
    content: `Campaign Presets allow you to **save commonly used campaign settings**.

A preset can include:
* Subject lines
* Email body
* Sender group
* Delay settings`,
  },
  {
    id: 'using-presets',
    section: 'Campaign Presets',
    title: 'Using Presets',
    description: 'When creating a campaign, select a preset to auto-fill all fields and ensure consistency.',
    content: `When creating a campaign, simply select a preset to auto-fill all fields, saving time and ensuring consistency.`,
  },
  // ─── 8. Scan Settings ───────────────────────────────────────────────────
  {
    id: 'url-paths-settings',
    section: 'Scan Settings',
    title: 'URL Paths Settings',
    description: 'Customize which pages the crawler visits by adding or removing URL paths.',
    content: `You can customize which pages the crawler visits by adding or removing URL paths.

This helps improve email discovery on different site structures.`,
  },
  {
    id: 'crawler-limits',
    section: 'Scan Settings',
    title: 'Crawler Limits',
    description: 'Control maximum concurrent crawlers and maximum URLs per scan to balance speed and stability.',
    content: `These settings control:
* Maximum number of concurrent crawlers
* Maximum URLs per scan

Limits help balance speed and system stability.`,
  },
  {
    id: 'default-email-delay',
    section: 'Scan Settings',
    title: 'Default Email Delay',
    description: 'Set a default delay for new campaigns to ensure safe sending behavior from the start.',
    content: `Set a default delay for new campaigns to ensure safe sending behavior from the start.`,
  },
  // ─── 9. Export & Activity Logs ──────────────────────────────────────────
  {
    id: 'excel-export',
    section: 'Export & Activity Logs',
    title: 'Excel Export',
    description: 'Download scan results as Excel for reporting, offline use, or CRM imports.',
    content: `Download scan results as an Excel file for:
* Reporting
* Offline use
* CRM imports`,
  },
  {
    id: 'activity-log',
    section: 'Export & Activity Logs',
    title: 'Activity Log',
    description: 'Records scans, campaign actions, exports, sender changes—for tracking and auditing.',
    content: `The Activity Log records:
* Scans started/completed
* Campaign actions
* Exports
* Sender changes

This helps with tracking and auditing.`,
  },
  // ─── 10. Account & Team Management ──────────────────────────────────────
  {
    id: 'account-profile',
    section: 'Account & Team Management',
    title: 'Account Profile',
    description: 'Manage profile photo, name, email, and Google sign-in settings.',
    content: `Manage:
* Profile photo
* Name and email
* Google sign-in settings`,
  },
  {
    id: 'team-users',
    section: 'Account & Team Management',
    title: 'Team Users',
    description: 'Invite team members via email. They receive a login link and sign in with Google.',
    content: `Invite team members via email.

Invited users:
* Receive a login link
* Sign in using Google
* Access features based on your plan`,
  },
  {
    id: 'manage-plan',
    section: 'Account & Team Management',
    title: 'Manage Plan',
    description: 'Upgrade or downgrade, pause or cancel subscription, or delete account.',
    content: `From here you can:
* Upgrade or downgrade plan
* Pause subscription
* Cancel subscription
* Delete account`,
  },
  {
    id: 'billing',
    section: 'Account & Team Management',
    title: 'Billing',
    description: 'View current plan, payment details, billing history, and invoices.',
    content: `Billing section shows:
* Current plan
* Payment details
* Billing history
* Invoices`,
  },
  // ─── 11. Pricing Plans ──────────────────────────────────────────────────
  {
    id: 'available-plans',
    section: 'Pricing Plans',
    title: 'Available Plans',
    description: 'Free, Essentials, Standard, Premium—each differs by email limits, team seats, and support.',
    content: `wiblaster offers:
* Free
* Essentials
* Standard
* Premium

Each plan differs by:
* Monthly email limits
* Team seats
* Support level`,
  },
  // ─── 12. UI & Experience ────────────────────────────────────────────────
  {
    id: 'theme-settings',
    section: 'UI & Experience',
    title: 'Theme Settings',
    description: 'Switch between light and dark mode. The interface uses a modern glass-style design.',
    content: `Switch between:
* Light mode
* Dark mode

The interface uses a modern glass-style design for clarity and comfort.`,
  },
  {
    id: 'loading-states',
    section: 'UI & Experience',
    title: 'Loading States',
    description: 'Preloaders and skeletons appear during page transitions and data loading.',
    content: `Preloaders and skeletons appear during:
* Page transitions
* Data loading

This ensures smooth user experience.`,
  },
  {
    id: 'in-app-help-panel',
    section: 'UI & Experience',
    title: 'In-App Help Panel',
    description: 'Quick access to feature explanations, usage guides, and best practices.',
    content: `The Help Panel provides quick access to:
* Feature explanations
* Usage guides
* Best practices`,
  },
  // ─── 13. Compliance & Responsibility ────────────────────────────────────
  {
    id: 'compliance-confirmation',
    section: 'Compliance & Responsibility',
    title: 'Compliance Confirmation',
    description:
      'You must confirm compliance with CAN-SPAM, GDPR, and local email laws. wiblaster only extracts publicly available business emails.',
    content: `Before starting campaigns, you must confirm compliance with outreach regulations such as:
* CAN-SPAM
* GDPR
* Local email laws

wiblaster only extracts **publicly available business emails**.
You are responsible for how outreach is conducted.`,
  },
];

/** Section order for grouping in the Help panel list */
export const HELP_SECTIONS_ORDER = [
  'Getting Started',
  'Dashboard Overview',
  'Store Scanner',
  'Results Dashboard',
  'Campaigns & Outreach',
  'Sender Management',
  'Campaign Presets',
  'Scan Settings',
  'Export & Activity Logs',
  'Account & Team Management',
  'Pricing Plans',
  'UI & Experience',
  'Compliance & Responsibility',
];

