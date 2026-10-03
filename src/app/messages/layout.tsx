import { cookies } from "next/headers";
import MessagesClientLayout from "./MessagesClientLayout";

export default async function MessagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Read the cookie on the server before anything renders. This records the
  // DESKTOP open/closed intent only — the mobile drawer starts closed and is
  // never persisted, so an absent cookie means "expanded on desktop".
  const cookieStore = await cookies();
  const savedPreference = cookieStore.get("sb-conversation-sidebar-open")?.value;
  const defaultOpen = savedPreference !== "false";

  return (
    <MessagesClientLayout defaultOpen={defaultOpen}>
      {children}
    </MessagesClientLayout>
  );
}