#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const inputPath = process.argv[2];
const outputPath =
  process.argv[3] ?? "src/data/institutional-email-domains.json";

if (!inputPath) {
  console.error(
    "Usage: node scripts/clean-university-domains.mjs <raw-json> [output-json]",
  );
  process.exit(1);
}

function normalizeDomain(value) {
  let domain = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\.$/, "");

  // Web hosts are commonly copied into university datasets. Remove only the
  // host prefix; for www-ecpm.example.edu this preserves ecpm.example.edu
  // instead of incorrectly broadening it to example.edu.
  domain = domain.replace(/^www\d*\./, "").replace(/^www-/, "");

  const labels = domain.split(".");
  if (
    labels.length < 2 ||
    domain.length > 253 ||
    labels.some(
      (label) =>
        label.length === 0 ||
        label.length > 63 ||
        !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label),
    )
  ) {
    return null;
  }

  const topLevelDomain = labels.at(-1);
  if (
    !topLevelDomain ||
    !/^(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})$/.test(topLevelDomain)
  ) {
    return null;
  }

  return domain;
}

const raw = JSON.parse(fs.readFileSync(inputPath, "utf8"));
if (!Array.isArray(raw)) {
  throw new Error("The source file must contain a JSON array.");
}

const cleanDomains = new Set();
for (const item of raw) {
  if (!Array.isArray(item?.domains)) continue;

  for (const rawDomain of item.domains) {
    const domain = normalizeDomain(rawDomain);
    if (domain) cleanDomains.add(domain);
  }
}

const sortedDomains = [...cleanDomains].sort();
const absoluteOutputPath = path.resolve(outputPath);
fs.mkdirSync(path.dirname(absoluteOutputPath), { recursive: true });
fs.writeFileSync(
  absoluteOutputPath,
  `${JSON.stringify(sortedDomains, null, 2)}\n`,
);

console.log(
  `Cleaned and deduplicated ${sortedDomains.length} institutional domains.`,
);
