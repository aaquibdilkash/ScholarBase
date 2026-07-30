import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | ScholarBase",
  description:
    "Please read these Terms of Service carefully before using ScholarBase. Your access to and use of the Service is conditioned on your acceptance of and compliance with these Terms.",
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-[calc(100vh-8rem)] py-12">
      <div className="mx-auto max-w-4xl px-4">
        <h1 className="sb-heading text-center">Terms of Service</h1>
        <p className="sb-subtitle mt-4 text-center">
          Last updated: July 29, 2026
        </p>

        <div className="prose prose-lg mx-auto mt-8">
          <p>
            Welcome to ScholarBase. These Terms of Service (&ldquo;Terms&rdquo;)
            govern your access to and use of the ScholarBase website, platform,
            and services (collectively, the &ldquo;Service&rdquo;), operated by
            ScholarBase (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or
            &ldquo;our&rdquo;).
          </p>

          <p>
            By accessing or using the Service, you agree to be bound by these
            Terms. If you do not agree to these Terms, you may not access or use
            the Service. Your access to and use of the Service is also
            conditioned on your acceptance of and compliance with our{" "}
            <a href="/privacy">Privacy Policy</a>.
          </p>

          <h2>1. Acceptance and Eligibility</h2>
          <p>
            By creating an account or using the Service, you represent and
            warrant that:
          </p>
          <ul>
            <li>
              You are at least <strong>13 years of age</strong> (or the age of
              digital consent in your country).
            </li>
            <li>
              You have the full power and authority to enter into these Terms.
            </li>
            <li>
              You are not located in a country subject to a U.S. or Indian
              government embargo.
            </li>
            <li>
              You will comply with these Terms and all applicable local, national,
              and international laws and regulations.
            </li>
          </ul>

          <h2>2. Account Registration and Security</h2>
          <p>
            To access certain features of the Service, you must create an
            account. You may register via email or using Google OAuth
            authentication.
          </p>
          <ul>
            <li>
              You are responsible for maintaining the confidentiality of your
              account credentials.
            </li>
            <li>
              You are responsible for all activities that occur under your
              account.
            </li>
            <li>
              You agree to notify us immediately of any unauthorized use of your
              account at{" "}
              <a href="mailto:connect@scholarbase.app">
                connect@scholarbase.app
              </a>
              .
            </li>
            <li>
              We reserve the right to refuse service, terminate accounts, or
              remove or edit content at our sole discretion.
            </li>
          </ul>

          <h2>3. Google OAuth and Third-Party Authentication</h2>
          <p>
            ScholarBase offers sign-in via Google OAuth for your convenience. By
            using Google sign-in, you agree to:
          </p>
          <ul>
            <li>
              Allow ScholarBase to access your Google account email address and
              profile information as described in our Privacy Policy.
            </li>
            <li>
              Comply with Google&apos;s{" "}
              <a
                href="https://policies.google.com/terms"
                target="_blank"
                rel="noopener noreferrer"
              >
                Terms of Service
              </a>{" "}
              and{" "}
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
              >
                Privacy Policy
              </a>
              .
            </li>
            <li>
              Acknowledge that your use of Google services is governed by
              Google&apos;s own terms.
            </li>
          </ul>

          <h2>4. User-Generated Content</h2>
          <h3>4.1 Ownership</h3>
          <p>
            You retain all ownership rights to the content you post on
            ScholarBase, including publications, blog posts, comments, feed
            updates, survey responses, and any other materials
            (&ldquo;Content&rdquo;).
          </p>

          <h3>4.2 License to ScholarBase</h3>
          <p>
            By posting Content on ScholarBase, you grant us a non-exclusive,
            worldwide, royalty-free, sublicensable, and transferable license to
            use, reproduce, modify, adapt, publish, and display such Content
            solely for the purpose of operating, providing, and improving the
            Service. This license ends when you delete your Content or your
            account, except to the extent your Content has been shared with
            others and they have not deleted it.
          </p>

          <h3>4.3 Content Representations and Warranties</h3>
          <p>
            You represent and warrant that:
          </p>
          <ul>
            <li>You own the Content or have the necessary licenses, rights, consents, and permissions.</li>
            <li>Your Content does not infringe the intellectual property rights, privacy rights, or other rights of any third party.</li>
            <li>Your Content complies with these Terms and all applicable laws.</li>
          </ul>

          <h2>5. Prohibited Conduct</h2>
          <p>You agree not to:</p>
          <ul>
            <li>
              Post, upload, or transmit any Content that is illegal, harmful,
              threatening, abusive, harassing, defamatory, vulgar, obscene, or
              hateful.
            </li>
            <li>
              Impersonate any person or entity or falsely state or misrepresent
              your affiliation with a person or entity.
            </li>
            <li>
              Engage in spam, phishing, or any form of unsolicited
              communication.
            </li>
            <li>
              Attempt to gain unauthorized access to any part of the Service,
              other accounts, or computer systems.
            </li>
            <li>
              Use the Service for any commercial purpose without our prior
              written consent.
            </li>
            <li>
              Interfere with or disrupt the integrity or performance of the
              Service.
            </li>
            <li>
              Collect or harvest any personally identifiable information from
              the Service.
            </li>
            <li>
              Use the Service to distribute malware, viruses, or other harmful
              code.
            </li>
          </ul>

          <h2>6. Copyright and DMCA Compliance</h2>
          <p>
            ScholarBase respects the intellectual property rights of others. If
            you believe that your copyrighted work has been copied in a way that
            constitutes copyright infringement, please provide us with a
            written notice containing the following information:
          </p>
          <ul>
            <li>
              A physical or electronic signature of the copyright owner or
              authorized representative.
            </li>
            <li>
              Identification of the copyrighted work claimed to have been
              infringed.
            </li>
            <li>
              Identification of the material that is claimed to be infringing,
              with sufficient detail for us to locate it.
            </li>
            <li>
              Your contact information, including address, telephone number, and
              email.
            </li>
            <li>
              A statement that you have a good faith belief that the use is not
              authorized.
            </li>
            <li>
              A statement that the information in the notification is accurate,
              and under penalty of perjury, that you are authorized to act on
              behalf of the copyright owner.
            </li>
          </ul>
          <p>
            Send copyright infringement notices to:{" "}
            <a href="mailto:connect@scholarbase.app">
              connect@scholarbase.app
            </a>
          </p>

          <h2>7. Platform Content and Third-Party Links</h2>
          <p>
            ScholarBase contains academic content, publications, and
            information posted by its users. We do not verify, endorse, or
            guarantee the accuracy, completeness, or usefulness of any Content.
            You rely on Content at your own risk.
          </p>
          <p>
            The Service may contain links to third-party websites or resources.
            ScholarBase is not responsible for the availability, content, or
            practices of any third-party websites. Your use of third-party
            websites is at your own risk and subject to their terms and
            privacy policies.
          </p>

          <h2>8. Termination</h2>
          <p>
            We may terminate or suspend your account and access to the Service
            at any time, without prior notice or liability, for any reason,
            including if you breach these Terms.
          </p>
          <p>
            Upon termination:
          </p>
          <ul>
            <li>Your right to use the Service will immediately cease.</li>
            <li>
              We may delete your account and Content, though we are not
              obligated to do so immediately.
            </li>
            <li>
              Sections of these Terms that by their nature should survive
              termination (including ownership, warranty disclaimers,
              indemnification, and limitations of liability) will continue to
              apply.
            </li>
          </ul>
          <p>
            You may delete your account at any time by contacting us or using
            account deletion features where available.
          </p>

          <h2>9. Service Modifications</h2>
          <p>
            We reserve the right to modify, suspend, or discontinue the Service
            (or any part thereof) at any time with or without notice. We will
            not be liable to you or any third party for any modification,
            suspension, or discontinuance of the Service.
          </p>

          <h2>10. Disclaimer of Warranties</h2>
          <p>
            THE SERVICE IS PROVIDED ON AN &ldquo;AS IS&rdquo; AND
            &ldquo;AS AVAILABLE&rdquo; BASIS. SCHOLARBASE MAKES NO
            REPRESENTATIONS OR WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED,
            INCLUDING BUT NOT LIMITED TO:
          </p>
          <ul>
            <li>
              WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
              NON-INFRINGEMENT, OR COURSE OF PERFORMANCE.
            </li>
            <li>
              THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, SECURE, OR
              FREE FROM VIRUSES OR OTHER HARMFUL COMPONENTS.
            </li>
            <li>
              REGARDING THE ACCURACY, RELIABILITY, OR QUALITY OF ANY CONTENT
              POSTED ON THE SERVICE.
            </li>
          </ul>

          <h2>11. Limitation of Liability</h2>
          <p>
            TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT
            SHALL SCHOLARBASE, ITS DIRECTORS, EMPLOYEES, PARTNERS, AGENTS,
            SUPPLIERS, OR AFFILIATES BE LIABLE FOR ANY:
          </p>
          <ul>
            <li>
              INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES.
            </li>
            <li>
              LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES.
            </li>
            <li>
              DAMAGES ARISING FROM YOUR ACCESS TO OR USE OF OR INABILITY TO
              ACCESS OR USE THE SERVICE.
            </li>
            <li>
              CONDUCT OR CONTENT OF ANY THIRD PARTY ON THE SERVICE.
            </li>
          </ul>
          <p>
            OUR TOTAL LIABILITY TO YOU FOR ALL CLAIMS ARISING FROM OR RELATING
            TO THESE TERMS OR YOUR USE OF THE SERVICE SHALL NOT EXCEED THE
            GREATER OF (A) THE AMOUNT YOU HAVE PAID US IN THE PAST 12 MONTHS,
            OR (B) $100 USD. SOME JURISDICTIONS DO NOT ALLOW THE EXCLUSION OR
            LIMITATION OF CERTAIN DAMAGES, SO SOME OF THE ABOVE EXCLUSIONS MAY
            NOT APPLY TO YOU.
          </p>

          <h2>12. Indemnification</h2>
          <p>
            You agree to indemnify, defend, and hold harmless ScholarBase, its
            directors, employees, and agents from and against any claims,
            liabilities, damages, losses, costs, or expenses (including
            reasonable attorneys&apos; fees) arising out of or related to:
          </p>
          <ul>
            <li>Your Content or your use of the Service.</li>
            <li>Your violation of these Terms.</li>
            <li>Your violation of any rights of another person or entity.</li>
          </ul>

          <h2>13. Governing Law and Dispute Resolution</h2>
          <p>
            These Terms shall be governed by and construed in accordance with
            the laws of <strong>India</strong>, without regard to its conflict
            of law provisions.
          </p>
          <p>
            <strong>Informal Resolution:</strong> Before filing a claim, you
            agree to attempt to resolve the dispute informally by contacting us
            at{" "}
            <a href="mailto:connect@scholarbase.app">
              connect@scholarbase.app
            </a>
            . We will attempt to resolve the dispute within 30 days.
          </p>
          <p>
            <strong>Jurisdiction:</strong> Any disputes arising out of or
            relating to these Terms that cannot be resolved informally shall be
            resolved in the courts of{" "}
            <strong>New Delhi, India</strong>. You consent to the personal
            jurisdiction of these courts.
          </p>
          <p>
            <strong>International Users:</strong> If you access the Service from
            outside India, you do so at your own initiative and are responsible
            for compliance with local laws. Nothing in these Terms limits your
            statutory rights under the laws of your country of residence.
          </p>

          <h2>14. Changes to Terms</h2>
          <p>
            We reserve the right to modify these Terms at any time. If we make
            material changes, we will notify you by posting the updated Terms on
            this page and, where appropriate, via email or platform notification.
            Your continued use of the Service after the effective date of the
            changes constitutes your acceptance of the new Terms.
          </p>
          <p>
            We encourage you to review these Terms periodically for any updates.
            The &ldquo;Last updated&rdquo; date at the top of this page
            indicates when these Terms were last revised.
          </p>

          <h2>15. Contact Information</h2>
          <p>
            For any questions, concerns, or notices relating to these Terms,
            please contact us:
          </p>
          <ul>
            <li>
              <strong>Email:</strong>{" "}
              <a href="mailto:connect@scholarbase.app">
                connect@scholarbase.app
              </a>
            </li>
            <li>
              <strong>Address:</strong> ScholarBase, New Delhi, India
            </li>
          </ul>

          <h2>16. Miscellaneous</h2>
          <ul>
            <li>
              <strong>Entire Agreement:</strong> These Terms, together with our
              Privacy Policy, constitute the entire agreement between you and
              ScholarBase regarding your use of the Service.
            </li>
            <li>
              <strong>Severability:</strong> If any provision of these Terms is
              held to be invalid or unenforceable, the remaining provisions will
              remain in full force and effect.
            </li>
            <li>
              <strong>Waiver:</strong> Our failure to enforce any right or
              provision of these Terms will not be considered a waiver of those
              rights.
            </li>
            <li>
              <strong>Assignment:</strong> You may not assign or transfer these
              Terms, by operation of law or otherwise, without our prior written
              consent. We may assign these Terms without restriction.
            </li>
            <li>
              <strong>No Agency:</strong> Nothing in these Terms creates a
              partnership, agency, joint venture, or employment relationship
              between you and ScholarBase.
            </li>
          </ul>

          <p className="mt-12 rounded-2xl border border-blue-200 bg-blue-50 p-6 text-center text-blue-800">
            <strong>Open Source Notice:</strong> ScholarBase is open-source
            software. You can view and contribute to our codebase on our
            repository. The open-source license governs the code itself, while
            these Terms govern your use of the ScholarBase platform as a hosted
            service.
          </p>
        </div>
    </div>
    </div>
  );
}
