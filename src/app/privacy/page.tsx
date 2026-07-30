import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | ScholarBase",
  description: "Understand how ScholarBase handles your data and respects your privacy. Our Privacy Policy details the information we collect, how we use it, and the measures we take to protect it.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-[calc(100vh-8rem)] py-12">
      <div className="mx-auto max-w-4xl px-4">
        <h1 className="sb-heading text-center">Privacy Policy</h1>
        <p className="sb-subtitle mt-4 text-center">
          Last updated: July 29, 2026
        </p>

        <div className="prose prose-lg mx-auto mt-8">
          <p>
            Welcome to ScholarBase. We are committed to protecting your personal information and your right to privacy. If you have any questions or concerns about this privacy notice, or our practices with regards to your personal information, please contact us.
          </p>

          <h2>1. What Information Do We Collect?</h2>
          <p>
            We collect personal information that you voluntarily provide to us when you register on the website, express an interest in obtaining information about us or our products and services, when you participate in activities on the website (such as posting messages in our online forums or entering competitions, contests or giveaways) or otherwise when you contact us.
          </p>
          <p>
            The personal information that we collect depends on the context of your interactions with us and the website, the choices you make and the products and features you use. The personal information we collect may include the following: name, email address, mailing address, phone number, and other similar data.
          </p>

          <h2>2. How Do We Use Your Information?</h2>
          <p>
            We use personal information collected via our website for a variety of business purposes described below. We process your personal information for these purposes in reliance on our legitimate business interests, in order to enter into or perform a contract with you, with your consent, and/or for compliance with our legal obligations.
          </p>
          <ul>
            <li>To facilitate account creation and logon process.</li>
            <li>To post testimonials.</li>
            <li>Request feedback.</li>
            <li>To enable user-to-user communications.</li>
            <li>To manage user accounts.</li>
          </ul>

          <h2>3. Will Your Information Be Shared with Anyone?</h2>
          <p>
            We only share information with your consent, to comply with laws, to provide you with services, to protect your rights, or to fulfill business obligations.
          </p>

          <h2>4. How Do We Keep Your Information Safe?</h2>
          <p>
            We aim to protect your personal information through a system of organizational and technical security measures. We have implemented appropriate technical and organizational security measures designed to protect the security of any personal information we process. However, despite our safeguards and efforts to secure your information, no electronic transmission over the Internet or information storage technology can be guaranteed to be 100% secure, so we cannot promise or guarantee that hackers, cybercriminals, or other unauthorized third parties will not be able to defeat our security, and improperly collect, access, steal, or modify your information.
          </p>

          <h2>5. What Are Your Privacy Rights?</h2>
          <p>
            In some regions (like the European Economic Area), you have certain rights under applicable data protection laws. These may include the right (i) to request access and obtain a copy of your personal information, (ii) to request rectification or erasure; (iii) to restrict the processing of your personal information; and (iv) if applicable, to data portability. In certain circumstances, you may also have the right to object to the processing of your personal information.
          </p>

          <h2>6. How Can You Contact Us About This Policy?</h2>
          <p>
            If you have questions or comments about this policy, you may email us at [Your Contact Email] or by post to: [Your Company Name, Address, City, Postal Code, Country].
          </p>
        </div>
      </div>
    </div>
  );
}
