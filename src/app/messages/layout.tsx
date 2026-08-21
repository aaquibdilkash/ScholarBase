import { cookies } from "next/headers";
import MessagesClientLayout from "./MessagesClientLayout";

export default async function MessagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Read the cookie on the server before anything renders
  const cookieStore = await cookies();
  const savedPreference = cookieStore.get("sb-conversation-sidebar-open")?.value;
  
  // Default to true (open) if the cookie doesn't exist yet
  const defaultOpen = savedPreference === "false" ? false : true;

  return (
    <MessagesClientLayout defaultOpen={defaultOpen}>
      {children}
    </MessagesClientLayout>
  );
}