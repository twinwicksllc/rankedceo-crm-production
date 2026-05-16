import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy | RankedCEO',
  description: 'Privacy Policy for RankedCEO LLC — covering our CRM, Website Audit, and WaaS products.',
}

export default function PrivacyPolicyPage() {
  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', color: '#1a1a1a', background: '#fff' }}>
      {/* Header */}
      <header style={{ background: '#0f172a', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: '20px' }}>
          RankedCEO
        </Link>
        <nav style={{ display: 'flex', gap: '24px' }}>
          <Link href="/privacy" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '14px' }}>Privacy Policy</Link>
          <Link href="/terms" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '14px' }}>Terms of Service</Link>
        </nav>
      </header>

      {/* Content */}
      <main style={{ maxWidth: '800px', margin: '0 auto', padding: '48px 24px 80px' }}>
        <h1 style={{ fontSize: '36px', fontWeight: 800, marginBottom: '8px' }}>Privacy Policy</h1>
        <p style={{ color: '#64748b', marginBottom: '40px' }}>
          <strong>Effective Date:</strong> June 1, 2025 &nbsp;|&nbsp; <strong>Last Updated:</strong> June 1, 2025
        </p>

        <section style={{ marginBottom: '36px' }}>
          <p style={{ lineHeight: 1.8, fontSize: '16px' }}>
            RankedCEO LLC ("RankedCEO," "we," "us," or "our") operates the websites located at{' '}
            <a href="https://rankedceo.com" style={{ color: '#4f46e5' }}>rankedceo.com</a>,{' '}
            <a href="https://crm.rankedceo.com" style={{ color: '#4f46e5' }}>crm.rankedceo.com</a>, and{' '}
            <a href="https://audit.rankedceo.com" style={{ color: '#4f46e5' }}>audit.rankedceo.com</a>, along with the
            associated software-as-a-service products including our CRM platform, Website Audit tool, and Website-as-a-Service
            (WaaS) offering (collectively, the "Services"). This Privacy Policy explains how we collect, use, disclose, and
            protect information about you when you use our Services. By accessing or using our Services, you agree to the
            practices described in this policy.
          </p>
        </section>

        <hr style={{ borderColor: '#e2e8f0', margin: '32px 0' }} />

        <section style={{ marginBottom: '36px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '12px' }}>1. Information We Collect</h2>

          <h3 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '8px', marginTop: '20px' }}>1.1 Information You Provide Directly</h3>
          <p style={{ lineHeight: 1.8 }}>
            When you register for an account, subscribe to a plan, submit a form, or contact us, we may collect your name,
            email address, phone number, company name, billing address, payment information (processed securely through our
            payment processors), and any other information you choose to provide.
          </p>

          <h3 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '8px', marginTop: '20px' }}>1.2 Information We Collect Automatically</h3>
          <p style={{ lineHeight: 1.8 }}>
            When you use our Services, we automatically collect certain information about your device and usage, including
            IP address, browser type and version, operating system, referring URLs, pages viewed, time spent on pages,
            click-through data, and other diagnostic data. We use cookies, pixel tags, and similar tracking technologies
            to collect this information. You can instruct your browser to refuse all cookies or to indicate when a cookie
            is being sent; however, some features of the Services may not function properly if you do so.
          </p>

          <h3 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '8px', marginTop: '20px' }}>1.3 Information from Third Parties</h3>
          <p style={{ lineHeight: 1.8 }}>
            We may receive information about you from third-party services you choose to connect to your account, such as
            Google (when you sign in with Google), or from publicly available sources such as business directories,
            review platforms, and search engine data relevant to your website audit or lead generation activity.
          </p>

          <h3 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '8px', marginTop: '20px' }}>1.4 Client Data</h3>
          <p style={{ lineHeight: 1.8 }}>
            If you use our CRM or WaaS platform to manage your own customers' data, we process that data on your behalf
            as a data processor. You remain the data controller for your customers' information, and you are responsible
            for ensuring you have the appropriate legal basis to collect and share that data with us.
          </p>
        </section>

        <hr style={{ borderColor: '#e2e8f0', margin: '32px 0' }} />

        <section style={{ marginBottom: '36px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '12px' }}>2. How We Use Your Information</h2>
          <p style={{ lineHeight: 1.8, marginBottom: '12px' }}>We use the information we collect for the following purposes:</p>
          <ul style={{ lineHeight: 2, paddingLeft: '24px' }}>
            <li><strong>Providing and improving the Services</strong> — creating and managing your account, processing transactions, delivering features, and troubleshooting issues.</li>
            <li><strong>Communication</strong> — sending you service-related emails, product updates, security alerts, and support messages. With your consent, we may also send promotional communications; you can opt out at any time.</li>
            <li><strong>Analytics and research</strong> — understanding how users interact with our Services so we can improve usability and performance.</li>
            <li><strong>Personalization</strong> — tailoring your experience and surfacing relevant features or content based on your usage patterns.</li>
            <li><strong>Legal and safety</strong> — complying with applicable laws, responding to legal processes, enforcing our agreements, and protecting the rights, property, and safety of RankedCEO and our users.</li>
            <li><strong>Fraud prevention</strong> — detecting, investigating, and preventing fraudulent transactions and other illegal activity.</li>
          </ul>
        </section>

        <hr style={{ borderColor: '#e2e8f0', margin: '32px 0' }} />

        <section style={{ marginBottom: '36px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '12px' }}>3. How We Share Your Information</h2>
          <p style={{ lineHeight: 1.8, marginBottom: '12px' }}>
            We do not sell your personal information. We may share your information in the following circumstances:
          </p>
          <ul style={{ lineHeight: 2, paddingLeft: '24px' }}>
            <li><strong>Service providers</strong> — we share information with trusted third-party vendors who perform services on our behalf, such as payment processing (e.g., Stripe), cloud hosting (e.g., Supabase, Vercel), email delivery, analytics, and customer support tools. These providers are contractually obligated to handle your data securely and only for the purposes we specify.</li>
            <li><strong>Business transfers</strong> — if RankedCEO LLC is involved in a merger, acquisition, asset sale, or financing, your information may be transferred as part of that transaction. We will notify you via email or a prominent notice on our website before your information becomes subject to a different privacy policy.</li>
            <li><strong>Legal requirements</strong> — we may disclose your information when required by law, subpoena, court order, or other governmental authority, or when we believe in good faith that disclosure is necessary to protect our rights or the safety of others.</li>
            <li><strong>With your consent</strong> — we may share your information with third parties when you have given us explicit consent to do so.</li>
          </ul>
        </section>

        <hr style={{ borderColor: '#e2e8f0', margin: '32px 0' }} />

        <section style={{ marginBottom: '36px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '12px' }}>4. Cookies and Tracking Technologies</h2>
          <p style={{ lineHeight: 1.8 }}>
            We use cookies and similar tracking technologies (including web beacons and pixel tags) to operate and improve
            our Services. Cookies are small text files stored on your device that help us recognize you between visits,
            maintain your session state, and gather analytics data. We use the following categories of cookies:
          </p>
          <ul style={{ lineHeight: 2, paddingLeft: '24px', marginTop: '12px' }}>
            <li><strong>Strictly necessary</strong> — required for the Services to function, such as authentication tokens and session management.</li>
            <li><strong>Analytics and performance</strong> — help us understand how visitors interact with our pages (e.g., Google Analytics).</li>
            <li><strong>Functionality</strong> — remember your preferences and settings.</li>
            <li><strong>Marketing</strong> — used to deliver relevant advertisements. You may opt out of interest-based advertising through industry opt-out tools such as the NAI opt-out tool at <a href="https://optout.networkadvertising.org" style={{ color: '#4f46e5' }}>optout.networkadvertising.org</a>.</li>
          </ul>
          <p style={{ lineHeight: 1.8, marginTop: '12px' }}>
            You can control cookies through your browser settings. Disabling certain cookies may affect the functionality
            of the Services.
          </p>
        </section>

        <hr style={{ borderColor: '#e2e8f0', margin: '32px 0' }} />

        <section style={{ marginBottom: '36px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '12px' }}>5. Data Retention</h2>
          <p style={{ lineHeight: 1.8 }}>
            We retain your personal information for as long as necessary to provide the Services, comply with our legal
            obligations, resolve disputes, and enforce our agreements. Account data is typically retained for the duration
            of your subscription plus up to 90 days following account termination, after which it is deleted or anonymized
            unless a longer retention period is required by law. Audit logs and usage records may be retained for up to
            3 years for security and compliance purposes.
          </p>
        </section>

        <hr style={{ borderColor: '#e2e8f0', margin: '32px 0' }} />

        <section style={{ marginBottom: '36px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '12px' }}>6. Data Security</h2>
          <p style={{ lineHeight: 1.8 }}>
            We implement administrative, technical, and physical security measures designed to protect your information
            against unauthorized access, loss, theft, and misuse. These measures include TLS/HTTPS encryption for data
            in transit, encrypted storage for sensitive fields, role-based access controls, and regular security reviews.
            However, no method of transmission over the Internet or electronic storage is 100% secure, and we cannot
            guarantee absolute security. You are responsible for maintaining the confidentiality of your account
            credentials and for any activity that occurs under your account.
          </p>
        </section>

        <hr style={{ borderColor: '#e2e8f0', margin: '32px 0' }} />

        <section style={{ marginBottom: '36px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '12px' }}>7. Your Rights and Choices</h2>
          <p style={{ lineHeight: 1.8, marginBottom: '12px' }}>
            Depending on your location, you may have the following rights with respect to your personal information:
          </p>
          <ul style={{ lineHeight: 2, paddingLeft: '24px' }}>
            <li><strong>Access</strong> — request a copy of the personal information we hold about you.</li>
            <li><strong>Correction</strong> — request that we correct inaccurate or incomplete information.</li>
            <li><strong>Deletion</strong> — request that we delete your personal information, subject to certain legal exceptions.</li>
            <li><strong>Portability</strong> — request that we provide your personal information in a structured, machine-readable format.</li>
            <li><strong>Objection / Restriction</strong> — object to or ask us to restrict certain processing of your data.</li>
            <li><strong>Withdraw consent</strong> — where processing is based on consent, you may withdraw it at any time without affecting the lawfulness of prior processing.</li>
            <li><strong>Opt out of marketing</strong> — unsubscribe from marketing communications at any time by clicking "Unsubscribe" in any email we send, or by contacting us directly.</li>
          </ul>
          <p style={{ lineHeight: 1.8, marginTop: '12px' }}>
            To exercise any of these rights, please contact us at{' '}
            <a href="mailto:support@twin-wicks.com" style={{ color: '#4f46e5' }}>support@twin-wicks.com</a>.
            We will respond to your request within 30 days. We may need to verify your identity before processing certain requests.
          </p>
        </section>

        <hr style={{ borderColor: '#e2e8f0', margin: '32px 0' }} />

        <section style={{ marginBottom: '36px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '12px' }}>8. Children's Privacy</h2>
          <p style={{ lineHeight: 1.8 }}>
            Our Services are not directed to children under the age of 13, and we do not knowingly collect personal
            information from children under 13. If we become aware that a child under 13 has provided us with personal
            information, we will take steps to delete that information. If you believe that a child under 13 has provided
            information to us, please contact us at{' '}
            <a href="mailto:support@twin-wicks.com" style={{ color: '#4f46e5' }}>support@twin-wicks.com</a>.
          </p>
        </section>

        <hr style={{ borderColor: '#e2e8f0', margin: '32px 0' }} />

        <section style={{ marginBottom: '36px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '12px' }}>9. Third-Party Links and Integrations</h2>
          <p style={{ lineHeight: 1.8 }}>
            Our Services may contain links to third-party websites or integrate with third-party services (such as Google,
            Stripe, or social media platforms). This Privacy Policy does not apply to those third-party services, and we
            are not responsible for their privacy practices. We encourage you to review the privacy policies of any
            third-party services you interact with through our platform.
          </p>
        </section>

        <hr style={{ borderColor: '#e2e8f0', margin: '32px 0' }} />

        <section style={{ marginBottom: '36px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '12px' }}>10. International Data Transfers</h2>
          <p style={{ lineHeight: 1.8 }}>
            RankedCEO LLC is based in the United States. If you access our Services from outside the United States, please
            be aware that your information may be transferred to, stored, and processed in the United States. By using our
            Services, you consent to the transfer of your information to the United States and to countries where our
            service providers operate. We take steps to ensure that your information receives an adequate level of
            protection wherever it is processed, including through contractual data protection agreements with our
            service providers.
          </p>
        </section>

        <hr style={{ borderColor: '#e2e8f0', margin: '32px 0' }} />

        <section style={{ marginBottom: '36px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '12px' }}>11. California Privacy Rights (CCPA)</h2>
          <p style={{ lineHeight: 1.8 }}>
            If you are a California resident, the California Consumer Privacy Act (CCPA) provides you with specific rights
            regarding your personal information. You have the right to know what personal information we collect, use,
            disclose, and sell; the right to delete personal information we have collected from you; the right to opt out
            of the sale of your personal information (we do not sell personal information); and the right to
            non-discrimination for exercising your CCPA rights. To submit a request to exercise any of these rights,
            please contact us at{' '}
            <a href="mailto:support@twin-wicks.com" style={{ color: '#4f46e5' }}>support@twin-wicks.com</a>.
          </p>
        </section>

        <hr style={{ borderColor: '#e2e8f0', margin: '32px 0' }} />

        <section style={{ marginBottom: '36px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '12px' }}>12. Changes to This Privacy Policy</h2>
          <p style={{ lineHeight: 1.8 }}>
            We may update this Privacy Policy from time to time. When we make changes, we will revise the "Last Updated"
            date at the top of this page. For material changes, we will provide additional notice such as an in-app
            notification or an email to the address associated with your account. Your continued use of the Services
            after any update constitutes your acceptance of the revised policy. We encourage you to review this policy
            periodically.
          </p>
        </section>

        <hr style={{ borderColor: '#e2e8f0', margin: '32px 0' }} />

        <section style={{ marginBottom: '36px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '12px' }}>13. Contact Us</h2>
          <p style={{ lineHeight: 1.8 }}>
            If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please
            contact us:
          </p>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px', marginTop: '16px' }}>
            <p style={{ margin: 0, lineHeight: 2 }}>
              <strong>RankedCEO LLC</strong><br />
              Email: <a href="mailto:support@twin-wicks.com" style={{ color: '#4f46e5' }}>support@twin-wicks.com</a><br />
              Website: <a href="https://rankedceo.com" style={{ color: '#4f46e5' }}>https://rankedceo.com</a>
            </p>
          </div>
        </section>

        <div style={{ marginTop: '48px', paddingTop: '24px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '24px', fontSize: '14px', color: '#64748b' }}>
          <Link href="/terms" style={{ color: '#4f46e5', textDecoration: 'none' }}>Terms of Service →</Link>
          <Link href="/" style={{ color: '#64748b', textDecoration: 'none' }}>← Back to Home</Link>
        </div>
      </main>

      {/* Footer */}
      <footer style={{ background: '#0f172a', color: '#94a3b8', padding: '24px', textAlign: 'center', fontSize: '14px' }}>
        <p style={{ margin: 0 }}>
          © {new Date().getFullYear()} RankedCEO LLC. All rights reserved. &nbsp;|&nbsp;{' '}
          <Link href="/privacy" style={{ color: '#94a3b8', textDecoration: 'underline' }}>Privacy Policy</Link>
          &nbsp;|&nbsp;{' '}
          <Link href="/terms" style={{ color: '#94a3b8', textDecoration: 'underline' }}>Terms of Service</Link>
        </p>
      </footer>
    </div>
  )
}
