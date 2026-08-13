import Link from "next/link";

export function FormCancelButton({ href }: { href: string }) {
  return (
    <Link href={href} className="sb-button-accent">
      Cancel
    </Link>
  );
}
