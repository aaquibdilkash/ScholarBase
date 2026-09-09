import type { Metadata } from "next";

import { InstitutionDomainRequestForm } from "@/components/auth/InstitutionDomainRequestForm";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";
import { MAX_INSTITUTION_REQUEST_EMAIL } from "@/lib/constants";
import { buildNoindexMetadata } from "@/lib/seo";

export const metadata: Metadata = buildNoindexMetadata(
  "Request Institution Access - ScholarBase",
);

interface RequestInstitutionPageProps {
  searchParams: Promise<{ email?: string }>;
}

export default async function RequestInstitutionPage({
  searchParams,
}: RequestInstitutionPageProps) {
  const { email: rawEmail } = await searchParams;
  const defaultEmail =
    typeof rawEmail === "string"
      ? rawEmail.trim().slice(0, MAX_INSTITUTION_REQUEST_EMAIL)
      : "";

  return (
    <CreateOrEditPageShell
      title="Request institution access"
      description="If your institution or research lab is not in our approved directory, send us its details for review."
      backHref="/login"
      backLabel="← Back to sign in"
      maxWidth="sm"
      className="flex min-h-[calc(100dvh-8rem)] flex-col justify-center"
    >
      <div className="mx-auto w-full max-w-md space-y-6">
        <InstitutionDomainRequestForm
          defaultEmail={defaultEmail}
          showHeader={false}
        />
      </div>
    </CreateOrEditPageShell>
  );
}
