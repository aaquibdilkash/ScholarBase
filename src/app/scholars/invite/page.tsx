import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Invite Scholar",
  description:
    "Invite a scholar to join ScholarBase and collaborate on research.",
  robots: { index: false, follow: true },
};

export default function InviteScholarPage() {
  redirect("/scholars");
}
