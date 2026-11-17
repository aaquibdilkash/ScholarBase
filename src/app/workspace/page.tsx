import { redirect } from "next/navigation";

/**
 * `/workspace` is the entry point linked from the account menu, so it lands on
 * the page every author has content on. Editors reach the desk from the nav.
 */
export default function WorkspaceIndexPage() {
  redirect("/workspace/submissions");
}
