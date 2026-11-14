import { headers } from "next/headers";

import { serializeJsonLd } from "@/lib/seo";
import type { JsonLdNode } from "@/lib/schema";

/**
 * Injects one or more structured-data nodes.
 *
 * A server component on purpose: it reads the per-request CSP nonce that
 * `src/proxy.ts` forwards on `x-nonce`. The policy (`script-src` without
 * `'unsafe-inline'`) applies to data blocks too, so a bare JSON-LD tag would be
 * blocked in production — and the failure is silent, because the page still
 * renders and only the markup disappears.
 *
 * Multiple nodes are merged into a single `@graph`. Two separate scripts would
 * also work, but one graph lets the content node and its breadcrumb reference
 * each other instead of describing two unrelated documents.
 */
export async function JsonLd({
  data,
}: {
  data: JsonLdNode | readonly JsonLdNode[];
}) {
  const nodes = Array.isArray(data) ? data : [data];
  if (nodes.length === 0) return null;

  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const payload =
    nodes.length === 1
      ? { "@context": "https://schema.org", ...nodes[0] }
      : { "@context": "https://schema.org", "@graph": nodes };

  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(payload) }}
    />
  );
}
