import React from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../components/Logo.jsx';

export function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-blaster-bg font-landing text-blaster-fg">
      <header className="sticky top-0 z-40 bg-blaster-bg border-b border-blaster-border">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold text-lg uppercase tracking-tight text-blaster-fg">
            <Logo />
          </Link>
          <Link to="/" className="text-sm text-blaster-muted hover:text-blaster-fg transition">
            Back to home
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-blaster-fg">Privacy Policy</h1>
        <p className="mt-2 text-blaster-muted">Last updated: {new Date().toLocaleDateString('en-US')}</p>

        <div className="mt-10 space-y-8 text-blaster-fg">
          <section>
            <h2 className="text-xl font-semibold text-blaster-fg mb-2">1. Introduction</h2>
            <p className="text-blaster-muted leading-relaxed">
              wiblaster (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) provides a platform for discovering contact emails from websites and sending outreach campaigns. This Privacy Policy explains how we collect, use, and protect your information when you use our services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-blaster-fg mb-2">2. Information we collect</h2>
            <p className="text-blaster-muted leading-relaxed mb-3">
              We may collect:
            </p>
            <ul className="list-disc list-inside text-blaster-muted space-y-1 ml-2">
              <li><strong className="text-blaster-fg">Account information:</strong> email address, name, and password (or OAuth profile if you sign in with Google).</li>
              <li><strong className="text-blaster-fg">Usage data:</strong> scan results, campaign data, sender configurations, and activity logs you create within the product.</li>
              <li><strong className="text-blaster-fg">Technical data:</strong> IP address, browser type, and device information for security and operation of the service.</li>
              <li><strong className="text-blaster-fg">Payment data:</strong> processed by our payment provider (e.g. Paystack); we do not store full card numbers.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-blaster-fg mb-2">3. How we use your information</h2>
            <p className="text-blaster-muted leading-relaxed">
              We use your information to provide, secure, and improve our services; to process payments and subscriptions; to send you transactional or account-related communications; and to comply with legal obligations. We do not sell your personal information to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-blaster-fg mb-2">4. Data retention and security</h2>
            <p className="text-blaster-muted leading-relaxed">
              We retain your account and usage data for as long as your account is active or as needed to provide the service and comply with law. We use industry-standard measures to protect your data. Sender credentials (e.g. OAuth tokens, SMTP settings) are used only to send emails on your behalf and are stored securely.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-blaster-fg mb-2">5. Your rights</h2>
            <p className="text-blaster-muted leading-relaxed">
              Depending on your location, you may have the right to access, correct, delete, or export your personal data, or to object to or restrict certain processing. You can update your profile and account settings in the app. For other requests, contact us at the email below.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-blaster-fg mb-2">6. Cookies and similar technologies</h2>
            <p className="text-blaster-muted leading-relaxed">
              We use cookies and similar technologies for authentication, session management, and security. You can control cookies through your browser settings.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-blaster-fg mb-2">7. Third-party services</h2>
            <p className="text-blaster-muted leading-relaxed">
              Our service may integrate with third parties (e.g. payment processors, email providers, cloud infrastructure). Their use of data is governed by their own privacy policies. We choose partners that align with our commitment to data protection.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-blaster-fg mb-2">8. Changes to this policy</h2>
            <p className="text-blaster-muted leading-relaxed">
              We may update this Privacy Policy from time to time. We will post the updated policy on this page and update the &quot;Last updated&quot; date. Continued use of the service after changes constitutes acceptance of the revised policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-blaster-fg mb-2">9. Contact us</h2>
            <p className="text-blaster-muted leading-relaxed">
              For questions about this Privacy Policy or your personal data, contact us at{' '}
              <a href="mailto:support@wiblaster.com" className="text-blaster-accent hover:underline">support@wiblaster.com</a>.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-blaster-border">
          <Link to="/" className="text-blaster-accent hover:underline font-medium">
            ← Back to home
          </Link>
        </div>
      </main>

      <footer className="py-6 px-4 border-t border-blaster-border text-center text-sm text-blaster-muted mt-12">
        <p>© {new Date().getFullYear()} <Logo className="inline w-auto h-auto" />. All rights reserved.</p>
      </footer>
    </div>
  );
}
