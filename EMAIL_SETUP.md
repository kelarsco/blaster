# Email sending setup (StoreReach)

If campaigns show **0 Sent** or **Failed**, follow these steps.

---

## 1. Database (required for sending)

Campaigns and senders are stored in the database.

- Create a free [Neon](https://neon.tech) PostgreSQL database.
- In **server/.env** set:
  ```env
  DATABASE_URL=postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require
  ```
- Restart the server. You should see: `Neon DB connected and schema ready.`

---

## 2. Add a sender with real SMTP credentials

Senders are **only saved when the database is connected**. If you added senders before setting `DATABASE_URL`, add them again.

1. Open **Automation Setup** (from the results dashboard).
2. Click **+ Add sender**.
3. Fill in **every** field:

| Field | Example (Gmail) | Notes |
|-------|-----------------|--------|
| **Sender email** | `you@gmail.com` | The "From" address. |
| **SMTP host** | `smtp.gmail.com` | Use your provider's SMTP host. |
| **Port** | `587` | Use 587 (STARTTLS) or 465 (SSL). |
| **TLS/SSL** | Unchecked for 587 | Check only for port 465. |
| **SMTP user** | `you@gmail.com` | Usually same as sender email. |
| **SMTP password** | (App Password) | **Not** your normal password (see below). |
| **Max per minute** | `10` | Optional. |

4. Click **Save sender**. The sender appears in the list.

---

## 3. Gmail: use an App Password

Gmail does not allow "less secure apps" anymore. You must use an **App Password**:

1. Turn on [2-Step Verification](https://myaccount.google.com/signinoptions/two-step-verification) for your Google account.
2. Open [App passwords](https://myaccount.google.com/apppasswords).
3. Create an app password for "Mail" (or "Other" â†’ "StoreReach").
4. Copy the 16-character password (no spaces).
5. In Automation Setup, paste it in **SMTP password / app password** (not your normal Gmail password).

---

## 4. Other providers (Outlook, Yahoo, etc.)

- **Outlook / Hotmail:** SMTP host `smtp-mail.outlook.com`, port 587. Use your Microsoft account password or an app password if 2FA is on.
- **Yahoo:** SMTP host `smtp.mail.yahoo.com`, port 587. Use an [app password](https://login.yahoo.com/account/security).
- **Custom domain:** Use your host's SMTP host and port (e.g. your hosting provider or Mailgun, SendGrid, etc.).

---

## 5. Run a scan, then start a campaign

1. **Scan** some store URLs so you have recipients with emails.
2. Open **Automation Setup** â†’ set subject and body (e.g. use `{{store_url}}`).
3. Confirm the compliance checkbox and click **Start campaign**.
4. In the **Campaign** panel you should see **Sent** increase. If **Failed** increases, the **Last error** message in the panel (and in the server terminal) will tell you why.

---

## 6. Check the server terminal

When a send fails, the server logs the reason, for example:

- `[send] Sender not found` â†’ Add the sender again (with DB running).
- `[send] Sender has no SMTP user/password` â†’ Edit the sender and set SMTP user + App Password.
- `[send] SMTP error: Invalid login` â†’ Wrong password or use an App Password for Gmail.
- `[send] SMTP error: ...` â†’ Other SMTP error; the message explains the issue.

Fix the sender in Automation Setup and start a **new** campaign (existing failed sends are not retried).
