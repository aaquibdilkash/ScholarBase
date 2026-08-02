import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | ScholarBase",
  description:
    "Understand how ScholarBase handles your data and respects your privacy. Our Privacy Policy details the information we collect, how we use it, and the measures we take to protect it.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-[calc(100vh-8rem)] py-12">
      <div className="mx-auto max-w-4xl px-4">
        <h1 className="sb-heading text-center">Privacy Policy</h1>
        <p className="sb-subtitle mt-4 text-center">
          Last updated: July 29, 2026
        </p>
        <div className="prose prose-lg prose-slate mx-auto mt-8 dark:prose-invert dark:prose-a:text-blue-300 dark:prose-strong:text-slate-100">
          <p>
            Welcome to ScholarBase. We are committed to protecting your personal
            information and your right to privacy. This Privacy Policy explains
            how ScholarBase (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or
            &ldquo;our&rdquo;) collects, uses, discloses, and safeguards your
            information when you visit our website{" "}
            <strong>scholarbase.app</strong> and use our services.
          </p>
          <p>
            ScholarBase is an open-source academic community platform that
            connects scholars, researchers, and academics worldwide. If you have
            any questions or concerns about this policy, please contact us at{" "}
            <strong>connect@scholarbase.app</strong>.
          </p>

          <h2>1. Information We Collect</h2>

          <h3>1.1 Information You Provide to Us</h3>
          <p>We collect personal information that you voluntarily provide:</p>
          <ul>
            <li>
              <strong>Account Information:</strong> When you register, we collect
              your name, email address, and profile information.
            </li>
            <li>
              <strong>Profile Data:</strong> Your academic interests, biography,
              institutional affiliation, research areas, and profile picture.
            </li>
            <li>
              <strong>Content You Post:</strong> Publications, blog posts, feed
              updates, comments, survey responses, event listings, admission
              posts, vacancy listings, and any other content you submit.
            </li>
            <li>
              <strong>Communications:</strong> When you contact us, we collect
              your message and contact details.
            </li>
          </ul>

          <h3>1.2 Information Collected via Google OAuth</h3>
          <p>
            When you sign in using Google OAuth, we collect the following
            information from your Google account:
          </p>
          <ul>
            <li>
              <strong>Email Address:</strong> Used to identify your account and
              send service-related communications.
            </li>
            <li>
              <strong>Profile Information:</strong> Your name and Google profile
              picture, used to populate your ScholarBase profile.
            </li>
          </ul>
          <p>
            <strong>Limited Use Disclosure:</strong> ScholarBase&apos;s use and
            transfer of information received from Google APIs to any other app
            will adhere to the{" "}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements. We only access the minimum
            Google data necessary to provide authentication and will not use this
            data for any other purpose without your explicit consent.
          </p>

          <h3>1.3 Information Collected Automatically</h3>
          <ul>
            <li>
              <strong>Log Data:</strong> IP address, browser type, operating
              system, referring URLs, and pages visited.
            </li>
            <li>
              <strong>Usage Data:</strong> Your interactions with the platform,
              including content views, likes, follows, and saves.
            </li>
            <li>
              <strong>Device Information:</strong> Device type and screen
              resolution for optimal display.
            </li>
          </ul>

          <h2>2. How We Use Your Information</h2>
          <p>We use your personal information for the following purposes:</p>
          <ul>
            <li>
              <strong>To Provide and Maintain Our Service:</strong> Create and
              manage your account, authenticate your identity, and enable you to
              post content and interact with the community.
            </li>
            <li>
              <strong>To Improve Our Platform:</strong> Analyze usage patterns to
              enhance user experience, develop new features, and optimize
              performance.
            </li>
            <li>
              <strong>To Communicate With You:</strong> Send service
              notifications, respond to inquiries, and provide support.
            </li>
            <li>
              <strong>To Moderate Content:</strong> Review content for compliance
              with our Terms of Service and applicable laws.
            </li>
            <li>
              <strong>To Ensure Security:</strong> Detect and prevent fraudulent,
              unauthorized, or illegal activity.
            </li>
          </ul>

          <h2>3. Legal Bases for Processing (EEA and UK Users)</h2>
          <p>
            If you are located in the European Economic Area (EEA) or the United
            Kingdom, we process your personal information under the following
            legal bases:
          </p>
          <ul>
            <li>
              <strong>Consent:</strong> For optional data processing activities
              like profile creation and content posting.
            </li>
            <li>
              <strong>Contractual Necessity:</strong> To provide our services and
              fulfill our obligations under our Terms of Service.
            </li>
            <li>
              <strong>Legitimate Interests:</strong> To improve our platform,
              ensure security, and prevent fraud.
            </li>
            <li>
              <strong>Legal Obligation:</strong> To comply with applicable laws
              and regulations.
            </li>
          </ul>

          <h2>4. How We Share Your Information</h2>
          <p>
            We do not sell your personal information. We may share your data in
            the following circumstances:
          </p>
          <ul>
            <li>
              <strong>With Your Consent:</strong> When you explicitly authorize
              sharing.
            </li>
            <li>
              <strong>Service Providers:</strong> With third-party services that
              help us operate the platform, including:
              <ul>
                <li>
                  <strong>Supabase</strong> &mdash; Authentication, database, and
                  file storage
                </li>
                <li>
                  <strong>Cloudinary</strong> &mdash; Image and media hosting
                </li>
                <li>
                  <strong>Vercel</strong> &mdash; Hosting and infrastructure
                </li>
                <li>
                  <strong>Google</strong> &mdash; OAuth authentication services
                </li>
              </ul>
            </li>
            <li>
              <strong>Legal Compliance:</strong> When required by law, court
              order, or governmental regulation.
            </li>
            <li>
              <strong>Protection of Rights:</strong> To enforce our Terms of
              Service, protect our rights, privacy, safety, or property.
            </li>
          </ul>

          <h2>5. Data Retention</h2>
          <p>
            We retain your personal information for as long as your account is
            active or as needed to provide you services. When you delete your
            account, we will delete or anonymize your personal information within
            30 days, except where we are required to retain certain data for
            legal compliance (e.g., tax records, legal disputes).
          </p>
          <p>
            Public content you posted (publications, blog posts, comments) may
            remain visible even after account deletion, though it will be
            anonymized (attributed to &ldquo;Deleted User&rdquo;). You can
            request complete removal of your content by contacting us.
          </p>

          <h2>6. Data Security</h2>
          <p>
            We implement appropriate technical and organizational security
            measures to protect your personal information, including:
          </p>
          <ul>
            <li>Encryption of data in transit (TLS/SSL) and at rest</li>
            <li>Secure authentication via Supabase/Google OAuth</li>
            <li>Regular security assessments and updates</li>
            <li>Restricted access to personal data on a need-to-know basis</li>
          </ul>
          <p>
            However, no method of transmission over the Internet is 100%
            secure. We cannot guarantee absolute security.
          </p>

          <h2>7. Your Rights</h2>

          <h3>7.1 For All Users</h3>
          <ul>
            <li>
              <strong>Access:</strong> Request a copy of the personal data we
              hold about you.
            </li>
            <li>
              <strong>Correction:</strong> Update or correct inaccurate
              information through your account settings or by contacting us.
            </li>
            <li>
              <strong>Deletion:</strong> Request deletion of your account and
              associated data.
            </li>
            <li>
              <strong>Data Portability:</strong> Request a machine-readable copy
              of your data.
            </li>
          </ul>

          <h3>7.2 For EEA/UK Users (GDPR)</h3>
          <p>
            In addition to the above, you have the right to:
          </p>
          <ul>
            <li>
              <strong>Restrict Processing:</strong> Request that we limit
              processing of your data.
            </li>
            <li>
              <strong>Object to Processing:</strong> Object to processing based
              on legitimate interests.
            </li>
            <li>
              <strong>Withdraw Consent:</strong> Withdraw consent at any time
              where processing is based on consent.
            </li>
          </ul>
          <p>
            You may lodge a complaint with your local data protection
            authority. Contact details for EU data protection authorities are
            available at{" "}
            <a
              href="https://edpb.europa.eu/about-edpb/about-edpb/members_en"
              target="_blank"
              rel="noopener noreferrer"
            >
              edpb.europa.eu
            </a>
            .
          </p>

          <h3>7.3 For California Residents (CCPA)</h3>
          <p>
            If you are a California resident, you have the right to:
          </p>
          <ul>
            <li>
              <strong>Know:</strong> Request disclosure of the categories and
              specific pieces of personal information we collect.
            </li>
            <li>
              <strong>Delete:</strong> Request deletion of personal information
              collected from you.
            </li>
            <li>
              <strong>Non-Discrimination:</strong> Not be discriminated against
              for exercising your CCPA rights.
            </li>
          </ul>
          <p>
            ScholarBase does not sell your personal information. To exercise
            your CCPA rights, contact us at{" "}
            <strong>connect@scholarbase.app</strong>.
          </p>

          <h3>7.4 For Indian Users (Digital Personal Data Protection Act)</h3>
          <p>
            Under India&apos;s Digital Personal Data Protection Act, 2023, you
            have the right to:
          </p>
          <ul>
            <li>
              <strong>Notice:</strong> Be informed about the purpose of data
              collection and processing.
            </li>
            <li>
              <strong>Access and Correction:</strong> Access and update your
              personal data.
            </li>
            <li>
              <strong>Grievance Redressal:</strong> File complaints regarding
              data processing. We will respond within 30 days.
            </li>
          </ul>

          <h2>8. Cookies and Tracking Technologies</h2>
          <p>
            We use essential cookies for authentication and security purposes.
            These cookies are necessary for the platform to function. We do not
            use third-party tracking cookies for advertising. You can control
            cookie settings through your browser preferences.
          </p>

          <h2>9. International Data Transfers</h2>
          <p>
            Your information may be transferred to and processed in countries
            other than your own. Our infrastructure is hosted globally via
            Vercel (US/EU regions) and data may be processed in the United
            States, India, and European Union. We ensure appropriate safeguards
            are in place for international transfers, including Standard
            Contractual Clauses (SCCs) where required.
          </p>

          <h2>10. Children&apos;s Privacy</h2>
          <p>
            Our service is not directed to individuals under the age of 13. We
            do not knowingly collect personal information from children under
            13. If we become aware that a child under 13 has provided us with
            personal information, we will delete it. In compliance with Google
            OAuth requirements, users must be at least 13 years old to use
            Google sign-in.
          </p>

          <h2>11. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify
            you of material changes by posting the updated policy on this page
            and, where appropriate, via email or platform notification. We
            encourage you to review this policy periodically.
          </p>

          <h2>12. Contact Information</h2>
          <p>
            If you have any questions, concerns, or requests regarding this
            Privacy Policy or our data practices, please contact us:
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
          <p>
            For data protection inquiries, you may reach our Data Protection
            Officer at{" "}
            <a href="mailto:connect@scholarbase.app">
              connect@scholarbase.app
            </a>
            . We will respond to your request within 30 days.
          </p>

          <h2>13. Google API Services User Data Policy</h2>
          <p>
            ScholarBase complies with the{" "}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google API Services User Data Policy
            </a>
            . Our use of Google user data is limited to:
          </p>
          <ul>
            <li>Authentication and account creation</li>
            <li>
              Displaying your profile information on your ScholarBase profile
            </li>
          </ul>
          <p>
            We do not use Google user data for advertising or any commercial
            purposes beyond providing our academic community platform. We do not
            transfer Google user data to any third parties except as necessary
            to provide and secure the platform (e.g., storing your profile data
            in our database) or as required by law.
          </p>
        </div>
    </div>
    </div>
  );
}
