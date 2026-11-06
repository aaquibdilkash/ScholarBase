/**
 * Signup domain policy.
 *
 * Keep these lists lowercase. The email normalizer already lowercases the
 * domain before this module is called. Exact institution domains come from
 * the directory below. Regulated academic suffixes are kept separately for
 * institutions that are valid but missing from the directory.
 *
 * Approved institution domains are also loaded from the database
 * (`InstitutionDomain` table) so an admin can approve a new domain without a
 * redeploy. The DB-backed set is cached in memory and invalidated whenever an
 * admin approves, rejects, or deactivates a domain.
 */
import universityDomains from "../data/institutional-email-domains.json" with {
  type: "json",
};

import prisma from "@/lib/db";

export const FAMOUS_EMAIL_PLATFORM_DOMAINS = new Set([
  "aol.com",
  "aol.ca",
  "aol.co.uk",
  "aol.de",
  "aol.fr",
  "daum.net",
  "fastmail.ca",
  "fastmail.co.uk",
  "fastmail.fm",
  "fastmail.to",
  "fastmail.com",
  "gmail.com",
  "googlemail.com",
  "gmx.at",
  "gmx.ch",
  "gmx.com",
  "gmx.de",
  "gmx.net",
  "gmx.us",
  "hotmail.com",
  "hotmail.co.uk",
  "hotmail.de",
  "hotmail.fr",
  "hotmail.it",
  "hotmail.es",
  "icloud.com",
  "inbox.ru",
  "126.com",
  "163.com",
  "yeah.net",
  "live.com",
  "live.co.uk",
  "live.de",
  "live.fr",
  "live.nl",
  "mail.com",
  "mail.ru",
  "me.com",
  "mac.com",
  "msn.com",
  "naver.com",
  "outlook.com",
  "outlook.co.uk",
  "outlook.de",
  "outlook.fr",
  "outlook.jp",
  "pm.me",
  "proton.me",
  "protonmail.ch",
  "protonmail.com",
  "qq.com",
  "rediffmail.com",
  "rocketmail.com",
  "sina.com",
  "sohu.com",
  "tuta.com",
  "tuta.io",
  "tutanota.com",
  "web.de",
  "ymail.com",
  "yahoo.com",
  "yahoo.ca",
  "yahoo.co.jp",
  "yahoo.co.uk",
  "yahoo.com.au",
  "yahoo.com.br",
  "yahoo.com.hk",
  "yahoo.com.mx",
  "yahoo.com.sg",
  "yahoo.com.tw",
  "yahoo.de",
  "yahoo.es",
  "yahoo.fr",
  "yahoo.in",
  "yahoo.it",
  "yandex.com",
  "yandex.ru",
  "zoho.com",
  "zohomail.com",
]);

export const INSTITUTIONAL_EMAIL_DOMAINS = new Set([
  // Reviewed institution domains.
  "berkeley.edu",
  "cam.ac.uk",
  "cornell.edu",
  "ethz.ch",
  "harvard.edu",
  "iitb.ac.in",
  "iitd.ac.in",
  "iitm.ac.in",
  "imperial.ac.uk",
  "jmi.ac.in",
  "mit.edu",
  "ox.ac.uk",
  "princeton.edu",
  "stanford.edu",
  "tum.de",
  "u-tokyo.ac.jp",
  "yale.edu",

  // Curated university and college domains from the MIT-licensed Hipo list.
  ...universityDomains,
]);

/**
 * Academic namespaces with registry-level eligibility controls. These rules
 * intentionally accept any delegated domain below the suffix, but never the
 * bare suffix itself (for example, `othercollege.ac.in` passes while
 * `ac.in` does not). Directory entries remain the preferred source for
 * country-code domains such as `tum.de` or `ethz.ch`.
 */
const REGULATED_INSTITUTIONAL_SUFFIXES = new Set([
  "ac.ae",
  "ac.id",
  "ac.in",
  "ac.jp",
  "ac.kr",
  "ac.nz",
  "ac.uk",
  "ac.za",
  "edu",
  "edu.ae",
  "edu.am",
  "edu.ar",
  "edu.au",
  "edu.az",
  "edu.bd",
  "edu.bh",
  "edu.bo",
  "edu.br",
  "edu.cn",
  "edu.co",
  "edu.cr",
  "edu.do",
  "edu.eg",
  "edu.ge",
  "edu.gr",
  "edu.hk",
  "edu.hn",
  "edu.in",
  "edu.jo",
  "edu.kh",
  "edu.kz",
  "edu.lb",
  "edu.my",
  "edu.ng",
  "edu.np",
  "edu.om",
  "edu.pa",
  "edu.pe",
  "edu.ph",
  "edu.pk",
  "edu.qa",
  "edu.sa",
  "edu.sg",
  "edu.tr",
  "edu.tw",
  "edu.za",
  "edu.zm",
  "edu.zw",
  "res.in",
]);

function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/\.$/, "");
}

function matchesInstitutionalDomain(domain: string): boolean {
  if (INSTITUTIONAL_EMAIL_DOMAINS.has(domain)) return true;

  for (const suffix of REGULATED_INSTITUTIONAL_SUFFIXES) {
    if (domain.endsWith(`.${suffix}`)) return true;
  }

  return false;
}

export function getEmailDomain(email: string): string {
  const atIndex = email.lastIndexOf("@");
  return atIndex > 0 ? normalizeDomain(email.slice(atIndex + 1)) : "";
}

/**
 * DB-backed cache of approved institution domains.
 *
 * Populated lazily on first use and invalidated via `invalidateApprovedDomainsCache`
 * when an admin approves/rejects/deactivates a domain.
 */
let approvedDomainsCache: Set<string> | null = null;
let approvedDomainsLoaded = false;

async function loadApprovedDomainsFromDB(): Promise<Set<string>> {
  if (approvedDomainsLoaded && approvedDomainsCache) {
    return approvedDomainsCache;
  }

  const rows = await prisma.institutionDomain.findMany({
    where: { isActive: true },
    select: { domain: true },
  });

  const set = new Set(rows.map((row) => normalizeDomain(row.domain)));
  approvedDomainsCache = set;
  approvedDomainsLoaded = true;
  return set;
}

/** Clears the DB-backed domain cache so the next check re-queries the DB. */
export function invalidateApprovedDomainsCache(): void {
  approvedDomainsCache = null;
  approvedDomainsLoaded = false;
}

export function isAllowedEmailDomain(emailOrDomain: string): boolean {
  const value = emailOrDomain.includes("@")
    ? getEmailDomain(emailOrDomain)
    : normalizeDomain(emailOrDomain);

  return (
    value.length > 0 &&
    (FAMOUS_EMAIL_PLATFORM_DOMAINS.has(value) ||
      matchesInstitutionalDomain(value))
  );
}

export function isInstitutionalEmailDomain(emailOrDomain: string): boolean {
  const domain = emailOrDomain.includes("@")
    ? getEmailDomain(emailOrDomain)
    : normalizeDomain(emailOrDomain);

  return domain.length > 0 && matchesInstitutionalDomain(domain);
}

/**
 * Async variant of `isAllowedEmailDomain` that also checks the DB-backed
 * table of admin-approved institution domains. All call sites are already in
 * async contexts (auth callbacks, server actions, profile ensure), so making
 * this async adds no new boundary.
 */
export async function isAllowedEmailDomainAsync(
  emailOrDomain: string,
): Promise<boolean> {
  const value = emailOrDomain.includes("@")
    ? getEmailDomain(emailOrDomain)
    : normalizeDomain(emailOrDomain);

  if (value.length === 0) return false;
  if (FAMOUS_EMAIL_PLATFORM_DOMAINS.has(value)) return true;
  if (matchesInstitutionalDomain(value)) return true;

  const approved = await loadApprovedDomainsFromDB();
  return approved.has(value);
}

/**
 * Async variant of `isInstitutionalEmailDomain` that also checks the DB-backed
 * table of admin-approved institution domains.
 */
export async function isInstitutionalEmailDomainAsync(
  emailOrDomain: string,
): Promise<boolean> {
  const domain = emailOrDomain.includes("@")
    ? getEmailDomain(emailOrDomain)
    : normalizeDomain(emailOrDomain);

  if (domain.length === 0) return false;
  if (matchesInstitutionalDomain(domain)) return true;

  const approved = await loadApprovedDomainsFromDB();
  return approved.has(domain);
}
