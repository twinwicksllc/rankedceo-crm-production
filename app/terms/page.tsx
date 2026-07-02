import Link from "next/link";

export const metadata = {
  title: "Terms of Service | RankedCEO",
  description:
    "Terms of Service for RankedCEO LLC — governing use of our CRM, Website Audit, and WaaS products.",
};

export default function TermsOfServicePage() {
  return (
    <div
      style={{
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#1a1a1a",
        background: "#fff",
      }}
    >
      {/* Header */}
      <header
        style={{
          background: "#0f172a",
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Link
          href="/"
          style={{
            color: "#fff",
            textDecoration: "none",
            fontWeight: 700,
            fontSize: "20px",
          }}
        >
          RankedCEO
        </Link>
        <nav style={{ display: "flex", gap: "24px" }}>
          <Link
            href="https://crm.rankedceo.com/privacy"
            style={{
              color: "#94a3b8",
              textDecoration: "none",
              fontSize: "14px",
            }}
          >
            Privacy Policy
          </Link>
          <Link
            href="https://crm.rankedceo.com/terms"
            style={{
              color: "#94a3b8",
              textDecoration: "none",
              fontSize: "14px",
            }}
          >
            Terms of Service
          </Link>
        </nav>
      </header>

      {/* Content */}
      <main
        style={{
          maxWidth: "800px",
          margin: "0 auto",
          padding: "48px 24px 80px",
        }}
      >
        <h1 style={{ fontSize: "36px", fontWeight: 800, marginBottom: "8px" }}>
          Terms of Service
        </h1>
        <p style={{ color: "#64748b", marginBottom: "40px" }}>
          <strong>Effective Date:</strong> June 1, 2025 &nbsp;|&nbsp;{" "}
          <strong>Last Updated:</strong> June 1, 2025
        </p>

        <section style={{ marginBottom: "36px" }}>
          <p style={{ lineHeight: 1.8, fontSize: "16px" }}>
            Please read these Terms of Service ("Terms") carefully before
            accessing or using the websites or services provided by{" "}
            <strong>RankedCEO LLC</strong> ("RankedCEO," "we," "us," or "our"),
            including{" "}
            <a href="https://rankedceo.com" style={{ color: "#4f46e5" }}>
              rankedceo.com
            </a>
            ,{" "}
            <a href="https://crm.rankedceo.com" style={{ color: "#4f46e5" }}>
              crm.rankedceo.com
            </a>
            , and{" "}
            <a href="https://audit.rankedceo.com" style={{ color: "#4f46e5" }}>
              audit.rankedceo.com
            </a>{" "}
            (collectively, the "Services"). By creating an account, clicking "I
            agree," or otherwise using the Services, you agree to be bound by
            these Terms and our{" "}
            <Link
              href="https://crm.rankedceo.com/privacy"
              style={{ color: "#4f46e5" }}
            >
              Privacy Policy
            </Link>
            . If you do not agree to these Terms, do not use the Services.
          </p>
          <p style={{ lineHeight: 1.8, marginTop: "12px" }}>
            If you are using the Services on behalf of a business or other legal
            entity, you represent that you have the authority to bind that
            entity to these Terms, and "you" and "your" will refer to that
            entity.
          </p>
        </section>

        <hr style={{ borderColor: "#e2e8f0", margin: "32px 0" }} />

        <section style={{ marginBottom: "36px" }}>
          <h2
            style={{ fontSize: "22px", fontWeight: 700, marginBottom: "12px" }}
          >
            1. Description of Services
          </h2>
          <p style={{ lineHeight: 1.8 }}>
            RankedCEO provides a suite of software-as-a-service (SaaS) tools for
            local businesses and marketing professionals. Our core offerings
            include:
          </p>
          <ul style={{ lineHeight: 2, paddingLeft: "24px", marginTop: "12px" }}>
            <li>
              <strong>CRM Platform</strong> — a customer relationship management
              tool for managing leads, clients, tasks, and communications.
            </li>
            <li>
              <strong>Website Audit Tool</strong> — an automated platform that
              analyzes websites for SEO performance, page speed, technical
              issues, and optimization opportunities.
            </li>
            <li>
              <strong>Website-as-a-Service (WaaS)</strong> — a managed website
              creation and hosting service enabling businesses to launch and
              maintain professional web presences.
            </li>
          </ul>
          <p style={{ lineHeight: 1.8, marginTop: "12px" }}>
            We reserve the right to modify, suspend, or discontinue any aspect
            of the Services at any time with or without notice, though we will
            make reasonable efforts to notify subscribers in advance of material
            changes.
          </p>
        </section>

        <hr style={{ borderColor: "#e2e8f0", margin: "32px 0" }} />

        <section style={{ marginBottom: "36px" }}>
          <h2
            style={{ fontSize: "22px", fontWeight: 700, marginBottom: "12px" }}
          >
            2. Accounts and Registration
          </h2>

          <h3
            style={{
              fontSize: "17px",
              fontWeight: 600,
              marginBottom: "8px",
              marginTop: "20px",
            }}
          >
            2.1 Account Creation
          </h3>
          <p style={{ lineHeight: 1.8 }}>
            To access certain features of the Services, you must create an
            account. You agree to provide accurate, current, and complete
            information during registration and to update that information as
            necessary. You are responsible for all activity that occurs under
            your account, and you must notify us immediately at{" "}
            <a
              href="mailto:support@twin-wicks.com"
              style={{ color: "#4f46e5" }}
            >
              support@twin-wicks.com
            </a>{" "}
            if you suspect any unauthorized use of your account.
          </p>

          <h3
            style={{
              fontSize: "17px",
              fontWeight: 600,
              marginBottom: "8px",
              marginTop: "20px",
            }}
          >
            2.2 Account Security
          </h3>
          <p style={{ lineHeight: 1.8 }}>
            You are responsible for maintaining the confidentiality of your
            credentials. You must not share your password or allow others to
            access the Services using your account. RankedCEO is not liable for
            any loss or damage arising from your failure to maintain the
            security of your account.
          </p>

          <h3
            style={{
              fontSize: "17px",
              fontWeight: 600,
              marginBottom: "8px",
              marginTop: "20px",
            }}
          >
            2.3 Eligibility
          </h3>
          <p style={{ lineHeight: 1.8 }}>
            You must be at least 18 years old and legally capable of entering
            into contracts to use the Services. By using the Services, you
            represent and warrant that you meet these requirements.
          </p>
        </section>

        <hr style={{ borderColor: "#e2e8f0", margin: "32px 0" }} />

        <section style={{ marginBottom: "36px" }}>
          <h2
            style={{ fontSize: "22px", fontWeight: 700, marginBottom: "12px" }}
          >
            3. Subscriptions, Fees, and Payment
          </h2>

          <h3
            style={{
              fontSize: "17px",
              fontWeight: 600,
              marginBottom: "8px",
              marginTop: "20px",
            }}
          >
            3.1 Paid Plans
          </h3>
          <p style={{ lineHeight: 1.8 }}>
            Certain features of the Services require a paid subscription.
            Pricing and plan details are available on our website. All fees are
            stated in U.S. dollars unless otherwise noted. We reserve the right
            to change our pricing at any time; however, price changes will not
            apply to your current billing period and we will provide at least 30
            days' notice of material fee increases.
          </p>

          <h3
            style={{
              fontSize: "17px",
              fontWeight: 600,
              marginBottom: "8px",
              marginTop: "20px",
            }}
          >
            3.2 Billing and Renewal
          </h3>
          <p style={{ lineHeight: 1.8 }}>
            Subscriptions are billed in advance on a recurring basis (monthly or
            annually, depending on your selected plan). Your subscription will
            automatically renew at the end of each billing period unless you
            cancel prior to the renewal date. You authorize us (or our payment
            processor) to charge your payment method on a recurring basis until
            you cancel.
          </p>

          <h3
            style={{
              fontSize: "17px",
              fontWeight: 600,
              marginBottom: "8px",
              marginTop: "20px",
            }}
          >
            3.3 Cancellation and Refunds
          </h3>
          <p style={{ lineHeight: 1.8 }}>
            You may cancel your subscription at any time through your account
            settings or by contacting us. Cancellation will take effect at the
            end of the current billing period, and you will continue to have
            access to the Services until that date. We do not provide refunds
            for partial billing periods, except as required by applicable law or
            as expressly stated in a promotional offer.
          </p>

          <h3
            style={{
              fontSize: "17px",
              fontWeight: 600,
              marginBottom: "8px",
              marginTop: "20px",
            }}
          >
            3.4 Taxes
          </h3>
          <p style={{ lineHeight: 1.8 }}>
            You are responsible for all applicable taxes associated with your
            use of the Services, except for taxes based on RankedCEO's net
            income. Where required by law, we may collect and remit sales tax on
            your behalf.
          </p>
        </section>

        <hr style={{ borderColor: "#e2e8f0", margin: "32px 0" }} />

        <section style={{ marginBottom: "36px" }}>
          <h2
            style={{ fontSize: "22px", fontWeight: 700, marginBottom: "12px" }}
          >
            4. Acceptable Use
          </h2>
          <p style={{ lineHeight: 1.8, marginBottom: "12px" }}>
            You agree to use the Services only for lawful purposes and in
            accordance with these Terms. You agree not to:
          </p>
          <ul style={{ lineHeight: 2, paddingLeft: "24px" }}>
            <li>
              Use the Services in any way that violates applicable federal,
              state, local, or international law or regulation.
            </li>
            <li>
              Transmit or facilitate the transmission of any unsolicited,
              unauthorized, or deceptive communications (spam).
            </li>
            <li>
              Engage in any conduct that restricts or inhibits any other user
              from using the Services, or that could damage, disable,
              overburden, or impair the Services.
            </li>
            <li>
              Use any robot, spider, scraper, or other automated means to access
              the Services without our express written permission.
            </li>
            <li>
              Attempt to gain unauthorized access to any portion of the Services
              or any related systems or networks.
            </li>
            <li>
              Upload, transmit, or distribute any content that is unlawful,
              harmful, threatening, abusive, defamatory, obscene, or otherwise
              objectionable.
            </li>
            <li>
              Impersonate any person or entity, or falsely state or misrepresent
              your affiliation with a person or entity.
            </li>
            <li>
              Use the Services to violate the privacy or data protection rights
              of third parties.
            </li>
            <li>
              Reverse engineer, decompile, or attempt to derive the source code
              of the Services.
            </li>
          </ul>
          <p style={{ lineHeight: 1.8, marginTop: "12px" }}>
            We reserve the right to terminate or suspend your access to the
            Services immediately, without prior notice, if we believe you have
            violated any of these restrictions.
          </p>
        </section>

        <hr style={{ borderColor: "#e2e8f0", margin: "32px 0" }} />

        <section style={{ marginBottom: "36px" }}>
          <h2
            style={{ fontSize: "22px", fontWeight: 700, marginBottom: "12px" }}
          >
            5. Intellectual Property
          </h2>

          <h3
            style={{
              fontSize: "17px",
              fontWeight: 600,
              marginBottom: "8px",
              marginTop: "20px",
            }}
          >
            5.1 Our Property
          </h3>
          <p style={{ lineHeight: 1.8 }}>
            The Services and all related content, features, and functionality —
            including but not limited to software, text, graphics, logos, icons,
            images, and the compilation thereof — are owned by RankedCEO LLC or
            its licensors and are protected by copyright, trademark, patent,
            trade secret, and other intellectual property laws. You may not
            copy, modify, distribute, sell, or lease any part of the Services
            without our prior written consent.
          </p>

          <h3
            style={{
              fontSize: "17px",
              fontWeight: 600,
              marginBottom: "8px",
              marginTop: "20px",
            }}
          >
            5.2 License to Use
          </h3>
          <p style={{ lineHeight: 1.8 }}>
            Subject to your compliance with these Terms, we grant you a limited,
            non-exclusive, non-transferable, revocable license to access and use
            the Services for your internal business purposes. This license does
            not include any right to sublicense, resell, or commercially exploit
            the Services without our express written authorization.
          </p>

          <h3
            style={{
              fontSize: "17px",
              fontWeight: 600,
              marginBottom: "8px",
              marginTop: "20px",
            }}
          >
            5.3 Your Content
          </h3>
          <p style={{ lineHeight: 1.8 }}>
            You retain all ownership rights to the content and data you submit
            to the Services ("Your Content"). By submitting Your Content, you
            grant RankedCEO a worldwide, non-exclusive, royalty-free license to
            use, store, process, and display Your Content solely as necessary to
            operate and improve the Services. You represent and warrant that you
            have all necessary rights to grant this license and that Your
            Content does not infringe any third-party rights.
          </p>
        </section>

        <hr style={{ borderColor: "#e2e8f0", margin: "32px 0" }} />

        <section style={{ marginBottom: "36px" }}>
          <h2
            style={{ fontSize: "22px", fontWeight: 700, marginBottom: "12px" }}
          >
            6. Confidentiality
          </h2>
          <p style={{ lineHeight: 1.8 }}>
            Each party agrees to keep confidential any non-public information
            disclosed by the other party in connection with these Terms that is
            designated as confidential or that reasonably should be understood
            to be confidential given the nature of the information and the
            circumstances of disclosure. Neither party will use the other
            party's confidential information except to exercise its rights or
            perform its obligations under these Terms. Each party will take
            reasonable precautions to protect the confidentiality of the other's
            information, no less than the precautions it takes to protect its
            own confidential information.
          </p>
        </section>

        <hr style={{ borderColor: "#e2e8f0", margin: "32px 0" }} />

        <section style={{ marginBottom: "36px" }}>
          <h2
            style={{ fontSize: "22px", fontWeight: 700, marginBottom: "12px" }}
          >
            7. Disclaimers and Limitation of Liability
          </h2>

          <h3
            style={{
              fontSize: "17px",
              fontWeight: 600,
              marginBottom: "8px",
              marginTop: "20px",
            }}
          >
            7.1 Disclaimer of Warranties
          </h3>
          <p style={{ lineHeight: 1.8 }}>
            THE SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT
            WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT
            LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
            PURPOSE, TITLE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE
            SERVICES WILL BE UNINTERRUPTED, ERROR-FREE, SECURE, OR FREE FROM
            VIRUSES OR OTHER HARMFUL COMPONENTS. WE MAKE NO WARRANTY REGARDING
            THE ACCURACY, COMPLETENESS, OR USEFULNESS OF ANY INFORMATION
            PROVIDED THROUGH THE SERVICES.
          </p>

          <h3
            style={{
              fontSize: "17px",
              fontWeight: 600,
              marginBottom: "8px",
              marginTop: "20px",
            }}
          >
            7.2 Limitation of Liability
          </h3>
          <p style={{ lineHeight: 1.8 }}>
            TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, RANKEDCEO LLC AND
            ITS OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, SUPPLIERS, AND LICENSORS
            WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
            CONSEQUENTIAL, PUNITIVE, OR EXEMPLARY DAMAGES, INCLUDING LOSS OF
            PROFITS, REVENUE, DATA, GOODWILL, OR BUSINESS, ARISING OUT OF OR
            RELATED TO THESE TERMS OR THE SERVICES, EVEN IF WE HAVE BEEN ADVISED
            OF THE POSSIBILITY OF SUCH DAMAGES. OUR TOTAL CUMULATIVE LIABILITY
            ARISING OUT OF OR RELATED TO THESE TERMS OR THE SERVICES WILL NOT
            EXCEED THE GREATER OF (A) THE AMOUNT YOU PAID TO RANKEDCEO IN THE
            TWELVE (12) MONTHS PRECEDING THE CLAIM, OR (B) ONE HUNDRED U.S.
            DOLLARS ($100.00).
          </p>

          <h3
            style={{
              fontSize: "17px",
              fontWeight: 600,
              marginBottom: "8px",
              marginTop: "20px",
            }}
          >
            7.3 Essential Basis
          </h3>
          <p style={{ lineHeight: 1.8 }}>
            The limitations and exclusions in this Section 7 reflect a
            reasonable allocation of risk and are an essential element of the
            basis of the bargain between RankedCEO and you. RankedCEO would not
            be able to provide the Services on an economically reasonable basis
            without these limitations.
          </p>
        </section>

        <hr style={{ borderColor: "#e2e8f0", margin: "32px 0" }} />

        <section style={{ marginBottom: "36px" }}>
          <h2
            style={{ fontSize: "22px", fontWeight: 700, marginBottom: "12px" }}
          >
            8. Indemnification
          </h2>
          <p style={{ lineHeight: 1.8 }}>
            You agree to indemnify, defend, and hold harmless RankedCEO LLC and
            its officers, directors, employees, agents, licensors, and suppliers
            from and against any claims, liabilities, damages, judgments,
            awards, losses, costs, expenses, or fees (including reasonable
            attorneys' fees) arising out of or relating to your violation of
            these Terms, your use of the Services, Your Content, or your
            violation of any law or the rights of any third party.
          </p>
        </section>

        <hr style={{ borderColor: "#e2e8f0", margin: "32px 0" }} />

        <section style={{ marginBottom: "36px" }}>
          <h2
            style={{ fontSize: "22px", fontWeight: 700, marginBottom: "12px" }}
          >
            9. Termination
          </h2>
          <p style={{ lineHeight: 1.8 }}>
            We may terminate or suspend your account and access to the Services
            immediately, without prior notice, for any reason, including if you
            breach these Terms. Upon termination, your right to use the Services
            will immediately cease. You may also terminate your account at any
            time by contacting us at{" "}
            <a
              href="mailto:support@twin-wicks.com"
              style={{ color: "#4f46e5" }}
            >
              support@twin-wicks.com
            </a>
            . Sections of these Terms that by their nature should survive
            termination will survive, including Sections 5, 7, 8, and 10.
          </p>
        </section>

        <hr style={{ borderColor: "#e2e8f0", margin: "32px 0" }} />

        <section style={{ marginBottom: "36px" }}>
          <h2
            style={{ fontSize: "22px", fontWeight: 700, marginBottom: "12px" }}
          >
            10. Governing Law and Dispute Resolution
          </h2>

          <h3
            style={{
              fontSize: "17px",
              fontWeight: 600,
              marginBottom: "8px",
              marginTop: "20px",
            }}
          >
            10.1 Governing Law
          </h3>
          <p style={{ lineHeight: 1.8 }}>
            These Terms and any dispute arising out of or related to these Terms
            or the Services will be governed by and construed in accordance with
            the laws of the State of Delaware, without regard to its conflict of
            law provisions.
          </p>

          <h3
            style={{
              fontSize: "17px",
              fontWeight: 600,
              marginBottom: "8px",
              marginTop: "20px",
            }}
          >
            10.2 Informal Resolution
          </h3>
          <p style={{ lineHeight: 1.8 }}>
            Before filing any formal legal action, you agree to first contact us
            at{" "}
            <a
              href="mailto:support@twin-wicks.com"
              style={{ color: "#4f46e5" }}
            >
              support@twin-wicks.com
            </a>{" "}
            and attempt to resolve the dispute informally. We will attempt to
            resolve the dispute within 30 days of receiving your notice.
          </p>

          <h3
            style={{
              fontSize: "17px",
              fontWeight: 600,
              marginBottom: "8px",
              marginTop: "20px",
            }}
          >
            10.3 Arbitration
          </h3>
          <p style={{ lineHeight: 1.8 }}>
            If the dispute cannot be resolved informally, you and RankedCEO
            agree that any dispute, claim, or controversy arising out of or
            relating to these Terms or the Services will be resolved by binding
            arbitration under the rules of the American Arbitration Association
            (AAA), rather than in a court of law, except that either party may
            seek injunctive or other equitable relief in any court of competent
            jurisdiction for actual or threatened infringement of intellectual
            property rights. The arbitration will be conducted on an individual
            basis and not as a class action or representative proceeding.
          </p>
        </section>

        <hr style={{ borderColor: "#e2e8f0", margin: "32px 0" }} />

        <section style={{ marginBottom: "36px" }}>
          <h2
            style={{ fontSize: "22px", fontWeight: 700, marginBottom: "12px" }}
          >
            11. General Provisions
          </h2>

          <h3
            style={{
              fontSize: "17px",
              fontWeight: 600,
              marginBottom: "8px",
              marginTop: "20px",
            }}
          >
            11.1 Entire Agreement
          </h3>
          <p style={{ lineHeight: 1.8 }}>
            These Terms, together with our Privacy Policy and any other
            agreements expressly incorporated by reference, constitute the
            entire agreement between you and RankedCEO LLC regarding the
            Services and supersede all prior agreements and understandings.
          </p>

          <h3
            style={{
              fontSize: "17px",
              fontWeight: 600,
              marginBottom: "8px",
              marginTop: "20px",
            }}
          >
            11.2 Severability
          </h3>
          <p style={{ lineHeight: 1.8 }}>
            If any provision of these Terms is found to be invalid, illegal, or
            unenforceable, the remaining provisions will continue in full force
            and effect.
          </p>

          <h3
            style={{
              fontSize: "17px",
              fontWeight: 600,
              marginBottom: "8px",
              marginTop: "20px",
            }}
          >
            11.3 Waiver
          </h3>
          <p style={{ lineHeight: 1.8 }}>
            Our failure to enforce any right or provision of these Terms will
            not constitute a waiver of that right or provision. Any waiver must
            be in writing and signed by an authorized representative of
            RankedCEO LLC.
          </p>

          <h3
            style={{
              fontSize: "17px",
              fontWeight: 600,
              marginBottom: "8px",
              marginTop: "20px",
            }}
          >
            11.4 Assignment
          </h3>
          <p style={{ lineHeight: 1.8 }}>
            You may not assign or transfer your rights or obligations under
            these Terms without our prior written consent. We may assign these
            Terms without restriction in connection with a merger, acquisition,
            or sale of all or substantially all of our assets.
          </p>

          <h3
            style={{
              fontSize: "17px",
              fontWeight: 600,
              marginBottom: "8px",
              marginTop: "20px",
            }}
          >
            11.5 Force Majeure
          </h3>
          <p style={{ lineHeight: 1.8 }}>
            Neither party will be liable for any failure or delay in performance
            due to causes beyond its reasonable control, including acts of God,
            natural disasters, terrorism, labor disputes, changes in law, or
            internet service provider failures.
          </p>

          <h3
            style={{
              fontSize: "17px",
              fontWeight: 600,
              marginBottom: "8px",
              marginTop: "20px",
            }}
          >
            11.6 Updates to These Terms
          </h3>
          <p style={{ lineHeight: 1.8 }}>
            We reserve the right to modify these Terms at any time. When we make
            material changes, we will update the "Last Updated" date and provide
            reasonable notice. Your continued use of the Services after the
            effective date of any changes constitutes your acceptance of the
            updated Terms.
          </p>
        </section>

        <hr style={{ borderColor: "#e2e8f0", margin: "32px 0" }} />

        <section style={{ marginBottom: "36px" }}>
          <h2
            style={{ fontSize: "22px", fontWeight: 700, marginBottom: "12px" }}
          >
            12. Contact Us
          </h2>
          <p style={{ lineHeight: 1.8 }}>
            If you have any questions about these Terms of Service, please
            contact us:
          </p>
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              padding: "20px",
              marginTop: "16px",
            }}
          >
            <p style={{ margin: 0, lineHeight: 2 }}>
              <strong>RankedCEO LLC</strong>
              <br />
              Email:{" "}
              <a
                href="mailto:support@twin-wicks.com"
                style={{ color: "#4f46e5" }}
              >
                support@twin-wicks.com
              </a>
              <br />
              Website:{" "}
              <a href="https://rankedceo.com" style={{ color: "#4f46e5" }}>
                https://rankedceo.com
              </a>
            </p>
          </div>
        </section>

        <div
          style={{
            marginTop: "48px",
            paddingTop: "24px",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            gap: "24px",
            fontSize: "14px",
            color: "#64748b",
          }}
        >
          <Link
            href="https://crm.rankedceo.com/privacy"
            style={{ color: "#4f46e5", textDecoration: "none" }}
          >
            ← Privacy Policy
          </Link>
          <Link
            href="https://crm.rankedceo.com"
            style={{ color: "#64748b", textDecoration: "none" }}
          >
            ← Back to Home
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer
        style={{
          background: "#0f172a",
          color: "#94a3b8",
          padding: "24px",
          textAlign: "center",
          fontSize: "14px",
        }}
      >
        <p style={{ margin: 0 }}>
          © {new Date().getFullYear()} RankedCEO LLC. All rights reserved.
          &nbsp;|&nbsp;{" "}
          <Link
            href="https://crm.rankedceo.com/privacy"
            style={{ color: "#94a3b8", textDecoration: "underline" }}
          >
            Privacy Policy
          </Link>
          &nbsp;|&nbsp;{" "}
          <Link
            href="https://crm.rankedceo.com/terms"
            style={{ color: "#94a3b8", textDecoration: "underline" }}
          >
            Terms of Service
          </Link>
        </p>
      </footer>
    </div>
  );
}
