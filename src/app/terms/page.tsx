import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | ScholarBase",
  description: "Please read these Terms of Service carefully before using ScholarBase. Your access to and use of the Service is conditioned on your acceptance of and compliance with these Terms.",
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
          <h2>1. Terms</h2>
          <p>
            By accessing the website at https://scholarbase.net, you are agreeing to be bound by these terms of service, all applicable laws and regulations, and agree that you are responsible for compliance with any applicable local laws. If you do not agree with any of these terms, you are prohibited from using or accessing this site. The materials contained in this website are protected by applicable copyright and trademark law.
          </p>

          <h2>2. Use License</h2>
          <p>
            Permission is granted to temporarily download one copy of the materials (information or software) on ScholarBase's website for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:
          </p>
          <ul>
            <li>modify or copy the materials;</li>
            <li>use the materials for any commercial purpose, or for any public display (commercial or non-commercial);</li>
            <li>attempt to decompile or reverse engineer any software contained on ScholarBase's website;</li>
            <li>remove any copyright or other proprietary notations from the materials; or</li>
            <li>transfer the materials to another person or "mirror" the materials on any other server.</li>
          </ul>
          <p>
            This license shall automatically terminate if you violate any of these restrictions and may be terminated by ScholarBase at any time. Upon terminating your viewing of these materials or upon the termination of this license, you must destroy any downloaded materials in your possession whether in electronic or printed format.
          </p>

          <h2>3. Disclaimer</h2>
          <p>
            The materials on ScholarBase's website are provided on an 'as is' basis. ScholarBase makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.
          </p>
          <p>
            Further, ScholarBase does not warrant or make any representations concerning the accuracy, likely results, or reliability of the use of the materials on its website or otherwise relating to such materials or on any sites linked to this site.
          </p>

          <h2>4. Limitations</h2>
          <p>
            In no event shall ScholarBase or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to a a a the materials on ScholarBase's website, even if ScholarBase or a ScholarBase authorized representative has been notified orally or in writing of the possibility of such damage. Because some jurisdictions do not allow limitations on implied warranties, or limitations of liability for consequential or incidental damages, these limitations may not apply to you.
          </p>

          <h2>5. Accuracy of materials</h2>
          <p>
            The materials appearing on ScholarBase's website could include technical, typographical, or photographic errors. ScholarBase does not warrant that any of the materials on its website are accurate, complete or current. ScholarBase may make changes to the materials contained on its website at any time without notice. However ScholarBase does not make any commitment to update the materials.
          </p>

          <h2>6. Links</h2>
          <p>
            ScholarBase has not reviewed all of the sites linked to its website and is not responsible for the contents of any such linked site. The inclusion of any link does not imply endorsement by ScholarBase of the site. Use of any such linked website is at the user's own risk.
          </p>

          <h2>7. Modifications</h2>
          <p>
            ScholarBase may revise these terms of service for its website at any time without notice. By using this website you are agreeing to be bound by the then current version of these terms of service.
          </p>

          <h2>8. Governing Law</h2>
          <p>
            These terms and conditions are governed by and construed in accordance with the laws of [Your Jurisdiction] and you irrevocably submit to the exclusive jurisdiction of the courts in that State or location.
          </p>
        </div>
      </div>
    </div>
  );
}
