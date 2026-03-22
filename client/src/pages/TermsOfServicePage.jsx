import React from 'react';
import { Link } from 'react-router-dom';

export function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-blaster-bg font-landing text-blaster-fg">
      <header className="sticky top-0 z-40 bg-blaster-bg border-b border-blaster-border">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold text-lg uppercase tracking-tight text-blaster-fg">
            <span className="text-blaster-accent">⚡</span>
            wiblaster
          </Link>
          <Link to="/" className="text-sm text-blaster-muted hover:text-blaster-fg transition">
            Back to home
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-blaster-fg">Terms of Service</h1>
        <p className="mt-2 text-blaster-muted">Last updated: {new Date().toLocaleDateString('en-US')}</p>

        <div className="mt-10 space-y-8 text-blaster-fg">
          <section>
            <h2 className="text-xl font-semibold text-blaster-fg mb-2">1. Agreement to terms</h2>
            <p className="text-blaster-muted leading-relaxed">
              By accessing or using wiblaster (&quot;Service&quot;, &quot;we&quot;, &quot;our&quot;, or &quot;us&quot;), you agree to be bound by these Terms of Service and our Privacy Policy. If you do not agree, do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-blaster-fg mb-2">2. Description of service</h2>
            <p className="text-blaster-muted leading-relaxed">
              wiblaster provides a platform for discovering contact emails from websites and sending outreach campaigns. Features include scanning store or business sites for email addresses, organizing senders (including connected Gmail accounts), and running email campaigns. We may change, suspend, or discontinue features with reasonable notice where practicable.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-blaster-fg mb-2">3. Account and eligibility</h2>
            <p className="text-blaster-muted leading-relaxed mb-3">
              You must be at least 18 years old and able to form a binding contract. You are responsible for keeping your account credentials secure and for all activity under your account. You must provide accurate information and update it as needed.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-blaster-fg mb-2">4. Acceptable use</h2>
            <p className="text-blaster-muted leading-relaxed mb-3">
              You agree to use the Service only for lawful purposes and in accordance with these Terms. You will not:
            </p>
            <ul className="list-disc list-inside text-blaster-muted space-y-1 ml-2">
              <li>Violate any applicable law, including anti-spam, data protection, or consumer protection laws.</li>
              <li>Send unsolicited commercial email (spam) or use the Service to harass, defame, or harm others.</li>
              <li>Scrape or use extracted data in ways that violate website terms of use or robots.txt.</li>
              <li>Attempt to gain unauthorized access to the Service, other accounts, or our systems.</li>
              <li>Resell, sublicense, or redistribute the Service or use it to build a competing product without our written consent.</li>
            </ul>
            <p className="text-blaster-muted leading-relaxed mt-3">
              We may suspend or terminate accounts that we reasonably believe violate these terms or pose a risk to others or the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-blaster-fg mb-2">5. Your data and content</h2>
            <p className="text-blaster-muted leading-relaxed">
              You retain ownership of the content and data you upload or create (e.g. scan results, campaigns, sender configurations). By using the Service, you grant us the rights necessary to operate the Service (e.g. storing, processing, and sending emails on your behalf). Our handling of personal data is described in our{' '}
              <Link to="/privacy" className="text-blaster-accent hover:underline">Privacy Policy</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-blaster-fg mb-2">6. Payment and subscriptions</h2>
            <p className="text-blaster-muted leading-relaxed">
              Paid plans and extra credit are billed according to the pricing in effect at the time of purchase. Fees are non-refundable except where required by law or as stated in our refund policy. We may change pricing with notice; continued use after changes constitutes acceptance. You are responsible for any taxes applicable to your use of the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-blaster-fg mb-2">7. Disclaimers</h2>
            <p className="text-blaster-muted leading-relaxed">
              The Service is provided &quot;as is&quot; and &quot;as available&quot;. We disclaim all warranties, express or implied, including merchantability and fitness for a particular purpose. We do not guarantee that the Service will be uninterrupted, error-free, or that scan or campaign results will be complete or accurate. You use the Service at your own risk.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-blaster-fg mb-2">8. Limitation of liability</h2>
            <p className="text-blaster-muted leading-relaxed">
              To the maximum extent permitted by law, we and our affiliates, officers, and employees shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or for loss of profits, data, or business opportunity, arising from your use of or inability to use the Service. Our total liability for any claim arising from these Terms or the Service shall not exceed the amount you paid us in the twelve (12) months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-blaster-fg mb-2">9. Indemnification</h2>
            <p className="text-blaster-muted leading-relaxed">
              You agree to indemnify and hold harmless wiblaster and its affiliates, officers, and employees from any claims, damages, losses, or expenses (including reasonable legal fees) arising from your use of the Service, your content, or your violation of these Terms or any law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-blaster-fg mb-2">10. Termination</h2>
            <p className="text-blaster-muted leading-relaxed">
              You may stop using the Service and close your account at any time. We may suspend or terminate your access if you breach these Terms, for non-payment, or to protect the Service or others. Upon termination, your right to use the Service ends. Provisions that by their nature should survive (e.g. disclaimers, limitation of liability, indemnification) will survive.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-blaster-fg mb-2">11. Changes to these terms</h2>
            <p className="text-blaster-muted leading-relaxed">
              We may update these Terms from time to time. We will post the updated terms on this page and update the &quot;Last updated&quot; date. Material changes may be communicated by email or in-app notice. Continued use of the Service after changes constitutes acceptance of the revised Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-blaster-fg mb-2">12. General</h2>
            <p className="text-blaster-muted leading-relaxed mb-3">
              These Terms constitute the entire agreement between you and wiblaster regarding the Service. If any provision is held unenforceable, the remaining provisions remain in effect. Our failure to enforce a right does not waive that right. These Terms are governed by the laws of the jurisdiction in which we operate, without regard to conflict of law principles.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-blaster-fg mb-2">13. Contact</h2>
            <p className="text-blaster-muted leading-relaxed">
              For questions about these Terms of Service, contact us at{' '}
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
